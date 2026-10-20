import { useState } from "react";
import type { Combatant, CombatantPatch } from "../encounter";
import { setCurrent, setMax, setTemp, type HealthChange } from "../encounter/health";
import { announceConcentrationCheck } from "../encounter/concentration";
import { obrAdapter } from "../obr/obrAdapter";

/** Which HP/AC cell is being edited, plus commit handlers that apply the Health rules. */
export function useHPEditing(
    row: Combatant,
    inCombat: boolean,
    onChange: (patch: CombatantPatch) => void
) {
    const [editingField, setEditingField] = useState<null | "cur" | "max" | "temp" | "ac">(null);

    const apply = ({ patch, concentrationCheck }: HealthChange) => {
        onChange(patch);
        if (concentrationCheck) {
            announceConcentrationCheck(obrAdapter, row, concentrationCheck.dc).catch(console.error);
        }
        setEditingField(null);
    };

    const commitAc = (v: number) => {
        onChange({ ac: Math.max(0, v) });
        setEditingField(null);
    };

    return {
        editingField,
        setEditingField,
        commitAc,
        commitCurrentHP: (value: number) => apply(setCurrent(row, value)),
        commitTempHP: (value: number) => apply(setTemp(row, value)),
        applyMaxChange: (value: number) => apply(setMax(row, value, { inCombat })),
    };
}
