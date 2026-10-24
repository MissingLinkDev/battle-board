import { describe, expect, it } from "vitest";
import type { Combatant } from "./combatant";
import { deriveGroups } from "./groups";
import { afterLeaving, canPrev, next, orderCombatants, prev, turnOrder, type TurnState } from "./turnOrder";

function c(id: string, initiative: number, extra: Partial<Combatant> = {}): Combatant {
    return {
        id, name: id, initiative, active: false, visible: true, ac: 10, currentHP: 10, maxHP: 10, tempHP: 0,
        movement: 30, attackRange: 60, elevation: 0, playerCharacter: false, ownerId: "gm", ...extra,
    };
}

function state(combatants: Combatant[], clock: Partial<TurnState> = {}): TurnState {
    return { combatants, groups: deriveGroups(combatants), started: true, round: 1, ...clock };
}

const keys = (s: TurnState) => turnOrder(s).map((t) => t.key);

describe("turn order", () => {
    it("puts higher initiative first, then GM decimal tie-breaks (15.1 before 15.2), then name", () => {
        const s = state([c("b", 15), c("x", 15.2), c("y", 15.1), c("a", 15), c("top", 18)]);
        expect(keys(s)).toEqual(["top", "a", "b", "y", "x"]);
    });

    it("counts a group as one turn at its whole initiative", () => {
        const s = state([
            c("m1", 12, { groupId: "g", groupName: "Wolves", groupIndex: 1 }),
            c("m0", 12, { groupId: "g", groupName: "Wolves", groupIndex: 0 }),
            c("solo", 12.1),
        ]);
        const turns = turnOrder(s);
        expect(turns.map((t) => t.key)).toEqual(["group:g", "solo"]);
        expect(turns[0].ids).toEqual(["m0", "m1"]);
    });

    it("leaves staged groups out of the turn order but lists them last for display", () => {
        const s = state([
            c("r", 30, { groupId: "res", groupName: "Reserve", groupStaged: true }),
            c("a", 10),
        ]);
        expect(keys(s)).toEqual(["a"]);
        expect(orderCombatants(s.combatants, s.groups).map((x) => x.id)).toEqual(["a", "r"]);
    });

    it("display order is the turn order with members expanded", () => {
        const s = state([
            c("solo", 5),
            c("m1", 9, { groupId: "g", groupIndex: 1 }),
            c("m0", 9, { groupId: "g", groupIndex: 0 }),
            c("first", 20),
        ]);
        expect(orderCombatants(s.combatants, s.groups).map((x) => x.id)).toEqual(["first", "m0", "m1", "solo"]);
    });
});

describe("next / prev", () => {
    it("next with nobody active starts at the first turn without changing the round", () => {
        expect(next(state([c("a", 2), c("b", 1)], { round: 3 }))).toEqual({ activeIds: ["a"], round: 3 });
    });

    it("next does nothing before the encounter starts", () => {
        expect(next(state([c("a", 2, { active: true })], { started: false }))).toBeNull();
    });

    it("prev from the first turn goes to the last turn of the previous round", () => {
        expect(prev(state([c("a", 2, { active: true }), c("b", 1)], { round: 3 }))).toEqual({ activeIds: ["b"], round: 2 });
    });

    it("prev is unavailable on the first turn of round 1, and the button uses the same rule", () => {
        const s = state([c("a", 2, { active: true }), c("b", 1)], { round: 1 });
        expect(canPrev(s)).toBe(false);
        expect(prev(s)).toBeNull();
        expect(canPrev(state([c("a", 2), c("b", 1, { active: true })], { round: 1 }))).toBe(true);
    });
});

describe("afterLeaving", () => {
    it("is null when the active turn stays", () => {
        expect(afterLeaving(state([c("a", 2, { active: true }), c("b", 1)]), ["b"])).toBeNull();
    });

    it("skips turns that leave together with the turn holder", () => {
        const s = state([c("a", 3, { active: true }), c("b", 2), c("d", 1)]);
        expect(afterLeaving(s, ["a", "b"])).toEqual({ activeIds: ["d"], round: 1 });
    });

    it("leaves nobody active when every turn leaves", () => {
        expect(afterLeaving(state([c("a", 3, { active: true })]), ["a"])).toEqual({ activeIds: [], round: 1 });
    });
});
