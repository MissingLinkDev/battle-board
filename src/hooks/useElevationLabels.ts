import { useEffect, useRef } from "react";
import OBR, { isImage, type Item } from "@owlbear-rodeo/sdk";
import { ensureElevationLabel } from "../components/elevationLabels";
import { readMeta } from "../components/metadata";
import { getGridInfo } from "../components/utils";
import { getPluginId } from "../getPluginId";

const LABEL_META_KEY = getPluginId("elevation-label");

/**
 * Hook to manage elevation labels for all tokens in the scene.
 * Initializes labels on mount and subscribes to item changes.
 */
export function useElevationLabels(ready: boolean) {
    const rafIdRef = useRef<number | null>(null);
    const unsubscribeRef = useRef<(() => void) | null>(null);
    const elevationMapRef = useRef<Map<string, number>>(new Map());

    useEffect(() => {
        if (!ready) return;

        const initLabels = async () => {
            try {
                // Get current unit from grid
                const grid = await getGridInfo();
                const unit = grid.unitLabel;

                // Initialize labels for all tokens with elevation > 0
                const items = await OBR.scene.items.getItems(
                    (item) => isImage(item) && (item.layer === "CHARACTER" || item.layer === "MOUNT")
                );

                // Build initial elevation map
                for (const item of items) {
                    const meta = readMeta(item);
                    const elevation = meta?.elevation ?? 0;
                    elevationMapRef.current.set(item.id, elevation);

                    if (elevation > 0) {
                        await ensureElevationLabel({
                            tokenId: item.id,
                            elevation: elevation,
                            unit: unit,
                        });
                    }
                }

                // Subscribe to item changes (but filter out label changes to avoid loops)
                const unsubscribe = OBR.scene.items.onChange(async (items: Item[]) => {
                    // Filter to tokens whose elevation actually changed
                    const tokensWithElevationChange = items.filter(item => {
                        // Skip if this is one of our elevation labels
                        const isLabel = (item.metadata as any)?.[LABEL_META_KEY];
                        if (isLabel) return false;

                        // Skip if not a character/mount token
                        if (!isImage(item)) return false;
                        if (item.layer !== "CHARACTER" && item.layer !== "MOUNT") return false;

                        // Check if elevation changed
                        const meta = readMeta(item);
                        const newElevation = meta?.elevation ?? 0;
                        const oldElevation = elevationMapRef.current.get(item.id) ?? 0;

                        return newElevation !== oldElevation;
                    });

                    // If no elevation changes, skip update
                    if (tokensWithElevationChange.length === 0) return;

                    // Cancel any pending RAF
                    if (rafIdRef.current !== null) {
                        cancelAnimationFrame(rafIdRef.current);
                    }

                    // Use RAF to debounce updates
                    rafIdRef.current = requestAnimationFrame(async () => {
                        try {
                            const grid = await getGridInfo();
                            const unit = grid.unitLabel;

                            for (const item of tokensWithElevationChange) {
                                const meta = readMeta(item);
                                const elevation = meta?.elevation ?? 0;

                                // Update elevation map
                                elevationMapRef.current.set(item.id, elevation);

                                await ensureElevationLabel({
                                    tokenId: item.id,
                                    elevation: elevation,
                                    unit: unit,
                                });
                            }
                        } catch (error) {
                            console.error("Error updating elevation labels:", error);
                            if (error && typeof error === 'object' && 'error' in error) {
                                console.error("Detailed error:", (error as any).error);
                            }
                        }

                        rafIdRef.current = null;
                    });
                });

                unsubscribeRef.current = unsubscribe;
            } catch (error) {
                console.error("Error initializing elevation labels:", error);
            }
        };

        initLabels();

        return () => {
            // Cleanup: cancel RAF and unsubscribe from changes
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }
        };
    }, [ready]);
}
