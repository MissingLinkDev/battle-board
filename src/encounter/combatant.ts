import type { Item } from "@owlbear-rodeo/sdk";
import { readMeta, type MetaShape } from "../components/metadata";

/** A token taking part in the encounter (see CONTEXT.md). */
export type Combatant = {
    id: string;
    /** Live token label, falling back to the saved name. */
    name: string;
    initiative: number;
    active: boolean;
    /** Live token visibility. */
    visible: boolean;
    ac: number;
    currentHP: number;
    maxHP: number;
    tempHP: number;
    movement: number;
    attackRange: number;
    elevation: number;
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
    concentrating?: boolean;

    groupId?: string | null;
    groupName?: string | null;
    groupStaged?: boolean;
    /** Position within the group's member order (0 = first). See `memberIndex`. */
    groupIndex?: number | null;
};

/** Fields a caller may edit directly. Turn state, membership and group fields have their own commands. */
export type CombatantPatch = Partial<Pick<Combatant,
    | "initiative" | "ac" | "currentHP" | "maxHP" | "tempHP" | "movement" | "attackRange" | "elevation"
    | "playerCharacter" | "movementColor" | "rangeColor" | "movementWeight" | "rangeWeight"
    | "movementPattern" | "rangePattern" | "movementOpacity" | "rangeOpacity" | "dmPreview" | "concentrating"
>>;

/** The token as a combatant, or null when it has no saved data or is not in initiative. */
export function toCombatant(item: Item): Combatant | null {
    const meta = readMeta(item);
    if (!meta || meta.inInitiative === false) return null;

    const img = item as Item & { text?: { plainText?: string } };
    return {
        id: item.id,
        name: img.text?.plainText || item.name || meta.name || "",
        initiative: meta.initiative,
        active: meta.active,
        visible: typeof item.visible === "boolean" ? item.visible : meta.visible,
        ac: meta.ac,
        currentHP: meta.currentHP,
        maxHP: meta.maxHP,
        tempHP: meta.tempHP,
        movement: meta.movement,
        attackRange: meta.attackRange,
        elevation: meta.elevation,
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
        concentrating: meta.concentrating ?? false,

        groupId: meta.groupId ?? null,
        groupName: meta.groupName ?? null,
        groupStaged: meta.groupStaged ?? false,
        groupIndex: meta.groupIndex ?? null,
    };
}

/**
 * Position within the group's member order. Saved scenes from before
 * `groupIndex` existed encode it in the initiative decimal (15.3 = index 3).
 */
export function memberIndex(c: Pick<Combatant, "initiative" | "groupIndex"> | Pick<MetaShape, "initiative" | "groupIndex">): number {
    if (typeof c.groupIndex === "number") return c.groupIndex;
    return Math.round((c.initiative - Math.floor(c.initiative)) * 10);
}
