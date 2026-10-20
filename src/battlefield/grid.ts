import type { GridMeasurement, Vector2 } from "@owlbear-rodeo/sdk";
import type { ObrPort } from "../obr/port";
import type { GridScale } from "./footprint";

/** Everything distance and overlay maths needs to know about the scene's grid, read fresh. */
export type GridSnapshot = GridScale & {
    unitLabel: string;
    measurement: GridMeasurement;
    /** Horizontal distance between two scene points in cells, by the grid's own rules (incl. hex). */
    horizontalCells(from: Vector2, to: Vector2): Promise<number>;
};

export async function readGrid(port: ObrPort): Promise<GridSnapshot> {
    const [dpi, scale, measurement] = await Promise.all([port.grid.getDpi(), port.grid.getScale(), port.grid.getMeasurement()]);
    return {
        dpi,
        unitsPerCell: scale.multiplier,
        unitLabel: scale.unit,
        measurement,
        horizontalCells: (from, to) => port.grid.getDistance(from, to),
    };
}
