import { describe, expect, it } from "vitest";
import { createFakeScene, flush } from "./fakeScene";
import { makeToken } from "../test/tokens";

describe("fake scene", () => {
    it("delivers one client's item write to every client, including itself", async () => {
        const scene = createFakeScene({ items: [makeToken({ id: "a" })] });
        const gm = scene.connect("GM");
        const player = scene.connect("PLAYER");
        const seen: string[] = [];
        gm.items.onChange((items) => seen.push(`gm:${items[0].name}`));
        player.items.onChange((items) => seen.push(`player:${items[0].name}`));

        await gm.items.update(["a"], (items) => { items[0].name = "Goblin"; });
        await flush();

        expect(seen.sort()).toEqual(["gm:Goblin", "player:Goblin"]);
    });

    it("merges metadata at the top level", async () => {
        const scene = createFakeScene({ sceneMetadata: { other: 1 } });
        const client = scene.connect();
        await client.sceneMetadata.set({ mine: 2 });
        expect(await client.sceneMetadata.get()).toEqual({ other: 1, mine: 2 });
    });

    it("routes broadcasts by destination", async () => {
        const scene = createFakeScene();
        const a = scene.connect();
        const b = scene.connect();
        const got: string[] = [];
        a.broadcast.onMessage("ch", (d) => got.push(`a:${d}`));
        b.broadcast.onMessage("ch", (d) => got.push(`b:${d}`));

        await a.broadcast.send("ch", "local", "LOCAL");
        await a.broadcast.send("ch", "remote", "REMOTE");
        await a.broadcast.send("ch", "all", "ALL");
        await flush();

        expect(got.sort()).toEqual(["a:all", "a:local", "b:all", "b:remote"]);
    });

    it("hands out copies, so callers cannot mutate scene state", async () => {
        const scene = createFakeScene({ items: [makeToken({ id: "a", name: "Orc" })] });
        const client = scene.connect();
        const [item] = await client.items.get();
        item.name = "changed";
        expect(scene.peek().items[0].name).toBe("Orc");
    });
});
