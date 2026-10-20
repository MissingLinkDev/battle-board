import { META_KEY } from "../components/metadata";
import { SCENE_META_KEY } from "../encounter/store";
import type { ObrPort } from "../obr/port";
import { migrateSettings, ROOM_META_KEY } from "./settings";

/**
 * One-off moves of data saved by older versions (ADR-0002), run on GM clients
 * only (ADR-0003) each time a scene opens. Each step is a no-op once done.
 */
export async function runSavedDataMigrations(port: ObrPort) {
    if ((await port.player.getRole()) !== "GM") return;
    await moveSceneSettingsToRoom(port);
    await moveSceneGroupsToTokens(port);
}

/** Settings used to live in each scene; the room now holds them. */
async function moveSceneSettingsToRoom(port: ObrPort) {
    const [room, scene] = await Promise.all([port.roomMetadata.get(), port.sceneMetadata.get()]);
    const legacy = (scene[SCENE_META_KEY] as { settings?: unknown } | undefined)?.settings;
    if (room[ROOM_META_KEY] !== undefined || legacy === undefined) return;
    await port.roomMetadata.set({ [ROOM_META_KEY]: migrateSettings(legacy) });
}

type LegacyGroup = { id: string; name?: string; staged?: boolean };
type LegacySceneState = Record<string, unknown> & {
    groups?: LegacyGroup[];
    encounters?: LegacyGroup[] | { groups?: LegacyGroup[] };
};
type LegacyTokenMeta = { groupId?: string | null; encounterGroups?: string[] } | undefined;

/** Groups used to be listed in scene state; group name and staged now live on each member (ADR-0001). */
async function moveSceneGroupsToTokens(port: ObrPort) {
    const scene = await port.sceneMetadata.get();
    const state = scene[SCENE_META_KEY] as LegacySceneState | undefined;
    const raw = state?.groups ?? (Array.isArray(state?.encounters) ? state.encounters : state?.encounters?.groups);
    if (!Array.isArray(raw) || raw.length === 0) return;
    const legacyGroups = new Map((raw as LegacyGroup[]).map((g) => [g.id, g]));

    const groupOf = (item: { metadata: Record<string, unknown> }) => {
        const meta = item.metadata[META_KEY] as LegacyTokenMeta;
        const groupId = meta?.groupId || meta?.encounterGroups?.[0];
        return groupId ? legacyGroups.get(groupId) : undefined;
    };
    const ids = (await port.items.get()).filter(groupOf).map((i) => i.id);
    if (ids.length) {
        await port.items.update(ids, (items) => {
            for (const item of items) {
                const group = groupOf(item);
                if (!group) continue;
                Object.assign(item.metadata[META_KEY] as object, {
                    groupId: group.id,
                    groupName: group.name || "Migrated Group",
                    groupStaged: group.staged ?? false,
                });
            }
        });
    }

    const rest = { ...state };
    delete rest.groups;
    delete rest.encounters;
    await port.sceneMetadata.set({ [SCENE_META_KEY]: rest });
}
