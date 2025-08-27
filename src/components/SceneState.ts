// src/scene/state.ts
import OBR from "@owlbear-rodeo/sdk";
import { getPluginId } from "../getPluginId";

export const SCENE_META_KEY = getPluginId("sceneState");

export type InitiativeSettings = {
    // Initiative List
    showArmor: boolean;
    showHP: boolean;
    showMovementRange: boolean;
    showAttackRange: boolean;
    showConditions: boolean;
    showDistances: boolean;

    // Gameplay
    disablePlayerList: boolean;
    displayHealthStatusToPlayer: boolean;
    displayPlayerHealthNumbers: boolean;
    showRangeRings: boolean;
    dmRingToggle: boolean;
};

export type SceneState = {
    started: boolean;
    round: number;
    settings: InitiativeSettings;
};

export const DEFAULT_SETTINGS: InitiativeSettings = {
    // Initiative List
    showArmor: true,
    showHP: true,
    showMovementRange: true,
    showAttackRange: true,
    showConditions: true,
    showDistances: true,

    // Gameplay
    disablePlayerList: false,
    displayHealthStatusToPlayer: true,
    displayPlayerHealthNumbers: true,
    showRangeRings: true,
    dmRingToggle: true,
};

const DEFAULT_SCENE_STATE: SceneState = {
    started: false,
    round: 0,
    settings: DEFAULT_SETTINGS,
};

export async function readSceneState(): Promise<SceneState | null> {
    const meta = await OBR.scene.getMetadata();
    const raw = meta[SCENE_META_KEY] as Partial<SceneState> | undefined;
    if (!raw) return null;
    return {
        started: !!raw.started,
        round: typeof raw.round === "number" ? raw.round : 0,
        settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) },
    };
}

export async function saveSceneState(patch: Partial<SceneState>) {
    // 1) read current scene metadata
    const prev = await OBR.scene.getMetadata();

    // 2) read current scene-state value (or defaults)
    const current = (prev[SCENE_META_KEY] as SceneState) ?? DEFAULT_SCENE_STATE;

    // 3) merge in the patch (deep-merge for settings)
    const next: SceneState = {
        ...current,
        ...patch,
        settings: {
            ...current.settings,
            ...(patch.settings ?? {}),
        },
    };

    // 4) write back the whole metadata object
    await OBR.scene.setMetadata({
        ...prev,
        [SCENE_META_KEY]: next,
    });
}

export function onSceneStateChange(cb: (state: SceneState | null) => void) {
    // Fire once immediately with current value
    OBR.scene.getMetadata().then((meta) => {
        const raw = meta[SCENE_META_KEY] as SceneState | undefined;
        if (raw) {
            cb({
                started: !!raw.started,
                round: typeof raw.round === "number" ? raw.round : 0,
                settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) },
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
                settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) },
            });
        } else {
            cb(null);
        }
    });
}
