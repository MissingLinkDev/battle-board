import { getPluginId } from "../getPluginId";
import type { Item } from "@owlbear-rodeo/sdk";

export const META_KEY = getPluginId("metadata");

/** The canonical scene metadata we store on each token. */
export type MetaShape = {
    // core turn/list fields
    name: string;
    initiative: number;
    active: boolean;
    visible: boolean;

    // combat stats
    ac: number;
    currentHP: number;
    maxHP: number;
    tempHP: number;

    // movement & tactics
    movement: number;     // e.g., feet per round
    attackRange: number;  // e.g., feet

    // player flag
    playerCharacter: boolean;

    // optional UI bits we persist (previously written in multiple places)
    conditions?: string[];

    // ring styling (optional — persisted so the DM sees consistent rings)
    movementColor?: string | null;
    rangeColor?: string | null;
    movementWeight?: number | null;
    rangeWeight?: number | null;
    movementPattern?: "solid" | "dash" | null;
    rangePattern?: "solid" | "dash" | null;
    movementOpacity?: number | null; // 0..1
    rangeOpacity?: number | null;    // 0..1

    // DM-only quick toggle
    dmPreview?: boolean;
    inInitiative?: boolean;
};

export function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Minimal guard: required keys are present and well-typed. Optional keys are ignored. */
export function isMetadata(v: unknown): v is MetaShape {
    if (!isPlainObject(v)) return false;
    const o = v as any;
    return (
        typeof o.name === "string" &&
        typeof o.initiative === "number" &&
        typeof o.active === "boolean" &&
        typeof o.visible === "boolean" &&
        typeof o.ac === "number" &&
        typeof o.currentHP === "number" &&
        typeof o.maxHP === "number" &&
        typeof o.tempHP === "number" &&
        typeof o.movement === "number" &&
        typeof o.attackRange === "number" &&
        typeof o.playerCharacter === "boolean"
    );
}

/** Defaults for a newly-added token (keep in one place). */
export const DEFAULT_META: Omit<MetaShape, "name" | "visible"> = {
    initiative: 0,
    active: false,

    // combat
    ac: 10,
    currentHP: 10,
    maxHP: 10,
    tempHP: 0,

    // tactics
    movement: 30,
    attackRange: 60,

    playerCharacter: false,

    // optional
    conditions: [],

    // ring defaults (match your current UI defaults)
    movementColor: "#519e00",
    rangeColor: "#fe4c50",
    movementWeight: 12,
    rangeWeight: 12,
    movementPattern: "dash",
    rangePattern: "dash",
    movementOpacity: 1,
    rangeOpacity: 1,

    dmPreview: false,
    inInitiative: true,
};

/** Create initial meta from an Item snapshot + defaults. */
export function createMetaForItem(item: Item): MetaShape {
    const img: any = item as any;
    const displayName: string =
        (img?.text?.plainText as string) || img?.name || "Unnamed";

    return {
        name: displayName,
        visible: !!img?.visible,
        ...DEFAULT_META,
    };
}

/** Safe read helper. */
export function readMeta(item: Item): MetaShape | null {
    const raw = (item.metadata as any)?.[META_KEY];
    return isMetadata(raw) ? (raw as MetaShape) : null;
}

/** Write/patch helper (single item id). */
export function updateItemMeta(
    OBR: any,
    id: string,
    patch: Partial<MetaShape>
): Promise<void> {
    return OBR.scene.items.updateItems([id], (items: Item[]) => {
        for (const it of items) {
            const meta = ((it.metadata as any)[META_KEY] ?? createMetaForItem(it)) as MetaShape;
            Object.assign(meta, patch);
            (it.metadata as any)[META_KEY] = meta;
        }
    });
}

/** Batch patch by id. */
export function batchUpdateMeta(
    OBR: any,
    patches: { id: string; patch: Partial<MetaShape> }[]
): Promise<void> {
    if (patches.length === 0) return Promise.resolve();
    const ids = patches.map((p) => p.id);
    return OBR.scene.items.updateItems(ids, (items: Item[]) => {
        for (const it of items) {
            const p = patches.find((x) => x.id === it.id)?.patch;
            if (!p) continue;
            const meta = ((it.metadata as any)[META_KEY] ?? createMetaForItem(it)) as MetaShape;
            Object.assign(meta, p);
            (it.metadata as any)[META_KEY] = meta;
        }
    });
}
