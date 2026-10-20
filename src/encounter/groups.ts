import { memberIndex, type Combatant } from "./combatant";

/** A group, derived from the combatants that share a `groupId` (ADR-0001). */
export type Group = {
    id: string;
    name: string;
    /** Whole-number initiative shared by every member. */
    initiative: number;
    /** Whether any member holds the active turn. */
    active: boolean;
    staged: boolean;
    /** Member ids in member order. */
    memberIds: string[];
};

/**
 * Derive groups from combatants. Members normally agree on name, staged and
 * initiative because group writes touch every member at once; for saves
 * where they drifted, the highest whole initiative wins, any non-empty name
 * wins, and the group is staged if any member says so.
 */
export function deriveGroups(combatants: Combatant[]): Group[] {
    const byId = new Map<string, { group: Group; members: Combatant[] }>();

    for (const c of combatants) {
        if (!c.groupId) continue;
        let entry = byId.get(c.groupId);
        if (!entry) {
            entry = {
                group: { id: c.groupId, name: "", initiative: Math.floor(c.initiative), active: false, staged: false, memberIds: [] },
                members: [],
            };
            byId.set(c.groupId, entry);
        }
        const g = entry.group;
        entry.members.push(c);
        g.initiative = Math.max(g.initiative, Math.floor(c.initiative));
        if (c.groupName && c.groupName.trim()) g.name = c.groupName;
        if (c.groupStaged) g.staged = true;
        if (c.active) g.active = true;
    }

    return [...byId.values()].map(({ group, members }) => ({
        ...group,
        name: group.name || "Unnamed Group",
        memberIds: members
            .sort((a, b) => memberIndex(a) - memberIndex(b) || a.name.localeCompare(b.name))
            .map((m) => m.id),
    }));
}

export function newGroupId(): string {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
