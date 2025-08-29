// src/scene/state.ts
import OBR from "@owlbear-rodeo/sdk";
import { getPluginId } from "../getPluginId";

export const SCENE_META_KEY = getPluginId("sceneState");

/** New unified health mode for what players can see */
export type HealthMode = "none" | "status" | "numbers";

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
};

export type SceneState = {
    started: boolean;
    round: number;
    settings: InitiativeSettings;
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
    // Default the player list to HIDDEN for players (UI toggle will start OFF)
    disablePlayerList: true,

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

    return merged;
}

export async function readSceneState(): Promise<SceneState | null> {
    const meta = await OBR.scene.getMetadata();
    const raw = meta[SCENE_META_KEY] as Partial<SceneState> | undefined;
    if (!raw) return null;

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

    // 3) deep-merge with migration on settings
    const nextSettings = migrateSettings({
        ...current.settings,
        ...(patch.settings ?? {}),
    });

    const next: SceneState = {
        ...current,
        ...patch,
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
