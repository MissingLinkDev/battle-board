import OBR from "@owlbear-rodeo/sdk";
import { getPluginId } from "../getPluginId";
import { deriveGroupsFromItems, META_KEY, batchUpdateMeta } from "./metadata";

export const SCENE_META_KEY = getPluginId("sceneState");

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

const DEFAULT_SCENE_STATE: SceneState = {
    started: false,
    round: 0,
    settings: DEFAULT_SETTINGS,
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
    if (!raw) return null;

    // Check for old groups and migrate if found
    const oldGroups = raw.groups || raw.encounters?.groups || raw.encounters;
    if (oldGroups && Array.isArray(oldGroups) && oldGroups.length > 0) {
        // Run migration asynchronously (don't block the read)
        migrateOldGroupsToTokens(oldGroups).catch(err => {
            console.error("[Migration] Failed to migrate old groups:", err);
        });
    }

    return {
        started: !!raw.started,
        round: typeof raw.round === "number" ? raw.round : 0,
        settings: migrateSettings(raw.settings),
    };
}

export async function saveSceneState(patch: Partial<SceneState>) {
    // 1) read current scene metadata
    const prev = await OBR.scene.getMetadata();
    // 2) read current scene-state value (or defaults)
    const current = (prev[SCENE_META_KEY] as SceneState) ?? DEFAULT_SCENE_STATE;

    // 3) deep-merge settings only when provided
    let nextSettings = current.settings;
    if (patch.settings !== undefined) {
        nextSettings = migrateSettings({
            ...current.settings,
            ...patch.settings,
        });
    }

    const next: SceneState = {
        started: patch.started !== undefined ? patch.started : current.started,
        round: patch.round !== undefined ? patch.round : current.round,
        settings: nextSettings,
    };

    // 4) write back the whole metadata object
    await OBR.scene.setMetadata({
        ...prev,
        [SCENE_META_KEY]: next,
    });
}

export function onSceneStateChange(cb: (state: SceneState | null) => void) {
    // Fire once immediately
    OBR.scene.getMetadata().then((meta) => {
        const raw = meta[SCENE_META_KEY] as SceneState | undefined;
        if (raw) {
            cb({
                started: !!raw.started,
                round: typeof raw.round === "number" ? raw.round : 0,
                settings: migrateSettings(raw.settings),
            });
        } else {
            cb(null);
        }
    });

    // Subscribe to future changes
    return OBR.scene.onMetadataChange((meta) => {
        const raw = meta[SCENE_META_KEY] as SceneState | undefined;
        if (raw) {
            cb({
                started: !!raw.started,
                round: typeof raw.round === "number" ? raw.round : 0,
                settings: migrateSettings(raw.settings),
            });
        } else {
            cb(null);
        }
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
export async function createGroup(name: string, initiative: number = 0): Promise<Group> {
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    // Return a "virtual" group that will exist once tokens are added
    return {
        id,
        name: name.trim() || "New Group",
        active: false,
        initiative,
        staged: false,
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
 */
export async function clearAllGroupsActive(): Promise<void> {
    const groups = await getGroups();

    const { updateGroupActive } = await import("./metadata");
    for (const group of groups) {
        if (group.active) {
            await updateGroupActive(OBR, group.id, false);
        }
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