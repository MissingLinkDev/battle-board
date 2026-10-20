import { useEffect } from "react";
import { obrAdapter } from "../obr/obrAdapter";
import { startDistanceLineSync } from "../overlays/distanceLineSync";
import { readGrid } from "../battlefield/grid";

/** Keep distance lines in sync while the tracker is open (GM clients only). */
export function useDistanceLineSync(ready: boolean) {
    useEffect(() => {
        if (!ready) return;
        return startDistanceLineSync(obrAdapter, () => readGrid(obrAdapter));
    }, [ready]);
}
