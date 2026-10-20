import { useEffect } from "react";
import { obrAdapter } from "../obr/obrAdapter";
import { startRingSync } from "../overlays/ringSync";
import { readGrid } from "../battlefield/grid";

/** Keep range rings in sync while the tracker is open (GM clients only). */
export function useRingSync(ready: boolean) {
    useEffect(() => {
        if (!ready) return;
        return startRingSync(obrAdapter, () => readGrid(obrAdapter));
    }, [ready]);
}
