import { useSyncExternalStore } from "react";

/** Where the turn bar sits on screen. */
export type TurnBarPosition = "top-center" | "bottom-center" | "bottom-left" | "bottom-right";

/** A player's own turn bar preferences, kept per device. */
export type TurnBarPreferences = { position: TurnBarPosition; hidden: boolean };

export const POSITIONS: { value: TurnBarPosition; label: string }[] = [
    { value: "top-center", label: "Top" },
    { value: "bottom-center", label: "Bottom" },
    { value: "bottom-left", label: "Bottom left" },
    { value: "bottom-right", label: "Bottom right" },
];

const STORAGE_KEY = "com.missing-link-dev.battle-board/turnBar";
const DEFAULTS: TurnBarPreferences = { position: "bottom-left", hidden: false };

let cached: TurnBarPreferences | null = null;
const listeners = new Set<() => void>();

function read(): TurnBarPreferences {
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<TurnBarPreferences> | null;
        return {
            position: POSITIONS.some((p) => p.value === raw?.position) ? raw!.position! : DEFAULTS.position,
            hidden: raw?.hidden === true,
        };
    } catch {
        return DEFAULTS;
    }
}

function getPreferences(): TurnBarPreferences {
    return (cached ??= read());
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** Other frames of the extension (the tracker, the bar) share this origin's storage. */
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("storage", (e) => {
        if (e.key !== STORAGE_KEY) return;
        cached = null;
        listeners.forEach((l) => l());
    });
}

export function setPreferences(patch: Partial<TurnBarPreferences>) {
    cached = { ...getPreferences(), ...patch };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
    } catch {
        // Storage blocked: the change lasts until this frame reloads.
    }
    listeners.forEach((l) => l());
}

export function useTurnBarPreferences(): TurnBarPreferences {
    return useSyncExternalStore(subscribe, getPreferences);
}
