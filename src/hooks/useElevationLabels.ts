import { useEffect } from "react";
import { obrAdapter } from "../obr/obrAdapter";
import { startElevationLabelSync } from "../overlays/elevationLabelSync";
import { readGrid } from "../battlefield/grid";

/** Keep elevation labels in sync while the tracker is open (GM clients only). */
export function useElevationLabels(ready: boolean) {
    useEffect(() => {
        if (!ready) return;
        return startElevationLabelSync(obrAdapter, () => readGrid(obrAdapter));
    }, [ready]);
}
