// src/scene/rings.ts
import OBR, { buildShape, type Item, type Shape, type Vector2, isImage } from "@owlbear-rodeo/sdk";
import { getPluginId } from "../getPluginId";

const RING_META = getPluginId("rings");

const DEFAULT_MOVE_COLOR = "#519e00";
const DEFAULT_RANGE_COLOR = "#fe4c50";
const DEFAULT_WEIGHT = 12;
const DEFAULT_PATTERN: "solid" | "dash" | "dot" = "dash";
const DEFAULT_OPACITY = 1;

type RingVariant = "normal" | "dm";
type RingKind = "move" | "range";

type RingMeta = {
    ownerId: string; // token id
    kind: RingKind;
    variant: RingVariant;
    __ring__: true;
    [k: string]: unknown;
};

function dashFor(
    pattern: "solid" | "dash" | "dot" | undefined | null,
    width: number
): number[] | undefined {
    if (!pattern || pattern === "solid") return undefined;

    const w = Math.max(1, Math.round(width));
    if (pattern === "dash") {
        const dash = Math.max(1, Math.round(1.2 * w));
        const gap = Math.max(1, Math.round(4.0 * w));
        return [dash, gap];
    }
    // "dot": very short dash with a moderate gap
    const dot = Math.max(1, Math.round(0.6 * w));
    const gap = Math.max(1, Math.round(1.6 * w));
    return [dot, gap];
}

const isShapeItem = (it: Item): it is Shape => it.type === "SHAPE";

const isOurRing = (it: Item, ownerId?: string, variant?: RingVariant): it is Shape => {
    if (!isShapeItem(it)) return false;
    const m = it.metadata as any;
    const mine = m?.[RING_META] && m?.__ring__ === true;
    if (!mine) return false;
    if (ownerId && m?.ownerId !== ownerId) return false;
    if (variant && m?.variant !== variant) return false;
    return true;
};

function ringMeta(ownerId: string, kind: RingKind, variant: RingVariant): RingMeta {
    return { ownerId, kind, variant, __ring__: true, [RING_META]: true } as any;
}

export async function clearRingsFor(tokenId: string, variant?: RingVariant) {
    const rings = await OBR.scene.items.getItems((it) => isOurRing(it, tokenId, variant));
    if (rings.length) await OBR.scene.items.deleteItems(rings.map((r) => r.id));
}

/** Convert a distance in grid units (e.g., feet) to pixels based on the scene grid. */
async function unitsToPixels(units: number): Promise<number> {
    const [dpi, scale] = await Promise.all([OBR.scene.grid.getDpi(), OBR.scene.grid.getScale(),]);
    const perCellUnits = scale.parsed?.multiplier ?? 5;
    return (units / perCellUnits) * dpi;
}

/** Remove all rings created by us (any owner). */
export async function clearRings(variant?: RingVariant) {
    const rings = await OBR.scene.items.getItems((it) => isOurRing(it, undefined, variant));
    if (rings.length) await OBR.scene.items.deleteItems(rings.map((r) => r.id));
}

/** Build a dashed circle, optionally attached to `tokenId`. */
function buildCircle(opts: {
    tokenId: string;
    center: Vector2;
    diameterPx: number;
    color: string;
    kind: RingKind;
    attached: boolean;
    visible: boolean;
    variant: RingVariant;
    strokeWidth: number;
    strokeDash?: number[];
    strokeOpacity: number;
}) {
    const { tokenId, center, diameterPx, color, kind, attached, visible, variant, strokeWidth, strokeDash, strokeOpacity } = opts;

    const builder = buildShape()
        .shapeType("CIRCLE")
        .width(diameterPx)
        .height(diameterPx)
        .position(center)
        .fillOpacity(0)
        .strokeColor(color)
        .strokeOpacity(strokeOpacity)
        .strokeWidth(strokeWidth)
        .locked(true)
        .disableHit(false)
        .visible(visible)
        .metadata(ringMeta(tokenId, kind, variant));

    if (strokeDash && strokeDash.length) builder.strokeDash(strokeDash);

    if (attached) builder.layer("DRAWING").attachedTo(tokenId);
    else builder.layer("DRAWING");

    return builder.build();
}

async function getTokenFeet(token: Item): Promise<number> {
    // Scene units per cell (usually 5 ft)
    const sceneScale = await OBR.scene.grid.getScale();
    const perCellUnits = sceneScale.parsed?.multiplier ?? 5;

    if (isImage(token) && token.grid?.dpi && token.image?.width && token.image?.height) {
        const dpi = token.grid.dpi; // pixels per grid cell in the image
        // Base cells from the raw image dimensions
        const baseCellsW = token.image.width / dpi;
        const baseCellsH = token.image.height / dpi;

        // Apply any DM scaling (scale is per-axis)
        const scaleX = Math.abs(token.scale?.x ?? 1);
        const scaleY = Math.abs(token.scale?.y ?? 1);

        const cellsW = baseCellsW * scaleX;
        const cellsH = baseCellsH * scaleY;

        // Tokens are effectively the max side in cells
        const cells = Math.max(cellsW, cellsH) || 1;

        return cells * perCellUnits; // feet
    }

    // Fallback: treat as Medium (1 cell)
    return perCellUnits;
}

/**
 * Ensure rings exist for this token + stats (idempotent):
 * - diameter feet = (stat * 2 + 5)
 * - skip a ring when stat <= 0
 * - update size (and position for attached rings) instead of delete/recreate
 *
 * Attachment behavior:
 * - moveAttached=false → ring is placed where created, does NOT follow the token
 * - rangeAttached=true → ring follows the token via ATTACHMENT layer
 */
export async function ensureRings(params: {
    tokenId: string;
    movement: number;
    attackRange: number;
    moveAttached?: boolean;  // default false
    rangeAttached?: boolean; // default true
    visible?: boolean;
    variant?: RingVariant;
    movementColor?: string | null;
    rangeColor?: string | null;
    movementWeight?: number | null;
    rangeWeight?: number | null;
    movementPattern?: "solid" | "dash" | "dot" | null;
    rangePattern?: "solid" | "dash" | "dot" | null;
    movementOpacity?: number | null;  // 0..1
    rangeOpacity?: number | null;
    forceRecenter?: boolean;
    only?: "move" | "range";
}) {
    const {
        tokenId,
        movement,
        attackRange,
        moveAttached = false,
        rangeAttached = true,
        visible = true,
        variant = "normal",
        movementColor = null,
        rangeColor = null,
        movementWeight,
        rangeWeight,
        movementPattern,
        rangePattern,
        movementOpacity,
        rangeOpacity,
        forceRecenter = false,
        only,
    } = params;

    const moveStroke = movementColor ?? DEFAULT_MOVE_COLOR;
    const rangeStroke = rangeColor ?? DEFAULT_RANGE_COLOR;
    const moveWeight = Math.max(1, movementWeight ?? DEFAULT_WEIGHT);
    const rangeWeight2 = Math.max(1, rangeWeight ?? DEFAULT_WEIGHT);
    const moveDash = dashFor(movementPattern ?? DEFAULT_PATTERN, moveWeight);
    const rangeDash = dashFor(rangePattern ?? DEFAULT_PATTERN, rangeWeight2);
    const moveOpacity = Math.max(0, Math.min(1, movementOpacity ?? DEFAULT_OPACITY));
    const rangeOpacity2 = Math.max(0, Math.min(1, rangeOpacity ?? DEFAULT_OPACITY));

    const [token] = await OBR.scene.items.getItems((it) => it.id === tokenId);
    if (!token) return;
    const center = token.position;

    const tokenFeet = getTokenFeet(token);

    // Find any existing rings we created for this token (attached or not)
    const allRings = await OBR.scene.items.getItems((it) => isOurRing(it, tokenId, variant));
    const existingMove = allRings.find((r) => (r.metadata as any)?.kind === "move");
    const existingRange = allRings.find((r) => (r.metadata as any)?.kind === "range");

    const wantMove = movement > 0 ? await unitsToPixels(movement * 2 + await tokenFeet) : 0;
    const wantRange = attackRange > 0 ? await unitsToPixels(attackRange * 2 + await tokenFeet) : 0;

    const toAdd: Shape[] = [];
    const toUpdate: {
        id: string;
        width?: number;
        height?: number;
        position?: Vector2;
        layer?: string;
        attachedTo?: string | null;
        visible?: boolean;
        strokeColor?: string;
        strokeWidth?: number;
        strokeOpacity?: number;
    }[] = [];
    const toDelete: string[] = [];

    // Helper to see if an existing ring matches attachment mode
    const hasAttachment = (r: Shape) => r.layer === "ATTACHMENT" && (r as any).attachedTo === tokenId;

    // Helpers to read current style from existing shapes (works across SDK versions)
    const readStrokeColor = (s: Shape): string | undefined =>
        ((s as any).style?.strokeColor ?? (s as any).strokeColor) as string | undefined;
    const readStrokeWidth = (s: Shape): number | undefined =>
        ((s as any).style?.strokeWidth ?? (s as any).strokeWidth) as number | undefined;
    const readStrokeOpacity = (s: Shape): number | undefined =>
        ((s as any).style?.strokeOpacity ?? (s as any).strokeOpacity) as number | undefined;
    const readStrokeDash = (s: Shape): number[] | undefined =>
        ((s as any).style?.strokeDash ?? (s as any).strokeDash) as number[] | undefined;

    // MOVE RING (default: unattached)
    if (!only || only === "move") {
        if (wantMove > 0) {
            if (existingMove) {
                const wrongAttachment =
                    moveAttached ? !hasAttachment(existingMove) : hasAttachment(existingMove);
                const existingDash = readStrokeDash(existingMove) ?? [];
                const dashMismatch =
                    JSON.stringify(existingDash) !== JSON.stringify(moveDash ?? []);

                if (wrongAttachment || dashMismatch) {
                    // Recreate for attachment or dash changes
                    toDelete.push(existingMove.id);
                    toAdd.push(
                        buildCircle({
                            tokenId,
                            center,
                            diameterPx: wantMove,
                            color: moveStroke,
                            kind: "move",
                            attached: moveAttached,
                            visible,
                            variant,
                            strokeWidth: moveWeight,
                            strokeDash: moveDash,
                            strokeOpacity: moveOpacity,
                        })
                    );
                } else {
                    const needsSize =
                        existingMove.width !== wantMove || existingMove.height !== wantMove;

                    // track token position only when attached OR if forceRecenter is requested
                    const needsPos =
                        (moveAttached || forceRecenter) &&
                        (existingMove.position.x !== center.x ||
                            existingMove.position.y !== center.y);

                    const needsVis = existingMove.visible !== visible;
                    const needsColor = readStrokeColor(existingMove) !== moveStroke;
                    const needsWeight = readStrokeWidth(existingMove) !== moveWeight;
                    const needsOpacity = readStrokeOpacity(existingMove) !== moveOpacity;

                    if (needsSize || needsPos || needsVis || needsColor || needsWeight || needsOpacity) {
                        toUpdate.push({
                            id: existingMove.id,
                            ...(needsSize ? { width: wantMove, height: wantMove } : {}),
                            ...(needsPos ? { position: center } : {}),
                            ...(needsVis ? { visible } : {}),
                            ...(needsColor ? { strokeColor: moveStroke } : {}),
                            ...(needsWeight ? { strokeWidth: moveWeight } : {}),
                            ...(needsOpacity ? { strokeOpacity: moveOpacity } : {}),
                        });
                    }
                }
            } else {
                toAdd.push(
                    buildCircle({
                        tokenId,
                        center,
                        diameterPx: wantMove,
                        color: moveStroke,
                        kind: "move",
                        attached: moveAttached,
                        visible,
                        variant,
                        strokeWidth: moveWeight,
                        strokeDash: moveDash,
                        strokeOpacity: moveOpacity,
                    })
                );
            }
        } else if (existingMove) {
            toDelete.push(existingMove.id);
        }
    }

    // RANGE RING (default: attached)
    if (!only || only === "range") {
        if (wantRange > 0) {
            if (existingRange) {
                const wrongAttachment =
                    rangeAttached ? !hasAttachment(existingRange) : hasAttachment(existingRange);

                const existingDash = readStrokeDash(existingRange) ?? [];
                const dashMismatch =
                    JSON.stringify(existingDash) !== JSON.stringify(rangeDash ?? []);

                if (wrongAttachment || dashMismatch) {
                    toDelete.push(existingRange.id);
                    toAdd.push(
                        buildCircle({
                            tokenId,
                            center,
                            diameterPx: wantRange,
                            color: rangeStroke,
                            kind: "range",
                            attached: rangeAttached,
                            visible,
                            variant,
                            strokeWidth: rangeWeight2,
                            strokeDash: rangeDash,
                            strokeOpacity: rangeOpacity2,
                        })
                    );
                } else {
                    const needsSize =
                        existingRange.width !== wantRange || existingRange.height !== wantRange;

                    const needsPos =
                        (rangeAttached || forceRecenter) &&
                        (existingRange.position.x !== center.x ||
                            existingRange.position.y !== center.y);

                    const needsVis = existingRange.visible !== visible;
                    const needsColor = readStrokeColor(existingRange) !== rangeStroke;
                    const needsWeight = readStrokeWidth(existingRange) !== rangeWeight2;
                    const needsOpacity = readStrokeOpacity(existingRange) !== rangeOpacity2;

                    if (needsSize || needsPos || needsVis || needsColor || needsWeight || needsOpacity) {
                        toUpdate.push({
                            id: existingRange.id,
                            ...(needsSize ? { width: wantRange, height: wantRange } : {}),
                            ...(needsPos ? { position: center } : {}),
                            ...(needsVis ? { visible } : {}),
                            ...(needsColor ? { strokeColor: rangeStroke } : {}),
                            ...(needsWeight ? { strokeWidth: rangeWeight2 } : {}),
                            ...(needsOpacity ? { strokeOpacity: rangeOpacity2 } : {}),
                        });
                    }
                }
            } else {
                toAdd.push(
                    buildCircle({
                        tokenId,
                        center,
                        diameterPx: wantRange,
                        color: rangeStroke,
                        kind: "range",
                        attached: rangeAttached,
                        visible,
                        variant,
                        strokeWidth: rangeWeight2,
                        strokeDash: rangeDash,
                        strokeOpacity: rangeOpacity2,
                    })
                );
            }
        } else if (existingRange) {
            toDelete.push(existingRange.id);
        }
    }

    if (toDelete.length) await OBR.scene.items.deleteItems(toDelete);

    if (toUpdate.length) {
        await OBR.scene.items.updateItems(
            toUpdate.map((u) => u.id),
            (items) => {
                for (const it of items) {
                    if (!isShapeItem(it)) continue;
                    const upd = toUpdate.find((u) => u.id === it.id)!;

                    if (upd.width !== undefined) it.width = upd.width;
                    if (upd.height !== undefined) it.height = upd.height;
                    if (upd.position) it.position = upd.position;
                    if (upd.visible !== undefined) it.visible = upd.visible; // keep it as a native prop

                    if (upd.strokeColor !== undefined || upd.strokeWidth !== undefined || upd.strokeOpacity !== undefined) {
                        const s = ((it as any).style ?? {}) as any;
                        (it as any).style = {
                            ...s,
                            ...(upd.strokeColor !== undefined ? { strokeColor: upd.strokeColor } : {}),
                            ...(upd.strokeWidth !== undefined ? { strokeWidth: upd.strokeWidth } : {}),
                            ...(upd.strokeOpacity !== undefined ? { strokeOpacity: upd.strokeOpacity } : {}),
                        };
                    }
                }
            }
        );
    }

    if (toAdd.length) await OBR.scene.items.addItems(toAdd);
}
