import { useCallback, useMemo } from "react";
import type { InitiativeItem } from "../components/InitiativeItem";

export type RingStyle = {
    color: string | null;
    weight: number;
    pattern: "solid" | "dash";
    opacity: number;
};

export type RingConfig = {
    movement: number;
    attackRange: number;
    movementStyle: RingStyle;
    rangeStyle: RingStyle;
};

/**
 * Centralized ring configuration management
 */
export function useRingState(row: InitiativeItem) {
    const config = useMemo((): RingConfig => ({
        movement: row.movement ?? 30,
        attackRange: row.attackRange ?? 60,
        movementStyle: {
            color: row.movementColor ?? "#519e00",
            weight: row.movementWeight ?? 10,
            pattern: row.movementPattern ?? "dash",
            opacity: row.movementOpacity ?? 1,
        },
        rangeStyle: {
            color: row.rangeColor ?? "#fe4c50",
            weight: row.rangeWeight ?? 10,
            pattern: row.rangePattern ?? "dash",
            opacity: row.rangeOpacity ?? 1,
        },
    }), [
        row.movement, row.attackRange,
        row.movementColor, row.movementWeight, row.movementPattern, row.movementOpacity,
        row.rangeColor, row.rangeWeight, row.rangePattern, row.rangeOpacity,
    ]);

    const createEnsureRingsConfig = useCallback((overrides: {
        variant?: "normal" | "dm";
        visible?: boolean;
        forceRecenter?: boolean;
    } = {}) => ({
        tokenId: row.id,
        movement: config.movement,
        attackRange: config.attackRange,
        moveAttached: false,
        rangeAttached: true,
        variant: "normal" as const,
        visible: true,
        movementColor: config.movementStyle.color,
        rangeColor: config.rangeStyle.color,
        movementWeight: config.movementStyle.weight,
        rangeWeight: config.rangeStyle.weight,
        movementPattern: config.movementStyle.pattern,
        rangePattern: config.rangeStyle.pattern,
        movementOpacity: config.movementStyle.opacity,
        rangeOpacity: config.rangeStyle.opacity,
        forceRecenter: false,
        ...overrides,
    }), [row.id, config]);

    return {
        config,
        createEnsureRingsConfig,
    };
}