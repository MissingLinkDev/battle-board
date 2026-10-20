import type { HealthMode, InitiativeSettings } from "../settings/settings";
import type { BroadcastDestination } from "../obr/port";
import type { Combatant, CombatantPatch } from "./combatant";

type HP = Pick<Combatant, "currentHP" | "maxHP" | "tempHP" | "concentrating">;

/** The fields to write, and the concentration check the change triggers, if any. */
export type HealthChange = { patch: CombatantPatch; concentrationCheck: { dc: number } | null };

/**
 * Set current HP to `value` (clamped to 0…max). Lowering it is damage, which
 * temp HP absorbs first; raising it is healing.
 */
export function setCurrent(c: HP, value: number): HealthChange {
    const target = clamp(value, 0, Math.max(0, c.maxHP));
    const damage = c.currentHP - target;
    if (damage <= 0) return change(c, { currentHP: target });

    const absorbed = Math.min(damage, c.tempHP);
    return change(c, { tempHP: c.tempHP - absorbed, currentHP: Math.max(0, c.currentHP - (damage - absorbed)) });
}

/**
 * Set temp HP to `value`. Lowering it below the current temp HP is damage:
 * whatever the temp HP cannot absorb spills into current HP.
 */
export function setTemp(c: HP, value: number): HealthChange {
    if (value >= c.tempHP) return change(c, { tempHP: Math.max(0, value) });

    const damage = c.tempHP - value;
    const overflow = Math.max(0, damage - c.tempHP);
    return change(c, { tempHP: Math.max(0, value), currentHP: Math.max(0, c.currentHP - overflow) });
}

/**
 * Set max HP. Before combat, current HP shifts by the same amount (so a
 * full-health creature stays full); during combat it is only clamped.
 */
export function setMax(c: HP, value: number, opts: { inCombat: boolean }): HealthChange {
    const maxHP = Math.max(0, value);
    const currentHP = opts.inCombat
        ? Math.min(c.currentHP, maxHP)
        : clamp(c.currentHP + (maxHP - c.maxHP), 0, maxHP);
    return change(c, currentHP === c.currentHP ? { maxHP } : { maxHP, currentHP });
}

/** Any loss of total HP (temp + current) while concentrating needs a check: DC max(10, half the loss). */
function change(c: HP, patch: CombatantPatch): HealthChange {
    const before = c.currentHP + c.tempHP;
    const after = (patch.currentHP ?? c.currentHP) + (patch.tempHP ?? c.tempHP);
    const loss = before - after;
    return {
        patch,
        concentrationCheck: c.concentrating && loss > 0 ? { dc: Math.max(10, Math.floor(loss / 2)) } : null,
    };
}

export type HealthStatus = "Healthy" | "Bloodied" | "Dying" | "Dead";

export function status(c: Pick<Combatant, "currentHP" | "maxHP" | "playerCharacter">): HealthStatus {
    if (c.currentHP === 0) return c.playerCharacter ? "Dying" : "Dead";
    return c.maxHP > 0 && c.currentHP < c.maxHP / 2 ? "Bloodied" : "Healthy";
}

type HealthSettings = Pick<InitiativeSettings, "displayHealthStatusToPlayer" | "pcHealthMode" | "npcHealthMode" | "playerEditableHealth">;

/** What players may see of this combatant's health. */
export function playerHealthMode(c: Pick<Combatant, "playerCharacter">, settings: HealthSettings): HealthMode {
    if (!settings.displayHealthStatusToPlayer) return "none";
    return c.playerCharacter ? settings.pcHealthMode : settings.npcHealthMode;
}

/** Whether players see a health column at all. */
export function showPlayerHealthColumn(settings: HealthSettings): boolean {
    return playerHealthMode({ playerCharacter: true }, settings) !== "none"
        || playerHealthMode({ playerCharacter: false }, settings) !== "none";
}

/** Whether the mode shows HP as numbers (with or without a bar). */
export function showsNumbers(mode: HealthMode): boolean {
    return mode === "numbers" || mode === "barNumbers";
}

/** Whether the mode shows a health bar. */
export function showsBar(mode: HealthMode): boolean {
    return mode === "bar" || mode === "barNumbers";
}

/** The one rule for player HP editing: enabled, a PC, and PC health shown as numbers. */
export function playerCanEditHP(c: Pick<Combatant, "playerCharacter">, settings: HealthSettings): boolean {
    return settings.playerEditableHealth && c.playerCharacter && showsNumbers(playerHealthMode(c, settings));
}

/** Share of max HP left, 0…1, or null when no max HP is set. */
export function healthFraction(c: Pick<Combatant, "currentHP" | "maxHP">): number | null {
    if (c.maxHP <= 0) return null;
    return clamp(c.currentHP / c.maxHP, 0, 1);
}

/**
 * Who is told about a concentration check: everyone for a PC (its player
 * rolls), only the sending client for an NPC. Players can only edit PCs, so
 * NPC checks never leave the GM's client.
 */
export function concentrationAudience(c: Pick<Combatant, "playerCharacter">): BroadcastDestination {
    return c.playerCharacter ? "ALL" : "LOCAL";
}

function clamp(n: number, min: number, max: number) {
    return Math.min(Math.max(n, min), max);
}
