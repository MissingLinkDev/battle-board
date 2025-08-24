export function sortByInitiativeDesc<T extends { initiative?: number }>(items: T[]): T[] {
    return [...items].sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));
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