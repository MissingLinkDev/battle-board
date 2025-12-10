// elevationLabels.ts
import OBR, { buildLabel, isImage, type Item, type Label, type Vector2 } from "@owlbear-rodeo/sdk";
import { getPluginId } from "../getPluginId";
import { getGridInfo } from "./utils";

/* =========================
   Constants (file-local)
   ========================= */
const LABEL_META_KEY = getPluginId("elevation-label");

const LABEL_BACKGROUND_COLOR = "rgb(30, 34, 49)";
const LABEL_BACKGROUND_OPACITY = 0.3;
const LABEL_TEXT_COLOR = "#FFFFFF";
const LABEL_TEXT_OPACITY = 1.0;
const LABEL_FONT_SIZE = 24;
const LABEL_CORNER_RADIUS = 14;
const LABEL_HEIGHT_ESTIMATE = 30; // Approximate label height in pixels for positioning

/* =========================
   Types
   ========================= */
type ElevationLabelMeta = {
    __elevationLabel__: true;
    ownerId: string;      // token id
    key: string;          // stable rediscovery key (ownerId:elevation-label)
};

/* =========================
   Stable key & helpers
   ========================= */
const labelKey = (ownerId: string) => `${ownerId}:elevation-label`;

const buildLabelMeta = (ownerId: string): ElevationLabelMeta => ({
    __elevationLabel__: true,
    ownerId,
    key: labelKey(ownerId),
});

/**
 * Generate a deterministic ID for an elevation label.
 * This makes labels instantly findable by ID without scanning all items.
 */
const determineLabelId = (tokenId: string): string =>
    `${getPluginId("elevation-label")}.${tokenId}`;


/**
 * Find ALL elevation labels for a given token using multi-tier discovery.
 * Searches by: deterministic ID, metadata key, owner ID, and attachment.
 * This ensures labels are found regardless of how they were created.
 */
async function findAllLabelsForToken(tokenId: string): Promise<Label[]> {
    const deterministicId = determineLabelId(tokenId);
    const items = await OBR.scene.items.getItems();
    const matches: Label[] = [];

    for (const it of items) {
        let isMatch = false;

        // Tier 1: Direct ID match (fastest, for new labels)
        if (it.id === deterministicId) {
            isMatch = true;
        } else {
            const meta = (it.metadata as any)?.[LABEL_META_KEY] as ElevationLabelMeta | undefined;

            // Tier 2: Metadata key match (for old labels)
            if (meta?.__elevationLabel__ && meta.key === labelKey(tokenId)) {
                isMatch = true;
            }
            // Tier 3: Owner ID match (for persist-created labels)
            else if (meta?.__elevationLabel__ && meta.ownerId === tokenId) {
                isMatch = true;
            }
            // Tier 4: Attachment match with emoji (for labels with corrupt metadata)
            else if (
                it.attachedTo === tokenId &&
                (it as any).text?.plainText?.includes('🪽')
            ) {
                isMatch = true;
            }
        }

        if (isMatch) {
            matches.push(it as unknown as Label);
        }
    }

    return matches;
}

/**
 * Score a label's quality based on how it was identified.
 * Higher score = better quality (more reliable identification).
 */
function scoreLabelQuality(label: Label): number {
    let score = 0;

    // Highest priority: has deterministic ID pattern
    if (label.id.startsWith(getPluginId("elevation-label"))) {
        score += 1000;
    }

    const meta = (label.metadata as any)?.[LABEL_META_KEY] as ElevationLabelMeta | undefined;

    // Has proper metadata with key
    if (meta?.key) {
        score += 100;
    }

    // Has metadata marker
    if (meta?.__elevationLabel__) {
        score += 10;
    }

    // Has ownerId
    if (meta?.ownerId) {
        score += 5;
    }

    // Is attached to token
    if (label.attachedTo) {
        score += 1;
    }

    return score;
}

/**
 * Deduplicate labels by keeping the highest quality one and deleting the rest.
 * Returns the kept label, or null if no labels were provided.
 */
async function deduplicateLabels(labels: Label[]): Promise<Label | null> {
    if (labels.length === 0) return null;
    if (labels.length === 1) return labels[0];

    // Sort by quality: highest score first
    const sorted = labels.sort((a, b) => {
        const aScore = scoreLabelQuality(a);
        const bScore = scoreLabelQuality(b);
        return bScore - aScore;
    });

    const keeper = sorted[0];
    const toDelete = sorted.slice(1);

    if (toDelete.length > 0) {
        await OBR.scene.items.deleteItems(toDelete.map(l => l.id));
        console.log(`[Battle Board] Deduplicated ${toDelete.length} elevation label(s)`);
    }

    return keeper;
}

/**
 * Find the elevation label for a token, automatically deduplicating if multiple exist.
 * This is the main label discovery function that should be used instead of findLabelByKey.
 */
async function findElevationLabel(tokenId: string): Promise<Label | null> {
    const allLabels = await findAllLabelsForToken(tokenId);
    return await deduplicateLabels(allLabels);
}

/* =========================
   Position Calculation
   ========================= */
/**
 * Calculate the position for the elevation label at the top edge of the token.
 * Uses the same center-based positioning as range rings.
 */
async function calculateLabelPosition(token: Item): Promise<Vector2> {
    const grid = await getGridInfo();

    // Start from token center (same as rings)
    const center = token.position;

    if (!isImage(token)) {
        // Fallback for non-image items
        return { x: center.x, y: center.y - 50 };
    }

    // Calculate token height in pixels (same approach as rings)
    const dpi = token.grid?.dpi ?? grid.dpi;
    const baseCellsH = (token.image?.height ?? dpi) / dpi;
    const scaleY = Math.abs(token.scale?.y ?? 1);

    // Position label: move up by half token height + half label height
    const labelY = center.y - (grid.dpi / 2 * baseCellsH * scaleY) + (LABEL_HEIGHT_ESTIMATE);
    const labelX = center.x;
    return { x: labelX, y: labelY };
}

/* =========================
   Cleanup Functions
   ========================= */

/**
 * Remove elevation labels whose owner tokens no longer exist in the scene.
 * This prevents orphaned labels from accumulating over time.
 */
export async function cleanupOrphanedLabels(): Promise<void> {
    try {
        const items = await OBR.scene.items.getItems();

        // Get all token IDs
        const tokenIds = new Set(
            items
                .filter(it => isImage(it) && (it.layer === "CHARACTER" || it.layer === "MOUNT"))
                .map(it => it.id)
        );

        // Find labels without valid owner tokens
        const orphans = items.filter(it => {
            const meta = (it.metadata as any)?.[LABEL_META_KEY] as ElevationLabelMeta | undefined;
            if (!meta?.__elevationLabel__) return false;

            // Try to find owner ID from multiple sources
            let ownerId = meta.ownerId;

            // If no ownerId in metadata, try to extract from deterministic ID
            if (!ownerId && it.id.startsWith(getPluginId("elevation-label"))) {
                const parts = it.id.split('.');
                ownerId = parts[parts.length - 1];
            }

            // If still no owner, try attachedTo
            if (!ownerId && it.attachedTo) {
                ownerId = it.attachedTo;
            }

            // Label is orphaned if we found an owner ID but that token doesn't exist
            return ownerId && !tokenIds.has(ownerId);
        });

        if (orphans.length > 0) {
            await OBR.scene.items.deleteItems(orphans.map(it => it.id));
            console.log(`[Battle Board] Cleaned up ${orphans.length} orphaned elevation label(s)`);
        }
    } catch (error) {
        console.error("[Battle Board] Error cleaning up orphaned labels:", error);
    }
}

/* =========================
   Main API Functions
   ========================= */

/**
 * Ensure an elevation label exists for the given token.
 * Creates a new label if needed, updates if it exists, or removes if elevation <= 0.
 */
export async function ensureElevationLabel(opts: {
    tokenId: string;
    elevation: number;
    unit?: string;
}): Promise<void> {
    try {
        const { tokenId, elevation, unit = "ft" } = opts;
        const meta = buildLabelMeta(tokenId);

        // If elevation is 0, remove label (ground level has no indicator)
        if (elevation === 0) {
            const stale = await findElevationLabel(tokenId);
            if (stale) {
                await OBR.scene.items.deleteItems([stale.id]);
            }
            return;
        }

        // Get token to calculate position
        const [token] = await OBR.scene.items.getItems((it) => it.id === tokenId);
        if (!token) {
            console.warn(`[Battle Board] Token ${tokenId} not found, cannot create elevation label`);
            return;
        }

        const position = await calculateLabelPosition(token);
        const icon = elevation > 0 ? "🪽" : "⬇️";
        const plainText = `${icon} ${elevation} ${unit}`;

        // Use new discovery method with automatic deduplication
        const existing = await findElevationLabel(tokenId);

        if (existing) {
            // Update existing label
            await OBR.scene.items.updateItems([existing.id], (items) => {
                const label = items[0] as any;
                if (!label) return;

                label.position = position;
                label.text = label.text ?? {};
                label.text.plainText = plainText;
                label.attachedTo = tokenId;
                label.visible = true;
                label.layer = "TEXT";
                label.locked = true;
                label.disableHit = false;

                label.metadata = { ...(label.metadata ?? {}) };
                (label.metadata as any)[LABEL_META_KEY] = meta;
            });
        } else {
            // Create new label with deterministic ID
            const label = buildLabel()
                .id(determineLabelId(tokenId))
                .position(position)
                .plainText(plainText)
                .fontSize(LABEL_FONT_SIZE)
                .textAlign("CENTER")
                .textAlignVertical("MIDDLE")
                .fillColor(LABEL_TEXT_COLOR)
                .fillOpacity(LABEL_TEXT_OPACITY)
                .backgroundColor(LABEL_BACKGROUND_COLOR)
                .backgroundOpacity(LABEL_BACKGROUND_OPACITY)
                .cornerRadius(LABEL_CORNER_RADIUS)
                .attachedTo(tokenId)
                .layer("TEXT")
                .locked(true)
                .disableHit(false)
                .visible(true)
                .metadata({ [LABEL_META_KEY]: meta })
                .build();
            label.style.maxViewScale = 1.25;
            label.style.minViewScale = 1;
            await OBR.scene.items.addItems([label]);

        }
    } catch (error) {
        console.error("[Battle Board] Error in ensureElevationLabel:", error);
        console.error("[Battle Board] Options:", opts);
        throw error;
    }
}

/**
 * Clear the elevation label for a specific token.
 */
export async function clearElevationLabel(tokenId: string): Promise<void> {
    const existing = await findElevationLabel(tokenId);
    if (existing) {
        await OBR.scene.items.deleteItems([existing.id]);
    }
}

/**
 * Clear all elevation labels in the scene.
 */
export async function clearAllElevationLabels(): Promise<void> {
    const items = await OBR.scene.items.getItems();
    const ids = items
        .filter((it) => {
            const meta = (it.metadata as any)?.[LABEL_META_KEY] as ElevationLabelMeta | undefined;
            return meta && meta.__elevationLabel__;
        })
        .map((it) => it.id);
    if (ids.length) {
        await OBR.scene.items.deleteItems(ids);
    }
}
