import { describe, expect, it } from "vitest";
import { createFakeScene, flush } from "../obr/fakeScene";
import { makeToken } from "../test/tokens";
import { META_KEY, DEFAULT_META } from "../components/metadata";
import { SCENE_META_KEY } from "../encounter/store";
import { DEFAULT_SETTINGS, migrateSettings, ROOM_META_KEY } from "./settings";
import { createSettingsStore } from "./store";
import { runSavedDataMigrations } from "./migrations";

describe("migrateSettings", () => {
    it("fills settings an older version never saved with defaults", () => {
        expect(migrateSettings({ showHP: false })).toEqual({ ...DEFAULT_SETTINGS, showHP: false });
        expect(migrateSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    });

    it("ignores retired and malformed fields", () => {
        const migrated = migrateSettings({ displayPlayerHealthNumbers: false, showArmor: "yes", pcHealthMode: "status" });
        expect(migrated).toEqual({ ...DEFAULT_SETTINGS, pcHealthMode: "status" });
        expect(migrated).not.toHaveProperty("displayPlayerHealthNumbers");
    });
});

describe("settings store", () => {
    it("migrates settings arriving through change events", async () => {
        const scene = createFakeScene();
        const store = createSettingsStore(scene.connect());
        store.subscribe(() => {});
        await scene.connect().roomMetadata.set({ [ROOM_META_KEY]: { showHP: false } });
        await flush();
        expect(store.getState().settings).toEqual({ ...DEFAULT_SETTINGS, showHP: false });
    });

    it("keeps both of two quick changes to different settings", async () => {
        const scene = createFakeScene();
        const store = createSettingsStore(scene.connect());
        await Promise.all([store.update({ showHP: false }), store.update({ showArmor: false })]);
        expect(scene.peek().roomMetadata[ROOM_META_KEY]).toMatchObject({ showHP: false, showArmor: false });
    });

    it("keeps another GM's earlier change to a different setting", async () => {
        const scene = createFakeScene();
        const a = createSettingsStore(scene.connect());
        const b = createSettingsStore(scene.connect());
        await a.update({ showHP: false });
        await b.update({ showArmor: false });
        expect(scene.peek().roomMetadata[ROOM_META_KEY]).toMatchObject({ showHP: false, showArmor: false });
    });

    it("writes only this extension's room key", async () => {
        const scene = createFakeScene({ roomMetadata: { "other.extension/key": 1 } });
        await createSettingsStore(scene.connect()).update({ showHP: false });
        expect(scene.peek().roomMetadata["other.extension/key"]).toBe(1);
    });
});

describe("saved-data migrations", () => {
    const legacyScene = {
        [SCENE_META_KEY]: { started: true, round: 3, settings: { showHP: false }, groups: [{ id: "g", name: "Goblins", staged: true }] },
        "other.extension/key": { keep: true },
    };
    const grouped = () => makeToken({ id: "a", metadata: { [META_KEY]: { ...DEFAULT_META, name: "a", visible: true, groupId: "g", groupName: null } } });

    it("move scene settings to the room and scene groups onto their tokens, keeping everything else", async () => {
        const scene = createFakeScene({ items: [grouped()], sceneMetadata: legacyScene });
        await runSavedDataMigrations(scene.connect("GM"));

        const after = scene.peek();
        expect(after.roomMetadata[ROOM_META_KEY]).toEqual({ ...DEFAULT_SETTINGS, showHP: false });
        expect(after.items[0].metadata[META_KEY]).toMatchObject({ groupId: "g", groupName: "Goblins", groupStaged: true });
        expect(after.sceneMetadata[SCENE_META_KEY]).toEqual({ started: true, round: 3, settings: { showHP: false } });
        expect(after.sceneMetadata["other.extension/key"]).toEqual({ keep: true });
    });

    it("never overwrite settings the room already has", async () => {
        const scene = createFakeScene({ sceneMetadata: legacyScene, roomMetadata: { [ROOM_META_KEY]: { showArmor: false } } });
        await runSavedDataMigrations(scene.connect("GM"));
        expect(scene.peek().roomMetadata[ROOM_META_KEY]).toEqual({ showArmor: false });
    });

    it("do nothing on a player's client", async () => {
        const scene = createFakeScene({ items: [grouped()], sceneMetadata: legacyScene });
        await runSavedDataMigrations(scene.connect("PLAYER"));
        expect(scene.writes).toEqual([]);
    });
});
