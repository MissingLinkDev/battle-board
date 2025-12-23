import { useEffect, useMemo } from "react";
import { ensureRings, clearRingsFor } from "../components/rings";
import type { RingConfig } from "./useRingState";

/* ============================================================================
   Ring Management Hooks - DM Preview Only
   ============================================================================

   NOTE: The global ring management (PC rings during combat turns) has been
   moved to useRingCoordinator.ts. These hooks are only for DM preview rings.

   ============================================================================ */

// Shared RAF queue for DM preview rings (simple batching)
let dmPreviewRafId: number | null = null;
const dmPreviewOperations = new Map<string, () => Promise<void>>();

function scheduleDmPreviewOperation(key: string, execute: () => Promise<void>) {
    dmPreviewOperations.set(key, execute);

    if (dmPreviewRafId === null) {
        dmPreviewRafId = requestAnimationFrame(() => {
            const ops = Array.from(dmPreviewOperations.values());
            dmPreviewOperations.clear();
            dmPreviewRafId = null;

            Promise.all(ops.map(op => op())).catch(console.error);
        });
    }
}

/* ============================================================================
   DM Preview Ring Hooks (Individual Token Toggles)
   ============================================================================ */

/**
 * @deprecated This hook is no longer used for combat turn rings.
 * Combat turn rings are now managed by RingCoordinator.
 * This hook remains only for backwards compatibility with any code that might reference it.
 */
export function useGlobalRings(
    _config: {
        tokenId: string;
        active: boolean;
        started: boolean;
        playerCharacter: boolean;
        showGlobalRings: boolean;
        ready: boolean;
    },
    _ringConfig: RingConfig
) {
    // This hook is deprecated - RingCoordinator handles all combat turn rings
    console.warn("useGlobalRings is deprecated. Combat turn rings are managed by RingCoordinator.");
}

/**
 * Hook for managing DM preview rings (independent toggle per token).
 * DM rings are always invisible to players (visible: false).
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

        // Schedule using simplified queue
        scheduleDmPreviewOperation(
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

/* ============================================================================
   Deprecated Functions (Kept for backwards compatibility)
   ============================================================================ */

/**
 * @deprecated Replaced by RingCoordinator in useRingCoordinator.ts
 * Combat turn rings are now managed via explicit commands, not reactive hooks.
 */
export function useCentralizedRings() {
    console.warn("useCentralizedRings is deprecated. Use RingCoordinator instead.");
}

/**
 * @deprecated Replaced by RingCoordinator in useRingCoordinator.ts
 */
export function useCollapsedGroupRings() {
    console.warn("useCollapsedGroupRings is deprecated. Use RingCoordinator instead.");
}

/**
 * Combined hook for DM preview rings.
 * Combat turn rings are now managed by RingCoordinator, so this only handles DM preview.
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
    // Combat turn rings are managed by RingCoordinator
    // Only DM preview rings are managed here
    useDmPreviewRings({
        tokenId: config.tokenId,
        showDmPreview: config.showDmPreview,
        ready: config.ready,
    }, ringConfig);
}

/**
 * @deprecated Replaced by useRingCoordinatorCleanup in useRingCoordinator.ts
 */
export function useGlobalRingCleanup() {
    console.warn("useGlobalRingCleanup is deprecated. Use useRingCoordinatorCleanup instead.");
}