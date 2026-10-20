import type { Item, Vector2 } from "@owlbear-rodeo/sdk";
import type { Combatant } from "../encounter/combatant";
import type { InitiativeSettings } from "../settings/settings";
import { footprintCells, unitsToPixels, type GridScale } from "../battlefield/footprint";
import { getPluginId } from "../getPluginId";

/**
 * Range rings: derived scene items written only by GM clients (ADR-0003).
 * `desiredRings` says which rings should exist; `planRings` turns that into
 * shapes under deterministic ids and diffs them against the scene.
 */

export const RING_META_KEY = getPluginId("rings");
const RING_ID_PREFIX = `${RING_META_KEY}.`;

/** "normal": the active PC's turn rings, seen by everyone. "dm": a GM-only preview. */
export type RingVariant = "normal" | "dm";
/** "move": circle left where the token started; "range": outline attached to the token. */
export type RingKind = "move" | "range";

export type RingStyle = { color: string; weight: number; pattern: "solid" | "dash"; opacity: number };

export type RingWant = { tokenId: string; variant: RingVariant; kind: RingKind; radiusUnits: number; style: RingStyle };

export const RING_DEFAULTS = {
    move: { color: "#519e00", weight: 12, pattern: "dash", opacity: 1 },
    range: { color: "#fe4c50", weight: 12, pattern: "dash", opacity: 1 },
} as const satisfies Record<RingKind, RingStyle>;

export function ringStyle(c: Combatant, kind: RingKind): RingStyle {
    const d = RING_DEFAULTS[kind];
    return kind === "move"
        ? { color: c.movementColor ?? d.color, weight: c.movementWeight ?? d.weight, pattern: c.movementPattern ?? d.pattern, opacity: c.movementOpacity ?? d.opacity }
        : { color: c.rangeColor ?? d.color, weight: c.rangeWeight ?? d.weight, pattern: c.rangePattern ?? d.pattern, opacity: c.rangeOpacity ?? d.opacity };
}

type RingSettings = Pick<InitiativeSettings, "showRangeRings" | "showMovementRange" | "showAttackRange" | "dmRingToggle">;

/**
 * Which rings should exist. Turn rings: every active PC while the encounter
 * runs. DM preview: every combatant with the preview on, whatever the turn.
 * The movement / attack-range settings apply to both.
 */
export function desiredRings(combatants: Combatant[], settings: RingSettings, started: boolean): RingWant[] {
    const wants: RingWant[] = [];
    const add = (c: Combatant, variant: RingVariant) => {
        if (settings.showMovementRange && c.movement > 0) wants.push({ tokenId: c.id, variant, kind: "move", radiusUnits: c.movement, style: ringStyle(c, "move") });
        if (settings.showAttackRange && c.attackRange > 0) wants.push({ tokenId: c.id, variant, kind: "range", radiusUnits: c.attackRange, style: ringStyle(c, "range") });
    };
    for (const c of combatants) {
        if (started && settings.showRangeRings && c.active && c.playerCharacter) add(c, "normal");
        if (settings.dmRingToggle && c.dmPreview) add(c, "dm");
    }
    return wants;
}

export type RingShape = {
    id: string;
    tokenId: string;
    variant: RingVariant;
    kind: RingKind;
    center: Vector2;
    /** Turn rings are visible to everyone; DM previews are hidden items only GMs see. */
    visible: boolean;
    style: RingStyle;
    /** Move: circle diameter in px. Range: half token size plus reach, in px. */
    geometry: { diameter: number } | { halfW: number; halfH: number; reach: number };
    /** Everything that should redraw the ring, except where the token is. */
    signature: string;
};

export type RingPlan = {
    add: RingShape[];
    /** Movement circles to resize/restyle in place (they keep their start-of-turn position). */
    update: RingShape[];
    remove: string[];
};

export const ringIdFor = (tokenId: string, variant: RingVariant, kind: RingKind) => `${RING_ID_PREFIX}${tokenId}.${variant}.${kind}`;

export function ringShape(want: RingWant, token: Item, grid: GridScale): RingShape {
    const cells = footprintCells(token);
    const geometry = want.kind === "move"
        ? { diameter: unitsToPixels(want.radiusUnits * 2, grid) + Math.max(cells.w, cells.h) * grid.dpi }
        : { halfW: (cells.w * grid.dpi) / 2, halfH: (cells.h * grid.dpi) / 2, reach: unitsToPixels(want.radiusUnits, grid) };
    const visible = want.variant === "normal";
    return {
        id: ringIdFor(want.tokenId, want.variant, want.kind),
        tokenId: want.tokenId,
        variant: want.variant,
        kind: want.kind,
        center: token.position,
        visible,
        style: want.style,
        geometry,
        signature: JSON.stringify([geometry, want.style, visible]),
    };
}

/** What to add, update and remove so the scene's rings match `wants`. */
export function planRings(items: Item[], wants: RingWant[], grid: GridScale): RingPlan {
    const tokens = new Map(items.map((i) => [i.id, i]));
    const desired = new Map<string, RingShape>();
    for (const want of wants) {
        const token = tokens.get(want.tokenId);
        if (token) desired.set(ringIdFor(want.tokenId, want.variant, want.kind), ringShape(want, token, grid));
    }

    const plan: RingPlan = { add: [], update: [], remove: [] };
    const existing = new Set<string>();
    for (const item of items) {
        const meta = (item.metadata as Record<string, unknown>)[RING_META_KEY] as { __ring__?: boolean; signature?: string } | undefined;
        if (!meta?.__ring__) continue;
        const want = desired.get(item.id);
        // Older versions' rings (random ids) and rings no longer wanted go.
        if (!want) {
            plan.remove.push(item.id);
            continue;
        }
        existing.add(item.id);
        if (meta.signature === want.signature) continue;
        if (want.kind === "move") plan.update.push(want);
        else {
            plan.remove.push(item.id);
            plan.add.push(want);
        }
    }
    for (const shape of desired.values()) {
        if (!existing.has(shape.id)) plan.add.push(shape);
    }
    return plan;
}

export function ringMetadata(shape: RingShape) {
    return { [RING_META_KEY]: { __ring__: true, ownerId: shape.tokenId, variant: shape.variant, kind: shape.kind, signature: shape.signature } };
}

export function strokeDash(style: RingStyle): number[] {
    return style.pattern === "dash" ? [style.weight * 1.5, style.weight * 1.5] : [];
}
