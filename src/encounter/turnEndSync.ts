import type { ObrPort, PartyMember, Unsubscribe } from "../obr/port";
import { migrateSettings, ROOM_META_KEY } from "../settings/settings";
import { deriveGroups } from "./groups";
import { combatantsOf, readClock, type EncounterStore } from "./store";
import { finishedTurn } from "./turnResources";

/** Ids of connected players (not GMs), who are the only owners End turn waits for. */
export function connectedPlayerIds(party: PartyMember[]): Set<string> {
    return new Set(party.filter((p) => p.role === "PLAYER").map((p) => p.id));
}

/** Advance the turn if the turn bar is on and every counted member of the active turn has ended. */
export async function advanceIfTurnEnded(port: ObrPort, store: EncounterStore) {
    const [items, scene, room, party] = await Promise.all([
        port.items.get(), port.sceneMetadata.get(), port.roomMetadata.get(), port.party.getPlayers(),
    ]);
    if (!migrateSettings(room[ROOM_META_KEY]).turnBar) return;
    const combatants = combatantsOf(items);
    const key = finishedTurn({ combatants, groups: deriveGroups(combatants), ...readClock(scene) }, connectedPlayerIds(party));
    if (key) await store.advanceFrom(key);
}

/**
 * Watch for players ending their turns and advance for them. Runs on GM
 * clients only: players may not be allowed to write other tokens, so they
 * flag their own token and a GM client moves the turn (ADR-0005).
 */
export function startTurnEndSync(port: ObrPort, store: EncounterStore): Unsubscribe {
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
            await advanceIfTurnEnded(port, store);
        } catch (error) {
            console.error("[Battle Board] Turn end sync failed:", error);
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
            port.party.onChange(() => void run()),
        );
        await run();
    })().catch(console.error);

    return () => {
        stopped = true;
        unsubscribes.forEach((u) => u());
    };
}
