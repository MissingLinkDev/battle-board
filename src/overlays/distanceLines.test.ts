import { describe, expect, it } from "vitest";
import type { Item } from "@owlbear-rodeo/sdk";
import { createFakeScene, flush } from "../obr/fakeScene";
import { makeToken } from "../test/tokens";
import { DEFAULT_META, META_KEY } from "../components/metadata";
import { SCENE_META_KEY } from "../encounter/store";
import { ROOM_META_KEY } from "../settings/settings";
import { readGrid } from "../battlefield/grid";
import { LINE_LOOK, labelPosition, labelRotation, LINE_META_KEY, lineIdFor, lineMetadata, partIdFor, PARTS_BY_LOOK, type LineLook } from "./distanceLines";
import { startDistanceLineSync, syncDistanceLines, type LineFactory } from "./distanceLineSync";

const DPI = 150;

/** Stand-in for the SDK builders, which need a live Owlbear connection. */
const fakeLine: LineFactory = (spec, look) => {
    const base = { name: "", visible: true, locked: true, createdUserId: "u", zIndex: 0, lastModified: "", lastModifiedUserId: "u", rotation: 0, scale: { x: 1, y: 1 } };
    if (look === "ruler") {
        return [{ ...base, id: partIdFor(spec, "ruler"), type: "RULER", layer: "RULER", position: { x: 0, y: 0 }, startPosition: spec.start, endPosition: spec.end, measurement: spec.text, style: { variant: "DASHED" }, metadata: lineMetadata(spec, "ruler") }] as unknown as Item[];
    }
    return [
        { ...base, id: partIdFor(spec, "line"), type: "LINE", layer: "DRAWING", position: { x: 0, y: 0 }, startPosition: spec.start, endPosition: spec.end, style: { strokeWidth: spec.weight }, metadata: lineMetadata(spec, "line") },
        { ...base, id: partIdFor(spec, "label"), type: "LABEL", layer: "TEXT", position: labelPosition(spec), rotation: labelRotation(spec), text: { plainText: spec.text, style: { fontSize: spec.fontSize } }, metadata: lineMetadata(spec, "label") },
    ] as unknown as Item[];
};

const meta = (extra: Record<string, unknown> = {}) => ({ [META_KEY]: { ...DEFAULT_META, name: "t", visible: true, ...extra } });
/** A one-cell token standing on column `col` of row 0. */
const at = (id: string, col: number, extra: Record<string, unknown> = {}, visible = true) =>
    makeToken({ id, visible, position: { x: (col + 0.5) * DPI, y: DPI / 2 }, metadata: meta(extra) });
const pc = (id: string, col: number, extra: Record<string, unknown> = {}) => at(id, col, { playerCharacter: true, ...extra });

const running = { [SCENE_META_KEY]: { started: true, round: 1 } };
const enabled = { [ROOM_META_KEY]: { showDistanceLines: true } };

const lineIds = (items: Item[]) => items.filter((i) => (i.metadata as Record<string, unknown>)[LINE_META_KEY]).map((i) => i.id).sort();
const labelText = (items: Item[], from: string, to: string) =>
    (items.find((i) => i.id === partIdFor({ id: lineIdFor(from, to) }, "label")) as Item & { text: { plainText: string } } | undefined)?.text.plainText;

function setup(items: Item[], opts: { roomMetadata?: Record<string, unknown>; sceneMetadata?: Record<string, unknown>; look?: LineLook } = {}) {
    const scene = createFakeScene({ items, sceneMetadata: opts.sceneMetadata ?? running, roomMetadata: opts.roomMetadata ?? enabled, grid: { dpi: DPI } });
    const port = scene.connect();
    const sync = async (look: LineLook = opts.look ?? "line") => syncDistanceLines(port, await readGrid(port), fakeLine, look);
    return { scene, port, sync };
}

describe("distance lines", () => {
    it("draw from the active PC to every combatant more than two cells away, with the distance", async () => {
        const { scene, sync } = setup([pc("me", 0, { active: true }), at("near", 2), at("far", 3), pc("ally", 6)]);
        await sync();
        const items = scene.peek().items;
        expect(lineIds(items)).toEqual([
            `${lineIdFor("me", "ally")}.label`, `${lineIdFor("me", "ally")}.line`,
            `${lineIdFor("me", "far")}.label`, `${lineIdFor("me", "far")}.line`,
        ]);
        expect(labelText(items, "me", "far")).toBe("15 ft");
        expect(labelText(items, "me", "ally")).toBe("30 ft");
    });

    it("draw nothing on an NPC's turn, before the encounter starts, or with the setting off", async () => {
        const tokens = () => [at("npc", 0, { active: true }), pc("pc", 5)];
        const npcTurn = setup(tokens());
        await npcTurn.sync();
        expect(lineIds(npcTurn.scene.peek().items)).toEqual([]);

        const notStarted = setup([pc("me", 0, { active: true }), at("far", 5)], { sceneMetadata: {} });
        await notStarted.sync();
        expect(lineIds(notStarted.scene.peek().items)).toEqual([]);

        const off = setup([pc("me", 0, { active: true }), at("far", 5)], { roomMetadata: {} });
        await off.sync();
        expect(lineIds(off.scene.peek().items)).toEqual([]);
    });

    it("never point at hidden or staged combatants", async () => {
        const { scene, sync } = setup([pc("me", 0, { active: true }), at("hidden", 5, {}, false), at("staged", 6, { groupId: "g", groupStaged: true })]);
        await sync();
        expect(lineIds(scene.peek().items)).toEqual([]);
    });

    it("follow a token when it moves, then settle", async () => {
        const { scene, port, sync } = setup([pc("me", 0, { active: true }), at("far", 3)]);
        await sync();
        await port.items.update(["far"], ([t]) => { t.position = { x: 6.5 * DPI, y: DPI / 2 }; });
        await sync();
        const items = scene.peek().items;
        expect(labelText(items, "me", "far")).toBe("30 ft");
        const line = items.find((i) => i.id === partIdFor({ id: lineIdFor("me", "far") }, "line")) as Item & { endPosition: { x: number } };
        expect(line.endPosition.x).toBe(6.5 * DPI);

        const writes = scene.writes.length;
        await sync();
        expect(scene.writes.length).toBe(writes);
    });

    it("disappear when a token comes within two cells and when the turn passes", async () => {
        const { scene, port, sync } = setup([pc("me", 0, { active: true }), at("far", 3)]);
        await sync();
        await port.items.update(["far"], ([t]) => { t.position = { x: 2.5 * DPI, y: DPI / 2 }; });
        await sync();
        expect(lineIds(scene.peek().items)).toEqual([]);

        await port.items.update(["far"], ([t]) => { t.position = { x: 5.5 * DPI, y: DPI / 2 }; });
        await sync();
        expect(lineIds(scene.peek().items)).toHaveLength(2);
        await port.items.update(["me", "far"], ([me, far]) => {
            (me.metadata[META_KEY] as Record<string, unknown>).active = false;
            (far.metadata[META_KEY] as Record<string, unknown>).active = true;
        });
        await sync();
        expect(lineIds(scene.peek().items)).toEqual([]);
    });

    it("turn the label to run along the line, never upside down", () => {
        const o = { x: 0, y: 0 };
        expect(labelRotation({ start: o, end: { x: 100, y: 0 } })).toBe(0);
        expect(labelRotation({ start: o, end: { x: -100, y: 0 } })).toBe(0);
        expect(labelRotation({ start: o, end: { x: 100, y: 100 } })).toBe(45);
        expect(labelRotation({ start: o, end: { x: -100, y: -100 } })).toBe(45);
        expect(labelRotation({ start: o, end: { x: 100, y: -100 } })).toBe(-45);
        expect(labelRotation({ start: o, end: { x: 0, y: 100 } })).toBe(90);
        expect(labelRotation({ start: o, end: { x: 0, y: -100 } })).toBe(90);
    });

    it("put the label's anchor half a pill below the midpoint, so the line runs through its middle", () => {
        // fontSize 20, padding 7: a 34px pill, anchored at its bottom edge
        const flat = labelPosition({ start: { x: 0, y: 0 }, end: { x: 200, y: 0 }, fontSize: 20 });
        expect(flat).toEqual({ x: 100, y: 17 });
        const upright = labelPosition({ start: { x: 0, y: 0 }, end: { x: 0, y: 200 }, fontSize: 20 });
        expect(upright.x).toBeCloseTo(-17);
        expect(upright.y).toBeCloseTo(100);
    });

    it("replace parts left by older versions", async () => {
        const { scene, port, sync } = setup([pc("me", 0, { active: true }), at("far", 3)]);
        await sync();
        const [line] = scene.peek().items.filter((i) => i.id.endsWith(".line"));
        const stale = { ...line, id: `${lineIdFor("me", "far")}.path`, metadata: { [LINE_META_KEY]: { __distanceLine__: true, lineId: lineIdFor("me", "far"), part: "path" } } };
        await port.items.add([stale]);
        await sync();
        expect(lineIds(scene.peek().items)).toEqual([`${lineIdFor("me", "far")}.label`, `${lineIdFor("me", "far")}.line`]);
    });

    it("can be drawn as a single dashed ruler showing the distance, which follows the token", async () => {
        const { scene, port, sync } = setup([pc("me", 0, { active: true }), at("far", 3)], { look: "ruler" });
        await sync();
        const rulerId = partIdFor({ id: lineIdFor("me", "far") }, "ruler");
        expect(lineIds(scene.peek().items)).toEqual([rulerId]);

        await port.items.update(["far"], ([t]) => { t.position = { x: 6.5 * DPI, y: DPI / 2 }; });
        await sync();
        const ruler = scene.peek().items.find((i) => i.id === rulerId) as Item & { measurement: string; endPosition: { x: number } };
        expect(ruler.measurement).toBe("30 ft");
        expect(ruler.endPosition.x).toBe(6.5 * DPI);
    });

    it("swap every line over when the look changes", async () => {
        const { scene, sync } = setup([pc("me", 0, { active: true }), at("far", 3)]);
        await sync("line");
        await sync("ruler");
        expect(lineIds(scene.peek().items)).toEqual([partIdFor({ id: lineIdFor("me", "far") }, "ruler")]);
        await sync("line");
        expect(lineIds(scene.peek().items)).toEqual([`${lineIdFor("me", "far")}.label`, `${lineIdFor("me", "far")}.line`]);
    });

    it("rebuild a line whose label was deleted", async () => {
        const { scene, port, sync } = setup([pc("me", 0, { active: true }), at("far", 3)]);
        await sync();
        await port.items.delete([partIdFor({ id: lineIdFor("me", "far") }, "label")]);
        await sync();
        expect(lineIds(scene.peek().items)).toHaveLength(2);
    });

    it("are drawn by the GM's client only", async () => {
        const scene = createFakeScene({ items: [pc("me", 0, { active: true }), at("far", 3)], sceneMetadata: running, roomMetadata: enabled, grid: { dpi: DPI } });
        const player = scene.connect("PLAYER");
        const stopPlayer = startDistanceLineSync(player, () => readGrid(player), fakeLine);
        await flush();
        expect(scene.writes).toEqual([]);

        const gm = scene.connect("GM");
        const stopGm = startDistanceLineSync(gm, () => readGrid(gm), fakeLine);
        await flush();
        await flush();
        expect(lineIds(scene.peek().items)).toHaveLength(PARTS_BY_LOOK[LINE_LOOK].length);

        stopPlayer();
        stopGm();
    });
});
