import { useEffect, useRef } from "react";
import { clearRings, ensureRings, clearRingsFor } from "../components/rings";
import type { RingConfig } from "./useRingState";

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

    // Cleanup on unmount - only clear this token's normal rings
    useEffect(() => {
        return () => {
            clearRingsFor(config.tokenId, "normal").catch(() => { });
        };
    }, [config.tokenId]);
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