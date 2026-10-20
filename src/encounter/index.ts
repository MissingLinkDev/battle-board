import { useSyncExternalStore } from "react";
import { obrAdapter } from "../obr/obrAdapter";
import { createEncounterStore, type EncounterState } from "./store";

/** The encounter store for this frame, connected to the real Owlbear SDK. */
export const encounterStore = createEncounterStore(obrAdapter);

export function useEncounter(): EncounterState {
    return useSyncExternalStore(encounterStore.subscribe, encounterStore.getState);
}

export type { EncounterState, GroupTarget } from "./store";
export type { Combatant, CombatantPatch } from "./combatant";
export type { Group } from "./groups";
