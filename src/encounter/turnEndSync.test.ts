import { describe, expect, it } from "vitest";
import { createFakeScene, flush } from "../obr/fakeScene";
import { makeToken } from "../test/tokens";
import { DEFAULT_META, META_KEY } from "../components/metadata";
import { ROOM_META_KEY } from "../settings/settings";
import { createEncounterStore, SCENE_META_KEY } from "./store";
import { startTurnEndSync } from "./turnEndSync";

const combatant = (id: string, owner: string, fields: Record<string, unknown> = {}) =>
    makeToken({ id, owner, metadata: { [META_KEY]: { ...DEFAULT_META, name: id, visible: true, ...fields } } });

function room(tokens: ReturnType<typeof makeToken>[], turnBar = true) {
    return createFakeScene({
        items: tokens,
        sceneMetadata: { [SCENE_META_KEY]: { started: true, round: 1 } },
        roomMetadata: { [ROOM_META_KEY]: { turnBar } },
    });
}

/** A client with its own store, subscribed like an open tracker. */
function client(scene: ReturnType<typeof room>, role: "GM" | "PLAYER", playerId: string) {
    const port = scene.connect(role, playerId);
    const store = createEncounterStore(port);
    store.subscribe(() => {});
    return { port, store };
}

const activeIds = (scene: ReturnType<typeof room>) =>
    scene.peek().items.filter((i) => (i.metadata[META_KEY] as { active: boolean }).active).map((i) => i.id);

describe("turn end sync", () => {
    it("advances when the player ends their combatant's turn", async () => {
        const scene = room([combatant("pc", "alice", { initiative: 20, active: true }), combatant("npc", "gm", { initiative: 10 })]);
        const gm = client(scene, "GM", "gm");
        const alice = client(scene, "PLAYER", "alice");
        startTurnEndSync(gm.port, gm.store);
        await flush();

        await alice.store.setTurnResources("pc", { ended: true });
        await flush();
        await flush();

        expect(activeIds(scene)).toEqual(["npc"]);
    });

    it("stays on the turn, fresh, when the GM steps back to it after the player ended it", async () => {
        const scene = room([combatant("pc", "alice", { initiative: 20, active: true }), combatant("npc", "gm", { initiative: 10 })]);
        const gm = client(scene, "GM", "gm");
        const alice = client(scene, "PLAYER", "alice");
        startTurnEndSync(gm.port, gm.store);
        await flush();

        await alice.store.setTurnResources("pc", { ended: true, actionUsed: true });
        await flush();
        await flush();
        expect(activeIds(scene)).toEqual(["npc"]);

        await gm.store.prev();
        await flush();
        await flush();
        expect(activeIds(scene)).toEqual(["pc"]);
        expect(alice.store.getState().combatants.find((c) => c.id === "pc")?.turnResources ?? null).toBeNull();
    });

    it("clears a combatant's turn resources when its turn starts, including an off-turn reaction", async () => {
        const scene = room([combatant("npc", "gm", { initiative: 20, active: true }), combatant("pc", "alice", { initiative: 10 })]);
        const gm = client(scene, "GM", "gm");
        const alice = client(scene, "PLAYER", "alice");
        await flush();

        await alice.store.setTurnResources("pc", { reactionUsed: true });
        await flush();
        expect(alice.store.getState().combatants.find((c) => c.id === "pc")?.turnResources).toMatchObject({ reactionUsed: true });

        await gm.store.next();
        await flush();
        expect(alice.store.getState().combatants.find((c) => c.id === "pc")?.turnResources ?? null).toBeNull();
    });

    it("starts a new encounter with every turn resource fresh", async () => {
        const scene = room([combatant("pc", "alice", { initiative: 20, active: true }), combatant("npc", "gm", { initiative: 10 })]);
        const gm = client(scene, "GM", "gm");
        const alice = client(scene, "PLAYER", "alice");
        await flush();
        const resources = () => alice.store.getState().combatants.find((c) => c.id === "pc")?.turnResources ?? null;

        await alice.store.setTurnResources("pc", { actionUsed: true, reactionUsed: true, movementUsed: 4 });
        await flush();
        expect(resources()).toMatchObject({ actionUsed: true });

        await gm.store.end();
        await flush();
        expect(resources()).toBeNull();

        await alice.store.setTurnResources("pc", { reactionUsed: true });
        await gm.store.start();
        await flush();
        expect(resources()).toBeNull();
    });

    it("gives a token re-added after an earlier encounter fresh turn resources", async () => {
        const scene = room([
            combatant("pc", "alice", { initiative: 20, inInitiative: false, turnResources: { actionUsed: true, bonusActionUsed: false, reactionUsed: true, movementUsed: 3, ended: false } }),
            combatant("npc", "gm", { initiative: 10, active: true }),
        ]);
        const gm = client(scene, "GM", "gm");
        await flush();

        await gm.store.add(["pc"]);
        await flush();

        expect(gm.store.getState().combatants.find((c) => c.id === "pc")?.turnResources).toBeNull();
    });

    it("advances only once even with two GMs connected", async () => {
        const scene = room([
            combatant("pc", "alice", { initiative: 20, active: true }),
            combatant("npc", "gm", { initiative: 10 }),
            combatant("npc2", "gm", { initiative: 5 }),
        ]);
        const gm1 = client(scene, "GM", "gm");
        const gm2 = client(scene, "GM", "gm2");
        const alice = client(scene, "PLAYER", "alice");
        startTurnEndSync(gm1.port, gm1.store);
        startTurnEndSync(gm2.port, gm2.store);
        await flush();

        await alice.store.setTurnResources("pc", { ended: true });
        for (let i = 0; i < 4; i++) await flush();

        expect(activeIds(scene)).toEqual(["npc"]);
    });

    it("waits for every connected owner in a group, and goes once the last one leaves", async () => {
        const member = (id: string, owner: string, groupIndex: number) =>
            combatant(id, owner, { initiative: 20, active: true, groupId: "g", groupName: "Party", groupIndex });
        const scene = room([member("a", "alice", 0), member("b", "bob", 1), combatant("npc", "gm", { initiative: 10 })]);
        const gm = client(scene, "GM", "gm");
        const alice = client(scene, "PLAYER", "alice");
        const bob = client(scene, "PLAYER", "bob");
        startTurnEndSync(gm.port, gm.store);
        await flush();

        await alice.store.setTurnResources("a", { ended: true });
        await flush();
        await flush();
        expect(activeIds(scene)).toEqual(["a", "b"]);

        scene.disconnect(bob.port);
        await flush();
        await flush();
        expect(activeIds(scene)).toEqual(["npc"]);
    });

    it("does nothing while the turn bar setting is off", async () => {
        const scene = room([combatant("pc", "alice", { initiative: 20, active: true }), combatant("npc", "gm", { initiative: 10 })], false);
        const gm = client(scene, "GM", "gm");
        const alice = client(scene, "PLAYER", "alice");
        startTurnEndSync(gm.port, gm.store);
        await flush();

        await alice.store.setTurnResources("pc", { ended: true });
        await flush();
        await flush();

        expect(activeIds(scene)).toEqual(["pc"]);
    });

    it("off-turn, records only the reaction", async () => {
        const scene = room([combatant("npc", "gm", { initiative: 20, active: true }), combatant("pc", "alice", { initiative: 10 })]);
        const alice = client(scene, "PLAYER", "alice");
        await flush();

        await alice.store.setTurnResources("pc", { ended: true, actionUsed: true, bonusActionUsed: true, movementUsed: 2, reactionUsed: true });
        await flush();

        expect(alice.store.getState().combatants.find((c) => c.id === "pc")?.turnResources)
            .toMatchObject({ ended: false, actionUsed: false, bonusActionUsed: false, movementUsed: 0, reactionUsed: true });
    });
});
