import { useEffect, useState } from "react";
import { obrAdapter } from "../obr/obrAdapter";
import { readGrid, type GridSnapshot } from "../battlefield/grid";

/** The scene's grid, re-read whenever the GM changes it. Null until first read. */
export function useGrid(): GridSnapshot | null {
    const [grid, setGrid] = useState<GridSnapshot | null>(null);
    useEffect(() => {
        let live = true;
        const refresh = () => readGrid(obrAdapter).then((g) => live && setGrid(g)).catch(console.error);
        refresh();
        const unsubscribe = obrAdapter.grid.onChange(refresh);
        return () => {
            live = false;
            unsubscribe();
        };
    }, []);
    return grid;
}
