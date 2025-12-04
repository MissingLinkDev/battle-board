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

    // Concentration tracking
    concentrating?: boolean;

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

/** Safe read helper with migration. */
export function readMeta(item: Item): MetaShape | null {
    const raw = (item.metadata as any)?.[META_KEY];
    if (!isMetadata(raw)) return null;

    // Migrate encounterGroups to groupId if needed
    const meta = raw as MetaShape;
    if (meta.encounterGroups && meta.encounterGroups.length > 0 && !meta.groupId) {
        // Take the first group ID from the old array
        meta.groupId = meta.encounterGroups[0];
        // Clean up the old property
        delete meta.encounterGroups;
    }

    return meta;
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

// ========== TOKEN-BASED GROUP MANAGEMENT FUNCTIONS ==========

/**
 * Add a token to a group (token-based approach).
 * If the group doesn't exist yet, this token becomes the first member.
 */
export async function addTokenToGroup(
    OBR: any,
    tokenId: string,
    groupId: string,
    groupName?: string,
    groupInitiative?: number
) {
    // Check if group already exists by finding other members
    const allItems = await OBR.scene.items.getItems();
    const existingGroup = deriveGroupsFromItems(allItems).find(g => g.id === groupId);

    // Use existing group properties or provided defaults
    const finalGroupName = groupName ?? existingGroup?.name ?? "New Group";
    const finalGroupInitiative = groupInitiative ?? existingGroup?.initiative ?? 0;
    const finalGroupStaged = existingGroup?.staged ?? false;

    return OBR.scene.items.updateItems([tokenId], (items: Item[]) => {
        const it = items[0];
        const hadMeta = !!(it.metadata as any)[META_KEY];
        const meta = (hadMeta ? (it.metadata as any)[META_KEY] : createMetaForItem(it)) as MetaShape;
        if (!hadMeta) meta.inInitiative = false;

        // Set group properties
        meta.groupId = groupId;
        meta.groupName = finalGroupName;
        meta.groupStaged = finalGroupStaged;
        meta.initiative = finalGroupInitiative;

        // Clean up legacy encounterGroups if present
        if (meta.encounterGroups) {
            delete meta.encounterGroups;
        }

        (it.metadata as any)[META_KEY] = meta;
    });
}

/** Remove a token from its group (clears all group properties). */
export function removeTokenFromGroup(OBR: any, id: string) {
    return OBR.scene.items.updateItems([id], (items: Item[]) => {
        const it = items[0];
        const meta = ((it.metadata as any)[META_KEY] ?? createMetaForItem(it)) as MetaShape;

        // Clear all group-related properties
        meta.groupId = null;
        meta.groupName = null;
        meta.groupStaged = false;

        // Clean up legacy encounterGroups if present
        if (meta.encounterGroups) {
            delete meta.encounterGroups;
        }

        (it.metadata as any)[META_KEY] = meta;
    });
}

/** Get all tokens that belong to a specific group. */
export async function getTokensInGroup(OBR: any, groupId: string): Promise<string[]> {
    const items = await OBR.scene.items.getItems();
    return items
        .filter((item: Item) => {
            const meta = readMeta(item);
            return meta?.groupId === groupId;
        })
        .map((item: Item) => item.id);
}

/** Get the group ID for a specific token. */
export function getTokenGroupId(item: Item): string | null {
    const meta = readMeta(item);
    return meta?.groupId ?? null;
}

/**
 * Update initiative for all tokens in a group.
 * This syncs the group's initiative value across all members.
 */
export async function syncGroupTokensInitiative(OBR: any, groupId: string, groupInitiative: number) {
    const tokenIds = await getTokensInGroup(OBR, groupId);

    if (tokenIds.length === 0) return;

    const patches = tokenIds.map((id, index) => ({
        id,
        patch: {
            // Give each member a slightly different initiative for stable sorting
            // Group members will be ordered by their index in the group
            initiative: groupInitiative + (index * 0.01)
        }
    }));

    await batchUpdateMeta(OBR, patches);
}

/**
 * Update group name for all tokens in a group.
 * This syncs the group's name across all members.
 */
export async function updateGroupName(OBR: any, groupId: string, groupName: string) {
    const tokenIds = await getTokensInGroup(OBR, groupId);

    if (tokenIds.length === 0) return;

    const patches = tokenIds.map(id => ({
        id,
        patch: { groupName }
    }));

    await batchUpdateMeta(OBR, patches);
}

/**
 * Update staged status for all tokens in a group.
 * This syncs the group's staged status across all members.
 */
export async function updateGroupStaged(OBR: any, groupId: string, staged: boolean) {
    const tokenIds = await getTokensInGroup(OBR, groupId);

    if (tokenIds.length === 0) return;

    const patches = tokenIds.map(id => ({
        id,
        patch: { groupStaged: staged }
    }));

    await batchUpdateMeta(OBR, patches);
}

/**
 * Update active status for all tokens in a group.
 * Used during turn management.
 */
export async function updateGroupActive(OBR: any, groupId: string, active: boolean) {
    const tokenIds = await getTokensInGroup(OBR, groupId);

    if (tokenIds.length === 0) return;

    const patches = tokenIds.map(id => ({
        id,
        patch: { active }
    }));

    await batchUpdateMeta(OBR, patches);
}

/**
 * Create a new group by assigning tokens to it.
 * Returns the group ID.
 */
export async function createGroupFromTokens(
    OBR: any,
    tokenIds: string[],
    groupName: string,
    groupInitiative: number = 0
): Promise<string> {
    const groupId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const patches = tokenIds.map((id, index) => ({
        id,
        patch: {
            groupId,
            groupName,
            groupStaged: false,
            initiative: groupInitiative + (index * 0.01),
        } as Partial<MetaShape>
    }));

    await batchUpdateMeta(OBR, patches);

    return groupId;
}

/**
 * Delete a group by removing all tokens from it.
 * This doesn't delete the tokens, just removes their group membership.
 */
export async function deleteGroup(OBR: any, groupId: string) {
    const tokenIds = await getTokensInGroup(OBR, groupId);

    if (tokenIds.length === 0) return;

    const patches = tokenIds.map(id => ({
        id,
        patch: {
            groupId: null,
            groupName: null,
            groupStaged: false,
        } as Partial<MetaShape>
    }));

    await batchUpdateMeta(OBR, patches);
}

/** Update token visibility for all tokens in a group */
export async function updateGroupTokensVisibility(OBR: any, groupId: string, visible: boolean) {
    const tokenIds = await getTokensInGroup(OBR, groupId);

    if (tokenIds.length === 0) return;

    // Update the actual OBR item visibility (not metadata)
    await OBR.scene.items.updateItems(tokenIds, (items: Item[]) => {
        for (const item of items) {
            // Make sure we're setting the visible property correctly
            item.visible = visible;
        }
    });
}

/** Set token visibility for a single token */
export async function updateTokenVisibility(OBR: any, tokenId: string, visible: boolean) {
    await OBR.scene.items.updateItems([tokenId], (items: Item[]) => {
        const item = items[0];
        if (item) {
            // Make sure we're setting the visible property correctly
            item.visible = visible;
        }
    });
}

/** Add token to group with specific initiative and member ordering */
export async function addTokenToGroupWithInitiative(OBR: any, id: string, groupId: string, groupInitiative: number, memberIndex: number = 0) {
    return OBR.scene.items.updateItems([id], (items: Item[]) => {
        const it = items[0];
        const hadMeta = !!(it.metadata as any)[META_KEY];
        const meta = (hadMeta ? (it.metadata as any)[META_KEY] : createMetaForItem(it)) as MetaShape;
        if (!hadMeta) meta.inInitiative = false;

        // Set the single group ID
        meta.groupId = groupId;

        // Set initiative to match group with decimal sub-ordering for stable sorting
        meta.initiative = groupInitiative + (memberIndex * 0.01);

        // Clean up legacy encounterGroups if present
        if (meta.encounterGroups) {
            delete meta.encounterGroups;
        }

        (it.metadata as any)[META_KEY] = meta;
    });
}

// Legacy function names for backward compatibility (marked as deprecated)
/** @deprecated Use addTokenToGroup instead */
export const addTokenToEncounterGroup = addTokenToGroup;

/** @deprecated Use removeTokenFromGroup instead */
export const removeTokenFromEncounterGroup = removeTokenFromGroup;

// ========== TOKEN-BASED GROUP DERIVATION ==========

/** Derive Group objects from tokens (single source of truth) */
export type DerivedGroup = {
    id: string;              // Group ID
    name: string;            // Group display name
    initiative: number;      // Derived from first member's initiative
    active: boolean;         // Whether any member is active
    staged: boolean;         // Whether group is staged
    memberIds: string[];     // IDs of all tokens in this group
};

/**
 * Derive all groups from the provided items.
 * Groups are created implicitly based on tokens sharing a groupId.
 */
export function deriveGroupsFromItems(items: Item[]): DerivedGroup[] {
    const groupMap = new Map<string, {
        id: string;
        name: string;
        initiative: number;
        staged: boolean;
        memberIds: string[];
        activeMembers: number;
    }>();

    // Collect all tokens by their group ID
    for (const item of items) {
        const meta = readMeta(item);
        if (!meta || meta.inInitiative === false) continue;

        const groupId = meta.groupId;
        if (!groupId) continue; // Not in a group

        if (!groupMap.has(groupId)) {
            // Create new group entry using this first member's properties
            groupMap.set(groupId, {
                id: groupId,
                name: meta.groupName || "Unnamed Group",
                initiative: Math.floor(meta.initiative), // Use integer part for group initiative
                staged: meta.groupStaged ?? false,
                memberIds: [],
                activeMembers: 0,
            });
        }

        const group = groupMap.get(groupId)!;
        group.memberIds.push(item.id);
        if (meta.active) {
            group.activeMembers++;
        }

        // Keep the highest initiative value in the group
        const memberInit = Math.floor(meta.initiative);
        if (memberInit > group.initiative) {
            group.initiative = memberInit;
        }

        // If any member has a group name set, use it (prefer non-empty names)
        if (meta.groupName && meta.groupName.trim()) {
            group.name = meta.groupName;
        }

        // Use OR logic for staged: if ANY member says staged, group is staged
        // (This handles potential inconsistencies)
        if (meta.groupStaged) {
            group.staged = true;
        }
    }

    // Convert to DerivedGroup array
    return Array.from(groupMap.values()).map(g => ({
        id: g.id,
        name: g.name,
        initiative: g.initiative,
        active: g.activeMembers > 0, // Active if any member is active
        staged: g.staged,
        memberIds: g.memberIds,
    }));
}