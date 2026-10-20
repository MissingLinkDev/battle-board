import { useEffect, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import {
    readSceneState,
    onSceneStateChange,
    saveSceneState,
    DEFAULT_SETTINGS,
    ROOM_META_KEY,
    type SceneState,
    type InitiativeSettings,
} from "../components/SceneState";

/** Room settings. (Encounter started/round live in the Encounter store.) */
export function useSceneStateSync() {
    const [settings, setSettings] = useState<InitiativeSettings>(DEFAULT_SETTINGS);

    useEffect(() => {
        let unmounted = false;

        const apply = (s: SceneState | null) => {
            if (!s) return;
            setSettings((prev) => ({ ...prev, ...(s.settings ?? {}) }));
        };

        readSceneState().then((s) => !unmounted && apply(s)).catch(console.error);
        const unsubScene = onSceneStateChange(apply);

        // Listen for room metadata changes (settings are stored at room level)
        const unsubRoom = OBR.room.onMetadataChange((meta) => {
            if (unmounted) return;
            const raw = meta[ROOM_META_KEY] as InitiativeSettings | undefined;
            if (raw) {
                // Merge with defaults to handle any missing fields
                setSettings(() => ({ ...DEFAULT_SETTINGS, ...raw }));
            }
        });

        return () => {
            unmounted = true;
            unsubScene();
            unsubRoom();
        };
    }, []);

    const persistSettings = async (next: InitiativeSettings) => {
        setSettings(next);
        await saveSceneState({ settings: next });
    };

    return { settings, setSettings: persistSettings };
}
