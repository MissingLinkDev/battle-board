// src/tokens.ts
import OBR, { isImage, type Item } from "@owlbear-rodeo/sdk";

export type CMToken = {
    id: string;
    name: string;
    layer: "CHARACTER" | "MOUNT";
    position: { x: number; y: number };
    attachedTo?: string | null;
    visible?: boolean;
    diameterFeet: number;
    radiusFeet: number;
};

let _perCellUnits: number | null = null;
async function getPerCellUnits(): Promise<number> {
    if (_perCellUnits != null) return _perCellUnits;
    const scale = await OBR.scene.grid.getScale();
    _perCellUnits = scale.parsed?.multiplier ?? 5; // default 5 ft per cell
    return _perCellUnits;
}

function computeTokenFeetFromSnapshot(item: Item, perCellUnits: number): number {
    if (!isImage(item) || !item.image?.width || !item.image?.height) {
        // non-image or missing size → treat as 1 cell
        return perCellUnits;
    }

    // item.grid.dpi = pixels per grid cell the image was authored for
    const dpi = item.grid?.dpi;
    if (!dpi) return perCellUnits;

    const baseCellsW = item.image.width / dpi;
    const baseCellsH = item.image.height / dpi;

    const scaleX = Math.abs(item.scale?.x ?? 1);
    const scaleY = Math.abs(item.scale?.y ?? 1);

    // footprint in cells is the larger axis (square/rect bases)
    const cells = Math.max(baseCellsW * scaleX, baseCellsH * scaleY) || 1;

    return cells * perCellUnits; // feet
}

function itemsToCMTokensWithUnits(items: Item[], perCellUnits: number): CMToken[] {
    const list: CMToken[] = [];
    for (const it of items) {
        if (!isImage(it)) continue;
        if (it.layer !== "CHARACTER" && it.layer !== "MOUNT") continue;

        const diameterFeet = computeTokenFeetFromSnapshot(it, perCellUnits);
        list.push({
            id: it.id,
            name: (it.text?.plainText as string) || (it as any).name || "Unnamed",
            layer: it.layer as "CHARACTER" | "MOUNT",
            position: { x: it.position?.x ?? 0, y: it.position?.y ?? 0 },
            attachedTo: it.attachedTo ?? null,
            visible: it.visible,
            diameterFeet,
            radiusFeet: diameterFeet / 2,
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
        // If your SDK has a dedicated grid scale change event, use that; otherwise, re-read on generic grid change.
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
        try { unsubItems?.(); } catch { }
        try { unsubGrid?.(); } catch { }
    };
}