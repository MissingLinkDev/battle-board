import { describe, expect, it } from "vitest";
import type { Item } from "@owlbear-rodeo/sdk";
import { createFakeScene, flush } from "../obr/fakeScene";
import { makeToken } from "../test/tokens";
import { DEFAULT_META, META_KEY } from "../components/metadata";
import { SCENE_META_KEY } from "../encounter/store";
import { DEFAULT_SETTINGS, ROOM_META_KEY, type InitiativeSettings } from "../settings/settings";
import type { Combatant } from "../encounter/combatant";
import { desiredRings, ringIdFor, ringMetadata, ringShape, RING_META_KEY } from "./rings";
import { startRingSync, syncRings, type RingFactory } from "./ringSync";

const grid = { dpi: 100, unitsPerCell: 5 };

/** Stand-in for the SDK builders, which need a live Owlbear connection. */
const fakeRing: RingFactory = (shape) => ({
    id: shape.id, type: shape.kind === "move" ? "SHAPE" : "PATH", name: "", visible: shape.visible, locked: true,
    createdUserId: "u", zIndex: 0, lastModified: "", lastModifiedUserId: "u", layer: "DRAWING",
    position: shape.center, rotation: 0, scale: { x: 1, y: 1 }, metadata: ringMetadata(shape),
    attachedTo: shape.kind === "range" ? shape.tokenId : undefined,
    ...("diameter" in shape.geometry ? { width: shape.geometry.diameter, height: shape.geometry.diameter } : {}),
    style: { strokeColor: shape.style.color },
}) as unknown as Item;

const c = (id: string, extra: Partial<Combatant> = {}): Combatant => ({
    id, name: id, initiative: 0, active: false, visible: true, ac: 10, currentHP: 10, maxHP: 10, tempHP: 0,
    movement: 30, attackRange: 60, elevation: 0, playerCharacter: false, ...extra,
});

const settings: InitiativeSettings = DEFAULT_SETTINGS;
const kinds = (wants: ReturnType<typeof desiredRings>) => wants.map((w) => `${w.tokenId}:${w.variant}:${w.kind}`);

describe("desiredRings", () => {
    it("gives every active PC turn rings while the encounter runs, and no one else", () => {
        const combatants = [c("pc1", { playerCharacter: true, active: true }), c("pc2", { playerCharacter: true, active: true }), c("npc", { active: true }), c("idle", { playerCharacter: true })];
        expect(kinds(desiredRings(combatants, settings, true))).toEqual(["pc1:normal:move", "pc1:normal:range", "pc2:normal:move", "pc2:normal:range"]);
        expect(desiredRings(combatants, settings, false)).toEqual([]);
        expect(desiredRings(combatants, { ...settings, showRangeRings: false }, true)).toEqual([]);
    });

    it("gives DM previews whatever the turn, unless the preview button is turned off", () => {
        const combatants = [c("a", { dmPreview: true })];
        expect(kinds(desiredRings(combatants, settings, false))).toEqual(["a:dm:move", "a:dm:range"]);
        expect(desiredRings(combatants, { ...settings, dmRingToggle: false }, false)).toEqual([]);
    });

    it("applies the movement and attack-range settings to turn rings and previews alike", () => {
        const combatants = [c("pc", { playerCharacter: true, active: true, dmPreview: true })];
        expect(kinds(desiredRings(combatants, { ...settings, showMovementRange: false }, true))).toEqual(["pc:normal:range", "pc:dm:range"]);
        expect(kinds(desiredRings(combatants, { ...settings, showAttackRange: false }, true))).toEqual(["pc:normal:move", "pc:dm:move"]);
    });

    it("hides DM previews from players and shows turn rings to everyone", () => {
        const token = makeToken({ id: "a" });
        const [want] = desiredRings([c("a", { dmPreview: true })], settings, false);
        expect(ringShape(want, token, grid).visible).toBe(false);
    });

    it("sizes rings from the token's footprint, at least one cell", () => {
        const tiny = makeToken({ id: "tiny" });
        tiny.scale = { x: 0.5, y: 0.5 };
        const [move] = desiredRings([c("tiny", { dmPreview: true, movement: 30 })], settings, false);
        // 30 ft each way = 6 cells × 2, plus a one-cell token
        expect(ringShape(move, tiny, grid).geometry).toEqual({ diameter: 1300 });
    });
});

describe("ring sync", () => {
    const meta = (extra: Record<string, unknown>) => ({ [META_KEY]: { ...DEFAULT_META, name: "t", visible: true, ...extra } });
    const running = { [SCENE_META_KEY]: { started: true, round: 1 } };
    const ringIds = (items: Item[]) => items.filter((i) => (i.metadata as Record<string, unknown>)[RING_META_KEY]).map((i) => i.id).sort();

    it("draws the active PC's rings under fixed ids, then settles", async () => {
        const scene = createFakeScene({ items: [makeToken({ id: "pc", metadata: meta({ playerCharacter: true, active: true }) })], sceneMetadata: running });
        const port = scene.connect();
        await syncRings(port, grid, fakeRing);
        expect(ringIds(scene.peek().items)).toEqual([ringIdFor("pc", "normal", "move"), ringIdFor("pc", "normal", "range")]);

        const writes = scene.writes.length;
        await syncRings(port, grid, fakeRing);
        expect(scene.writes.length).toBe(writes);
    });

    it("leaves the movement circle where the turn started when the token moves", async () => {
        const scene = createFakeScene({ items: [makeToken({ id: "pc", position: { x: 0, y: 0 }, metadata: meta({ playerCharacter: true, active: true }) })], sceneMetadata: running });
        const port = scene.connect();
        await syncRings(port, grid, fakeRing);
        await port.items.update(["pc"], ([t]) => { t.position = { x: 500, y: 500 }; });
        const writes = scene.writes.length;
        await syncRings(port, grid, fakeRing);
        expect(scene.writes.length).toBe(writes);
        expect(scene.peek().items.find((i) => i.id === ringIdFor("pc", "normal", "move"))!.position).toEqual({ x: 0, y: 0 });
    });

    it("restyles the movement circle in place when its colour changes", async () => {
        const scene = createFakeScene({ items: [makeToken({ id: "pc", metadata: meta({ playerCharacter: true, active: true }) })], sceneMetadata: running });
        const port = scene.connect();
        await syncRings(port, grid, fakeRing);
        await port.items.update(["pc"], ([t]) => { (t.metadata[META_KEY] as Record<string, unknown>).movementColor = "#000000"; });
        await syncRings(port, grid, fakeRing);
        const ring = scene.peek().items.find((i) => i.id === ringIdFor("pc", "normal", "move")) as Item & { style: { strokeColor: string } };
        expect(ring.style.strokeColor).toBe("#000000");
    });

    it("moves turn rings to the next PC and clears them when the encounter ends, keeping previews", async () => {
        const scene = createFakeScene({
            items: [
                makeToken({ id: "a", metadata: meta({ playerCharacter: true, active: true }) }),
                makeToken({ id: "b", metadata: meta({ playerCharacter: true, dmPreview: true }) }),
            ],
            sceneMetadata: running,
        });
        const port = scene.connect();
        await syncRings(port, grid, fakeRing);
        await port.items.update(["a", "b"], ([a, b]) => {
            (a.metadata[META_KEY] as Record<string, unknown>).active = false;
            (b.metadata[META_KEY] as Record<string, unknown>).active = true;
        });
        await syncRings(port, grid, fakeRing);
        expect(ringIds(scene.peek().items)).toEqual([
            ringIdFor("b", "dm", "move"), ringIdFor("b", "dm", "range"), ringIdFor("b", "normal", "move"), ringIdFor("b", "normal", "range"),
        ].sort());

        await port.sceneMetadata.set({ [SCENE_META_KEY]: { started: false, round: 0 } });
        await syncRings(port, grid, fakeRing);
        expect(ringIds(scene.peek().items)).toEqual([ringIdFor("b", "dm", "move"), ringIdFor("b", "dm", "range")]);
    });

    it("keeps honouring a turned-off movement setting on later turns", async () => {
        const scene = createFakeScene({
            items: [makeToken({ id: "a", metadata: meta({ playerCharacter: true, active: true }) })],
            sceneMetadata: running,
            roomMetadata: { [ROOM_META_KEY]: { showMovementRange: false } },
        });
        await syncRings(scene.connect(), grid, fakeRing);
        expect(ringIds(scene.peek().items)).toEqual([ringIdFor("a", "normal", "range")]);
    });

    it("removes rings left by older versions", async () => {
        const shape = ringShape({ tokenId: "x", variant: "normal", kind: "move", radiusUnits: 30, style: { color: "#fff", weight: 12, pattern: "dash", opacity: 1 } }, makeToken({ id: "x" }), grid);
        const legacy = fakeRing({ ...shape, id: "random-old-id" });
        const scene = createFakeScene({ items: [legacy] });
        await syncRings(scene.connect(), grid, fakeRing);
        expect(ringIds(scene.peek().items)).toEqual([]);
    });

    it("are drawn by the GM's client only, and stay when its tracker closes", async () => {
        const scene = createFakeScene({ items: [makeToken({ id: "pc", metadata: meta({ playerCharacter: true, active: true }) })], sceneMetadata: running });
        const stopPlayer = startRingSync(scene.connect("PLAYER"), async () => grid, fakeRing);
        await flush();
        expect(scene.writes).toEqual([]);

        const stopGm = startRingSync(scene.connect("GM"), async () => grid, fakeRing);
        await flush();
        await flush();
        expect(ringIds(scene.peek().items)).toHaveLength(2);

        stopPlayer();
        stopGm();
        await flush();
        expect(ringIds(scene.peek().items)).toHaveLength(2);
    });
});
