import { useEffect, useState } from "react";
import type { CMToken } from "../components/tokens";
import { distancesFrom, type DistanceInfo } from "../battlefield/distance";
import { useGrid } from "./useGrid";

export type { DistanceInfo };

/**
 * Distances from one token to every token in `tokens`, nearest first.
 * Recomputed when tokens move, resize or change elevation, when the grid
 * changes, or when rounding is toggled. Pass `enabled: false` while hidden.
 */
export function useDistances(tokenId: string, tokens: CMToken[], enabled: boolean, round: boolean): DistanceInfo[] {
    const grid = useGrid();
    const [distances, setDistances] = useState<DistanceInfo[]>([]);

    useEffect(() => {
        if (!enabled || !grid) return;
        let cancelled = false;
        distancesFrom(tokenId, tokens, grid, { round })
            .then((list) => !cancelled && setDistances(list))
            .catch((error) => console.error("Failed to calculate distances:", error));
        return () => {
            cancelled = true;
        };
    }, [tokenId, tokens, enabled, grid, round]);

    return enabled ? distances : [];
}
