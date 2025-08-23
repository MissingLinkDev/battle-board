export function sortByInitiativeDesc<T extends { initiative?: number }>(items: T[]): T[] {
    return [...items].sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));
}
