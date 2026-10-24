import type { Combatant } from "./combatant";
import { turnOrder, type Turn, type TurnState } from "./turnOrder";

/** What a combatant has used of its turn (see CONTEXT.md, Turn resources). */
export type TurnResources = {
    actionUsed: boolean;
    bonusActionUsed: boolean;
    reactionUsed: boolean;
    /** Grid cells moved. May exceed the combatant's speed (Dash). */
    movementUsed: number;
    /** The combatant has pressed End turn. */
    ended: boolean;
};

export const FRESH_RESOURCES: TurnResources = {
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    movementUsed: 0,
    ended: false,
};

/** Turn resources as saved on the token, or null when it has none (fresh). */
export function readResources(raw: unknown): TurnResources | null {
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    return {
        actionUsed: o.actionUsed === true,
        bonusActionUsed: o.bonusActionUsed === true,
        reactionUsed: o.reactionUsed === true,
        movementUsed: typeof o.movementUsed === "number" ? Math.max(0, Math.floor(o.movementUsed)) : 0,
        ended: o.ended === true,
    };
}

/** The turn holding this combatant, or undefined when it is outside the turn order (staged). */
export function turnOf(turns: Turn[], combatantId: string): Turn | undefined {
    return turns.find((t) => t.ids.includes(combatantId));
}

/**
 * What the combatant has used so far this turn. The saved state is cleared
 * when its turn starts (see the store's turn writes).
 */
export function resourcesOf(combatant: Combatant): TurnResources {
    const saved = combatant.turnResources ?? FRESH_RESOURCES;
    // End turn only means something while the turn is still running.
    return { ...saved, ended: saved.ended && combatant.active };
}

/** The combatants a player gets a bar for: owned, visible and in the turn order, in turn order. */
export function barCombatants(state: TurnState, playerId: string): Combatant[] {
    return turnOrder(state)
        .flatMap((t) => (t.kind === "group" ? t.members : [t.combatant]))
        .filter((c) => c.ownerId === playerId && c.visible);
}

/**
 * Members whose End turn the turn waits for: visible, and owned by a player
 * who is connected. GM-owned tokens never count.
 */
export function countedForEnd(turn: Turn, connectedPlayerIds: ReadonlySet<string>): Combatant[] {
    const members = turn.kind === "group" ? turn.members : [turn.combatant];
    return members.filter((c) => c.visible && connectedPlayerIds.has(c.ownerId));
}

/** How many counted members of the turn have ended. */
export function endProgress(turn: Turn, connectedPlayerIds: ReadonlySet<string>): { ended: number; total: number } {
    const counted = countedForEnd(turn, connectedPlayerIds);
    return { ended: counted.filter((c) => resourcesOf(c).ended).length, total: counted.length };
}

/**
 * The key of the active turn when every counted member has pressed End turn,
 * i.e. the turn a GM client should advance from. Null otherwise, including
 * when nobody counts (the GM drives that turn as usual).
 */
export function finishedTurn(state: TurnState, connectedPlayerIds: ReadonlySet<string>): string | null {
    if (!state.started) return null;
    const active = turnOrder(state).find((t) => t.active);
    if (!active) return null;
    const { ended, total } = endProgress(active, connectedPlayerIds);
    return total > 0 && ended === total ? active.key : null;
}
