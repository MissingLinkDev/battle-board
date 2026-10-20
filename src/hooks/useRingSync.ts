import { useEffect } from "react";
import { obrAdapter } from "../obr/obrAdapter";
import { startRingSync } from "../overlays/ringSync";
import { getGridInfo } from "../components/utils";

/** Keep range rings in sync while the tracker is open (GM clients only). */
export function useRingSync(ready: boolean) {
    useEffect(() => {
        if (!ready) return;
        return startRingSync(obrAdapter, getGridInfo);
    }, [ready]);
}
