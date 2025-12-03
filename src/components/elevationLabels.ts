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
 * Find an existing elevation label by its stable key.
 */
async function findLabelByKey(key: string): Promise<Label | null> {
    const items = await OBR.scene.items.getItems();
    for (const it of items) {
        const meta = (it.metadata as any)?.[LABEL_META_KEY] as ElevationLabelMeta | undefined;
        if (meta && meta.__elevationLabel__ && meta.key === key) {
            return it as unknown as Label;
        }
    }
    return null;
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
    const tokenHeightPx = baseCellsH * scaleY * dpi;

    console.log("Label position calculation:", {
        tokenId: token.id,
        tokenName: token.name,
        centerY: center.y,
        imageHeight: token.image?.height,
        dpi: dpi,
        baseCellsH: baseCellsH,
        scaleY: scaleY,
        tokenHeightPx: tokenHeightPx,
        gridDpi: grid.dpi,
        gridUnitsPerCell: grid.unitsPerCell
    });

    // Position label: move up by half token height + half label height
    const labelY = center.y - (grid.dpi / 2 * baseCellsH * scaleY) + (LABEL_HEIGHT_ESTIMATE);
    const labelX = center.x;

    console.log("Final label position:", { labelX, labelY, offset: (grid.dpi / 4 * baseCellsH * scaleY) + (LABEL_HEIGHT_ESTIMATE / 2) });

    return { x: labelX, y: labelY };
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
        const key = labelKey(tokenId);
        const meta = buildLabelMeta(tokenId);

        // If elevation is 0 or negative, remove label
        if (!elevation || elevation <= 0) {
            const stale = await findLabelByKey(key);
            if (stale) {
                await OBR.scene.items.deleteItems([stale.id]);
            }
            return;
        }

        // Get token to calculate position
        const [token] = await OBR.scene.items.getItems((it) => it.id === tokenId);
        if (!token) {
            console.warn(`Token ${tokenId} not found, cannot create elevation label`);
            return;
        }

        const position = await calculateLabelPosition(token);
        const plainText = `🪽 ${elevation} ${unit}`;

        const existing = await findLabelByKey(key);

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
                label.disableHit = true;

                label.metadata = { ...(label.metadata ?? {}) };
                (label.metadata as any)[LABEL_META_KEY] = meta;
            });
        } else {
            // Create new label
            const label = buildLabel()
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
                .disableHit(true)
                .visible(true)
                .metadata({ [LABEL_META_KEY]: meta })
                .build();
            label.style.maxViewScale = 1.25;
            label.style.minViewScale = 1;
            await OBR.scene.items.addItems([label]);

        }
    } catch (error) {
        console.error("Error in ensureElevationLabel:", error);
        console.error("Options:", opts);
        throw error;
    }
}

/**
 * Clear the elevation label for a specific token.
 */
export async function clearElevationLabel(tokenId: string): Promise<void> {
    const key = labelKey(tokenId);
    const existing = await findLabelByKey(key);
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
