import { useCallback, useMemo, useState } from "react";
import { useSceneStateSync } from "./useSceneStateSync";
import { useCMTokens } from "../components/useCMTokens";
import { encounterStore, useEncounter, type CombatantPatch } from "../encounter";

/**
 * Everything the tracker renders: the encounter (from the Encounter store),
 * room settings, token geometry, and which rows are expanded.
 */
export function useInitiativeState() {
    const { combatants, groups, started, round } = useEncounter();
    const { settings, setSettings } = useSceneStateSync();
    const cmTokens = useCMTokens();
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const toggleExpanded = useCallback((id: string) =>
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        }), []);

    const initiativeItemIds = useMemo(() => new Set(combatants.map((c) => c.id)), [combatants]);

    // What players may see: visible combatants that are not in a staged group.
    const visibleRows = useMemo(() => {
        const staged = new Set(groups.filter((g) => g.staged).map((g) => g.id));
        return combatants.filter((c) => c.visible !== false && !(c.groupId && staged.has(c.groupId)));
    }, [combatants, groups]);

    const initiativeTokens = useMemo(() =>
        cmTokens.filter(t => initiativeItemIds.has(t.id)),
        [cmTokens, initiativeItemIds]
    );

    const updateRow = useCallback((id: string, patch: CombatantPatch) => {
        encounterStore.patch(id, patch).catch(console.error);
    }, []);

    return {
        combatants,
        groups,
        started,
        round,
        settings,
        setSettings,
        cmTokens,
        expandedIds,
        toggleExpanded,
        visibleRows,
        initiativeTokens,
        updateRow,
    };
}
