import { useState } from "react";
import type { InitiativeItem } from "../components/InitiativeItem";

export function useHPEditing(
    row: InitiativeItem,
    started: boolean,
    onChange: (patch: Partial<InitiativeItem>) => void
) {
    const [editingField, setEditingField] = useState<null | "cur" | "max" | "temp" | "ac">(null);

    const commitAc = (v: number) => {
        const next = Math.max(0, v);
        onChange({ ac: next });
        setEditingField(null);
    };

    const commitCurrentHP = (val: number) => {
        const clampedVal = Math.max(0, Math.min(val, row.maxHP));
        const damage = row.currentHP - clampedVal;

        if (damage > 0 && row.tempHP > 0) {
            // Taking damage with temp HP available - absorb with temp HP first
            const tempHPAbsorbed = Math.min(damage, row.tempHP);
            const remainingDamage = damage - tempHPAbsorbed;
            const newCurrentHP = row.currentHP - remainingDamage;

            onChange({
                tempHP: row.tempHP - tempHPAbsorbed,
                currentHP: Math.max(0, newCurrentHP)
            });
        } else {
            // No damage, or no temp HP, or healing
            onChange({ currentHP: clampedVal });
        }
        setEditingField(null);
    };

    const commitTempHP = (val: number) => {
        const clampedVal = Math.max(0, val);

        if (val < row.tempHP) {
            // Subtracting temp HP - check for overflow damage to current HP
            const requestedDamage = row.tempHP - val; // Can be negative if val < 0
            const tempHPAbsorbed = Math.min(row.tempHP, Math.max(0, requestedDamage));
            const overflow = Math.max(0, requestedDamage - row.tempHP);
            const newCurrentHP = Math.max(0, row.currentHP - overflow);

            onChange({
                tempHP: row.tempHP - tempHPAbsorbed,
                currentHP: newCurrentHP
            });
        } else {
            // Adding temp HP or no change
            onChange({ tempHP: clampedVal });
        }
        setEditingField(null);
    };

    const applyMaxChange = (nextMaxRaw: number) => {
        const m = Math.max(0, nextMaxRaw);
        const prevMax = row.maxHP;
        let nextCur = row.currentHP;

        if (!started) {
            const delta = m - prevMax;
            nextCur = row.currentHP + delta;
            if (nextCur < 0) nextCur = 0;
            if (nextCur > m) nextCur = m;
        } else {
            if (nextCur > m) nextCur = m;
        }

        const patch: Partial<InitiativeItem> = { maxHP: m };
        if (nextCur !== row.currentHP) patch.currentHP = nextCur;
        onChange(patch);
        setEditingField(null);
    };

    return {
        editingField,
        setEditingField,
        commitAc,
        commitCurrentHP,
        commitTempHP,
        applyMaxChange,
    };
}