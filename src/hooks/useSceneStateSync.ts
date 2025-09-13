import { useEffect, useState } from "react";
import {
    readSceneState,
    onSceneStateChange,
    saveSceneState,
    DEFAULT_SETTINGS,
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
            setGroups(() => s.groups ?? []);
        };

        readSceneState().then((s) => !unmounted && apply(s)).catch(console.error);
        const unsub = onSceneStateChange(apply);

        return () => {
            unmounted = true;
            unsub();
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
