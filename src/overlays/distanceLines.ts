import type { Item, Vector2 } from "@owlbear-rodeo/sdk";
import type { Combatant } from "../encounter/combatant";
import type { InitiativeSettings } from "../settings/settings";
import { distanceBetween, formatDistance, type Body } from "../battlefield/distance";
import { footprintCells } from "../battlefield/footprint";
import type { GridSnapshot } from "../battlefield/grid";
import { getPluginId } from "../getPluginId";

/**
 * Distance lines: on an active PC's turn, a dotted line with a distance label
 * to every other visible combatant more than two cells away. Derived scene
 * items written only by GM clients (ADR-0003), under deterministic ids. Two
 * looks (see `LineLook`); each line is one or more parts, one item per part.
 */

export const LINE_META_KEY = getPluginId("distance-line");
const LINE_ID_PREFIX = `${LINE_META_KEY}.`;

/** Anything this many cells away or closer is in reach and obvious: no line. */
const MIN_CELLS = 2;

/**
 * "line": a dashed line with the distance in a pill at its midpoint, turned to
 * run along the line like the ruler's (two items).
 * "ruler": Owlbear's own dashed ruler, which shows the distance itself (one item).
 */
export type LineLook = "line" | "ruler";
export const LINE_LOOK: LineLook = "line";

export type LinePart = "line" | "label" | "ruler";
export const PARTS_BY_LOOK = { line: ["line", "label"], ruler: ["ruler"] } as const satisfies Record<LineLook, readonly LinePart[]>;

export type DistanceLineSpec = {
    /** Shared by the line and its label; each item's id adds its part. */
    id: string;
    start: Vector2;
    end: Vector2;
    text: string;
    /** Stroke width in px, scaled to the grid. */
    weight: number;
    /** Label font size in px, scaled to the grid. */
    fontSize: number;
    /** Everything that should redraw the line. */
    signature: string;
};

export type LinePlan = {
    add: DistanceLineSpec[];
    update: DistanceLineSpec[];
    remove: string[];
};

export const lineIdFor = (fromId: string, toId: string) => `${LINE_ID_PREFIX}${fromId}.${toId}`;
export const partIdFor = (spec: Pick<DistanceLineSpec, "id">, part: LinePart) => `${spec.id}.${part}`;

type LineSettings = Pick<InitiativeSettings, "showDistanceLines" | "roundDistances">;

/**
 * The lines the scene should have. Hidden and staged combatants neither get
 * nor cast lines, so the lines never give them away.
 */
export async function desiredLines(items: Item[], combatants: Combatant[], settings: LineSettings, started: boolean, grid: GridSnapshot): Promise<DistanceLineSpec[]> {
    if (!started || !settings.showDistanceLines) return [];
    const tokens = new Map(items.map((i) => [i.id, i]));
    const shown = combatants.filter((c) => c.visible && !c.groupStaged && tokens.has(c.id));
    const bodies = new Map(shown.map((c) => [c.id, bodyOf(c, tokens.get(c.id)!)]));
    const weight = Math.max(2, grid.dpi / 30);
    const fontSize = Math.max(12, Math.round(grid.dpi / 7));

    const specs: DistanceLineSpec[] = [];
    for (const from of shown) {
        if (!from.active || !from.playerCharacter) continue;
        const a = bodies.get(from.id)!;
        const lines = await Promise.all(shown.filter((to) => to.id !== from.id).map(async (to) => {
            const b = bodies.get(to.id)!;
            const { units, text } = formatDistance(await distanceBetween(a, b, grid), grid, { round: settings.roundDistances });
            if (units <= MIN_CELLS * grid.unitsPerCell) return null;
            const spec = { id: lineIdFor(from.id, to.id), start: a.center, end: b.center, text, weight, fontSize };
            return { ...spec, signature: JSON.stringify([spec.start, spec.end, text, weight, fontSize]) };
        }));
        specs.push(...lines.filter((l): l is DistanceLineSpec => !!l));
    }
    return specs;
}

/** What to add, update and remove so the scene's lines match `wants`, drawn in `look`. */
export function planLines(items: Item[], wants: DistanceLineSpec[], look: LineLook): LinePlan {
    const parts: readonly string[] = PARTS_BY_LOOK[look];
    const isPart = (part: string): part is LinePart => parts.includes(part);
    const desired = new Map(wants.map((w) => [w.id, w]));
    const found = new Map<string, { parts: Set<string>; signatures: Set<string | undefined>; itemIds: string[] }>();
    const plan: LinePlan = { add: [], update: [], remove: [] };

    for (const item of items) {
        const meta = lineMeta(item);
        if (!meta) continue;
        // Parts of the other look, or from older versions (e.g. a gapped "path"), go too.
        if (!desired.has(meta.lineId) || !isPart(meta.part) || item.id !== partIdFor({ id: meta.lineId }, meta.part)) {
            plan.remove.push(item.id);
            continue;
        }
        const entry = found.get(meta.lineId) ?? { parts: new Set(), signatures: new Set(), itemIds: [] };
        entry.parts.add(meta.part);
        entry.signatures.add(meta.signature);
        entry.itemIds.push(item.id);
        found.set(meta.lineId, entry);
    }

    for (const want of wants) {
        const entry = found.get(want.id);
        if (!entry) plan.add.push(want);
        else if (entry.parts.size < parts.length) {
            // Part of a line missing (e.g. its label deleted by hand): rebuild it all.
            plan.remove.push(...entry.itemIds);
            plan.add.push(want);
        } else if (entry.signatures.size > 1 || !entry.signatures.has(want.signature)) plan.update.push(want);
    }
    return plan;
}

export function lineMetadata(spec: DistanceLineSpec, part: LinePart) {
    return { [LINE_META_KEY]: { __distanceLine__: true, lineId: spec.id, part, signature: spec.signature } };
}

export function lineDash(spec: Pick<DistanceLineSpec, "weight">): number[] {
    return [spec.weight * 2, spec.weight * 2];
}

/** Space around the label's text, in px. */
export const labelPadding = (spec: Pick<DistanceLineSpec, "fontSize">) => Math.round(spec.fontSize * 0.35);

/**
 * Where to put the label so the line runs through the middle of its pill.
 * Owlbear anchors a label at the bottom centre (its pointer tip), so the
 * anchor moves half the pill's height off the midpoint, along the label's
 * own "down" once rotated. Assumes a line height of 1.
 */
export function labelPosition(spec: Pick<DistanceLineSpec, "start" | "end" | "fontSize">): Vector2 {
    const mid = midpoint(spec);
    const half = (spec.fontSize + 2 * labelPadding(spec)) / 2;
    const radians = (labelRotation(spec) * Math.PI) / 180;
    return { x: mid.x - half * Math.sin(radians), y: mid.y + half * Math.cos(radians) };
}

/** Degrees to turn the label so it runs along the line, never upside down. */
export function labelRotation(spec: Pick<DistanceLineSpec, "start" | "end">): number {
    const degrees = (Math.atan2(spec.end.y - spec.start.y, spec.end.x - spec.start.x) * 180) / Math.PI;
    if (degrees > 90) return degrees - 180;
    if (degrees <= -90) return degrees + 180;
    return degrees;
}

export function midpoint(spec: Pick<DistanceLineSpec, "start" | "end">): Vector2 {
    return { x: (spec.start.x + spec.end.x) / 2, y: (spec.start.y + spec.end.y) / 2 };
}

function lineMeta(item: Item): { lineId: string; part: string; signature?: string } | null {
    const meta = (item.metadata as Record<string, unknown>)[LINE_META_KEY] as { __distanceLine__?: boolean; lineId?: unknown; part?: unknown; signature?: string } | undefined;
    if (!meta?.__distanceLine__) return null;
    return { lineId: typeof meta.lineId === "string" ? meta.lineId : "", part: typeof meta.part === "string" ? meta.part : "", signature: meta.signature };
}

function bodyOf(c: Combatant, token: Item): Body {
    return { id: c.id, name: c.name, center: token.position, cells: footprintCells(token), elevation: c.elevation };
}
