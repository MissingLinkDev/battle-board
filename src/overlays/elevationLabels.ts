import { isImage, type Item, type Vector2 } from "@owlbear-rodeo/sdk";
import { readMeta } from "../components/metadata";
import { getPluginId } from "../getPluginId";

/**
 * Elevation labels: one text label attached to each token whose elevation is
 * not 0, combatant or not. Labels are derived scene items written only by GM
 * clients (ADR-0003), always under a deterministic id, so finding a token's
 * label is a lookup by id.
 */

const LABEL_ID_PREFIX = `${getPluginId("elevation-label")}.`;
/** Metadata marker on labels; older versions also used it to find labels. */
export const LABEL_META_KEY = getPluginId("elevation-label");

const LABEL_HEIGHT_ESTIMATE = 30;

export const labelIdFor = (tokenId: string) => `${LABEL_ID_PREFIX}${tokenId}`;
export const isCurrentLabel = (item: Item) => item.id.startsWith(LABEL_ID_PREFIX);

export type LabelSpec = { id: string; tokenId: string; text: string; position: Vector2 };
export type GridInfo = { dpi: number; unitLabel: string };

export type LabelPlan = {
    add: LabelSpec[];
    /** Existing labels whose text is out of date. */
    update: LabelSpec[];
    remove: string[];
};

export function labelText(elevation: number, unit: string): string {
    return `${elevation > 0 ? "🪽" : "⬇️"} ${elevation} ${unit}`;
}

/** The labels the scene should have. */
export function desiredLabels(items: Item[], grid: GridInfo): Map<string, LabelSpec> {
    const desired = new Map<string, LabelSpec>();
    for (const item of items) {
        if (!isImage(item) || (item.layer !== "CHARACTER" && item.layer !== "MOUNT")) continue;
        const elevation = readMeta(item)?.elevation ?? 0;
        if (elevation === 0) continue;
        const id = labelIdFor(item.id);
        desired.set(id, { id, tokenId: item.id, text: labelText(elevation, grid.unitLabel), position: labelPosition(item, grid) });
    }
    return desired;
}

/** What to add, update and remove so the scene's labels match `desiredLabels`. */
export function planLabels(items: Item[], grid: GridInfo): LabelPlan {
    const desired = desiredLabels(items, grid);
    const plan: LabelPlan = { add: [], update: [], remove: [] };
    const existing = new Set<string>();

    for (const item of items) {
        if (!isCurrentLabel(item)) {
            // Ours, but not under the current id (e.g. copied along with its token).
            if (hasLabelMarker(item)) plan.remove.push(item.id);
            continue;
        }
        existing.add(item.id);
        const want = desired.get(item.id);
        if (!want) plan.remove.push(item.id);
        else if ((item as Item & { text?: { plainText?: string } }).text?.plainText !== want.text) plan.update.push(want);
    }
    for (const spec of desired.values()) {
        if (!existing.has(spec.id)) plan.add.push(spec);
    }
    return plan;
}

/**
 * Labels left by older versions whose metadata marker was lost: attached to a
 * token and showing the 🪽 icon, but not under the current id. Too heuristic
 * for every sync, so only the one-off sweep on scene open deletes them.
 */
export function legacyLabelIds(items: Item[]): string[] {
    return items
        .filter((item) => {
            if (isCurrentLabel(item) || hasLabelMarker(item)) return false;
            const text = (item as Item & { text?: { plainText?: string } }).text?.plainText;
            return !!item.attachedTo && !!text?.includes("🪽");
        })
        .map((item) => item.id);
}

function hasLabelMarker(item: Item): boolean {
    const marker = (item.metadata as Record<string, unknown>)[LABEL_META_KEY] as { __elevationLabel__?: boolean } | undefined;
    return !!marker?.__elevationLabel__;
}

/** Just inside the top edge of the token. */
function labelPosition(token: Item, grid: GridInfo): Vector2 {
    const center = token.position;
    if (!isImage(token)) return { x: center.x, y: center.y - 50 };
    const dpi = token.grid?.dpi ?? grid.dpi;
    const cellsH = (token.image?.height ?? dpi) / dpi;
    const scaleY = Math.abs(token.scale?.y ?? 1);
    return { x: center.x, y: center.y - (grid.dpi / 2) * cellsH * scaleY + LABEL_HEIGHT_ESTIMATE };
}
