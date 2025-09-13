import { useCallback, useMemo } from "react";
import { useInitiativeRows } from "./useInitiativeRows";
import { useSceneStateSync } from "./useSceneStateSync";
import { useCMTokens } from "../components/useCMTokens";
import type { InitiativeItem } from "../components/InitiativeItem";

/**
 * Centralized state management for the entire initiative system
 */
export function useInitiativeState() {
    const { rows, setRows, sortedRows, expandedIds, toggleExpanded, initiativeItemIds, localEditRef } = useInitiativeRows();
    const { started, setStarted, round, setRound, settings, setSettings, saveSceneState, groups } = useSceneStateSync();
    const cmTokens = useCMTokens();

    // Memoized derived state
    const activeItem = useMemo(() =>
        rows.find(r => r.active) ?? null,
        [rows]
    );

    // FIXED: Use sortedRows (which includes latest active state) instead of a separate filter
    const visibleRows = useMemo(() => {
        // Create a map of group ID to group for quick lookups
        const groupsById = new Map(groups.map(g => [g.id, g]));

        return sortedRows.filter(r => {
            // Filter out invisible rows
            if (r.visible === false) return false;

            // Filter out rows in staged (inactive) groups
            if (r.groupId) {
                const group = groupsById.get(r.groupId);
                if (group && group.staged) {
                    return false; // Don't show tokens from staged groups to players
                }
            }

            // Row is visible and either ungrouped or in an active group
            return true;
        });
    }, [sortedRows, groups]); // IMPORTANT: Use sortedRows instead of rows

    const initiativeTokens = useMemo(() =>
        cmTokens.filter(t => initiativeItemIds.has(t.id)),
        [cmTokens, initiativeItemIds]
    );

    // Centralized row update function
    const updateRow = useCallback((id: string, draft: Partial<InitiativeItem>) => {
        localEditRef.current = true;
        setRows(prev => prev.map(r => r.id === id ? { ...r, ...draft } : r));
    }, [setRows, localEditRef]);

    // Batch row updates
    const updateRows = useCallback((updates: Array<{ id: string; draft: Partial<InitiativeItem> }>) => {
        localEditRef.current = true;
        setRows(prev => prev.map(r => {
            const update = updates.find(u => u.id === r.id);
            return update ? { ...r, ...update.draft } : r;
        }));
    }, [setRows, localEditRef]);

    return {
        // Raw state
        rows,
        setRows,
        started,
        setStarted,
        round,
        setRound,
        settings,
        setSettings,
        saveSceneState,
        cmTokens,
        expandedIds,
        toggleExpanded,
        localEditRef,
        groups,
        // Derived state
        sortedRows,
        activeItem,
        visibleRows,
        initiativeTokens,
        initiativeItemIds,

        // Actions
        updateRow,
        updateRows,
    };
}