import { describe, expect, it } from "vitest";
import type { Item } from "@owlbear-rodeo/sdk";
import { createFakeScene, flush } from "../obr/fakeScene";
import { makeToken } from "../test/tokens";
import { DEFAULT_META, META_KEY } from "../components/metadata";
import { LABEL_META_KEY, labelIdFor } from "./elevationLabels";
import { startElevationLabelSync, syncElevationLabels, sweepLegacyLabels, type LabelFactory } from "./elevationLabelSync";

const grid = { dpi: 150, unitLabel: "ft" };
const getGrid = async () => grid;

/** Stand-in for the SDK label builder, which needs a live Owlbear connection. */
const fakeLabel: LabelFactory = (spec) => label(spec.id, spec.text, spec.tokenId, { [LABEL_META_KEY]: { __elevationLabel__: true, ownerId: spec.tokenId } });

function label(id: string, text: string, attachedTo?: string, metadata: Record<string, unknown> = {}): Item {
    return {
        id, type: "LABEL", name: "", visible: true, locked: true, createdUserId: "u", zIndex: 0, lastModified: "", lastModifiedUserId: "u",
        layer: "TEXT", position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, metadata, attachedTo,
        text: { plainText: text },
    } as unknown as Item;
}

const token = (id: string, elevation: number, extra: Record<string, unknown> = {}) =>
    makeToken({ id, metadata: { [META_KEY]: { ...DEFAULT_META, name: id, visible: true, elevation, ...extra } } });

const labels = (items: Item[]) => items.filter((i) => i.type === "LABEL").map((i) => [i.id, (i as Item & { text: { plainText: string } }).text.plainText]);
const setElevation = (elevation: number) => ([t]: Item[]) => { (t.metadata[META_KEY] as { elevation: number }).elevation = elevation; };

describe("elevation labels", () => {
    it("label every token whose elevation is not 0, with the up or down icon", async () => {
        const scene = createFakeScene({ items: [token("up", 10), token("down", -5), token("ground", 0)] });
        await syncElevationLabels(scene.connect(), scene.peek().items, grid, fakeLabel);
        expect(labels(scene.peek().items)).toEqual([[labelIdFor("up"), "🪽 10 ft"], [labelIdFor("down"), "⬇️ -5 ft"]]);
    });

    it("keep the label on a token that is no longer a combatant", async () => {
        const scene = createFakeScene({ items: [token("removed", 15, { inInitiative: false })] });
        await syncElevationLabels(scene.connect(), scene.peek().items, grid, fakeLabel);
        expect(labels(scene.peek().items)).toEqual([[labelIdFor("removed"), "🪽 15 ft"]]);
    });

    it("update the existing label when elevation changes, and remove it at 0", async () => {
        const scene = createFakeScene({ items: [token("a", 10), fakeLabel({ id: labelIdFor("a"), tokenId: "a", text: "🪽 10 ft", position: { x: 0, y: 0 } })] });
        const port = scene.connect();
        await port.items.update(["a"], setElevation(20));
        await syncElevationLabels(port, scene.peek().items, grid, fakeLabel);
        expect(labels(scene.peek().items)).toEqual([[labelIdFor("a"), "🪽 20 ft"]]);

        await port.items.update(["a"], setElevation(0));
        await syncElevationLabels(port, scene.peek().items, grid, fakeLabel);
        expect(labels(scene.peek().items)).toEqual([]);
    });

    it("remove a label whose token is gone", async () => {
        const scene = createFakeScene({ items: [fakeLabel({ id: labelIdFor("gone"), tokenId: "gone", text: "🪽 5 ft", position: { x: 0, y: 0 } })] });
        await syncElevationLabels(scene.connect(), scene.peek().items, grid, fakeLabel);
        expect(labels(scene.peek().items)).toEqual([]);
    });

    it("replace older versions' duplicated labels with exactly one current label", async () => {
        const marker = { [LABEL_META_KEY]: { __elevationLabel__: true, ownerId: "a", key: "a:elevation-label" } };
        const scene = createFakeScene({ items: [
            token("a", 10),
            label("random-1", "🪽 10 ft", "a", marker),
            label("random-2", "🪽 10 ft", "a", marker),
            label("lost-marker", "🪽 10 ft", "a"),
            label("players-note", "🪽 flying!"),
        ] });
        const port = scene.connect();
        await sweepLegacyLabels(port);
        await syncElevationLabels(port, scene.peek().items, grid, fakeLabel);
        expect(labels(scene.peek().items)).toEqual([["players-note", "🪽 flying!"], [labelIdFor("a"), "🪽 10 ft"]]);
    });

    it("are written by the GM's client only", async () => {
        const scene = createFakeScene({ items: [token("a", 10)] });
        const stopPlayer = startElevationLabelSync(scene.connect("PLAYER"), getGrid, fakeLabel);
        await flush();
        expect(scene.writes).toEqual([]);

        const stopGm = startElevationLabelSync(scene.connect("GM"), getGrid, fakeLabel);
        await flush();
        await flush();
        expect(labels(scene.peek().items)).toEqual([[labelIdFor("a"), "🪽 10 ft"]]);
        stopPlayer();
        stopGm();
    });

    it("follow elevation changes while running, settling without extra writes", async () => {
        const scene = createFakeScene({ items: [token("a", 0)] });
        const gm = scene.connect("GM");
        const stop = startElevationLabelSync(gm, getGrid, fakeLabel);
        await flush();
        await gm.items.update(["a"], setElevation(30));
        await flush();
        await flush();
        expect(labels(scene.peek().items)).toEqual([[labelIdFor("a"), "🪽 30 ft"]]);

        const writes = scene.writes.length;
        await flush();
        expect(scene.writes.length).toBe(writes);
        stop();
    });
});
