import { useMemo } from "react";
import type { Combatant } from "../encounter";
import { ringStyle, type RingStyle } from "../overlays/rings";

export type { RingStyle };

export type RingConfig = {
    movement: number;
    attackRange: number;
    movementStyle: RingStyle;
    rangeStyle: RingStyle;
};

/** A combatant's ring settings with defaults applied, for the ring controls. */
export function useRingState(row: Combatant) {
    const config = useMemo((): RingConfig => ({
        movement: row.movement,
        attackRange: row.attackRange,
        movementStyle: ringStyle(row, "move"),
        rangeStyle: ringStyle(row, "range"),
    }), [row]);

    return { config };
}
