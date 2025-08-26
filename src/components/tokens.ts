// src/tokens.ts
import OBR, { isImage, type Item } from "@owlbear-rodeo/sdk";

export type CMToken = {
    id: string;
    name: string;
    layer: "CHARACTER" | "MOUNT";
    position: { x: number; y: number };
    attachedTo?: string | null;
    visible?: boolean;

    // New: store *box* size in feet (creature space), not circle
    widthFeet: number;
    heightFeet: number;

    // New: passthrough from Owlbear
    rotation: number; // (degrees, as provided by OBR)
    scaleX: number;   // final scale applied to the authored image
    scaleY: number;
};

let _perCellUnits: number | null = null;
async function getPerCellUnits(): Promise<number> {
    if (_perCellUnits != null) return _perCellUnits;
    const scale = await OBR.scene.grid.getScale();
    _perCellUnits = scale.parsed?.multiplier ?? 5; // default 5 ft per cell
    return _perCellUnits;
}

/**
 * Compute token's rectangular footprint in FEET.
 * Uses the authored image size and grid dpi to derive base cell dimensions,
 * then applies item scale. Falls back to 1x1 cells if data is missing.
 */
function computeTokenSizeFeetFromSnapshot(
    item: Item,
    perCellUnits: number
): { widthFeet: number; heightFeet: number } {
    // Default to 1x1 cell creature if we can't read image/dpi
    let baseCellsW = 1;
    let baseCellsH = 1;

    if (isImage(item) && item.image?.width && item.image?.height) {
        const dpi = item.grid?.dpi;
        if (dpi && dpi > 0) {
            baseCellsW = item.image.width / dpi;
            baseCellsH = item.image.height / dpi;
        }
    }

    const scaleX = Math.abs(item.scale?.x ?? 1);
    const scaleY = Math.abs(item.scale?.y ?? 1);

    const cellsW = (baseCellsW || 1) * scaleX;
    const cellsH = (baseCellsH || 1) * scaleY;

    return {
        widthFeet: cellsW * perCellUnits,
        heightFeet: cellsH * perCellUnits,
    };
}

function itemsToCMTokensWithUnits(items: Item[], perCellUnits: number): CMToken[] {
    const list: CMToken[] = [];
    for (const it of items) {
        if (!isImage(it)) continue;
        if (it.layer !== "CHARACTER" && it.layer !== "MOUNT") continue;

        const { widthFeet, heightFeet } = computeTokenSizeFeetFromSnapshot(it, perCellUnits);

        const scaleX = Math.abs(it.scale?.x ?? 1);
        const scaleY = Math.abs(it.scale?.y ?? 1);

        list.push({
            id: it.id,
            name: (it.text?.plainText as string) || (it as any).name || "Unnamed",
            layer: it.layer as "CHARACTER" | "MOUNT",
            position: { x: it.position?.x ?? 0, y: it.position?.y ?? 0 },
            attachedTo: it.attachedTo ?? null,
            visible: it.visible,

            widthFeet,
            heightFeet,

            rotation: it.rotation ?? 0, // OBR uses degrees
            scaleX,
            scaleY,
        });
    }
    return list;
}

// If you still want the “plain” transformer (used internally with cached units)
export function itemsToCMTokens(items: Item[]): CMToken[] {
    // fallback if _perCellUnits not yet populated
    const perCell = _perCellUnits ?? 5;
    return itemsToCMTokensWithUnits(items, perCell);
}

export async function getCMTokens(): Promise<CMToken[]> {
    const perCell = await getPerCellUnits();
    const items = await OBR.scene.items.getItems();
    return itemsToCMTokensWithUnits(items, perCell);
}

/**
 * Subscribe to changes in CHARACTER/MOUNT items and grid scale.
 * Calls `cb` with an up-to-date CMToken array whenever items or scale change.
 */
export function onCMTokensChange(cb: (tokens: CMToken[]) => void) {
    let unsubItems: (() => void) | null = null;
    let unsubGrid: (() => void) | null = null;
    let live = true;

    const emitFrom = (items: Item[], perCellUnits: number) => {
        if (!live) return;
        cb(itemsToCMTokensWithUnits(items, perCellUnits));
    };

    // bootstrap once
    (async () => {
        const perCell = await getPerCellUnits();
        const initial = await OBR.scene.items.getItems();
        if (!live) return;

        emitFrom(initial, perCell);

        // items listener (re-map using cached per-cell units)
        unsubItems = OBR.scene.items.onChange((items) => {
            emitFrom(items as Item[], _perCellUnits ?? 5);
        });

        // grid scale listener (if available) to refresh units + re-emit
        // @ts-ignore – adjust if a more specific event exists in your SDK version.
        unsubGrid = OBR.scene.grid.onChange?.(async () => {
            _perCellUnits = null; // invalidate cache
            const freshUnits = await getPerCellUnits();
            const current = await OBR.scene.items.getItems();
            emitFrom(current, freshUnits);
        }) ?? null;
    })().catch(console.error);

    // return unified unsubscribe
    return () => {
        live = false;
        try { unsubItems?.(); } catch { /* noop */ }
        try { unsubGrid?.(); } catch { /* noop */ }
    };
}
