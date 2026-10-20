import { buildPath, buildShape, Command, type Item, type Shape } from "@owlbear-rodeo/sdk";
import type { ObrPort, Unsubscribe } from "../obr/port";
import type { GridScale } from "../battlefield/footprint";
import { combatantsOf, readClock } from "../encounter/store";
import { migrateSettings, ROOM_META_KEY } from "../settings/settings";
import { desiredRings, planRings, ringMetadata, strokeDash, type RingShape } from "./rings";

/** Builds the scene item for a ring. Production uses the SDK builders; tests pass a stand-in. */
export type RingFactory = (shape: RingShape) => Item;

const CONIC_CIRCLE_W = Math.SQRT1_2;

export const buildRing: RingFactory = (shape) => {
    const { style } = shape;
    if ("diameter" in shape.geometry) {
        return buildShape()
            .id(shape.id)
            .shapeType("CIRCLE")
            .width(shape.geometry.diameter)
            .height(shape.geometry.diameter)
            .position(shape.center)
            .fillOpacity(0)
            .strokeColor(style.color)
            .strokeOpacity(style.opacity)
            .strokeWidth(style.weight)
            .strokeDash(strokeDash(style))
            .locked(true)
            .disableHit(false)
            .layer("DRAWING")
            .visible(shape.visible)
            .metadata(ringMetadata(shape))
            .build();
    }
    // Rounded rectangle around the token: straight sides joined by quarter circles.
    const { halfW: w, halfH: h, reach: r } = shape.geometry;
    return buildPath()
        .id(shape.id)
        .commands([
            [Command.MOVE, -w, -h - r],
            [Command.LINE, w, -h - r],
            [Command.CONIC, w + r, -h - r, w + r, -h, CONIC_CIRCLE_W],
            [Command.LINE, w + r, h],
            [Command.CONIC, w + r, h + r, w, h + r, CONIC_CIRCLE_W],
            [Command.LINE, -w, h + r],
            [Command.CONIC, -w - r, h + r, -w - r, h, CONIC_CIRCLE_W],
            [Command.LINE, -w - r, -h],
            [Command.CONIC, -w - r, -h - r, -w, -h - r, CONIC_CIRCLE_W],
            [Command.CLOSE],
        ])
        .position(shape.center)
        .fillOpacity(0)
        .strokeColor(style.color)
        .strokeOpacity(style.opacity)
        .strokeWidth(style.weight)
        .strokeDash(strokeDash(style))
        .locked(true)
        .disableHit(false)
        .layer("DRAWING")
        .visible(shape.visible)
        .attachedTo(shape.tokenId)
        .metadata(ringMetadata(shape))
        .build();
};

/** Make the scene's rings match the encounter, settings and token geometry. */
export async function syncRings(port: ObrPort, grid: GridScale, build: RingFactory) {
    const [items, scene, room] = await Promise.all([port.items.get(), port.sceneMetadata.get(), port.roomMetadata.get()]);
    const { started } = readClock(scene);
    const wants = desiredRings(combatantsOf(items), migrateSettings(room[ROOM_META_KEY]), started);
    const plan = planRings(items, wants, grid);

    if (plan.remove.length) await port.items.delete(plan.remove);
    if (plan.update.length) {
        const byId = new Map(plan.update.map((s) => [s.id, s]));
        await port.items.update([...byId.keys()], (rings) => {
            for (const ring of rings as Shape[]) {
                const shape = byId.get(ring.id)!;
                if ("diameter" in shape.geometry) {
                    ring.width = shape.geometry.diameter;
                    ring.height = shape.geometry.diameter;
                }
                ring.visible = shape.visible;
                ring.style = { ...ring.style, strokeColor: shape.style.color, strokeOpacity: shape.style.opacity, strokeWidth: shape.style.weight, strokeDash: strokeDash(shape.style) };
                ring.metadata = { ...ring.metadata, ...ringMetadata(shape) };
            }
        });
    }
    if (plan.add.length) await port.items.add(plan.add.map(build));
}

/**
 * Keep rings in sync on this client. Does nothing for players (ADR-0003), and
 * stopping it leaves the rings in place: rings follow the encounter, not
 * whether anyone's tracker is open.
 */
export function startRingSync(port: ObrPort, getGrid: () => Promise<GridScale>, build: RingFactory = buildRing): Unsubscribe {
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
            await syncRings(port, await getGrid(), build);
        } catch (error) {
            console.error("[Battle Board] Ring sync failed:", error);
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
        );
        await run();
    })().catch(console.error);

    return () => {
        stopped = true;
        unsubscribes.forEach((u) => u());
    };
}
