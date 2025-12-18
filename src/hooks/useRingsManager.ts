import { useEffect, useRef, useMemo } from "react";
import { clearRings, ensureRings, clearRingsFor } from "../components/rings";
import type { RingConfig } from "./useRingState";
import type { InitiativeItem } from "../components/InitiativeItem";

/* ============================================================================
   Ring Operation Queue - Prevents race conditions in ring updates
   ============================================================================ */

type RingOperation = {
    key: string;
    execute: () => Promise<void>;
    sequenceNumber: number;
};

/**
 * Manages queued ring operations with deduplication and sequence tracking.
 * Ensures only the latest operation for each key executes and rejects stale operations.
 */
class RingOperationQueue {
    private sequenceNumber = 0;
    private lastProcessedSequence = -1;
    private pendingOperations = new Map<string, RingOperation>();
    private rafId: number | null = null;

    /**
     * Schedule a ring operation. If an operation for the same key already exists,
     * it will be replaced (deduplication).
     */
    scheduleOperation(key: string, execute: () => Promise<void>): number {
        const seq = ++this.sequenceNumber;

        // Deduplicate: replace existing operation for this key
        this.pendingOperations.set(key, {
            key,
            execute,
            sequenceNumber: seq,
        });

        // Schedule batch execution if not already scheduled
        if (this.rafId === null) {
            this.rafId = requestAnimationFrame(() => {
                this.executeBatch().catch(console.error);
            });
        }

        return seq;
    }

    /**
     * Check if a sequence number is stale (newer operations have been scheduled)
     */
    isStale(sequenceNumber: number): boolean {
        return sequenceNumber < this.sequenceNumber;
    }

    /**
     * Execute all pending operations in the queue
     */
    private async executeBatch() {
        const ops = Array.from(this.pendingOperations.values());
        this.pendingOperations.clear();
        this.rafId = null;

        // Execute operations in order
        for (const op of ops) {
            // Skip if this operation has been superseded
            if (op.sequenceNumber <= this.lastProcessedSequence) {
                continue;
            }

            try {
                await op.execute();
                this.lastProcessedSequence = op.sequenceNumber;
            } catch (err) {
                console.error(`Ring operation ${op.key} failed:`, err);
                if (err instanceof Error) {
                    console.error('Error stack:', err.stack);
                }
            }
        }
    }

    /**
     * Cancel all pending operations (used on cleanup)
     */
    cancelAll() {
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.pendingOperations.clear();
    }
}

// Shared queue instance for all ring hooks
const ringQueue = new RingOperationQueue();

/* ============================================================================
   Ring Management Hooks
   ============================================================================ */

/**
 * Hook specifically for managing global PC rings (shown during combat turns)
 * Updated to handle multiple active tokens in groups
 *
 * UPDATED: Uses RingOperationQueue to prevent stale operations
 */
export function useGlobalRings(
    config: {
        tokenId: string;
        active: boolean;
        started: boolean;
        playerCharacter: boolean;
        showGlobalRings: boolean;
        ready: boolean;
    },
    ringConfig: RingConfig
) {
    const prevShouldShowRef = useRef<boolean>(false);

    // Snapshot config and ringConfig to avoid closure issues
    const configSnapshot = useMemo(() => config, [
        config.ready,
        config.started,
        config.active,
        config.playerCharacter,
        config.showGlobalRings,
        config.tokenId,
    ]);

    const ringConfigSnapshot = useMemo(() => ringConfig, [
        ringConfig.movement,
        ringConfig.attackRange,
        ringConfig.movementStyle.color,
        ringConfig.movementStyle.weight,
        ringConfig.movementStyle.pattern,
        ringConfig.movementStyle.opacity,
        ringConfig.rangeStyle.color,
        ringConfig.rangeStyle.weight,
        ringConfig.rangeStyle.pattern,
        ringConfig.rangeStyle.opacity,
    ]);

    useEffect(() => {
        if (!configSnapshot.ready) return;

        // Schedule using queue
        ringQueue.scheduleOperation(
            `global-${configSnapshot.tokenId}`,
            async () => {
                const shouldShow = configSnapshot.showGlobalRings && configSnapshot.started &&
                                  configSnapshot.active && configSnapshot.playerCharacter;
                const shouldShowChanged = shouldShow !== prevShouldShowRef.current;

                if (shouldShow) {
                    await ensureRings({
                        tokenId: configSnapshot.tokenId,
                        movement: ringConfigSnapshot.movement,
                        attackRange: ringConfigSnapshot.attackRange,
                        moveAttached: false,
                        rangeAttached: true,
                        visible: true,
                        variant: "normal",
                        forceRecenter: shouldShowChanged,
                        movementColor: ringConfigSnapshot.movementStyle.color,
                        rangeColor: ringConfigSnapshot.rangeStyle.color,
                        movementWeight: ringConfigSnapshot.movementStyle.weight,
                        rangeWeight: ringConfigSnapshot.rangeStyle.weight,
                        movementPattern: ringConfigSnapshot.movementStyle.pattern,
                        rangePattern: ringConfigSnapshot.rangeStyle.pattern,
                        movementOpacity: ringConfigSnapshot.movementStyle.opacity,
                        rangeOpacity: ringConfigSnapshot.rangeStyle.opacity,
                    });
                } else if (prevShouldShowRef.current) {
                    await clearRingsFor(configSnapshot.tokenId, "normal");
                }

                prevShouldShowRef.current = shouldShow;
            }
        );
    }, [configSnapshot, ringConfigSnapshot]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (config.showGlobalRings) {
                clearRingsFor(config.tokenId, "normal").catch(() => { });
            }
        };
    }, [config.tokenId, config.showGlobalRings]);
}

/**
 * Hook specifically for managing DM preview rings (independent toggle per token)
 *
 * UPDATED: Uses RingOperationQueue to prevent stale operations
 */
export function useDmPreviewRings(
    config: {
        tokenId: string;
        showDmPreview: boolean;
        ready: boolean;
    },
    ringConfig: RingConfig
) {
    // Snapshot config and ringConfig
    const configSnapshot = useMemo(() => config, [
        config.ready,
        config.showDmPreview,
        config.tokenId,
    ]);

    const ringConfigSnapshot = useMemo(() => ringConfig, [
        ringConfig.movement,
        ringConfig.attackRange,
        ringConfig.movementStyle.color,
        ringConfig.movementStyle.weight,
        ringConfig.movementStyle.pattern,
        ringConfig.movementStyle.opacity,
        ringConfig.rangeStyle.color,
        ringConfig.rangeStyle.weight,
        ringConfig.rangeStyle.pattern,
        ringConfig.rangeStyle.opacity,
    ]);

    useEffect(() => {
        if (!configSnapshot.ready) return;

        // Schedule using queue
        ringQueue.scheduleOperation(
            `dm-${configSnapshot.tokenId}`,
            async () => {
                if (configSnapshot.showDmPreview) {
                    await ensureRings({
                        tokenId: configSnapshot.tokenId,
                        movement: ringConfigSnapshot.movement,
                        attackRange: ringConfigSnapshot.attackRange,
                        moveAttached: false,
                        rangeAttached: true,
                        visible: false, // DM rings are always invisible to players
                        variant: "dm",
                        forceRecenter: false,
                        movementColor: ringConfigSnapshot.movementStyle.color,
                        rangeColor: ringConfigSnapshot.rangeStyle.color,
                        movementWeight: ringConfigSnapshot.movementStyle.weight,
                        rangeWeight: ringConfigSnapshot.rangeStyle.weight,
                        movementPattern: ringConfigSnapshot.movementStyle.pattern,
                        rangePattern: ringConfigSnapshot.rangeStyle.pattern,
                        movementOpacity: ringConfigSnapshot.movementStyle.opacity,
                        rangeOpacity: ringConfigSnapshot.rangeStyle.opacity,
                    });
                } else {
                    await clearRingsFor(configSnapshot.tokenId, "dm");
                }
            }
        );
    }, [configSnapshot, ringConfigSnapshot]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearRingsFor(config.tokenId, "dm").catch(() => { });
        };
    }, [config.tokenId]);
}

/**
 * Centralized hook for managing rings for ALL initiative items
 * Manages rings based purely on active state, regardless of rendering/grouping
 * Call this at GMTable level with the complete flat list of all items
 *
 * UPDATED: Uses RingOperationQueue with two-phase clear-then-draw protocol
 * to prevent race conditions during rapid state changes.
 */
export function useCentralizedRings(
    items: InitiativeItem[],
    config: {
        started: boolean;
        showGlobalRings: boolean;
        ready: boolean;
    }
) {
    const prevActiveIdsRef = useRef<Set<string>>(new Set());
    const prevActiveStateKeyRef = useRef<string>('');

    // Snapshot config to avoid closure issues
    const configSnapshot = useMemo(() => config, [
        config.ready,
        config.started,
        config.showGlobalRings,
    ]);

    // Create stable key for items based on active states
    // ONLY changes when the actual set of active PC IDs changes
    const activeStateKey = useMemo(() => {
        const newKey = items
            .filter(item => item.playerCharacter && item.active)
            .map(item => item.id)
            .sort()
            .join(',');

        // Only update if actually changed
        if (newKey !== prevActiveStateKeyRef.current) {
            prevActiveStateKeyRef.current = newKey;
        }
        return prevActiveStateKeyRef.current;
    }, [items.map(i => `${i.id}:${i.active}:${i.playerCharacter}`).join('|')]);

    // Snapshot items when activeStateKey changes (not on every render)
    const itemsSnapshot = useMemo(() => items, [activeStateKey]);

    useEffect(() => {
        if (!configSnapshot.ready) {
            return;
        }

        // Schedule ring operation using queue (handles RAF internally)
        const seq = ringQueue.scheduleOperation(
            'centralized-rings',
            async () => {
                // Build state from snapshot
                const shouldHaveRings = new Set<string>();
                const itemMap = new Map<string, InitiativeItem>();

                itemsSnapshot.forEach(item => {
                    itemMap.set(item.id, item);
                    if (item.playerCharacter && item.active && configSnapshot.started && configSnapshot.showGlobalRings) {
                        shouldHaveRings.add(item.id);
                    }
                });

                // Find newly active items (need rings drawn)
                const toDraw: string[] = [];
                shouldHaveRings.forEach(id => {
                    if (!prevActiveIdsRef.current.has(id)) {
                        toDraw.push(id);
                    }
                });

                // Find newly inactive items (need rings cleared)
                const toClear: string[] = [];
                prevActiveIdsRef.current.forEach(id => {
                    if (!shouldHaveRings.has(id)) {
                        toClear.push(id);
                    }
                });

                // ===== PHASE 1: Clear rings for inactive items =====
                await Promise.all(
                    toClear.map(id => clearRingsFor(id, "normal"))
                );

                // Check if we're still current after clearing
                if (ringQueue.isStale(seq)) {
                    return; // Abort, newer operation scheduled
                }

                // ===== PHASE 2: Draw rings for active items =====
                const drawPromises = toDraw.map(async id => {
                    const item = itemMap.get(id);
                    if (!item) return;

                    const ringConfig: RingConfig = {
                        movement: item.movement ?? 30,
                        attackRange: item.attackRange ?? 60,
                        movementStyle: {
                            color: item.movementColor ?? "#519e00",
                            weight: item.movementWeight ?? 10,
                            pattern: item.movementPattern ?? "dash",
                            opacity: item.movementOpacity ?? 1,
                        },
                        rangeStyle: {
                            color: item.rangeColor ?? "#fe4c50",
                            weight: item.rangeWeight ?? 10,
                            pattern: item.rangePattern ?? "dash",
                            opacity: item.rangeOpacity ?? 1,
                        },
                    };

                    await ensureRings({
                        tokenId: id,
                        movement: ringConfig.movement,
                        attackRange: ringConfig.attackRange,
                        moveAttached: false,
                        rangeAttached: true,
                        visible: true,
                        variant: "normal",
                        forceRecenter: true,
                        movementColor: ringConfig.movementStyle.color,
                        rangeColor: ringConfig.rangeStyle.color,
                        movementWeight: ringConfig.movementStyle.weight,
                        rangeWeight: ringConfig.rangeStyle.weight,
                        movementPattern: ringConfig.movementStyle.pattern,
                        rangePattern: ringConfig.rangeStyle.pattern,
                        movementOpacity: ringConfig.movementStyle.opacity,
                        rangeOpacity: ringConfig.rangeStyle.opacity,
                    });
                });

                await Promise.all(drawPromises);

                // Update tracking only if we're still current
                if (!ringQueue.isStale(seq)) {
                    prevActiveIdsRef.current = shouldHaveRings;
                }
            }
        );

        // No cleanup needed - queue handles RAF cancellation
    }, [activeStateKey, configSnapshot, itemsSnapshot]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            prevActiveIdsRef.current.forEach(tokenId => {
                clearRingsFor(tokenId, "normal").catch(() => {});
            });
        };
    }, []);
}

/**
 * @deprecated Use useCentralizedRings at GMTable level instead
 * Hook for managing rings for all active player characters in a group
 * Only manages rings when group is collapsed to avoid conflicts with InitiativeRow
 * CRITICAL: Only draws/clears rings when active state actually changes (transitions)
 */
export function useCollapsedGroupRings(
    items: InitiativeItem[],
    config: {
        started: boolean;
        showGlobalRings: boolean;
        ready: boolean;
        groupExpanded: boolean;
    }
) {
    // Create stable item map using useMemo - only recalculates when item IDs or active states change
    const itemMap = useMemo(() => {
        const map = new Map<string, InitiativeItem>();
        items.forEach(item => map.set(item.id, item));
        return map;
    }, [items.map(i => `${i.id}:${i.active}`).join(',')]); // Stable key based on actual data

    // Track which items currently have rings (managed by this hook)
    const prevActiveIdsRef = useRef<Set<string>>(new Set());
    const rafIdRef = useRef<number | null>(null);

    useEffect(() => {
        if (!config.ready) {
            return;
        }

        // When group is expanded, stop managing rings (InitiativeRow takes over)
        // DON'T clear rings - just stop managing them
        if (config.groupExpanded) {
            return;
        }

        // Cancel any pending RAF
        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }

        const updateGroupRings = async () => {
            // Build set of items that SHOULD have rings right now
            const shouldHaveRings = new Set<string>();

            itemMap.forEach((item, id) => {
                if (item.playerCharacter && item.active && config.started && config.showGlobalRings) {
                    shouldHaveRings.add(id);
                }
            });

            // Find items that need rings drawn (newly active)
            const toDraw: string[] = [];
            shouldHaveRings.forEach(id => {
                if (!prevActiveIdsRef.current.has(id)) {
                    toDraw.push(id);
                }
            });

            // Find items that need rings cleared (no longer active)
            const toClear: string[] = [];
            prevActiveIdsRef.current.forEach(id => {
                if (!shouldHaveRings.has(id)) {
                    toClear.push(id);
                }
            });

            // Draw rings for newly active items
            for (const id of toDraw) {
                const item = itemMap.get(id);
                if (!item) continue;

                const ringConfig: RingConfig = {
                    movement: item.movement ?? 30,
                    attackRange: item.attackRange ?? 60,
                    movementStyle: {
                        color: item.movementColor ?? "#519e00",
                        weight: item.movementWeight ?? 10,
                        pattern: item.movementPattern ?? "dash",
                        opacity: item.movementOpacity ?? 1,
                    },
                    rangeStyle: {
                        color: item.rangeColor ?? "#fe4c50",
                        weight: item.rangeWeight ?? 10,
                        pattern: item.rangePattern ?? "dash",
                        opacity: item.rangeOpacity ?? 1,
                    },
                };

                await ensureRings({
                    tokenId: id,
                    movement: ringConfig.movement,
                    attackRange: ringConfig.attackRange,
                    moveAttached: false,
                    rangeAttached: true,
                    visible: true,
                    variant: "normal",
                    forceRecenter: true,
                    movementColor: ringConfig.movementStyle.color,
                    rangeColor: ringConfig.rangeStyle.color,
                    movementWeight: ringConfig.movementStyle.weight,
                    rangeWeight: ringConfig.rangeStyle.weight,
                    movementPattern: ringConfig.movementStyle.pattern,
                    rangePattern: ringConfig.rangeStyle.pattern,
                    movementOpacity: ringConfig.movementStyle.opacity,
                    rangeOpacity: ringConfig.rangeStyle.opacity,
                });
            }

            // Clear rings for items that became inactive
            for (const id of toClear) {
                await clearRingsFor(id, "normal");
            }

            // Update tracking
            prevActiveIdsRef.current = shouldHaveRings;
        };

        rafIdRef.current = requestAnimationFrame(() => {
            updateGroupRings().catch(console.error);
            rafIdRef.current = null;
        });

        return () => {
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
        };
    }, [
        // CRITICAL: NO items array here, use itemMap instead
        itemMap,
        config.ready,
        config.started,
        config.showGlobalRings,
        config.groupExpanded,
    ]);

    // Cleanup on unmount - only clear if we're managing (collapsed)
    useEffect(() => {
        return () => {
            if (!config.groupExpanded) {
                prevActiveIdsRef.current.forEach(tokenId => {
                    clearRingsFor(tokenId, "normal").catch(() => {});
                });
            }
        };
    }, [config.groupExpanded]);
}

/**
 * Combined hook that uses both separate ring managers
 */
export function useRingManager(
    config: {
        tokenId: string;
        active: boolean;
        started: boolean;
        playerCharacter: boolean;
        showGlobalRings: boolean;
        showDmPreview: boolean;
        ready: boolean;
    },
    ringConfig: RingConfig
) {
    // Use separate hooks for each ring system
    useGlobalRings({
        tokenId: config.tokenId,
        active: config.active,
        started: config.started,
        playerCharacter: config.playerCharacter,
        showGlobalRings: config.showGlobalRings,
        ready: config.ready,
    }, ringConfig);

    useDmPreviewRings({
        tokenId: config.tokenId,
        showDmPreview: config.showDmPreview,
        ready: config.ready,
    }, ringConfig);
}

/**
 * Hook for managing global ring cleanup when initiative ends
 * This should be used at the application level to ensure proper cleanup
 */
export function useGlobalRingCleanup(started: boolean, ready: boolean) {
    const rafIdRef = useRef<number | null>(null);

    useEffect(() => {
        if (!ready) return;

        // Cancel any pending RAF
        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }

        // When initiative is not started, clear all normal rings
        if (!started) {
            rafIdRef.current = requestAnimationFrame(() => {
                clearRings("normal").catch(console.error);
                rafIdRef.current = null;
            });
        }

        return () => {
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
        };
    }, [started, ready]);
}