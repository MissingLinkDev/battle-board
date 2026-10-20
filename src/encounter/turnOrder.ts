import type { Combatant } from "./combatant";
import type { Group } from "./groups";

/** One slot in the turn order: a non-staged group or a solo combatant. */
export type Turn =
    | { kind: "group"; key: string; group: Group; members: Combatant[]; ids: string[]; active: boolean }
    | { kind: "solo"; key: string; combatant: Combatant; ids: string[]; active: boolean };

export type TurnState = {
    combatants: Combatant[];
    groups: Group[];
    started: boolean;
    round: number;
};

/** What a turn command changes: who is active, and the round. */
export type TurnChange = { activeIds: string[]; round: number };

/**
 * The turn order. Higher whole initiative first; then the smaller decimal
 * (GM tie-breaks: 15.1 before 15.2; groups count as .0); then name.
 */
export function turnOrder({ combatants, groups }: Pick<TurnState, "combatants" | "groups">): Turn[] {
    const byId = new Map(combatants.map((c) => [c.id, c]));
    const turns: Turn[] = [];
    for (const group of groups) {
        if (group.staged) continue;
        const members = group.memberIds.map((id) => byId.get(id)).filter((c): c is Combatant => !!c);
        if (!members.length) continue;
        turns.push({ kind: "group", key: `group:${group.id}`, group, members, ids: members.map((m) => m.id), active: members.some((m) => m.active) });
    }
    for (const c of combatants) {
        if (c.groupId) continue;
        turns.push({ kind: "solo", key: c.id, combatant: c, ids: [c.id], active: c.active });
    }
    return turns.sort(compareTurns);
}

/** Staged groups, by name. They sit outside the turn order. */
export function stagedGroups(groups: Group[]): Group[] {
    return groups.filter((g) => g.staged).sort((a, b) => a.name.localeCompare(b.name));
}

/** Combatants in display order: the turn order (members in member order), then staged groups. */
export function orderCombatants(combatants: Combatant[], groups: Group[]): Combatant[] {
    const byId = new Map(combatants.map((c) => [c.id, c]));
    const ordered = turnOrder({ combatants, groups }).flatMap((t) => (t.kind === "group" ? t.members : [t.combatant]));
    for (const g of stagedGroups(groups)) {
        for (const id of g.memberIds) {
            const c = byId.get(id);
            if (c) ordered.push(c);
        }
    }
    return ordered;
}

export function activeIndex(turns: Turn[]): number {
    return turns.findIndex((t) => t.active);
}

/** Begin the encounter: the first turn of round 1. */
export function start(state: TurnState): TurnChange | null {
    const turns = turnOrder(state);
    return turns.length ? { activeIds: turns[0].ids, round: 1 } : null;
}

/** Advance one turn; wrapping to the first turn starts the next round. */
export function next(state: TurnState): TurnChange | null {
    if (!state.started) return null;
    const turns = turnOrder(state);
    if (!turns.length) return null;
    const current = activeIndex(turns);
    if (current === -1) return { activeIds: turns[0].ids, round: state.round };
    const to = (current + 1) % turns.length;
    return { activeIds: turns[to].ids, round: to === 0 ? state.round + 1 : state.round };
}

/** Whether `prev` would do anything: not before the first turn of round 1. */
export function canPrev(state: TurnState): boolean {
    if (!state.started) return false;
    const turns = turnOrder(state);
    return turns.length > 0 && !(activeIndex(turns) === 0 && state.round <= 1);
}

/** Step back one turn; stepping back past the first turn returns to the previous round. */
export function prev(state: TurnState): TurnChange | null {
    if (!canPrev(state)) return null;
    const turns = turnOrder(state);
    const current = activeIndex(turns);
    if (current === -1) return { activeIds: turns[turns.length - 1].ids, round: state.round };
    if (current === 0) return { activeIds: turns[turns.length - 1].ids, round: state.round - 1 };
    return { activeIds: turns[current - 1].ids, round: state.round };
}

/**
 * Who has the turn once these combatants leave the turn order (removed, or
 * their group staged). If the active turn leaves entirely, the turn passes to
 * the next remaining turn, starting a new round if that wraps. Returns null
 * when the active turn is unaffected.
 */
export function afterLeaving(state: TurnState, leavingIds: string[]): TurnChange | null {
    if (!state.started) return null;
    const leaving = new Set(leavingIds);
    const turns = turnOrder(state);
    const current = activeIndex(turns);
    if (current === -1) return null;
    if (!turns[current].ids.every((id) => leaving.has(id))) return null;

    for (let step = 1; step < turns.length; step++) {
        const i = (current + step) % turns.length;
        const remaining = turns[i].ids.filter((id) => !leaving.has(id));
        if (remaining.length) {
            return { activeIds: remaining, round: i <= current ? state.round + 1 : state.round };
        }
    }
    return { activeIds: [], round: state.round };
}

function compareTurns(a: Turn, b: Turn): number {
    const ai = initiativeOf(a);
    const bi = initiativeOf(b);
    const af = Math.floor(ai);
    const bf = Math.floor(bi);
    if (bf !== af) return bf - af;
    if (ai !== bi) return ai - bi;
    return nameOf(a).localeCompare(nameOf(b)) || a.key.localeCompare(b.key);
}

function initiativeOf(t: Turn): number {
    return t.kind === "group" ? t.group.initiative : t.combatant.initiative;
}

function nameOf(t: Turn): string {
    return t.kind === "group" ? t.group.name : t.combatant.name;
}
