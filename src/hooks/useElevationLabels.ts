import { useEffect } from "react";
import { obrAdapter } from "../obr/obrAdapter";
import { startElevationLabelSync } from "../overlays/elevationLabelSync";
import { getGridInfo } from "../components/utils";

/** Keep elevation labels in sync while the tracker is open (GM clients only). */
export function useElevationLabels(ready: boolean) {
    useEffect(() => {
        if (!ready) return;
        return startElevationLabelSync(obrAdapter, getGridInfo);
    }, [ready]);
}
