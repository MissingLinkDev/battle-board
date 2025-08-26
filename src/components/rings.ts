// src/rings.ts
import OBR, { buildShape, isImage, type Item, type Shape, type Vector2 } from "@owlbear-rodeo/sdk";
import { getPluginId } from "../getPluginId";
import { getGridInfo, unitsToPixels } from "./utils";
// If you already have grid helpers, you can import and use them here:
// import { getGridInfo } from "./utils";

/* =========================
   Constants (file-local)
   ========================= */
const RING_META_KEY = getPluginId("rings");

const DEFAULT_MOVE_COLOR = "#519e00";
const DEFAULT_RANGE_COLOR = "#fe4c50";
const DEFAULT_WEIGHT = 12 as number;
const DEFAULT_PATTERN: "solid" | "dash" | "dot" = "dash";
const DEFAULT_OPACITY = 1 as number;

/* =========================
   Types
   ========================= */
export type RingVariant = "normal" | "dm";
export type RingKind = "move" | "range";

type RingMeta = {
    __ring__: true;
    ownerId: string;     // token id
    variant: RingVariant;
    kind: RingKind;
    key: string;         // stable rediscovery key (ownerId:variant:kind)
};

/* =========================
   Stable key & helpers
   ========================= */
const ringKey = (ownerId: string, variant: RingVariant, kind: RingKind) =>
    `${ownerId}:${variant}:${kind}`;

const buildRingMeta = (ownerId: string, variant: RingVariant, kind: RingKind): RingMeta => ({
    __ring__: true,
    ownerId,
    variant,
    kind,
    key: ringKey(ownerId, variant, kind),
});

const dashFor = (
    pattern: "solid" | "dash" | "dot" | null | undefined,
    width: number
): number[] | undefined => {
    if (!pattern || pattern === "solid") return undefined;
    if (pattern === "dash") return [width * 1.5, width * 1.5];
    if (pattern === "dot") return [0, width * 2];
    return undefined;
};

async function findRingByKey(key: string): Promise<Shape | null> {
    const items = await OBR.scene.items.getItems();
    for (const it of items) {
        const meta = (it.metadata as any)?.[RING_META_KEY] as RingMeta | undefined;
        if (meta && meta.__ring__ && meta.key === key) {
            return it as unknown as Shape;
        }
    }
    return null;
}

/* If you already have a robust feet→px conversion from your grid, use it here.
   This fallback assumes 5 ft per cell and ~70 px per cell (common defaults). */
async function feetToPixels(feet: number): Promise<number> {
    const grid = await getGridInfo();      // same source your distances use
    return unitsToPixels(feet, grid);       // <- use your existing converter
}

/** Compute this token's footprint DIAMETER in scene units (feet) from its snapshot. */
async function tokenDiameterFeet(token: Item,): Promise<number> {
    const grid = await getGridInfo();
    // Fallback: treat as 1 cell
    const fallback = grid.unitsPerCell;

    if (!isImage(token) || !token.image?.width || !token.image?.height) {
        return fallback;
    }
    const dpi = token.grid?.dpi;
    if (!dpi) return fallback; // missing authored DPI → assume 1 cell

    const baseCellsW = token.image.width / dpi;
    const baseCellsH = token.image.height / dpi;

    const scaleX = Math.abs(token.scale?.x ?? 1);
    const scaleY = Math.abs(token.scale?.y ?? 1);

    const cells = Math.max(baseCellsW * scaleX, baseCellsH * scaleY) || 1;
    return cells * grid.unitsPerCell; // feet
}

/* =========================
   Public API
   ========================= */
export async function ensureRings(opts: {
    tokenId: string;
    movement: number;
    attackRange: number;
    moveAttached?: boolean;      // reserved if you use attachments
    rangeAttached?: boolean;
    visible?: boolean;
    variant?: RingVariant;       // "normal" | "dm"

    movementColor?: string | null;
    rangeColor?: string | null;
    movementWeight?: number | null;
    rangeWeight?: number | null;
    movementPattern?: "solid" | "dash" | "dot" | null;
    rangePattern?: "solid" | "dash" | "dot" | null;
    movementOpacity?: number | null; // 0..1
    rangeOpacity?: number | null;    // 0..1

    forceRecenter?: boolean;
    only?: RingKind;             // "move" | "range"
}) {
    const {
        tokenId,
        movement,
        attackRange,
        moveAttached = false,  // attachment not used in this simplified version
        rangeAttached = true,
        visible = true,
        variant = "normal",

        movementColor,
        rangeColor,
        movementWeight,
        rangeWeight,
        movementPattern,
        rangePattern,
        movementOpacity,
        rangeOpacity,

        forceRecenter = false,
        only,
    } = opts;

    // fetch token to derive center
    const [token] = await OBR.scene.items.getItems((it) => it.id === tokenId);
    if (!token) return;

    // NB: Owlbear item position is its shape anchor; for circles we treat .position as center.
    const center = (token as any).position as Vector2;

    const upsert = async (
        kind: RingKind,
        radiusFeet: number,
        colorIn: string | null | undefined,
        weightIn: number | null | undefined,
        patternIn: "solid" | "dash" | "dot" | null | undefined,
        opacityIn: number | null | undefined,
        attached: boolean
    ) => {
        const key = ringKey(tokenId, variant, kind);
        const meta = buildRingMeta(tokenId, variant, kind);

        // remove if “off”
        if (!radiusFeet || radiusFeet <= 0) {
            const stale = await findRingByKey(key);
            if (stale) await OBR.scene.items.deleteItems([stale.id]);
            return;
        }

        // units: FEET → PX using the same grid math as your distances
        const diameterPx = await feetToPixels(radiusFeet * 2 + await tokenDiameterFeet(token));

        // style
        const strokeWidth = (weightIn ?? DEFAULT_WEIGHT);
        const color = colorIn ?? (kind === "move" ? DEFAULT_MOVE_COLOR : DEFAULT_RANGE_COLOR);
        const strokeOpacity = (opacityIn ?? DEFAULT_OPACITY);
        const strokeDash = dashFor(patternIn ?? DEFAULT_PATTERN, strokeWidth);

        const existing = await findRingByKey(key);

        if (existing) {
            // UPDATE IN PLACE (no delete/re-add)
            await OBR.scene.items.updateItems([existing.id], (items) => {
                const it: any = items[0];

                // geometry
                it.width = diameterPx;
                it.height = diameterPx;
                if (forceRecenter) it.position = center;

                // visibility / attachment
                it.visible = visible;
                it.layer = "DRAWING";
                it.attachedTo = attached ? tokenId : undefined;
                it.locked = true;
                it.disableHit = false;

                // ✅ style must be updated under `style`
                const s = { ...(it.style ?? {}) };
                s.strokeColor = color;
                s.strokeOpacity = strokeOpacity;
                s.strokeWidth = strokeWidth;
                s.strokeDash = strokeDash ?? [];     // empty array = solid
                it.style = s;

                // metadata (keep your stable key)
                (it.metadata as any)[RING_META_KEY] = meta;
            });
        } else {
            // CREATE
            const b = buildShape()
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
                .layer("DRAWING")
                .visible(visible)
                .metadata({ [RING_META_KEY]: meta });

            if (strokeDash) b.strokeDash(strokeDash as any);
            if (attached) b.attachedTo(tokenId);

            const shape = b.build();
            await OBR.scene.items.addItems([shape]);
        }
    };


    // Fast path for single-type updates
    if (only === "move") {
        await upsert("move", movement, movementColor, movementWeight, movementPattern, movementOpacity, moveAttached ?? false);
        return;
    }
    if (only === "range") {
        await upsert("range", attackRange, rangeColor, rangeWeight, rangePattern, rangeOpacity, rangeAttached ?? true);
        return;
    }

    await upsert("move", movement, movementColor, movementWeight, movementPattern, movementOpacity, moveAttached ?? false);
    await upsert("range", attackRange, rangeColor, rangeWeight, rangePattern, rangeOpacity, rangeAttached ?? true);
}

export async function clearRings(variant: RingVariant) {
    const items = await OBR.scene.items.getItems();
    const ids = items
        .filter((it) => {
            const meta = (it.metadata as any)?.[RING_META_KEY] as RingMeta | undefined;
            return meta && meta.__ring__ && meta.variant === variant;
        })
        .map((it) => it.id);
    if (ids.length) await OBR.scene.items.deleteItems(ids);
}

export async function clearRingsFor(ownerId: string, variant: RingVariant) {
    const items = await OBR.scene.items.getItems();
    const ids = items
        .filter((it) => {
            const meta = (it.metadata as any)?.[RING_META_KEY] as RingMeta | undefined;
            return meta && meta.__ring__ && meta.variant === variant && meta.ownerId === ownerId;
        })
        .map((it) => it.id);
    if (ids.length) await OBR.scene.items.deleteItems(ids);
}

