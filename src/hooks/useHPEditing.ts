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
        onChange({ currentHP: val });
        setEditingField(null);
    };

    const commitTempHP = (val: number) => {
        onChange({ tempHP: val });
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