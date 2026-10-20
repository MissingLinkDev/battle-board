import { describe, expect, it } from "vitest";
import { createFakeScene, flush } from "../obr/fakeScene";
import { makeToken } from "../test/tokens";
import { DEFAULT_META, META_KEY } from "../components/metadata";
import { createEncounterStore, ITEM_ADDED_CHANNEL, SCENE_META_KEY } from "./store";

/** Saved data as an older version of the extension would have written it. */
function saved(fields: Record<string, unknown> = {}) {
    return { [META_KEY]: { ...DEFAULT_META, name: "saved", visible: true, ...fields } };
}

async function setup(tokens: ReturnType<typeof makeToken>[], sceneMetadata: Record<string, unknown> = {}) {
    const scene = createFakeScene({ items: tokens, sceneMetadata });
    const port = scene.connect("GM");
    const store = createEncounterStore(port);
    store.subscribe(() => {});
    await flush();
    return { scene, port, store, meta: (id: string) => scene.peek().items.find((i) => i.id === id)!.metadata[META_KEY] as Record<string, unknown> };
}

describe("encounter store", () => {
    describe("add", () => {
        it("gives a new token default stats and announces it to statblock extensions", async () => {
            const { store, port } = await setup([makeToken({ id: "a", name: "Goblin" })]);
            const announced: unknown[] = [];
            port.broadcast.onMessage(ITEM_ADDED_CHANNEL, (id) => announced.push(id));

            await store.add(["a"]);
            await flush();

            const [c] = store.getState().combatants;
            expect(c).toMatchObject({ id: "a", name: "Goblin", ac: 10, maxHP: 10, active: false });
            expect(announced).toEqual(["a"]);
        });

        it("keeps a prepped token's saved stats", async () => {
            const { store } = await setup([makeToken({ id: "a", metadata: saved({ inInitiative: false, maxHP: 45, currentHP: 30, ac: 17 }) })]);
            await store.add(["a"]);
            await flush();
            expect(store.getState().combatants[0]).toMatchObject({ maxHP: 45, currentHP: 30, ac: 17 });
        });

        it("rejoins a group that still has combatants at its current initiative, last in member order", async () => {
            const { store, meta } = await setup([
                makeToken({ id: "m0", metadata: saved({ groupId: "g", groupName: "Wolves", initiative: 18, groupIndex: 0 }) }),
                makeToken({ id: "m1", metadata: saved({ groupId: "g", groupName: "Wolves", initiative: 18, groupIndex: 1 }) }),
                makeToken({ id: "back", metadata: saved({ inInitiative: false, groupId: "g", groupName: "Wolves", initiative: 9, groupIndex: 0 }) }),
            ]);
            await store.add(["back"]);
            await flush();
            expect(meta("back")).toMatchObject({ inInitiative: true, groupId: "g", initiative: 18, groupIndex: 2 });
            expect(store.getState().groups[0].memberIds).toEqual(["m0", "m1", "back"]);
        });

        it("brings back an empty group exactly as saved", async () => {
            const { store } = await setup([
                makeToken({ id: "a", metadata: saved({ inInitiative: false, groupId: "g", groupName: "Ambush", groupStaged: true, initiative: 14 }) }),
            ]);
            await store.add(["a"]);
            await flush();
            expect(store.getState().groups).toEqual([
                expect.objectContaining({ id: "g", name: "Ambush", staged: true, initiative: 14, memberIds: ["a"] }),
            ]);
        });

        it("solo drops saved group membership", async () => {
            const { store, meta } = await setup([
                makeToken({ id: "a", metadata: saved({ inInitiative: false, groupId: "g", groupName: "Ambush", groupStaged: true }) }),
            ]);
            await store.add(["a"], { solo: true });
            await flush();
            expect(meta("a")).toMatchObject({ groupId: null, groupName: null, groupStaged: false });
            expect(store.getState().groups).toEqual([]);
        });
    });

    describe("remove", () => {
        it("keeps every saved field, so adding again restores the combatant exactly", async () => {
            const { store, meta } = await setup([
                makeToken({ id: "a", metadata: saved({ initiative: 15, currentHP: 3, groupId: "g", groupName: "Pack", active: true }) }),
            ]);
            const before = { ...meta("a") };

            await store.remove(["a"]);
            await flush();
            expect(store.getState().combatants).toEqual([]);
            expect(meta("a")).toEqual({ ...before, inInitiative: false, active: false });

            await store.add(["a"]);
            await flush();
            expect(store.getState().combatants[0]).toMatchObject({ initiative: 15, currentHP: 3, groupId: "g", groupName: "Pack" });
        });
    });

    describe("clearAll", () => {
        it("removes every combatant, keeps their stats and ends the encounter", async () => {
            const { store, meta, scene } = await setup(
                [makeToken({ id: "a", metadata: saved({ maxHP: 40 }) }), makeToken({ id: "b", metadata: saved() })],
                { [SCENE_META_KEY]: { started: true, round: 4 } },
            );
            await store.clearAll();
            await flush();
            expect(store.getState()).toMatchObject({ combatants: [], started: false, round: 0 });
            expect(meta("a")).toMatchObject({ inInitiative: false, maxHP: 40 });
            expect(scene.peek().sceneMetadata[SCENE_META_KEY]).toEqual({ started: false, round: 0 });
        });
    });

    describe("concurrent edits (two clients, one scene)", () => {
        it("keeps both clients' edits to different fields of one combatant", async () => {
            const scene = createFakeScene({ items: [makeToken({ id: "pc", metadata: saved({ playerCharacter: true }) })] });
            const gm = createEncounterStore(scene.connect("GM"));
            const player = createEncounterStore(scene.connect("PLAYER"));
            gm.subscribe(() => {});
            player.subscribe(() => {});
            await flush();

            await Promise.all([gm.patch("pc", { ac: 18 }), player.patch("pc", { currentHP: 4 })]);
            await flush();

            for (const s of [gm, player]) expect(s.getState().combatants[0]).toMatchObject({ ac: 18, currentHP: 4 });
        });
    });

    describe("groups", () => {
        it("numbers members past nine without colliding (15, 15.1 … 15.10)", async () => {
            const ids = Array.from({ length: 11 }, (_, i) => `t${i}`);
            const { store, meta } = await setup(ids.map((id) => makeToken({ id })));
            await store.addToGroup(ids, { newGroup: { name: "Swarm", staged: false, initiative: 15 } }, { hideWhenStaged: true });
            await flush();

            const [group] = store.getState().groups;
            expect(group).toMatchObject({ name: "Swarm", initiative: 15 });
            expect(group.memberIds).toEqual(ids);
            expect(ids.map((id) => meta(id).initiative)).toEqual(ids.map(() => 15));
            expect(ids.map((id) => meta(id).groupIndex)).toEqual(ids.map((_, i) => i));
        });

        it("reads member order from the initiative decimal in older saves", async () => {
            const { store } = await setup([
                makeToken({ id: "third", metadata: saved({ groupId: "g", initiative: 12.2 }) }),
                makeToken({ id: "first", metadata: saved({ groupId: "g", initiative: 12 }) }),
                makeToken({ id: "second", metadata: saved({ groupId: "g", initiative: 12.1 }) }),
            ]);
            expect(store.getState().groups[0]).toMatchObject({ initiative: 12, memberIds: ["first", "second", "third"] });
        });

        it("keeps the old decimal order when the group's initiative changes", async () => {
            const { store, meta } = await setup([
                makeToken({ id: "second", metadata: saved({ groupId: "g", initiative: 12.1 }) }),
                makeToken({ id: "first", metadata: saved({ groupId: "g", initiative: 12 }) }),
            ]);
            await store.setGroupInitiative("g", 20);
            await flush();
            expect(meta("first")).toMatchObject({ initiative: 20, groupIndex: 0 });
            expect(meta("second")).toMatchObject({ initiative: 20, groupIndex: 1 });
            expect(store.getState().groups[0].memberIds).toEqual(["first", "second"]);
        });

        it("reads the oldest saves' encounterGroups as the token's group", async () => {
            const { store } = await setup([makeToken({ id: "a", metadata: saved({ encounterGroups: ["legacy"], groupId: undefined }) })]);
            expect(store.getState().combatants[0].groupId).toBe("legacy");
        });

        it("leaving a group does not fall back to the legacy encounterGroups", async () => {
            const { store } = await setup([makeToken({ id: "a", metadata: saved({ encounterGroups: ["legacy"], groupId: undefined }) })]);
            await store.leaveGroup(["a"], { showIfWasStaged: true });
            await flush();
            expect(store.getState().combatants[0].groupId).toBeNull();
        });

        it("staging hides members and takes the turn away, in one write", async () => {
            const { store, scene } = await setup([
                makeToken({ id: "a", metadata: saved({ groupId: "g", active: true }) }),
                makeToken({ id: "b", metadata: saved({ groupId: "g", active: true }) }),
            ]);
            const writesBefore = scene.writes.length;
            await store.setGroupStaged("g", true, { controlVisibility: true });
            await flush();

            expect(scene.writes.length - writesBefore).toBe(1);
            expect(store.getState().groups[0]).toMatchObject({ staged: true, active: false });
            expect(store.getState().combatants.map((c) => c.visible)).toEqual([false, false]);
        });

        it("a token leaving a staged group is shown again", async () => {
            const { store } = await setup([makeToken({ id: "a", visible: false, metadata: saved({ groupId: "g", groupStaged: true }) })]);
            await store.leaveGroup(["a"], { showIfWasStaged: true });
            await flush();
            expect(store.getState().combatants[0]).toMatchObject({ visible: true, groupId: null });
        });

        it("ungrouping the active group leaves the turn with its first member", async () => {
            const { store } = await setup([
                makeToken({ id: "b", metadata: saved({ groupId: "g", groupIndex: 1, active: true }) }),
                makeToken({ id: "a", metadata: saved({ groupId: "g", groupIndex: 0, active: true }) }),
            ]);
            await store.ungroup("g");
            await flush();
            const byId = Object.fromEntries(store.getState().combatants.map((c) => [c.id, c]));
            expect(byId.a).toMatchObject({ active: true, groupId: null });
            expect(byId.b).toMatchObject({ active: false, groupId: null });
            expect(store.getState().groups).toEqual([]);
        });

        it("adding to a staged group hides the token when staging controls visibility", async () => {
            const { store } = await setup([
                makeToken({ id: "m", metadata: saved({ groupId: "g", groupName: "Reserve", groupStaged: true }) }),
                makeToken({ id: "new" }),
            ]);
            await store.addToGroup(["new"], { groupId: "g" }, { hideWhenStaged: true });
            await flush();
            const added = store.getState().combatants.find((c) => c.id === "new")!;
            expect(added).toMatchObject({ groupId: "g", groupName: "Reserve", groupStaged: true, visible: false });
        });
    });

    describe("turn state", () => {
        it("setActive changes only the combatants whose flag differs, in one write", async () => {
            const { store, scene } = await setup([
                makeToken({ id: "a", metadata: saved({ active: true }) }),
                makeToken({ id: "b", metadata: saved() }),
                makeToken({ id: "c", metadata: saved() }),
            ]);
            const writesBefore = scene.writes.length;
            await store.setActive(["b"]);
            await flush();
            expect(scene.writes.slice(writesBefore)).toEqual([{ kind: "items.update", ids: ["a", "b"] }]);
            expect(store.getState().combatants.filter((c) => c.active).map((c) => c.id)).toEqual(["b"]);
        });

        it("setClock writes only this extension's scene key", async () => {
            const { store, scene } = await setup([], { "other.extension/key": { keep: true } });
            await store.setClock(true, 2);
            await flush();
            expect(scene.peek().sceneMetadata).toEqual({ "other.extension/key": { keep: true }, [SCENE_META_KEY]: { started: true, round: 2 } });
            expect(store.getState()).toMatchObject({ started: true, round: 2 });
        });
    });

    it("patch skips tokens that have no saved data", async () => {
        const { store, scene } = await setup([makeToken({ id: "plain" })]);
        await store.patch("plain", { elevation: 10 });
        expect(scene.peek().items[0].metadata[META_KEY]).toBeUndefined();
    });
});
