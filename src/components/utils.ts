// utils.ts
import OBR from "@owlbear-rodeo/sdk";
import type { InitiativeItem } from "./InitiativeItem";
import type { CMToken } from "./tokens";

/* =========================
   Grid helpers
   ========================= */

export type GridInfo = {
    dpi: number;
    unitsPerCell: number;   // e.g., 5
    unitLabel: string;      // e.g., "ft"
};

let _gridInfoCache: GridInfo | null = null;
export async function getGridInfo(): Promise<GridInfo> {
    if (_gridInfoCache) return _gridInfoCache;

    const [dpi, scale] = await Promise.all([
        OBR.scene.grid.getDpi(),
        OBR.scene.grid.getScale(),
    ]);

    // In current OBR SDK, scale.parsed?.multiplier and scale.parsed?.unit hold what we want.
    const unitsPerCell = scale.parsed?.multiplier ?? 5;
    const unitLabel = (scale.parsed?.unit ?? "ft").toString();

    _gridInfoCache = { dpi, unitsPerCell, unitLabel };
    return _gridInfoCache;
}

export function getCachedGridUnits() {
    // returns latest fetched grid units or safe defaults
    return _gridInfoCache
        ? { unitLabel: _gridInfoCache.unitLabel, unitsPerCell: _gridInfoCache.unitsPerCell }
        : { unitLabel: "ft", unitsPerCell: 5 };
}

/** Convert pixels → scene units (e.g., feet). */
export function pixelsToUnits(px: number, grid: GridInfo): number {
    return (px / grid.dpi) * grid.unitsPerCell;
}

/** Convert scene units (e.g., feet) → pixels using the current grid. */
export function unitsToPixels(units: number, grid: GridInfo): number {
    return (units / grid.unitsPerCell) * grid.dpi;
}

/* =========================
   Distance labels
   ========================= */

export function formatFeet(n: number): number {
    return Math.round(n);
}

/** Label helper with unit: "<multiplier unit" => "Touch", else "N unit" (rounded). */
export function formatDistanceLabel(valueInUnits: number, unit: string = "ft", touchThresholdUnits: number = 5): string {
    if (valueInUnits < touchThresholdUnits) return "Touch";
    return `${Math.round(valueInUnits)} ${unit}`;
}

/* =========================
   Token box + OBR distance
   ========================= */

/** Axis-aligned token rectangle in scene pixels. */
export type BoxPx = {
    cx: number;   // center x (pixels)
    cy: number;   // center y (pixels)
    width: number;
    height: number;
};

/** Build an axis-aligned rectangle (AABB) in pixels from a CMToken. */
export function tokenToBoxPx(token: CMToken, grid: GridInfo): BoxPx {
    return {
        cx: token.position.x,
        cy: token.position.y,
        width: unitsToPixels(token.widthFeet, grid),
        height: unitsToPixels(token.heightFeet, grid),
    };
}

const _clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** Nearest points on A and B (AABBs) in pixels for edge-to-edge measurement. */
export function closestPointsOnAABBsPx(
    a: BoxPx,
    b: BoxPx
): { aPx: { x: number; y: number }; bPx: { x: number; y: number } } {
    const ax1 = a.cx - a.width / 2, ax2 = a.cx + a.width / 2;
    const ay1 = a.cy - a.height / 2, ay2 = a.cy + a.height / 2;

    const bx1 = b.cx - b.width / 2, bx2 = b.cx + b.width / 2;
    const by1 = b.cy - b.height / 2, by2 = b.cy + b.height / 2;

    const aPx = { x: _clamp(b.cx, ax1, ax2), y: _clamp(b.cy, ay1, ay2) };
    const bPx = { x: _clamp(a.cx, bx1, bx2), y: _clamp(a.cy, by1, by2) };

    return { aPx, bPx };
}

export type TokenDistanceMode = "box" | "center";

/**
 * Distance between two CM tokens in scene units (e.g., feet), using Owlbear's
 * current measurement style (Chebyshev/Alternating/Manhattan/Euclidean) and scale.
 * - mode="box": nearest edge-to-edge of the token squares (recommended).
 * - mode="center": center-to-center.
 *
 * @param a First token
 * @param b Second token
 * @param mode Distance mode (box or center)
 * @param elevationA Optional elevation of first token in scene units
 * @param elevationB Optional elevation of second token in scene units
 */
export async function obrDistanceBetweenTokensUnits(
    a: CMToken,
    b: CMToken,
    mode: TokenDistanceMode = "box",
    elevationA: number = 0,
    elevationB: number = 0
): Promise<number> {
    let horizontalDistance: number;

    if (mode === "center") {
        horizontalDistance = await OBR.scene.grid.getDistance(
            { x: a.position.x, y: a.position.y },
            { x: b.position.x, y: b.position.y }
        );
    } else {
        const grid = await getGridInfo();
        const ra = tokenToBoxPx(a, grid);
        const rb = tokenToBoxPx(b, grid);
        const { aPx, bPx } = closestPointsOnAABBsPx(ra, rb);
        const cells = await OBR.scene.grid.getDistance(aPx, bPx);
        horizontalDistance = cells * grid.unitsPerCell;
    }

    // Calculate elevation difference
    const elevationDiff = Math.abs(elevationA - elevationB);

    // If there's no elevation difference, return horizontal distance
    if (elevationDiff === 0) {
        return horizontalDistance;
    }

    // Calculate 3D distance using Pythagorean theorem
    // This respects the grid's distance measurement style for horizontal distance
    // and adds vertical distance component
    return Math.sqrt(horizontalDistance * horizontalDistance + elevationDiff * elevationDiff);
}

/** Convenience wrapper for arbitrary pixel points. Returns scene units. */
export async function obrDistanceBetweenPointsUnits(
    fromPx: { x: number; y: number },
    toPx: { x: number; y: number }
): Promise<number> {
    const grid = await getGridInfo();
    const cells = await OBR.scene.grid.getDistance(fromPx, toPx);
    return cells * grid.unitsPerCell;
}

/* =========================
   Sorting / small math utils
   ========================= */

export function sortByInitiativeDesc(list: InitiativeItem[]) {
    return [...list].sort((a, b) => {
        const ai = a.initiative ?? 0;
        const bi = b.initiative ?? 0;

        const af = Math.floor(ai);
        const bf = Math.floor(bi);

        if (bf !== af) return bf - af;            // higher integer bucket first
        if (ai !== bi) return ai - bi;            // then smaller decimal first
        return (a.name ?? "").localeCompare(b.name ?? ""); // stable by name
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
