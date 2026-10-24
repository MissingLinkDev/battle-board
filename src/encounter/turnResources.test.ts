import { describe, expect, it } from "vitest";
import type { Combatant } from "./combatant";
import { deriveGroups } from "./groups";
import { turnOrder, type TurnState } from "./turnOrder";
import { barCombatants, endProgress, finishedTurn, FRESH_RESOURCES, resourcesOf, type TurnResources } from "./turnResources";

function c(id: string, initiative: number, extra: Partial<Combatant> = {}): Combatant {
    return {
        id, name: id, initiative, active: false, visible: true, ac: 10, currentHP: 10, maxHP: 10, tempHP: 0,
        movement: 30, attackRange: 60, elevation: 0, playerCharacter: false, ownerId: "gm", ...extra,
    };
}

function state(combatants: Combatant[], clock: Partial<TurnState> = {}): TurnState {
    return { combatants, groups: deriveGroups(combatants), started: true, round: 2, ...clock };
}

const used = (extra: Partial<TurnResources> = {}): TurnResources =>
    ({ ...FRESH_RESOURCES, actionUsed: true, reactionUsed: true, movementUsed: 3, ...extra });

const alice = new Set(["alice"]);

describe("turn resources", () => {
    it("reads what the combatant has used, or fresh when nothing is saved", () => {
        expect(resourcesOf(c("pc", 15, { active: true, turnResources: used() }))).toMatchObject({ actionUsed: true, reactionUsed: true, movementUsed: 3 });
        expect(resourcesOf(c("pc", 15))).toEqual(FRESH_RESOURCES);
    });

    it("forgets End turn once the turn is no longer active", () => {
        expect(resourcesOf(c("pc", 20, { turnResources: used({ ended: true }) })).ended).toBe(false);
    });

    it("gives a player a bar for owned, visible combatants in the turn order, in turn order", () => {
        const s = state([
            c("slow", 5, { ownerId: "alice" }),
            c("fast", 18, { ownerId: "alice" }),
            c("hidden", 12, { ownerId: "alice", visible: false }),
            c("staged", 12, { ownerId: "alice", groupId: "g", groupStaged: true }),
            c("bob's", 14, { ownerId: "bob" }),
        ]);
        expect(barCombatants(s, "alice").map((x) => x.id)).toEqual(["fast", "slow"]);
    });

    it("advances a solo turn once its owner ends it", () => {
        const pc = c("pc", 15, { active: true, ownerId: "alice", turnResources: used({ ended: true }) });
        expect(finishedTurn(state([pc]), alice)).toBe("pc");
    });

    it("waits for every connected, visible player-owned member of a group", () => {
        const member = (id: string, extra: Partial<Combatant>) => c(id, 15, { groupId: "g", groupName: "Party", active: true, ...extra });
        const ended = used({ ended: true });
        const s = state([
            member("a", { ownerId: "alice", turnResources: ended, groupIndex: 0 }),
            member("b", { ownerId: "bob", groupIndex: 1 }),
            member("npc", { ownerId: "gm", groupIndex: 2 }),
            member("hidden", { ownerId: "carol", visible: false, groupIndex: 3 }),
        ]);
        const [group] = turnOrder(s);

        expect(endProgress(group, new Set(["alice", "bob", "carol"]))).toEqual({ ended: 1, total: 2 });
        expect(finishedTurn(s, new Set(["alice", "bob"]))).toBeNull();
        // Bob has left the room, so only Alice counts.
        expect(finishedTurn(s, alice)).toBe("group:g");
    });

    it("leaves turns with nobody counted to the GM", () => {
        const s = state([c("npc", 15, { active: true })]);
        expect(finishedTurn(s, alice)).toBeNull();
    });
});
