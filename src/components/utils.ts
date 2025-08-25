// utils.ts
import type { InitiativeItem } from "./InitiativeItem";
import OBR from "@owlbear-rodeo/sdk";

export type GridInfo = { dpi: number; unitsPerCell: number };

let _gridInfoCache: GridInfo | null = null;
export async function getGridInfo(): Promise<GridInfo> {
    if (_gridInfoCache) return _gridInfoCache;
    const [dpi, scale] = await Promise.all([
        OBR.scene.grid.getDpi(),
        OBR.scene.grid.getScale(),
    ]);
    const unitsPerCell = scale.parsed?.multiplier ?? 5; // default to 5 ft per cell
    _gridInfoCache = { dpi, unitsPerCell };
    return _gridInfoCache;
}

/** Convert pixels → scene units (e.g., feet). */
export function pixelsToUnits(px: number, grid: GridInfo): number {
    // px / (px per cell) * (units per cell)
    return (px / grid.dpi) * grid.unitsPerCell;
}

/** Convert scene units (e.g., feet) → pixels using the current grid. */
export function unitsToPixels(units: number, grid: GridInfo): number {
    return (units / grid.unitsPerCell) * grid.dpi;
}

/** Round to nearest foot (or unit). */
export function formatFeet(n: number): number {
    return Math.round(n);
}

export type DistanceMode = "center" | "edge";

/**
 * One distance function to rule them all.
 * - mode="center": pure center-to-center distance (in grid units, e.g., feet)
 * - mode="edge": subtracts radii (in units) from both ends, clamped to 0
 *
 * Pass radii when using edge mode (e.g., CMToken.radiusFeet). If omitted, treated as 0.
 */
export function distanceInUnits(
    a: { x: number; y: number },
    b: { x: number; y: number },
    grid: GridInfo,
    mode: DistanceMode = "center",
    radii?: { radiusAUnits?: number; radiusBUnits?: number }
): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const center = pixelsToUnits(Math.hypot(dx, dy), grid);

    if (mode === "center") return center;

    const rA = radii?.radiusAUnits ?? 0;
    const rB = radii?.radiusBUnits ?? 0;
    return Math.max(0, center - (rA + rB));
}

/* -------------------- Sorting / math utils (kept) -------------------- */

export function sortByInitiativeDesc(list: InitiativeItem[]) {
    return [...list].sort((a, b) => {
        const ai = a.initiative ?? 0;
        const bi = b.initiative ?? 0;

        const af = Math.floor(ai);
        const bf = Math.floor(bi);

        // Primary: higher integer bucket first (15 before any 14.x)
        if (bf !== af) return bf - af;

        // Secondary (same integer): smaller decimal first (14 before 14.1 before 14.2)
        if (ai !== bi) return ai - bi;

        // Tertiary: stable fallback so order doesn’t jump around on ties
        return (a.name ?? "").localeCompare(b.name ?? "");
    });
}

/** Clamp a number between min and max */
export const clamp = (n: number, min: number, max: number) =>
    Math.min(Math.max(n, min), max);

/** Supports "+5", "-3", "17", "52-4+3" (only + and -). Falls back to base if unparsable. */
export const evalMathInput = (raw: string, base: number): number => {
    const s = (raw ?? "").trim();
    if (!s) return base;

    if (/^[+-]\d+$/.test(s)) return base + Number(s); // relative
    if (/^\d+$/.test(s)) return Number(s);            // absolute

    if (/^[+-]?\d+(?:[+-]\d+)+$/.test(s)) {           // chain
        const parts = s.match(/[+-]?\d+/g) ?? [];
        return parts.reduce((acc, t) => acc + Number(t), 0);
    }
    return base;
};
