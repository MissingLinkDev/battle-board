import type { Item } from "@owlbear-rodeo/sdk";
import { META_KEY, type MetaShape, isMetadata } from "./metadata";

export type InitiativeItem = {
    id: string;
    name: string;
    initiative: number;
    active: boolean;
    visible: boolean;
    ac: number;
    currentHP: number;
    maxHP: number;
    tempHP: number;
    movement: number;
    attackRange: number;
    playerCharacter: boolean;

    movementColor?: string | null;
    rangeColor?: string | null;
    movementWeight?: number | null;
    rangeWeight?: number | null;
    movementPattern?: "solid" | "dash" | null;
    rangePattern?: "solid" | "dash" | null;
    movementOpacity?: number | null;
    rangeOpacity?: number | null;
    dmPreview?: boolean;
};

/** Convert Item+Meta → InitiativeItem (prefers live label/name from Item). */
export function initiativeFromItem(item: Item): InitiativeItem | null {
    const meta = (item.metadata as any)?.[META_KEY];
    if (!isMetadata(meta)) return null;
    if (meta.inInitiative === false) return null;

    const img = item as any; // Image extends Item
    const liveLabel: string | undefined = img?.text?.plainText;
    const liveName: string | undefined = img?.name;

    return {
        id: item.id,
        name: liveLabel || liveName || meta.name || "",
        initiative: meta.initiative,
        active: meta.active,
        visible: typeof img?.visible === "boolean" ? img.visible : meta.visible,

        ac: meta.ac,
        currentHP: meta.currentHP,
        maxHP: meta.maxHP,
        tempHP: meta.tempHP,
        movement: meta.movement,
        attackRange: meta.attackRange,
        playerCharacter: meta.playerCharacter,

        movementColor: meta.movementColor ?? null,
        rangeColor: meta.rangeColor ?? null,
        movementWeight: meta.movementWeight ?? null,
        rangeWeight: meta.rangeWeight ?? null,
        movementPattern: meta.movementPattern ?? null,
        rangePattern: meta.rangePattern ?? null,
        movementOpacity: meta.movementOpacity ?? null,
        rangeOpacity: meta.rangeOpacity ?? null,
        dmPreview: meta.dmPreview ?? false,
    };
}

/** Compute a minimal Meta patch from a before/after InitiativeItem. */
export function metaPatchFromRowDiff(before: InitiativeItem, after: InitiativeItem): Partial<MetaShape> {
    const patch: Partial<MetaShape> = {};

    const assign = <K extends keyof InitiativeItem & keyof MetaShape>(k: K) => {
        if (after[k] !== before[k]) (patch as any)[k] = after[k] as any;
    };

    assign("name");
    assign("initiative");
    assign("ac");
    assign("currentHP");
    assign("maxHP");
    assign("tempHP");
    assign("movement");
    assign("attackRange");
    assign("active");
    assign("visible");
    assign("playerCharacter");

    assign("movementColor");
    assign("rangeColor");
    assign("movementWeight");
    assign("rangeWeight");
    assign("movementPattern");
    assign("rangePattern");
    assign("movementOpacity");
    assign("rangeOpacity");
    assign("dmPreview");

    return patch;
}
