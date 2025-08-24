import type { InitiativeItem } from "./InitiativeItem";

export function sortByInitiativeDesc(list: InitiativeItem[]) {
    return [...list].sort((a, b) => {
        const ai = a.initiative ?? 0;
        const bi = b.initiative ?? 0;

        const af = Math.floor(ai);
        const bf = Math.floor(bi);

        // Primary: higher integer bucket first (15 before any 14.x)
        if (bf !== af) return bf - af;

        // Secondary (same integer): smaller decimal first (14 before 14.1 before 14.2)
        if (ai !== bi) return ai - bi;

        // Tertiary: stable fallback so order doesn’t jump around on ties
        return (a.name ?? "").localeCompare(b.name ?? "");
    });
}

/** Clamp a number between min and max */
export const clamp = (n: number, min: number, max: number) =>
    Math.min(Math.max(n, min), max);

/** Supports "+5", "-3", "17", "52-4+3" (only + and -). Falls back to base if unparsable. */
export const evalMathInput = (raw: string, base: number): number => {
    const s = (raw ?? "").trim();
    if (!s) return base;

    if (/^[+-]\d+$/.test(s)) return base + Number(s); // relative
    if (/^\d+$/.test(s)) return Number(s);            // absolute

    if (/^[+-]?\d+(?:[+-]\d+)+$/.test(s)) {           // chain
        const parts = s.match(/[+-]?\d+/g) ?? [];
        return parts.reduce((acc, t) => acc + Number(t), 0);
    }
    return base;
};