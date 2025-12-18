import { useEffect, useMemo, useRef, useState } from "react";
import OBR, { isImage, type Item } from "@owlbear-rodeo/sdk";
import { batchUpdateMeta, type MetaShape } from "../components/metadata";
import { initiativeFromItem, metaPatchFromRowDiff, type InitiativeItem } from "../components/InitiativeItem";
import { sortByInitiativeDesc } from "../components/utils";

export function useInitiativeRows() {
    const [rows, setRows] = useState<InitiativeItem[]>([]);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    // local edit bookkeeping for diff writer
    const localEditRef = useRef(false);
    const prevRowsRef = useRef<InitiativeItem[]>([]);
    const diffGenerationRef = useRef(0); // Track diff generation to prevent stale writes

    // Scene → UI sync
    useEffect(() => {
        const handle = async (items: Item[]) => {
            // IMPORTANT: Don't ignore scene updates when we have local edits for active state changes
            // Only ignore for other types of changes
            const wasLocalEdit = localEditRef.current;

            const list: InitiativeItem[] = [];
            for (const it of items) {
                if (!isImage(it)) continue;
                const row = initiativeFromItem(it);
                if (row) list.push(row);
            }
            const sorted = sortByInitiativeDesc(list);

            // If this was a local edit, we need to be more careful about what we update
            if (wasLocalEdit) {
                // Check if this update contains active state changes that we need to accept
                const prevActiveIds = new Set(prevRowsRef.current.filter(r => r.active).map(r => r.id));
                const newActiveIds = new Set(sorted.filter(r => r.active).map(r => r.id));

                // If active state changed in the scene, we should accept it
                const activeStateChanged = prevActiveIds.size !== newActiveIds.size ||
                    [...prevActiveIds].some(id => !newActiveIds.has(id)) ||
                    [...newActiveIds].some(id => !prevActiveIds.has(id));

                if (activeStateChanged) {
                    // Active state changed - accept the scene update
                    setRows(sorted);
                    prevRowsRef.current = sorted;
                    localEditRef.current = false;
                } else {
                    // No active state change - keep our local edit flag
                    // This prevents overwriting local edits like HP changes
                }
            } else {
                // Not a local edit - accept all scene changes
                setRows(sorted);
                prevRowsRef.current = sorted;
                localEditRef.current = false;
            }
        };

        OBR.scene.items.getItems().then(handle);
        return OBR.scene.items.onChange(handle);
    }, []);

    // Diff-writer (rows → metadata) and auto resort when initiative changes
    // UPDATED: Uses generation counter to prevent stale writes
    useEffect(() => {
        if (!localEditRef.current) {
            prevRowsRef.current = rows;
            return;
        }

        // Increment generation and snapshot state BEFORE async work
        const currentGeneration = ++diffGenerationRef.current;
        const prevSnapshot = prevRowsRef.current;
        const currentSnapshot = rows;

        // Update prevRowsRef IMMEDIATELY to prevent stale diffs
        prevRowsRef.current = rows;

        (async () => {
            const prevById = new Map(prevSnapshot.map((r) => [r.id, r]));

            const patches: { id: string; patch: Partial<MetaShape> }[] = [];
            let initiativeChanged = false;

            for (const now of currentSnapshot) {
                const before = prevById.get(now.id);
                if (!before) continue;
                const patch = metaPatchFromRowDiff(before, now);
                if ("initiative" in patch) initiativeChanged = true;
                if (Object.keys(patch).length) patches.push({ id: now.id, patch });
            }

            // Check if we're still current before applying patches
            if (currentGeneration !== diffGenerationRef.current) {
                return; // Abort, newer edit has started
            }

            if (patches.length) {
                await batchUpdateMeta(OBR, patches);
            }

            if (initiativeChanged) {
                setRows((s) => sortByInitiativeDesc(s));
            }

            // Only clear localEditRef if we're still the current generation
            if (currentGeneration === diffGenerationRef.current) {
                localEditRef.current = false;
            }
        })().catch(console.error);
    }, [rows]);

    const sortedRows = useMemo(() => sortByInitiativeDesc(rows), [rows]);
    const initiativeItemIds = useMemo(() => new Set(sortedRows.map((r) => r.id)), [sortedRows]);

    const toggleExpanded = (id: string) =>
        setExpandedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });

    return {
        rows,
        setRows,
        sortedRows,
        expandedIds,
        toggleExpanded,
        initiativeItemIds,
        localEditRef,
    };
}