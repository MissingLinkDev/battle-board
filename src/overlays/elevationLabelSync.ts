import { buildLabel, type Item } from "@owlbear-rodeo/sdk";
import type { ObrPort, Unsubscribe } from "../obr/port";
import { LABEL_META_KEY, legacyLabelIds, planLabels, type GridInfo, type LabelSpec } from "./elevationLabels";

/** Builds the scene item for a label. Production uses the SDK builder; tests pass a stand-in. */
export type LabelFactory = (spec: LabelSpec) => Item;

export const buildElevationLabel: LabelFactory = (spec) => {
    const label = buildLabel()
        .id(spec.id)
        .position(spec.position)
        .plainText(spec.text)
        .fontSize(24)
        .textAlign("CENTER")
        .textAlignVertical("MIDDLE")
        .fillColor("#FFFFFF")
        .fillOpacity(1)
        .backgroundColor("rgb(30, 34, 49)")
        .backgroundOpacity(0.3)
        .cornerRadius(14)
        .attachedTo(spec.tokenId)
        .layer("TEXT")
        .locked(true)
        .disableHit(false)
        .visible(true)
        .metadata({ [LABEL_META_KEY]: { __elevationLabel__: true, ownerId: spec.tokenId } })
        .build();
    label.style.maxViewScale = 1.25;
    label.style.minViewScale = 1;
    return label;
};

/** Make the scene's elevation labels match token elevations. */
export async function syncElevationLabels(port: ObrPort, items: Item[], grid: GridInfo, build: LabelFactory) {
    const plan = planLabels(items, grid);
    if (plan.remove.length) await port.items.delete(plan.remove);
    if (plan.update.length) {
        const byId = new Map(plan.update.map((s) => [s.id, s]));
        await port.items.update([...byId.keys()], (labels) => {
            for (const label of labels) {
                const spec = byId.get(label.id)!;
                (label as Item & { text: { plainText: string } }).text.plainText = spec.text;
                label.position = spec.position;
            }
        });
    }
    if (plan.add.length) await port.items.add(plan.add.map(build));
}

/** Delete labels left by older versions (duplicates, random ids); current ones are then recreated. */
export async function sweepLegacyLabels(port: ObrPort) {
    const ids = legacyLabelIds(await port.items.get());
    if (ids.length) await port.items.delete(ids);
}

/**
 * Keep elevation labels in sync on this client. Does nothing for players
 * (ADR-0003). Syncs run one at a time; a change arriving mid-sync triggers
 * one more sync with the latest items.
 */
export function startElevationLabelSync(port: ObrPort, getGrid: () => Promise<GridInfo>, build: LabelFactory = buildElevationLabel): Unsubscribe {
    let stopped = false;
    let running = false;
    let pending: Item[] | null = null;

    const run = async (items: Item[]) => {
        if (running) {
            pending = items;
            return;
        }
        running = true;
        try {
            await syncElevationLabels(port, items, await getGrid(), build);
        } catch (error) {
            console.error("[Battle Board] Elevation label sync failed:", error);
        } finally {
            running = false;
            const next = pending;
            pending = null;
            if (next && !stopped) await run(next);
        }
    };

    let unsubscribe: Unsubscribe = () => {};
    (async () => {
        if ((await port.player.getRole()) !== "GM" || stopped) return;
        await sweepLegacyLabels(port);
        if (stopped) return;
        unsubscribe = port.items.onChange((items) => void run(items));
        await run(await port.items.get());
    })().catch(console.error);

    return () => {
        stopped = true;
        unsubscribe();
    };
}
