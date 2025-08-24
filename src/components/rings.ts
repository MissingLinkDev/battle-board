// src/scene/rings.ts
import OBR, { buildShape, type Item, type Shape, type Vector2, isImage } from "@owlbear-rodeo/sdk";
import { getPluginId } from "../getPluginId";

const RING_META = getPluginId("rings");
const MOVEMENT_COLOR = "#28a745";
const RANGE_COLOR = "#dc3545";
const DASH = [10, 20];
const STROKE_W = 10 as const;

type RingVariant = "normal" | "dm";

type RingKind = "move" | "range";
type RingMeta = {
    ownerId: string; // token id
    kind: RingKind;
    variant: RingVariant;
    __ring__: true;
    [k: string]: unknown;
};

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
    const [dpi, scale] = await Promise.all([OBR.scene.grid.getDpi(), OBR.scene.grid.getScale()]);
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
}) {
    const { tokenId, center, diameterPx, color, kind, attached, visible, variant } = opts;

    const builder = buildShape()
        .shapeType("CIRCLE")
        .width(diameterPx)
        .height(diameterPx)
        .position(center) // place at center
        .fillOpacity(0)
        .strokeColor(color)
        .strokeOpacity(1)
        .strokeWidth(STROKE_W)
        .strokeDash(DASH)
        .locked(true)
        .disableHit(false)
        .visible(visible)
        .metadata(ringMeta(tokenId, kind, variant));

    if (attached) {
        builder.layer("DRAWING").attachedTo(tokenId);
    } else {
        // Unattached ring sits in DRAWING layer so it doesn't follow the token
        builder.layer("DRAWING");
    }

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
}) {
    const {
        tokenId,
        movement,
        attackRange,
        moveAttached = false,
        rangeAttached = true,
        visible = true,
        variant = "normal",
    } = params;

    // Get the token (for initial placement center)
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
    }[] = [];
    const toDelete: string[] = [];

    // Helper to see if an existing ring matches attachment mode
    const hasAttachment = (r: Shape) => r.layer === "DRAWING" && (r as any).attachedTo === tokenId;

    // MOVE RING (default: unattached)
    if (wantMove > 0) {
        if (existingMove) {
            const wrongAttachment =
                moveAttached ? !hasAttachment(existingMove) : hasAttachment(existingMove);
            if (wrongAttachment) {
                // Easier: recreate with correct attachment behavior
                toDelete.push(existingMove.id);
                toAdd.push(
                    buildCircle({
                        tokenId,
                        center,
                        diameterPx: wantMove,
                        color: MOVEMENT_COLOR,
                        kind: "move",
                        attached: moveAttached,
                        visible,
                        variant,
                    })
                );
            } else {
                const needsSize =
                    existingMove.width !== wantMove || existingMove.height !== wantMove;
                // Only attached rings should track the token's position
                const needsPos =
                    moveAttached &&
                    (existingMove.position.x !== center.x || existingMove.position.y !== center.y);

                const needsVis = existingMove.visible !== visible;

                if (needsSize || needsPos || needsVis) {
                    toUpdate.push({
                        id: existingMove.id,
                        ...(needsSize ? { width: wantMove, height: wantMove } : {}),
                        ...(needsPos ? { position: center } : {}),
                        ...(needsVis ? { visible } : {}),
                    });
                }
            }
        } else {
            toAdd.push(
                buildCircle({
                    tokenId,
                    center,
                    diameterPx: wantMove,
                    color: MOVEMENT_COLOR,
                    kind: "move",
                    attached: moveAttached,
                    visible,
                    variant,
                })
            );
        }
    } else if (existingMove) {
        toDelete.push(existingMove.id);
    }

    // RANGE RING (default: attached)
    if (wantRange > 0) {
        if (existingRange) {
            const wrongAttachment =
                rangeAttached ? !hasAttachment(existingRange) : hasAttachment(existingRange);
            if (wrongAttachment) {
                toDelete.push(existingRange.id);
                toAdd.push(
                    buildCircle({
                        tokenId,
                        center,
                        diameterPx: wantRange,
                        color: RANGE_COLOR,
                        kind: "range",
                        attached: rangeAttached,
                        visible,
                        variant,
                    })
                );
            } else {
                const needsSize =
                    existingRange.width !== wantRange || existingRange.height !== wantRange;
                const needsPos =
                    rangeAttached &&
                    (existingRange.position.x !== center.x || existingRange.position.y !== center.y);

                const needsVisR = existingRange.visible !== visible;

                if (needsSize || needsPos || needsVisR) {
                    toUpdate.push({
                        id: existingRange.id,
                        ...(needsSize ? { width: wantRange, height: wantRange } : {}),
                        ...(needsPos ? { position: center } : {}),
                        ...(needsVisR ? { visible } : {}),
                    });
                }
            }
        } else {
            toAdd.push(
                buildCircle({
                    tokenId,
                    center,
                    diameterPx: wantRange,
                    color: RANGE_COLOR,
                    kind: "range",
                    attached: rangeAttached,
                    visible,
                    variant,
                })
            );
        }
    } else if (existingRange) {
        toDelete.push(existingRange.id);
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
                    if (upd.visible !== undefined) (it as any).visible = upd.visible; // 👈 add this line
                }
            }
        );
    }

    if (toAdd.length) await OBR.scene.items.addItems(toAdd);
}
