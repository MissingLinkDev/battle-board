import { useSyncExternalStore } from "react";
import { obrAdapter } from "../obr/obrAdapter";
import { createSettingsStore, type SettingsState } from "./store";

/** The settings store for this frame, connected to the real Owlbear SDK. */
export const settingsStore = createSettingsStore(obrAdapter);

export function useSettings(): SettingsState {
    return useSyncExternalStore(settingsStore.subscribe, settingsStore.getState);
}

export { DEFAULT_SETTINGS, ROOM_META_KEY, type HealthMode, type InitiativeSettings } from "./settings";
