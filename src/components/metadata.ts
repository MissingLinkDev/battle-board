import { getPluginId } from "../getPluginId";
import type { Item } from "@owlbear-rodeo/sdk";
import type { TurnResources } from "../encounter/turnResources";

export const META_KEY = getPluginId("metadata");

/**
 * The saved per-token format under META_KEY. Frozen for backwards
 * compatibility (ADR-0002): only add optional fields.
 */
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
    elevation: number;    // e.g., feet above ground

    // player flag
    playerCharacter: boolean;

    // optional UI bits we persist (previously written in multiple places)
    conditions?: string[];

    // ring styling (optional – persisted so the DM sees consistent rings)
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

    // Token-based grouping: each token stores its own group properties
    groupId?: string | null;        // Unique ID for the group this token belongs to
    groupName?: string | null;      // Display name of the group (synced across members)
    groupStaged?: boolean;          // Whether this group is staged (not in active initiative)
    groupIndex?: number | null;     // Position in the group's member order; absent in older saves (see memberIndex)

    // Concentration tracking
    concentrating?: boolean;

    // Turn bar: what the owner has used this turn; null when fresh (see encounter/turnResources.ts)
    turnResources?: TurnResources | null;

    // DEPRECATED: Keep for migration
    encounterGroups?: string[];
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
        typeof o.elevation === "number" &&
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
    elevation: 0,

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
    groupId: null,
    groupName: null,
    groupStaged: false,
    concentrating: false,
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

/**
 * Read a token's saved data, normalising older saves. Returns a copy; the
 * item itself is never modified (old fields are rewritten only on next write).
 */
export function readMeta(item: Item): MetaShape | null {
    const raw = (item.metadata as any)?.[META_KEY];
    if (!isMetadata(raw)) return null;

    const meta: MetaShape = { ...raw };
    // Oldest saves listed groups in `encounterGroups`; the first one is the token's group.
    if (!meta.groupId && meta.encounterGroups && meta.encounterGroups.length > 0) {
        meta.groupId = meta.encounterGroups[0];
    }
    return meta;
}
