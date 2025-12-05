import { useEffect, useRef, useMemo } from "react";
import { clearRings, ensureRings, clearRingsFor } from "../components/rings";
import type { RingConfig } from "./useRingState";
import type { InitiativeItem } from "../components/InitiativeItem";

/**
 * Hook specifically for managing global PC rings (shown during combat turns)
 * Updated to handle multiple active tokens in groups
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
    const rafIdRef = useRef<number | null>(null);
    const prevShouldShowRef = useRef<boolean>(false);

    useEffect(() => {
        if (!config.ready) return;

        // Cancel any pending RAF
        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }

        const updateGlobalRings = async () => {
            const shouldShow = config.showGlobalRings && config.started && config.active && config.playerCharacter;
            const shouldShowChanged = shouldShow !== prevShouldShowRef.current;

            // Only update rings if the show state changed or ring config changed
            if (shouldShow) {
                await ensureRings({
                    tokenId: config.tokenId,
                    movement: ringConfig.movement,
                    attackRange: ringConfig.attackRange,
                    moveAttached: false,
                    rangeAttached: true,
                    visible: true,
                    variant: "normal",
                    forceRecenter: shouldShowChanged, // Only recenter when transitioning to active
                    movementColor: ringConfig.movementStyle.color,
                    rangeColor: ringConfig.rangeStyle.color,
                    movementWeight: ringConfig.movementStyle.weight,
                    rangeWeight: ringConfig.rangeStyle.weight,
                    movementPattern: ringConfig.movementStyle.pattern,
                    rangePattern: ringConfig.rangeStyle.pattern,
                    movementOpacity: ringConfig.movementStyle.opacity,
                    rangeOpacity: ringConfig.rangeStyle.opacity,
                });
            } else if (prevShouldShowRef.current) {
                // Only clear if we were previously showing rings
                await clearRingsFor(config.tokenId, "normal");
            }

            prevShouldShowRef.current = shouldShow;
        };

        rafIdRef.current = requestAnimationFrame(() => {
            updateGlobalRings().catch(console.error);
            rafIdRef.current = null;
        });

        return () => {
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
        };
    }, [
        config.ready,
        config.started,
        config.active,
        config.playerCharacter,
        config.showGlobalRings,
        config.tokenId,
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

    // Cleanup on unmount - only clear if this hook was managing the rings
    useEffect(() => {
        return () => {
            // Only clear if this component was managing global rings
            if (config.showGlobalRings) {
                clearRingsFor(config.tokenId, "normal").catch(() => { });
            }
        };
    }, [config.tokenId, config.showGlobalRings]);
}

/**
 * Hook specifically for managing DM preview rings (independent toggle per token)
 */
export function useDmPreviewRings(
    config: {
        tokenId: string;
        showDmPreview: boolean;
        ready: boolean;
    },
    ringConfig: RingConfig
) {
    const rafIdRef = useRef<number | null>(null);

    useEffect(() => {
        if (!config.ready) return;

        // Cancel any pending RAF
        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }

        const updateDmRings = async () => {
            if (config.showDmPreview) {
                await ensureRings({
                    tokenId: config.tokenId,
                    movement: ringConfig.movement,
                    attackRange: ringConfig.attackRange,
                    moveAttached: false,
                    rangeAttached: true,
                    visible: false, // DM rings are always invisible to players
                    variant: "dm",
                    forceRecenter: false, // DM rings don't need recentering
                    movementColor: ringConfig.movementStyle.color,
                    rangeColor: ringConfig.rangeStyle.color,
                    movementWeight: ringConfig.movementStyle.weight,
                    rangeWeight: ringConfig.rangeStyle.weight,
                    movementPattern: ringConfig.movementStyle.pattern,
                    rangePattern: ringConfig.rangeStyle.pattern,
                    movementOpacity: ringConfig.movementStyle.opacity,
                    rangeOpacity: ringConfig.rangeStyle.opacity,
                });
            } else {
                // Clear only this token's DM rings
                await clearRingsFor(config.tokenId, "dm");
            }
        };

        rafIdRef.current = requestAnimationFrame(() => {
            updateDmRings().catch(console.error);
            rafIdRef.current = null;
        });

        return () => {
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
        };
    }, [
        config.ready,
        config.showDmPreview,
        config.tokenId,
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

    // Cleanup on unmount - only clear this token's DM rings
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
    const rafIdRef = useRef<number | null>(null);
    const itemsRef = useRef<InitiativeItem[]>(items);

    // Always keep items ref up to date
    itemsRef.current = items;

    // Create stable key for items based on active states
    const activeStateKey = useMemo(() => {
        return items
            .filter(item => item.playerCharacter && item.active)
            .map(item => item.id)
            .sort()
            .join(',');
    }, [items]);

    useEffect(() => {
        if (!config.ready) {
            return;
        }

        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }

        const updateRings = async () => {
            const shouldHaveRings = new Set<string>();
            const itemMap = new Map<string, InitiativeItem>();

            // Build map and find all active player characters using current items
            itemsRef.current.forEach(item => {
                itemMap.set(item.id, item);
                if (item.playerCharacter && item.active && config.started && config.showGlobalRings) {
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

            prevActiveIdsRef.current = shouldHaveRings;
        };

        rafIdRef.current = requestAnimationFrame(() => {
            updateRings().catch(console.error);
            rafIdRef.current = null;
        });

        return () => {
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
        };
    }, [activeStateKey, config.ready, config.started, config.showGlobalRings]);

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