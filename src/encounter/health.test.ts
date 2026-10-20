import { describe, expect, it } from "vitest";
import { concentrationAudience, playerCanEditHP, playerHealthMode, setCurrent, setMax, setTemp, showPlayerHealthColumn, status } from "./health";

const hp = (currentHP: number, maxHP: number, tempHP = 0, concentrating = false) => ({ currentHP, maxHP, tempHP, concentrating });

describe("damage and healing", () => {
    it("temp HP absorbs damage typed into current HP first", () => {
        expect(setCurrent(hp(20, 30, 5), 12).patch).toEqual({ tempHP: 0, currentHP: 17 });
    });

    it("healing is capped at max HP", () => {
        expect(setCurrent(hp(20, 30), 99).patch).toEqual({ currentHP: 30 });
    });

    it("damage typed into temp HP spills past the temp HP into current HP", () => {
        expect(setTemp(hp(20, 30, 5), -3).patch).toEqual({ tempHP: 0, currentHP: 17 });
    });

    it("raising temp HP only sets temp HP", () => {
        expect(setTemp(hp(20, 30, 2), 8).patch).toEqual({ tempHP: 8 });
    });
});

describe("concentration checks", () => {
    it("trigger on damage to current HP, DC 10 minimum", () => {
        expect(setCurrent(hp(20, 30, 0, true), 15).concentrationCheck).toEqual({ dc: 10 });
    });

    it("use half the damage when that is higher", () => {
        expect(setCurrent(hp(40, 40, 0, true), 15).concentrationCheck).toEqual({ dc: 12 });
    });

    it("trigger on damage typed into temp HP, including overflow", () => {
        expect(setTemp(hp(20, 30, 4, true), -20).concentrationCheck).toEqual({ dc: 12 });
    });

    it("trigger when temp HP absorbs all the damage", () => {
        expect(setTemp(hp(20, 30, 10, true), 4).concentrationCheck).toEqual({ dc: 10 });
    });

    it("do not trigger on healing or without concentration", () => {
        expect(setCurrent(hp(10, 30, 0, true), 20).concentrationCheck).toBeNull();
        expect(setCurrent(hp(20, 30), 5).concentrationCheck).toBeNull();
    });

    it("are told to everyone for a PC and kept on the GM's client for an NPC", () => {
        expect(concentrationAudience({ playerCharacter: true })).toBe("ALL");
        expect(concentrationAudience({ playerCharacter: false })).toBe("LOCAL");
    });
});

describe("max HP", () => {
    it("before combat, current HP moves with max HP", () => {
        expect(setMax(hp(30, 30), 45, { inCombat: false }).patch).toEqual({ maxHP: 45, currentHP: 45 });
        expect(setMax(hp(10, 30), 20, { inCombat: false }).patch).toEqual({ maxHP: 20, currentHP: 0 });
    });

    it("during combat, current HP is only clamped", () => {
        expect(setMax(hp(30, 30), 45, { inCombat: true }).patch).toEqual({ maxHP: 45 });
        expect(setMax(hp(30, 30), 20, { inCombat: true }).patch).toEqual({ maxHP: 20, currentHP: 20 });
    });
});

describe("status", () => {
    it("is Bloodied below half, Dying for a PC and Dead for an NPC at 0", () => {
        expect(status({ currentHP: 15, maxHP: 30, playerCharacter: false })).toBe("Healthy");
        expect(status({ currentHP: 14, maxHP: 30, playerCharacter: false })).toBe("Bloodied");
        expect(status({ currentHP: 0, maxHP: 30, playerCharacter: true })).toBe("Dying");
        expect(status({ currentHP: 0, maxHP: 30, playerCharacter: false })).toBe("Dead");
    });
});

describe("what players see and edit", () => {
    const settings = { displayHealthStatusToPlayer: true, pcHealthMode: "numbers", npcHealthMode: "status", playerEditableHealth: true } as const;
    const pc = { playerCharacter: true };
    const npc = { playerCharacter: false };

    it("applies the per-faction mode behind the master switch", () => {
        expect(playerHealthMode(pc, settings)).toBe("numbers");
        expect(playerHealthMode(npc, settings)).toBe("status");
        expect(playerHealthMode(pc, { ...settings, displayHealthStatusToPlayer: false })).toBe("none");
    });

    it("lets players edit only PCs whose health they see as numbers", () => {
        expect(playerCanEditHP(pc, settings)).toBe(true);
        expect(playerCanEditHP(npc, { ...settings, npcHealthMode: "numbers" })).toBe(false);
        expect(playerCanEditHP(pc, { ...settings, pcHealthMode: "status" })).toBe(false);
        expect(playerCanEditHP(pc, { ...settings, playerEditableHealth: false })).toBe(false);
    });

    it("hides the health column when neither faction is shown", () => {
        expect(showPlayerHealthColumn({ ...settings, pcHealthMode: "none", npcHealthMode: "none" })).toBe(false);
        expect(showPlayerHealthColumn(settings)).toBe(true);
    });
});
