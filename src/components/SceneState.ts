import OBR from "@owlbear-rodeo/sdk";
import { getPluginId } from "../getPluginId";
import { deriveGroupsFromItems, META_KEY, batchUpdateMeta } from "./metadata";

export const SCENE_META_KEY = getPluginId("sceneState");
export const ROOM_META_KEY = getPluginId("roomSettings");

/** New unified health mode for what players can see */
export type HealthMode = "none" | "status" | "numbers";

/**
 * Group type for compatibility with existing code.
 * NOTE: Groups are now derived from tokens, not stored in scene metadata.
 * This type exists for backward compatibility but the data comes from tokens.
 */
export type Group = {
    id: string;   // stable unique id
    name: string; // display name
    active: boolean; // whether this group is currently active in initiative (whose turn it is)
    initiative: number;
    staged?: boolean; // whether group is staged (in list but not participating in initiative yet)
};

export type InitiativeSettings = {
    // Display Settings (Initiative List)
    showArmor: boolean;
    showHP: boolean;
    showMovementRange: boolean;
    showAttackRange: boolean;
    showConditions: boolean;
    showDistances: boolean;
    roundDistances?: boolean;
    // Gameplay
    /** When true the list is hidden from players (UI shows the inverted "Show to players" switch) */
    disablePlayerList: boolean;
    /** Master gate for whether players can see ANY health info */
    displayHealthStatusToPlayer: boolean;
    /** @deprecated legacy flag; kept for migration */
    displayPlayerHealthNumbers: boolean;
    /** DM-only range ring toggle button visibility in each row */
    dmRingToggle: boolean;
    /** Show movement/attack rings for PCs on their turn (GM-side feature that drives ensureRings effect) */
    showRangeRings: boolean;
    /** NEW: What health info to show for PCs (when displayHealthStatusToPlayer=true) */
    pcHealthMode?: HealthMode;
    /** NEW: What health info to show for NPCs (when displayHealthStatusToPlayer=true) */
    npcHealthMode?: HealthMode;
    /** NEW: Group staging visibility control - default to true (enabled) */
    groupStagingControlsVisibility?: boolean;
    /** NEW: Allow players to edit health for their player characters */
    playerEditableHealth?: boolean;
    /** Show concentration tracking column in DM view */
    showConcentration?: boolean;
};

/**
 * Scene state stored in OBR scene metadata.
 * NOTE: Groups are NO LONGER stored here - they are derived from tokens!
 */
export type SceneState = {
    started: boolean;
    round: number;
    settings: InitiativeSettings;
    // groups: Group[]; // REMOVED - now derived from tokens
};

export const DEFAULT_SETTINGS: InitiativeSettings = {
    // Display Settings
    showArmor: true,
    showHP: true,
    showMovementRange: true,
    showAttackRange: true,
    showConditions: true,
    showDistances: true,
    roundDistances: false,
    // Gameplay
    // Default the player list to SHOWN for players (UI toggle will start ON)
    disablePlayerList: false,
    // Health visibility master switch ON by default
    displayHealthStatusToPlayer: true,
    // Legacy default (used for migration only)
    displayPlayerHealthNumbers: true,
    // DM row button + PC rings
    dmRingToggle: true,
    showRangeRings: true,
    // New per-faction defaults
    pcHealthMode: "numbers",
    npcHealthMode: "status",
    // Group staging visibility control - default to true (enabled)
    groupStagingControlsVisibility: true,
    // Player editable health - default to false (disabled)
    playerEditableHealth: false,
    // Concentration tracking - default to false (disabled)
    showConcentration: false,
};

/** Apply backward-compatible migrations to a settings object */
function migrateSettings(incoming: Partial<InitiativeSettings> | undefined): InitiativeSettings {
    // Start from defaults then overlay incoming
    const merged: InitiativeSettings = { ...DEFAULT_SETTINGS, ...(incoming ?? {}) };

    // ---- Migration for new pcHealthMode / npcHealthMode ----
    // If not present, derive from legacy toggles:
    // - If displayHealthStatusToPlayer is false => mode "none"
    // - Else if legacy displayPlayerHealthNumbers is true => PCs "numbers"
    // - Else PCs "status"
    // - NPCs default to "status" when allowed, else "none"
    const show = !!merged.displayHealthStatusToPlayer;
    const legacyNumbers = !!merged.displayPlayerHealthNumbers;

    if (merged.pcHealthMode === undefined) {
        merged.pcHealthMode = show ? (legacyNumbers ? "numbers" : "status") : "none";
    }
    if (merged.npcHealthMode === undefined) {
        merged.npcHealthMode = show ? "status" : "none";
    }

    // ---- Migration for new groupStagingControlsVisibility ----
    // If not present, default to true (enabled)
    if (merged.groupStagingControlsVisibility === undefined) {
        merged.groupStagingControlsVisibility = true;
    }

    // ---- Migration for new roundDistances ----
    // If not present, default to false (disabled)
    if (merged.roundDistances === undefined) {
        merged.roundDistances = false;
    }

    return merged;
}

// ========== ROOM METADATA FUNCTIONS ==========

/**
 * Read settings from room metadata.
 * Room metadata persists settings across all scenes in the room.
 */
export async function readRoomSettings(): Promise<InitiativeSettings | null> {
    const meta = await OBR.room.getMetadata();
    const raw = meta[ROOM_META_KEY] as InitiativeSettings | undefined;
    if (!raw) return null;
    return migrateSettings(raw);
}

/**
 * Save settings to room metadata.
 * This makes settings persist across all scenes in the room.
 */
export async function saveRoomSettings(settings: InitiativeSettings): Promise<void> {
    await OBR.room.setMetadata({
        [ROOM_META_KEY]: settings
    });
}

// ========== SCENE METADATA MIGRATION ==========

/**
 * Migrate old scene-metadata-based groups to token-based groups.
 * This runs once on load if old groups are found.
 */
async function migrateOldGroupsToTokens(oldGroups: any[]): Promise<void> {
    if (!oldGroups || oldGroups.length === 0) return;

    console.log(`[Migration] Found ${oldGroups.length} old groups in scene metadata, migrating to token-based system...`);

    const items = await OBR.scene.items.getItems();
    const patches: { id: string; patch: any }[] = [];

    // For each token that has a groupId, update it with group properties from scene metadata
    for (const item of items) {
        const meta = (item.metadata as any)?.[META_KEY];
        if (!meta) continue;

        const tokenGroupId = meta.groupId || (meta.encounterGroups && meta.encounterGroups[0]);
        if (!tokenGroupId) continue;

        // Find the matching old group
        const oldGroup = oldGroups.find((g: any) => g.id === tokenGroupId);
        if (!oldGroup) continue;

        // Update token with group properties
        patches.push({
            id: item.id,
            patch: {
                groupId: tokenGroupId,
                groupName: oldGroup.name || "Migrated Group",
                groupStaged: oldGroup.staged ?? false,
                // Keep existing initiative (tokens already have it)
            }
        });
    }

    if (patches.length > 0) {
        await batchUpdateMeta(OBR, patches);
        console.log(`[Migration] Updated ${patches.length} tokens with group properties`);
    }

    // Clean up old groups from scene metadata
    const currentMeta = await OBR.scene.getMetadata();
    const currentState = currentMeta[SCENE_META_KEY] as any;
    if (currentState && (currentState.groups || currentState.encounters)) {
        delete currentState.groups;
        delete currentState.encounters;
        await OBR.scene.setMetadata({
            ...currentMeta,
            [SCENE_META_KEY]: currentState
        });
        console.log(`[Migration] Removed old groups from scene metadata`);
    }
}

export async function readSceneState(): Promise<SceneState | null> {
    const meta = await OBR.scene.getMetadata();
    const raw = meta[SCENE_META_KEY] as any;

    // Check for old groups and migrate if found
    if (raw) {
        const oldGroups = raw.groups || raw.encounters?.groups || raw.encounters;
        if (oldGroups && Array.isArray(oldGroups) && oldGroups.length > 0) {
            // Run migration asynchronously (don't block the read)
            migrateOldGroupsToTokens(oldGroups).catch(err => {
                console.error("[Migration] Failed to migrate old groups:", err);
            });
        }
    }

    // Always get settings from room metadata (room-level persistence)
    const roomSettings = await readRoomSettings();
    let settings: InitiativeSettings;

    if (roomSettings) {
        // Room has settings - use them
        settings = roomSettings;
    } else if (raw?.settings) {
        // No room settings but scene has settings - migrate them to room
        settings = migrateSettings(raw.settings);
        // Save to room metadata for future use (fire and forget)
        saveRoomSettings(settings).catch(err => {
            console.warn("[Migration] Failed to migrate scene settings to room:", err);
        });
    } else {
        // No settings anywhere - use defaults
        settings = DEFAULT_SETTINGS;
    }

    // If we have no scene state and no room settings, return null
    if (!raw && !roomSettings) return null;

    return {
        started: raw?.started ?? false,
        round: typeof raw?.round === "number" ? raw.round : 0,
        settings,
    };
}

export async function saveSceneState(patch: Partial<SceneState>) {
    // Settings are saved to room metadata (room-level persistence)
    if (patch.settings !== undefined) {
        // Get current room settings to merge with
        const currentRoomSettings = await readRoomSettings();
        const nextSettings = migrateSettings({
            ...(currentRoomSettings ?? DEFAULT_SETTINGS),
            ...patch.settings,
        });
        await saveRoomSettings(nextSettings);
    }

    // Only save started/round to scene metadata (scene-specific state)
    if (patch.started !== undefined || patch.round !== undefined) {
        const prev = await OBR.scene.getMetadata();
        const current = (prev[SCENE_META_KEY] as any) ?? {};

        const next = {
            started: patch.started ?? current.started ?? false,
            round: patch.round ?? current.round ?? 0,
        };

        await OBR.scene.setMetadata({
            ...prev,
            [SCENE_META_KEY]: next,
        });
    }
}

export function onSceneStateChange(cb: (state: SceneState | null) => void) {
    // Helper to build state from scene + room metadata
    const buildState = async (raw: any): Promise<SceneState | null> => {
        // Always get settings from room metadata
        const roomSettings = await readRoomSettings();
        let settings: InitiativeSettings;

        if (roomSettings) {
            settings = roomSettings;
        } else if (raw?.settings) {
            // No room settings but scene has settings - migrate them
            settings = migrateSettings(raw.settings);
            saveRoomSettings(settings).catch(err => {
                console.warn("[Migration] Failed to migrate scene settings to room:", err);
            });
        } else {
            settings = DEFAULT_SETTINGS;
        }

        if (!raw && !roomSettings) return null;

        return {
            started: raw?.started ?? false,
            round: typeof raw?.round === "number" ? raw.round : 0,
            settings,
        };
    };

    // Fire once immediately
    OBR.scene.getMetadata().then(async (meta) => {
        const raw = meta[SCENE_META_KEY] as any;
        const state = await buildState(raw);
        cb(state);
    });

    // Subscribe to future changes
    return OBR.scene.onMetadataChange(async (meta) => {
        const raw = meta[SCENE_META_KEY] as any;
        const state = await buildState(raw);
        cb(state);
    });
}

// ========== TOKEN-BASED GROUP MANAGEMENT FUNCTIONS ==========

/**
 * Get all groups by deriving them from tokens.
 * This is the single source of truth for group data.
 */
export async function getGroups(): Promise<Group[]> {
    const items = await OBR.scene.items.getItems();
    const derived = deriveGroupsFromItems(items);

    // Convert DerivedGroup to Group for backward compatibility
    return derived.map(g => ({
        id: g.id,
        name: g.name,
        initiative: g.initiative,
        active: g.active,
        staged: g.staged,
    }));
}

/**
 * Create a new empty group (no tokens yet).
 * Returns a group ID that can be used to add tokens.
 */
export async function createGroup(name: string, initiative: number = 0, staged: boolean = false): Promise<Group> {
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    // Return a "virtual" group that will exist once tokens are added
    return {
        id,
        name: name.trim() || "New Group",
        active: false,
        initiative,
        staged,
    };
}

/**
 * Update initiative for all tokens in a group.
 */
export async function updateGroupInitiative(groupId: string, initiative: number): Promise<void> {
    const { syncGroupTokensInitiative } = await import("./metadata");
    await syncGroupTokensInitiative(OBR, groupId, initiative);
}

/**
 * Rename a group by updating all its member tokens.
 */
export async function renameGroup(id: string, newName: string): Promise<void> {
    const { updateGroupName } = await import("./metadata");
    await updateGroupName(OBR, id, newName.trim());
}

/**
 * Delete a group by removing all tokens from it.
 */
export async function deleteGroup(id: string): Promise<void> {
    const { deleteGroup: deleteGroupMeta } = await import("./metadata");
    await deleteGroupMeta(OBR, id);
}

/**
 * Set active status for a group by updating all its member tokens.
 */
export async function setGroupActive(id: string, active: boolean): Promise<void> {
    const { updateGroupActive } = await import("./metadata");
    await updateGroupActive(OBR, id, active);
}

/**
 * Clear active status from all groups.
 *
 * UPDATED: Uses atomic batching to clear all groups at once instead of
 * sequential awaits, reducing race condition window.
 */
export async function clearAllGroupsActive(): Promise<void> {
    const groups = await getGroups();
    const activeGroups = groups.filter(g => g.active);

    if (activeGroups.length === 0) return;

    // Collect all token IDs from all active groups
    const { getTokensInGroup, batchUpdateMeta } = await import("./metadata");
    const allTokenIds: string[] = [];

    for (const group of activeGroups) {
        const tokens = await getTokensInGroup(OBR, group.id);
        allTokenIds.push(...tokens);
    }

    // Single batch update for all tokens in all active groups
    if (allTokenIds.length > 0) {
        const patches = allTokenIds.map(id => ({
            id,
            patch: { active: false }
        }));
        await batchUpdateMeta(OBR, patches);
    }
}

/**
 * Set staged status for a group by updating all its member tokens.
 */
export async function setGroupStaged(id: string, staged: boolean): Promise<void> {
    const { updateGroupStaged } = await import("./metadata");
    await updateGroupStaged(OBR, id, staged);
}

/**
 * Get the currently active group.
 */
export async function getActiveGroup(): Promise<Group | null> {
    const groups = await getGroups();
    return groups.find(g => g.active) ?? null;
}

/**
 * Get all staged groups.
 */
export async function getStagedGroups(): Promise<Group[]> {
    const groups = await getGroups();
    return groups.filter(g => g.staged);
}

/**
 * Get all participating (non-staged) groups.
 */
export async function getParticipatingGroups(): Promise<Group[]> {
    const groups = await getGroups();
    return groups.filter(g => !g.staged);
}