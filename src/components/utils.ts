// utils.ts
import type { InitiativeItem } from "./InitiativeItem";
import type { CMToken } from "./tokens";
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

/** UI label helper: "<5 ft" => "Touch", else "N ft" (rounded). */
export function formatDistanceLabel(feet: number): string {
    if (feet < 5) return "Touch";
    return `${Math.round(feet)} ft`;
}

/* ------------------------------------------------------------------ */
/*                  BOX EDGE-TO-EDGE DISTANCE (NEW)                   */
/* ------------------------------------------------------------------ */

export type BoxPx = {
    cx: number;        // center x in scene pixels
    cy: number;        // center y in scene pixels
    width: number;     // width in scene pixels
    height: number;    // height in scene pixels
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

/**
 * Minimal edge-to-edge distance between two axis-aligned rectangles (pixels).
 * Returns 0 when boxes overlap or touch (D&D "they fill their square").
 */
export function edgeToEdgeDistancePx(a: BoxPx, b: BoxPx): number {
    const ax1 = a.cx - a.width / 2;
    const ax2 = a.cx + a.width / 2;
    const ay1 = a.cy - a.height / 2;
    const ay2 = a.cy + a.height / 2;

    const bx1 = b.cx - b.width / 2;
    const bx2 = b.cx + b.width / 2;
    const by1 = b.cy - b.height / 2;
    const by2 = b.cy + b.height / 2;

    // Separation along each axis (0 if overlapping on that axis)
    const dx = Math.max(0, Math.max(ax1 - bx2, bx1 - ax2));
    const dy = Math.max(0, Math.max(ay1 - by2, by1 - ay2));

    // Hypotenuse for diagonal separation
    return Math.hypot(dx, dy);
}

/**
 * Distance between two CM tokens in **grid units (feet)**.
 * mode = "box": closest edge-to-edge of creature boxes (AABB).
 * mode = "center": center-to-center (no radii subtraction).
 */
export type TokenDistanceMode = "box" | "center";

export function distanceBetweenTokensUnits(
    a: CMToken,
    b: CMToken,
    grid: GridInfo,
    mode: TokenDistanceMode = "box"
): number {
    if (mode === "center") {
        const dx = a.position.x - b.position.x;
        const dy = a.position.y - b.position.y;
        return pixelsToUnits(Math.hypot(dx, dy), grid);
    }

    // "box" mode
    const ra = tokenToBoxPx(a, grid);
    const rb = tokenToBoxPx(b, grid);
    const px = edgeToEdgeDistancePx(ra, rb);
    return pixelsToUnits(px, grid);
}

/* ------------------------------------------------------------------ */
/*                  LEGACY POINT DISTANCE (KEPT)                      */
/* ------------------------------------------------------------------ */

export type DistanceMode = "center" | "edge";

/**
 * Legacy distance function:
 * - mode="center": center-to-center distance (in units)
 * - mode="edge": subtracts circular radii (in units), clamped to 0
 *
 * Prefer `distanceBetweenTokensUnits` with mode "box" for D&D squares.
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
