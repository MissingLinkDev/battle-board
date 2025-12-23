import { useEffect } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { ensureRings, clearRings } from "../components/rings";
import { getPluginId } from "../getPluginId";
import type { RingConfig } from "./useRingState";

const RING_META_KEY = getPluginId("rings");

/* ============================================================================
   RingCoordinator - Command-based ring management
   ============================================================================ */

/**
 * Wait for all normal rings to be cleared from the scene.
 * Polls OBR until no normal rings are found.
 */
async function waitForRingsToClear(maxAttempts = 10, delayMs = 100): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const items = await OBR.scene.items.getItems();
        const normalRings = items.filter((it) => {
            const meta = (it.metadata as any)?.[RING_META_KEY];
            return meta && meta.__ring__ && meta.variant === "normal";
        });

        if (normalRings.length === 0) {
            console.log(`[RingCoordinator] Confirmed rings cleared after ${attempt + 1} attempts`);
            return;
        }

        console.log(`[RingCoordinator] Still waiting for ${normalRings.length} rings to clear (attempt ${attempt + 1}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    console.warn(`[RingCoordinator] Gave up waiting for rings to clear after ${maxAttempts} attempts`);
}

/**
 * Centralized coordinator for ring updates.
 * Eliminates race conditions by using explicit commands instead of reactive effects.
 *
 * Key Design:
 * - Ring updates are CLAIMED synchronously (inside TurnCyclingLock)
 * - Ring updates are EXECUTED asynchronously (via RAF batching)
 * - Single source of truth: expected state, not observed state
 */
class RingCoordinator {
    private expectedActiveIds = new Set<string>();
    private expectedConfigs = new Map<string, RingConfig>();
    private previousConfigs = new Map<string, RingConfig>(); // Track previous configs for diffing
    private globalSettings: { showGlobalRings: boolean; started: boolean } | null = null;
    private rafId: number | null = null;
    private isExecuting = false; // Prevent concurrent executions
    private debounceTimeoutId: number | null = null; // Debounce rapid updates

    /**
     * Command: Set which tokens should have rings.
     * Called synchronously from turn cycling logic (inside TurnCyclingLock).
     *
     * @param tokenIds - Array of token IDs that should have rings
     * @param ringConfigs - Map of token ID to ring configuration
     */
    setActiveTokens(tokenIds: string[], ringConfigs: Map<string, RingConfig>): void {
        this.expectedActiveIds = new Set(tokenIds);
        this.expectedConfigs = ringConfigs;

        // Debounce: Clear any pending timeout and set a new one
        // This ensures rapid successive calls only trigger one update (the last one)
        if (this.debounceTimeoutId !== null) {
            clearTimeout(this.debounceTimeoutId);
        }

        this.debounceTimeoutId = window.setTimeout(() => {
            this.debounceTimeoutId = null;
            this.scheduleUpdate();
        }, 100); // 100ms debounce window
    }

    /**
     * Update global settings (showGlobalRings, started).
     * When settings change, rings are re-evaluated.
     *
     * @param settings - Global settings that control ring visibility
     */
    setGlobalSettings(settings: { showGlobalRings: boolean; started: boolean }): void {
        const settingsChanged =
            this.globalSettings?.showGlobalRings !== settings.showGlobalRings ||
            this.globalSettings?.started !== settings.started;

        this.globalSettings = settings;

        if (settingsChanged) {
            this.scheduleUpdate();
        }
    }

    /**
     * Clear all rings (called when initiative ends or component unmounts)
     */
    async clearAll(): Promise<void> {
        // Cancel any pending debounce timeout
        if (this.debounceTimeoutId !== null) {
            clearTimeout(this.debounceTimeoutId);
            this.debounceTimeoutId = null;
        }

        // Cancel any pending RAF updates
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        // Clear expected state
        this.expectedActiveIds.clear();
        this.expectedConfigs.clear();

        // Clear all normal rings from scene
        try {
            await clearRings("normal");
        } catch (err) {
            console.error("Failed to clear all rings:", err);
        }
    }

    /**
     * Schedule a ring update for the next animation frame.
     * Multiple calls are batched - only the latest state is executed.
     * If an execution is already in progress, it will be re-scheduled after completion.
     */
    private scheduleUpdate(): void {
        if (this.rafId === null) {
            this.rafId = requestAnimationFrame(() => {
                this.rafId = null;
                this.executeUpdate().catch(console.error);
            });
        }
    }

    /**
     * Execute the ring update (RAF callback).
     * This is where the actual OBR scene manipulation happens.
     *
     * Strategy:
     * - If token set changed: Clear ALL existing rings, then draw fresh ones
     * - If only properties changed: Update rings in place (no clear/redraw)
     */
    private async executeUpdate(): Promise<void> {
        // Prevent concurrent executions - if already executing, schedule a retry
        if (this.isExecuting) {
            console.log(`[RingCoordinator] Execution already in progress, rescheduling...`);
            this.scheduleUpdate();
            return;
        }

        this.isExecuting = true;

        try {
            // Snapshot the expected state to avoid race conditions during async operations
            const targetIds = new Set(this.expectedActiveIds);
            const targetConfigs = new Map(this.expectedConfigs);
            const settings = this.globalSettings;

            console.log(`[RingCoordinator] executeUpdate called. Active tokens:`, Array.from(targetIds));

            // Check if rings should be shown at all
            if (!settings?.started || !settings?.showGlobalRings) {
                console.log(`[RingCoordinator] Clearing all rings (started=${settings?.started}, showGlobalRings=${settings?.showGlobalRings})`);
                await clearRings("normal").catch(err => {
                    console.error("Failed to clear rings (settings disabled):", err);
                });
                return;
            }

            // If no tokens should have rings, just clear everything
            if (targetIds.size === 0) {
                console.log(`[RingCoordinator] Clearing all rings (no active tokens)`);
                await clearRings("normal").catch(err => {
                    console.error("Failed to clear rings (no active tokens):", err);
                });
                return;
            }

            // Get existing rings to determine if we need to clear or just update
            const items = await OBR.scene.items.getItems();
            const existingRingTokenIds = new Set<string>();
            for (const it of items) {
                const meta = (it.metadata as any)?.[RING_META_KEY];
                if (meta && meta.__ring__ && meta.variant === "normal") {
                    existingRingTokenIds.add(meta.ownerId);
                }
            }

            // Determine if the set of active tokens changed
            const tokenIdsChanged =
                existingRingTokenIds.size !== targetIds.size ||
                Array.from(targetIds).some(id => !existingRingTokenIds.has(id));

            if (tokenIdsChanged) {
                // Token set changed - need to clear and redraw all rings
                console.log(`[RingCoordinator] Token set changed, clearing and redrawing all rings`);
                await clearRings("normal").catch(err => {
                    console.error("Failed to clear existing rings:", err);
                });

                // Wait for OBR to fully process the deletion
                await waitForRingsToClear();

                // Draw rings for all active tokens
                const tokenIds = Array.from(targetIds);
                console.log(`[RingCoordinator] Drawing rings for ${tokenIds.length} tokens`);

                for (let i = 0; i < tokenIds.length; i++) {
                    const tokenId = tokenIds[i];
                    const config = targetConfigs.get(tokenId);
                    if (!config) {
                        console.warn(`No ring config found for token ${tokenId}`);
                        continue;
                    }

                    try {
                        console.log(`[RingCoordinator] Drawing rings for token ${tokenId} (${i + 1}/${tokenIds.length})`);
                        await ensureRings({
                            tokenId,
                            movement: config.movement,
                            attackRange: config.attackRange,
                            moveAttached: false,
                            rangeAttached: true,
                            visible: true,
                            variant: "normal",
                            forceRecenter: true,
                            movementColor: config.movementStyle.color,
                            rangeColor: config.rangeStyle.color,
                            movementWeight: config.movementStyle.weight,
                            rangeWeight: config.rangeStyle.weight,
                            movementPattern: config.movementStyle.pattern,
                            rangePattern: config.rangeStyle.pattern,
                            movementOpacity: config.movementStyle.opacity,
                            rangeOpacity: config.rangeStyle.opacity,
                        });

                        // Add a small delay between ring operations to avoid rate limiting
                        if (i < tokenIds.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    } catch (err) {
                        console.error(`Failed to create rings for token ${tokenId}:`, err);
                    }
                }

                // Save current configs as previous for next diff
                this.previousConfigs = new Map(targetConfigs);
            } else {
                // Same tokens, just properties changed - update rings in place
                console.log(`[RingCoordinator] Same tokens, updating rings in place`);
                const tokenIds = Array.from(targetIds);

                for (let i = 0; i < tokenIds.length; i++) {
                    const tokenId = tokenIds[i];
                    const config = targetConfigs.get(tokenId);
                    const prevConfig = this.previousConfigs.get(tokenId);

                    if (!config) {
                        console.warn(`No ring config found for token ${tokenId}`);
                        continue;
                    }

                    try {
                        // Determine which rings actually changed
                        const movementChanged = !prevConfig ||
                            config.movement !== prevConfig.movement ||
                            config.movementStyle.color !== prevConfig.movementStyle.color ||
                            config.movementStyle.weight !== prevConfig.movementStyle.weight ||
                            config.movementStyle.pattern !== prevConfig.movementStyle.pattern ||
                            config.movementStyle.opacity !== prevConfig.movementStyle.opacity;

                        const rangeChanged = !prevConfig ||
                            config.attackRange !== prevConfig.attackRange ||
                            config.rangeStyle.color !== prevConfig.rangeStyle.color ||
                            config.rangeStyle.weight !== prevConfig.rangeStyle.weight ||
                            config.rangeStyle.pattern !== prevConfig.rangeStyle.pattern ||
                            config.rangeStyle.opacity !== prevConfig.rangeStyle.opacity;

                        // Update only the rings that changed
                        if (movementChanged && rangeChanged) {
                            console.log(`[RingCoordinator] Updating both rings for token ${tokenId} (${i + 1}/${tokenIds.length})`);
                            await ensureRings({
                                tokenId,
                                movement: config.movement,
                                attackRange: config.attackRange,
                                moveAttached: false,
                                rangeAttached: true,
                                visible: true,
                                variant: "normal",
                                forceRecenter: false,
                                movementColor: config.movementStyle.color,
                                rangeColor: config.rangeStyle.color,
                                movementWeight: config.movementStyle.weight,
                                rangeWeight: config.rangeStyle.weight,
                                movementPattern: config.movementStyle.pattern,
                                rangePattern: config.rangeStyle.pattern,
                                movementOpacity: config.movementStyle.opacity,
                                rangeOpacity: config.rangeStyle.opacity,
                            });
                        } else if (movementChanged) {
                            console.log(`[RingCoordinator] Updating movement ring only for token ${tokenId} (${i + 1}/${tokenIds.length})`);
                            await ensureRings({
                                tokenId,
                                movement: config.movement,
                                attackRange: config.attackRange,
                                moveAttached: false,
                                rangeAttached: true,
                                visible: true,
                                variant: "normal",
                                forceRecenter: false,
                                movementColor: config.movementStyle.color,
                                rangeColor: config.rangeStyle.color,
                                movementWeight: config.movementStyle.weight,
                                rangeWeight: config.rangeStyle.weight,
                                movementPattern: config.movementStyle.pattern,
                                rangePattern: config.rangeStyle.pattern,
                                movementOpacity: config.movementStyle.opacity,
                                rangeOpacity: config.rangeStyle.opacity,
                                only: "move",
                            });
                        } else if (rangeChanged) {
                            console.log(`[RingCoordinator] Updating range ring only for token ${tokenId} (${i + 1}/${tokenIds.length})`);
                            await ensureRings({
                                tokenId,
                                movement: config.movement,
                                attackRange: config.attackRange,
                                moveAttached: false,
                                rangeAttached: true,
                                visible: true,
                                variant: "normal",
                                forceRecenter: false,
                                movementColor: config.movementStyle.color,
                                rangeColor: config.rangeStyle.color,
                                movementWeight: config.movementStyle.weight,
                                rangeWeight: config.rangeStyle.weight,
                                movementPattern: config.movementStyle.pattern,
                                rangePattern: config.rangeStyle.pattern,
                                movementOpacity: config.movementStyle.opacity,
                                rangeOpacity: config.rangeStyle.opacity,
                                only: "range",
                            });
                        } else {
                            console.log(`[RingCoordinator] No changes for token ${tokenId}, skipping update`);
                        }

                        // Add a small delay between ring operations to avoid rate limiting
                        if (i < tokenIds.length - 1 && (movementChanged || rangeChanged)) {
                            await new Promise(resolve => setTimeout(resolve, 50));
                        }
                    } catch (err) {
                        console.error(`Failed to update rings for token ${tokenId}:`, err);
                    }
                }

                // Save current configs as previous for next diff
                this.previousConfigs = new Map(targetConfigs);
            }

            console.log(`[RingCoordinator] Finished drawing rings`);
        } finally {
            this.isExecuting = false;
        }
    }
}

// Singleton instance
export const ringCoordinator = new RingCoordinator();

/* ============================================================================
   React Hooks
   ============================================================================ */

/**
 * Hook for cleanup when initiative ends or component unmounts.
 * This is the only ring-related hook that should be used in GMTable.
 *
 * @param started - Whether initiative is started
 * @param ready - Whether OBR is ready
 */
export function useRingCoordinatorCleanup(started: boolean, ready: boolean): void {
    useEffect(() => {
        if (!ready) return;

        // When initiative is not started, clear all rings
        if (!started) {
            ringCoordinator.clearAll().catch(console.error);
        }
    }, [started, ready]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            ringCoordinator.clearAll().catch(() => {});
        };
    }, []);
}
