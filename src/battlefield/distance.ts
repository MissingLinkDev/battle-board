import type { Vector2 } from "@owlbear-rodeo/sdk";
import type { GridSnapshot } from "./grid";

/** A creature in space: where it stands, its footprint in cells, and how high its base is. */
export type Body = { id: string; name: string; center: Vector2; cells: { w: number; h: number }; elevation: number };

export type DistanceInfo = { id: string; name: string; units: number; text: string };

type Vec3 = { x: number; y: number; z: number };

/**
 * Distance between two creatures in scene units. Each is a cube (side = the
 * larger footprint side) split into one-cell blocks; the nearest pair of
 * block centres is measured horizontally by the grid's rules and combined
 * with the height difference to suit the measurement type.
 */
export async function distanceBetween(a: Body, b: Body, grid: GridSnapshot): Promise<number> {
    const [pa, pb] = nearestBlocks(blocksOf(a, grid), blocksOf(b, grid));
    const horizontal = await grid.horizontalCells({ x: pa.x * grid.dpi, y: pa.y * grid.dpi }, { x: pb.x * grid.dpi, y: pb.y * grid.dpi });
    return combine(horizontal, Math.abs(pa.z - pb.z), grid.measurement) * grid.unitsPerCell;
}

/** Distances from one creature to every other, nearest first. */
export async function distancesFrom(id: string, bodies: Body[], grid: GridSnapshot, opts: { round: boolean }): Promise<DistanceInfo[]> {
    const self = bodies.find((b) => b.id === id);
    if (!self) return [];
    const others = bodies.filter((b) => b.id !== id);
    const list = await Promise.all(others.map(async (other) => {
        const raw = await distanceBetween(self, other, grid);
        const { units, text } = formatDistance(raw, grid, opts);
        return { id: other.id, name: other.name || "(unnamed)", units, text };
    }));
    return list.sort((x, y) => x.units - y.units);
}

/** Less than one cell reads "Touch"; otherwise whole units, or the nearest grid multiple when rounding. */
export function formatDistance(raw: number, grid: Pick<GridSnapshot, "unitsPerCell" | "unitLabel">, opts: { round: boolean }): { units: number; text: string } {
    const units = opts.round ? Math.round(raw / grid.unitsPerCell) * grid.unitsPerCell : Math.round(raw);
    return { units, text: raw < grid.unitsPerCell ? "Touch" : `${units} ${grid.unitLabel}` };
}

/** Centres of the one-cell blocks making up the creature's cube, in cells. */
function blocksOf(body: Body, grid: GridSnapshot): Vec3[] {
    const size = Math.max(body.cells.w, body.cells.h);
    const n = Math.max(1, Math.round(size));
    const block = size / n;
    const origin = { x: body.center.x / grid.dpi - size / 2, y: body.center.y / grid.dpi - size / 2, z: body.elevation / grid.unitsPerCell };
    const centres: Vec3[] = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
        centres.push({ x: origin.x + (i + 0.5) * block, y: origin.y + (j + 0.5) * block, z: origin.z + (k + 0.5) * block });
    }
    return centres;
}

function nearestBlocks(as: Vec3[], bs: Vec3[]): [Vec3, Vec3] {
    let best: [Vec3, Vec3] = [as[0], bs[0]];
    let min = Infinity;
    for (const a of as) for (const b of bs) {
        const d = (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
        if (d < min) {
            min = d;
            best = [a, b];
        }
    }
    return best;
}

/** Combine horizontal and vertical cells the way the grid counts diagonals. */
function combine(h: number, v: number, measurement: string): number {
    switch (measurement) {
        case "CHEBYSHEV": return Math.max(h, v);
        case "MANHATTAN": return h + v;
        case "ALTERNATING": {
            // Every second diagonal costs double (D&D 3.5e).
            const diagonals = Math.min(h, v);
            return Math.floor(diagonals / 2) * 3 + (diagonals % 2) + Math.abs(h - v);
        }
        default: return Math.hypot(h, v); // EUCLIDEAN, and hex grids
    }
}
