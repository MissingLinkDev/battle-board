import { useEffect } from "react";
import { encounterStore } from "../encounter";
import { startTurnEndSync } from "../encounter/turnEndSync";
import { obrAdapter } from "../obr/obrAdapter";

/** Advance the turn when players end it from their turn bars (GM clients only). */
export function useTurnEndSync(ready: boolean) {
    useEffect(() => {
        if (!ready) return;
        return startTurnEndSync(obrAdapter, encounterStore);
    }, [ready]);
}
