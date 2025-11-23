import OBR from "@owlbear-rodeo/sdk";
import { getPluginId } from "../getPluginId";

export const SCENE_META_KEY = getPluginId("sceneState");

/** New unified health mode for what players can see */
export type HealthMode = "none" | "status" | "numbers";

/** NEW: Groups stored on the scene (renamed from EncounterGroup) */
export type Group = {
    id: string;   // stable unique id
    name: string; // display name
    active: boolean; // whether this group is currently active in initiative (whose turn it is)
    initiative: number;
    staged?: boolean; // NEW: whether group is staged (in list but not participating in initiative yet)
};

export type InitiativeSettings = {
    // Display Settings (Initiative List)
    showArmor: boolean;
    showHP: boolean;
    showMovementRange: boolean;
    showAttackRange: boolean;
    showConditions: boolean;
    showDistances: boolean;
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

export type SceneState = {
    started: boolean;
    round: number;
    settings: InitiativeSettings;
    groups: Group[]; // renamed from encounters.groups, flattened structure
};

export const DEFAULT_SETTINGS: InitiativeSettings = {
    // Display Settings
    showArmor: true,
    showHP: true,
    showMovementRange: true,
    showAttackRange: true,
    showConditions: true,
    showDistances: true,
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
    groups: [], // simplified structure
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

    return merged;
}

/** NEW: migrate/seed groups container */
function migrateGroups(groups: Group[] | any | undefined): Group[] {
    // Handle old encounters.groups structure
    if (groups && typeof groups === "object" && Array.isArray(groups.groups)) {
        groups = groups.groups;
    }

    if (!Array.isArray(groups)) return [];

    // Ensure each group has required fields (defensive) and add active field if missing
    return groups
        .filter((g) => g && typeof g.id === "string" && typeof g.name === "string")
        .map((g) => ({
            id: g.id,
            name: g.name,
            active: typeof g.active === "boolean" ? g.active : false,
            initiative: typeof g.initiative === "number" ? g.initiative : 0,
            staged: typeof g.staged === "boolean" ? g.staged : false, // NEW: default to false (participating)
        }));
}

export async function readSceneState(): Promise<SceneState | null> {
    const meta = await OBR.scene.getMetadata();
    const raw = meta[SCENE_META_KEY] as Partial<SceneState> | undefined;
    if (!raw) return null;

    return {
        started: !!raw.started,
        round: typeof raw.round === "number" ? raw.round : 0,
        settings: migrateSettings(raw.settings),
        groups: migrateGroups((raw as any).groups || (raw as any).encounters), // handle both old and new
    };
}

export async function saveSceneState(patch: Partial<SceneState>) {
    // 1) read current scene metadata
    const prev = await OBR.scene.getMetadata();
    // 2) read current scene-state value (or defaults)
    const current = (prev[SCENE_META_KEY] as SceneState) ?? DEFAULT_SCENE_STATE;

    // 3) FIXED: Preserve existing groups when not explicitly updating them
    let nextGroups = current.groups || [];
    if (patch.groups !== undefined) {
        nextGroups = migrateGroups(patch.groups);
    }

    // 4) deep-merge settings only when provided
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
        groups: nextGroups,
    };

    // 5) write back the whole metadata object
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
                groups: migrateGroups((raw as any).groups || (raw as any).encounters),
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
                groups: migrateGroups((raw as any).groups || (raw as any).encounters),
            });
        } else {
            cb(null);
        }
    });
}

// ========== GROUP MANAGEMENT FUNCTIONS ==========

export async function createGroup(name: string, initiative: number = 0): Promise<Group> {
    const id = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const state = (await readSceneState()) ?? DEFAULT_SCENE_STATE;
    const groups: Group[] = state.groups ?? [];
    const group: Group = {
        id,
        name: name.trim() || "New Group",
        active: false,
        initiative,
        staged: false, // NEW: groups start as active (not staged) by default
    };
    await saveSceneState({ groups: [...groups, group] });
    return group;
}

export async function updateGroupInitiative(groupId: string, initiative: number): Promise<void> {
    const state = (await readSceneState()) ?? DEFAULT_SCENE_STATE;
    const groups: Group[] = (state.groups ?? []).map(g =>
        g.id === groupId ? { ...g, initiative } : g
    );
    await saveSceneState({ groups });

    // NEW: Sync all tokens in the group to match the new initiative
    const { syncGroupTokensInitiative } = await import("./metadata");
    await syncGroupTokensInitiative(OBR, groupId, initiative);
}

export async function renameGroup(id: string, newName: string): Promise<void> {
    const state = (await readSceneState()) ?? DEFAULT_SCENE_STATE;
    const groups: Group[] = (state.groups ?? []).map(g =>
        g.id === id ? { ...g, name: newName.trim() || g.name } : g
    );
    await saveSceneState({ groups });
}

export async function deleteGroup(id: string): Promise<void> {
    const state = (await readSceneState()) ?? DEFAULT_SCENE_STATE;
    const groups: Group[] = (state.groups ?? []).filter(g => g.id !== id);
    await saveSceneState({ groups });
}

export async function setGroupActive(id: string, active: boolean): Promise<void> {
    const state = (await readSceneState()) ?? DEFAULT_SCENE_STATE;
    const groups: Group[] = (state.groups ?? []).map(g =>
        g.id === id ? { ...g, active } : g
    );
    await saveSceneState({ groups });
}

export async function clearAllGroupsActive(): Promise<void> {
    const state = (await readSceneState()) ?? DEFAULT_SCENE_STATE;
    const groups: Group[] = (state.groups ?? []).map(g => ({ ...g, active: false }));
    await saveSceneState({ groups });
}

// NEW: Staging functions
export async function setGroupStaged(id: string, staged: boolean): Promise<void> {
    const state = (await readSceneState()) ?? DEFAULT_SCENE_STATE;
    const groups: Group[] = (state.groups ?? []).map(g =>
        g.id === id ? { ...g, staged } : g
    );
    await saveSceneState({ groups });
}

export async function getGroups(): Promise<Group[]> {
    const state = await readSceneState();
    return state?.groups ?? [];
}

export async function getActiveGroup(): Promise<Group | null> {
    const groups = await getGroups();
    return groups.find(g => g.active) ?? null;
}

export async function getStagedGroups(): Promise<Group[]> {
    const groups = await getGroups();
    return groups.filter(g => g.staged);
}

export async function getParticipatingGroups(): Promise<Group[]> {
    const groups = await getGroups();
    return groups.filter(g => !g.staged);
}