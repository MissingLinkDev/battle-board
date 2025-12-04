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
    // Round to whole number (1 unit increments)
    // Grid measurement type handles snapping to grid cells
    return Math.round(n);
}

/** Label helper with unit: "<threshold" => "Touch", else "N unit" (rounded). */
export function formatDistanceLabel(
    valueInUnits: number,
    unit: string = "ft",
    touchThresholdUnits: number = 5
): string {
    if (valueInUnits < touchThresholdUnits) return "Touch";
    const formatted = formatFeet(valueInUnits);
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

/** 3D point/vector */
export type Vec3 = { x: number; y: number; z: number };

/** Calculate 3D Euclidean distance between two points */
function distance3D(a: Vec3, b: Vec3): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Generate centers of sub-blocks for a token based on grid size.
 *
 * Each token is subdivided into grid-sized cubes. For example, a 10×10×10 token
 * with 5ft grid becomes 2×2×2 = 8 sub-blocks. Tokens smaller than grid size
 * have a single sub-block at their center.
 *
 * @param box Token's 3D bounding box in scene units
 * @param gridUnitsPerCell Grid size in scene units (e.g., 5 for 5ft grid)
 * @returns Array of sub-block center positions
 */
function generateSubBlockCenters(box: Box3D, gridUnitsPerCell: number): Vec3[] {
    // Calculate number of sub-blocks in each dimension
    // Use Math.max to ensure at least 1 block even for tiny tokens
    const blocksX = Math.max(1, Math.round(box.width / gridUnitsPerCell));
    const blocksY = Math.max(1, Math.round(box.height / gridUnitsPerCell));
    const blocksZ = Math.max(1, Math.round(box.depth / gridUnitsPerCell));

    // Calculate the actual size of each sub-block
    const blockSizeX = box.width / blocksX;
    const blockSizeY = box.height / blocksY;
    const blockSizeZ = box.depth / blocksZ;

    const centers: Vec3[] = [];

    // Generate centers for all sub-blocks
    for (let ix = 0; ix < blocksX; ix++) {
        for (let iy = 0; iy < blocksY; iy++) {
            for (let iz = 0; iz < blocksZ; iz++) {
                // Calculate offset from token center for this sub-block
                // Center of block i is at (i + 0.5) * blockSize - (totalSize / 2)
                const offsetX = (ix + 0.5) * blockSizeX - box.width / 2;
                const offsetY = (iy + 0.5) * blockSizeY - box.height / 2;
                const offsetZ = (iz + 0.5) * blockSizeZ - box.depth / 2;

                centers.push({
                    x: box.cx + offsetX,
                    y: box.cy + offsetY,
                    z: box.cz + offsetZ,
                });
            }
        }
    }

    return centers;
}

/**
 * Find the pair of sub-blocks (one from each token) that are closest together.
 *
 * Uses brute force O(n×m) comparison, which is acceptable for typical token sizes:
 * - Large (2×2×2 = 8) vs Huge (3×3×3 = 27): 216 comparisons
 * - Gargantuan (4×4×4 = 64) vs Gargantuan: 4,096 comparisons
 *
 * @param centersA Sub-block centers for token A
 * @param centersB Sub-block centers for token B
 * @returns Closest points and distance between them
 */
function findNearestSubBlockPair(
    centersA: Vec3[],
    centersB: Vec3[]
): { pointA: Vec3; pointB: Vec3; distance: number } {
    let minDistance = Infinity;
    let bestA: Vec3 = centersA[0];
    let bestB: Vec3 = centersB[0];

    for (const centerA of centersA) {
        for (const centerB of centersB) {
            const dist = distance3D(centerA, centerB);
            if (dist < minDistance) {
                minDistance = dist;
                bestA = centerA;
                bestB = centerB;
            }
        }
    }

    return {
        pointA: bestA,
        pointB: bestB,
        distance: minDistance,
    };
}

/**
 * Calculate distance between two tokens using sub-block center-to-center method.
 *
 * This method:
 * 1. Subdivides each token into grid-sized sub-blocks
 * 2. Finds which sub-blocks are nearest between the two tokens
 * 3. Returns the Euclidean distance between those sub-block centers
 *
 * This replaces the previous edge-to-edge AABB calculation for more accurate
 * distance measurement, especially for large creatures.
 *
 * @param a First token's 3D box
 * @param b Second token's 3D box
 * @param gridUnitsPerCell Grid size for sub-block calculation
 * @returns Closest points and distance between them
 */
export function closestSubBlockDistance3D(
    a: Box3D,
    b: Box3D,
    gridUnitsPerCell: number
): { pointA: Vec3; pointB: Vec3; distance: number } {
    const centersA = generateSubBlockCenters(a, gridUnitsPerCell);
    const centersB = generateSubBlockCenters(b, gridUnitsPerCell);
    return findNearestSubBlockPair(centersA, centersB);
}

/**
 * Combine horizontal and vertical distances based on grid measurement type.
 *
 * @param horizontalCells Horizontal distance in grid cells
 * @param verticalCells Vertical distance in grid cells
 * @param measurement Grid measurement type
 * @returns Combined distance in grid cells
 */
function combine3DDistance(
    horizontalCells: number,
    verticalCells: number,
    measurement: string
): number {
    switch (measurement) {
        case "EUCLIDEAN":
            // True 3D distance - Pythagorean theorem
            return Math.sqrt(horizontalCells ** 2 + verticalCells ** 2);

        case "CHEBYSHEV":
            // Chessboard/5e D&D - diagonal movement is same cost as straight
            // For 3D: max of horizontal or vertical gives correct diagonal behavior
            return Math.max(horizontalCells, verticalCells);

        case "MANHATTAN":
            // No diagonal movement - only horizontal + vertical
            return horizontalCells + verticalCells;

        case "ALTERNATING":
            // D&D 3.5e - every 2nd diagonal costs 2 squares
            // Treat vertical as another dimension to alternate with
            const diagonals = Math.min(horizontalCells, verticalCells);
            const straight = Math.abs(horizontalCells - verticalCells);
            // Every 2 diagonal moves: first costs 1, second costs 2 (avg 1.5)
            const diagonalCost = Math.floor(diagonals / 2) * 3 + (diagonals % 2);
            return diagonalCost + straight;

        default:
            // Fallback to Euclidean for hex grids and unknown measurement types
            // This ensures consistent 3D distance calculation for all grid types
            return Math.sqrt(horizontalCells ** 2 + verticalCells ** 2);
    }
}

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
 *
 * - mode="box": Subdivides tokens into grid-sized sub-blocks, finds nearest sub-blocks,
 *   uses OBR's grid distance for horizontal component (respects Euclidean/Chebyshev/
 *   Manhattan/Alternating measurement type), then combines with vertical component
 *   according to the measurement type (recommended)
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

    // "box" mode: 3D sub-block center-to-center with OBR grid distance
    const boxA = tokenToBox3D(a, grid, elevationA);
    const boxB = tokenToBox3D(b, grid, elevationB);
    const { pointA, pointB } = closestSubBlockDistance3D(boxA, boxB, grid.unitsPerCell);

    // Get horizontal distance using OBR's grid measurement (handles Euclidean/Chebyshev/etc)
    const pointAPixels = { x: unitsToPixels(pointA.x, grid), y: unitsToPixels(pointA.y, grid) };
    const pointBPixels = { x: unitsToPixels(pointB.x, grid), y: unitsToPixels(pointB.y, grid) };
    const horizontalCells = await OBR.scene.grid.getDistance(pointAPixels, pointBPixels);

    // Get vertical distance in grid cells
    const verticalUnits = Math.abs(pointA.z - pointB.z);
    const verticalCells = verticalUnits / grid.unitsPerCell;

    // Combine based on measurement type
    const measurement = await OBR.scene.grid.getMeasurement();
    const totalCells = combine3DDistance(horizontalCells, verticalCells, measurement);

    return totalCells * grid.unitsPerCell;
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
