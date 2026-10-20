import { clearRings } from "../components/rings";
import { encounterStore, type EncounterState } from "../encounter";

// Turn operations run one at a time, each against fresh store state.
let queue: Promise<unknown> = Promise.resolve();
function exclusive(operation: () => Promise<void>) {
    const run = queue.then(operation, operation);
    queue = run.catch(console.error);
    return run;
}

/** Turn slots in order: non-staged groups and solo combatants, by initiative. */
function turnOrder({ combatants, groups }: EncounterState): { ids: string[]; active: boolean }[] {
    const turns: { ids: string[]; active: boolean; initiative: number; name: string }[] = [];
    for (const g of groups) {
        if (g.staged || g.memberIds.length === 0) continue;
        turns.push({ ids: g.memberIds, active: g.active, initiative: g.initiative, name: g.name });
    }
    for (const c of combatants) {
        if (c.groupId) continue;
        turns.push({ ids: [c.id], active: c.active, initiative: c.initiative, name: c.name });
    }
    return turns.sort((a, b) => {
        const af = Math.floor(a.initiative);
        const bf = Math.floor(b.initiative);
        if (bf !== af) return bf - af;
        if (a.initiative !== b.initiative) return a.initiative - b.initiative;
        return a.name.localeCompare(b.name);
    });
}

export function useTurns() {
    const handleStart = () => exclusive(async () => {
        const order = turnOrder(encounterStore.getState());
        if (order.length === 0) return;
        await encounterStore.setActive(order[0].ids);
        await encounterStore.setClock(true, 1);
    });

    const handleEnd = () => exclusive(async () => {
        await encounterStore.setActive(null);
        await clearRings("normal");
        await encounterStore.setClock(false, 0);
    });

    const handleNext = () => exclusive(async () => {
        const state = encounterStore.getState();
        if (!state.started) return;
        const order = turnOrder(state);
        if (order.length === 0) return;
        const current = order.findIndex((t) => t.active);
        const next = current === -1 ? 0 : (current + 1) % order.length;
        await encounterStore.setActive(order[next].ids);
        if (current !== -1 && next === 0) await encounterStore.setClock(true, state.round + 1);
    });

    const handlePrev = () => exclusive(async () => {
        const state = encounterStore.getState();
        if (!state.started) return;
        const order = turnOrder(state);
        if (order.length === 0) return;
        const current = order.findIndex((t) => t.active);
        const prev = current <= 0 ? order.length - 1 : current - 1;
        await encounterStore.setActive(order[prev].ids);
        if (current === 0 && state.round > 1) await encounterStore.setClock(true, state.round - 1);
    });

    return { handleStart, handleEnd, handleNext, handlePrev };
}
