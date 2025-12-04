import { useEffect, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import {
    readSceneState,
    onSceneStateChange,
    saveSceneState,
    DEFAULT_SETTINGS,
    getGroups,
    type SceneState,
    type InitiativeSettings,
    type Group,
} from "../components/SceneState";

export function useSceneStateSync() {
    const [started, setStarted] = useState(false);
    const [round, setRound] = useState(0);
    const [settings, setSettings] = useState<InitiativeSettings>(DEFAULT_SETTINGS);
    const [groups, setGroups] = useState<Group[]>([]);

    useEffect(() => {
        let unmounted = false;

        const apply = (s: SceneState | null) => {
            if (!s) return;
            setStarted((prev) => (prev !== s.started ? s.started : prev));
            setRound((prev) => (prev !== s.round ? s.round : prev));
            setSettings((prev) => ({ ...prev, ...(s.settings ?? {}) }));
        };

        readSceneState().then((s) => !unmounted && apply(s)).catch(console.error);
        const unsub = onSceneStateChange(apply);

        return () => {
            unmounted = true;
            unsub();
        };
    }, []);

    // NEW: Separate effect to derive groups from tokens
    useEffect(() => {
        let unmounted = false;

        const updateGroups = () => {
            getGroups().then(g => {
                if (!unmounted) {
                    setGroups(g);
                }
            }).catch(console.error);
        };

        // Initial fetch
        updateGroups();

        // Subscribe to item changes to update groups
        const unsubItems = OBR.scene.items.onChange(() => {
            updateGroups();
        });

        return () => {
            unmounted = true;
            unsubItems();
        };
    }, []);

    const persistSettings = async (next: InitiativeSettings) => {
        setSettings(next);
        await saveSceneState({ settings: next });
    };

    const persistRoundStarted = async (s: boolean, r: number) => {
        setStarted(s);
        setRound(r);
        await saveSceneState({ started: s, round: r });
    };

    return {
        started, setStarted,
        round, setRound,
        settings, setSettings: persistSettings,
        groups,
        saveSceneState: persistRoundStarted
    };
}
