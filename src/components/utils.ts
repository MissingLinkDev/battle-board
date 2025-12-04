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

export function formatFeet(n: number, roundDistances: boolean = true, gridUnits: number = 5): number {
    if (roundDistances) {
        // Round to nearest grid unit (e.g., nearest 5 ft)
        return Math.round(n / gridUnits) * gridUnits;
    }
    // Round to whole number (1 ft increments)
    return Math.round(n);
}

/** Label helper with unit: "<multiplier unit" => "Touch", else "N unit" (rounded). */
export function formatDistanceLabel(
    valueInUnits: number,
    unit: string = "ft",
    touchThresholdUnits: number = 5,
    roundDistances: boolean = true,
    gridUnits: number = 5
): string {
    if (valueInUnits < touchThresholdUnits) return "Touch";
    const formatted = formatFeet(valueInUnits, roundDistances, gridUnits);
    // Both modes return whole numbers, so display as integer
    return `${formatted} ${unit}`;
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

/** 3D axis-aligned bounding box in scene units (e.g., feet). */
export type Box3D = {
    cx: number;      // center x (units)
    cy: number;      // center y (units)
    cz: number;      // center z (units) - elevation to center of cube
    width: number;   // x-axis size (units)
    height: number;  // y-axis size (units)
    depth: number;   // z-axis size (units)
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

/** Build a 3D AABB in scene units from a CMToken. Tokens are cubes where size = max(width, height). */
export function tokenToBox3D(token: CMToken, grid: GridInfo, elevation: number): Box3D {
    // Token positions are in pixels, convert to units
    const cx = pixelsToUnits(token.position.x, grid);
    const cy = pixelsToUnits(token.position.y, grid);

    // Tokens are cubes: size = max(width, height)
    const cubeSize = Math.max(token.widthFeet, token.heightFeet);

    // Elevation is bottom of cube, so center z = elevation + cubeSize/2
    const cz = elevation + cubeSize / 2;

    return {
        cx,
        cy,
        cz,
        width: cubeSize,
        height: cubeSize,
        depth: cubeSize,
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

/**
 * Find the closest distance between two 3D AABBs in scene units.
 *
 * For each axis, we calculate the gap between the boxes:
 * - If they overlap on that axis, gap = 0
 * - Otherwise, gap = distance between nearest edges
 *
 * The 3D distance is the Euclidean distance of these gaps.
 */
export function closestPointsOnAABBs3D(
    a: Box3D,
    b: Box3D
): { pointA: { x: number; y: number; z: number }; pointB: { x: number; y: number; z: number }; distance: number } {
    // Calculate AABB bounds
    const ax1 = a.cx - a.width / 2, ax2 = a.cx + a.width / 2;
    const ay1 = a.cy - a.height / 2, ay2 = a.cy + a.height / 2;
    const az1 = a.cz - a.depth / 2, az2 = a.cz + a.depth / 2;

    const bx1 = b.cx - b.width / 2, bx2 = b.cx + b.width / 2;
    const by1 = b.cy - b.height / 2, by2 = b.cy + b.height / 2;
    const bz1 = b.cz - b.depth / 2, bz2 = b.cz + b.depth / 2;

    // For each axis, find the gap between boxes (0 if overlapping)
    const xGap = Math.max(0, Math.max(ax1 - bx2, bx1 - ax2));
    const yGap = Math.max(0, Math.max(ay1 - by2, by1 - ay2));
    const zGap = Math.max(0, Math.max(az1 - bz2, bz1 - az2));

    // The minimum distance is the Euclidean distance of the gaps
    const distance = Math.sqrt(xGap * xGap + yGap * yGap + zGap * zGap);

    // Calculate the actual closest points for visualization (optional, but kept for API compatibility)
    const pointA = {
        x: xGap > 0 ? (ax1 > bx2 ? ax1 : ax2) : _clamp(b.cx, ax1, ax2),
        y: yGap > 0 ? (ay1 > by2 ? ay1 : ay2) : _clamp(b.cy, ay1, ay2),
        z: zGap > 0 ? (az1 > bz2 ? az1 : az2) : _clamp(b.cz, az1, az2),
    };

    const pointB = {
        x: xGap > 0 ? (bx1 > ax2 ? bx1 : bx2) : _clamp(a.cx, bx1, bx2),
        y: yGap > 0 ? (by1 > ay2 ? by1 : by2) : _clamp(a.cy, by1, by2),
        z: zGap > 0 ? (bz1 > az2 ? bz1 : bz2) : _clamp(a.cz, bz1, bz2),
    };

    return { pointA, pointB, distance };
}

export type TokenDistanceMode = "box" | "center";

/**
 * Distance between two CM tokens in scene units (e.g., feet).
 *
 * Tokens are treated as equal-sided cubes (size = max(width, height)).
 * Elevation represents the bottom of the token cube.
 * Distance is calculated as closest point on cube A to closest point on cube B
 * in true 3D space, then 1 grid unit is added so adjacent tokens read as "1 grid apart".
 *
 * - mode="box": 3D edge-to-edge + 1 grid unit (recommended)
 * - mode="center": pure center-to-center distance (ignores token size)
 *
 * @param a First token
 * @param b Second token
 * @param mode Distance mode (box or center)
 * @param elevationA Optional elevation of first token's bottom in scene units
 * @param elevationB Optional elevation of second token's bottom in scene units
 * @returns Distance in scene units
 */
export async function obrDistanceBetweenTokensUnits(
    a: CMToken,
    b: CMToken,
    mode: TokenDistanceMode = "box",
    elevationA: number = 0,
    elevationB: number = 0
): Promise<number> {
    const grid = await getGridInfo();

    if (mode === "center") {
        // Pure center-to-center (unchanged)
        const horizontalDistanceCells = await OBR.scene.grid.getDistance(
            { x: a.position.x, y: a.position.y },
            { x: b.position.x, y: b.position.y }
        );
        const horizontalDistance = horizontalDistanceCells * grid.unitsPerCell;
        const elevationDiff = Math.abs(elevationA - elevationB);

        if (elevationDiff === 0) return horizontalDistance;
        return Math.sqrt(horizontalDistance * horizontalDistance + elevationDiff * elevationDiff);
    }

    // "box" mode: 3D edge-to-edge + 1 grid unit
    const boxA = tokenToBox3D(a, grid, elevationA);
    const boxB = tokenToBox3D(b, grid, elevationB);
    const { distance } = closestPointsOnAABBs3D(boxA, boxB);

    // Add 1 grid unit so adjacent tokens show as "1 grid apart"
    return distance + grid.unitsPerCell;
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
