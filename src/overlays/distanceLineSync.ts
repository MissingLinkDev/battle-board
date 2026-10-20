import { buildLabel, buildLine, buildRuler, type Item, type Line, type Ruler } from "@owlbear-rodeo/sdk";
import type { ObrPort, Unsubscribe } from "../obr/port";
import type { GridSnapshot } from "../battlefield/grid";
import { combatantsOf, readClock } from "../encounter/store";
import { migrateSettings, ROOM_META_KEY } from "../settings/settings";
import { desiredLines, LINE_LOOK, labelPadding, labelPosition, labelRotation, lineDash, lineMetadata, partIdFor, planLines, PARTS_BY_LOOK, type DistanceLineSpec, type LineLook } from "./distanceLines";

/** Builds the scene items for a line, one per part of `look`. Production uses the SDK builders; tests pass a stand-in. */
export type LineFactory = (spec: DistanceLineSpec, look: LineLook) => Item[];

export const buildDistanceLine: LineFactory = (spec, look) => {
    if (look === "ruler") {
        return [
            buildRuler()
                .id(partIdFor(spec, "ruler"))
                .startPosition(spec.start)
                .endPosition(spec.end)
                .measurement(spec.text)
                .variant("DASHED")
                .locked(true)
                .disableHit(true)
                .visible(true)
                .metadata(lineMetadata(spec, "ruler"))
                .build(),
        ];
    }
    const line = buildLine()
        .id(partIdFor(spec, "line"))
        .startPosition(spec.start)
        .endPosition(spec.end)
        .strokeColor("#FFFFFF")
        .strokeOpacity(0.75)
        .strokeWidth(spec.weight)
        .strokeDash(lineDash(spec))
        .layer("DRAWING")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .metadata(lineMetadata(spec, "line"))
        .build();
    // A translucent pill centred on the line, turned to run along it like the ruler's.
    const label = buildLabel()
        .id(partIdFor(spec, "label"))
        .position(labelPosition(spec))
        .rotation(labelRotation(spec))
        .plainText(spec.text)
        .fontSize(spec.fontSize)
        .fontWeight(700)
        .textAlign("CENTER")
        .textAlignVertical("MIDDLE")
        .fillColor("#FFFFFF")
        .fillOpacity(1)
        .lineHeight(1)
        .backgroundColor("rgb(64, 64, 64)")
        .backgroundOpacity(0.6)
        .cornerRadius(spec.fontSize)
        .padding(labelPadding(spec))
        .pointerHeight(0)
        .minViewScale(1)
        .maxViewScale(1)
        .layer("TEXT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .metadata(lineMetadata(spec, "label"))
        .build();
    return [line, label];
};

/** Make the scene's distance lines match the encounter, settings and token positions. */
export async function syncDistanceLines(port: ObrPort, grid: GridSnapshot, build: LineFactory, look: LineLook = LINE_LOOK) {
    const [items, scene, room] = await Promise.all([port.items.get(), port.sceneMetadata.get(), port.roomMetadata.get()]);
    const { started } = readClock(scene);
    const wants = await desiredLines(items, combatantsOf(items), migrateSettings(room[ROOM_META_KEY]), started, grid);
    const plan = planLines(items, wants, look);

    if (plan.remove.length) await port.items.delete(plan.remove);
    if (plan.update.length) {
        const byId = new Map(plan.update.flatMap((s) => PARTS_BY_LOOK[look].map((p) => [partIdFor(s, p), s] as const)));
        await port.items.update([...byId.keys()], (parts) => {
            for (const part of parts) {
                const spec = byId.get(part.id)!;
                if (part.id === partIdFor(spec, "ruler")) {
                    const ruler = part as Ruler;
                    ruler.startPosition = spec.start;
                    ruler.endPosition = spec.end;
                    ruler.measurement = spec.text;
                    ruler.metadata = { ...ruler.metadata, ...lineMetadata(spec, "ruler") };
                } else if (part.id === partIdFor(spec, "line")) {
                    const line = part as Line;
                    line.startPosition = spec.start;
                    line.endPosition = spec.end;
                    line.style = { ...line.style, strokeWidth: spec.weight, strokeDash: lineDash(spec) };
                    line.metadata = { ...line.metadata, ...lineMetadata(spec, "line") };
                } else {
                    const label = part as Item & { text: { plainText: string; style: { fontSize: number } } };
                    label.text.plainText = spec.text;
                    label.text.style.fontSize = spec.fontSize;
                    part.position = labelPosition(spec);
                    part.rotation = labelRotation(spec);
                    part.metadata = { ...part.metadata, ...lineMetadata(spec, "label") };
                }
            }
        });
    }
    if (plan.add.length) await port.items.add(plan.add.flatMap((spec) => build(spec, look)));
}

/**
 * Keep distance lines in sync on this client. Does nothing for players
 * (ADR-0003), and stopping it leaves the lines in place, like rings.
 */
export function startDistanceLineSync(port: ObrPort, getGrid: () => Promise<GridSnapshot>, build: LineFactory = buildDistanceLine): Unsubscribe {
    let stopped = false;
    let running = false;
    let again = false;

    const run = async () => {
        if (running) {
            again = true;
            return;
        }
        running = true;
        try {
            await syncDistanceLines(port, await getGrid(), build);
        } catch (error) {
            console.error("[Battle Board] Distance line sync failed:", error);
        } finally {
            running = false;
            if (again && !stopped) {
                again = false;
                await run();
            }
        }
    };

    const unsubscribes: Unsubscribe[] = [];
    (async () => {
        if ((await port.player.getRole()) !== "GM" || stopped) return;
        unsubscribes.push(
            port.items.onChange(() => void run()),
            port.sceneMetadata.onChange(() => void run()),
            port.roomMetadata.onChange(() => void run()),
            port.grid.onChange(() => void run()),
        );
        await run();
    })().catch(console.error);

    return () => {
        stopped = true;
        unsubscribes.forEach((u) => u());
    };
}
