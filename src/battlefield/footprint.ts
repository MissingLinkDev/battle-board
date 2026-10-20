import { isImage, type Item } from "@owlbear-rodeo/sdk";

/** Grid scale: pixels per cell and scene units (e.g. ft) per cell. */
export type GridScale = { dpi: number; unitsPerCell: number };

/**
 * A token's footprint in grid cells: its image size at its own DPI, times its
 * scale, never less than one cell in either direction (a Tiny creature on a
 * half-cell token still occupies a square).
 */
export function footprintCells(item: Item): { w: number; h: number } {
    if (!isImage(item) || !item.image?.width || !item.image?.height || !item.grid?.dpi) return { w: 1, h: 1 };
    const w = (item.image.width / item.grid.dpi) * Math.abs(item.scale?.x ?? 1);
    const h = (item.image.height / item.grid.dpi) * Math.abs(item.scale?.y ?? 1);
    return { w: Math.max(w, 1), h: Math.max(h, 1) };
}

export function unitsToPixels(units: number, grid: GridScale): number {
    return (units / grid.unitsPerCell) * grid.dpi;
}
