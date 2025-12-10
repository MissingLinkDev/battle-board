import { useEffect, useState, useMemo, useRef } from "react";
import OBR from "@owlbear-rodeo/sdk";
import type { CMToken } from "../components/tokens";
import type { InitiativeItem } from "../components/InitiativeItem";
import { formatFeet, formatDistanceLabel, obrDistanceBetweenTokensUnits, getCachedGridUnits, type TokenDistanceMode } from "../components/utils";
import { readMeta } from "../components/metadata";

export type DistanceInfo = {
    id: string;
    name: string;
    ft: number;
    text: string;
};

/**
 * Centralized distance calculation hook - optimized for position changes
 * Now includes elevation in distance calculations
 */
export function useDistances(
    tokenId: string,
    tokens: CMToken[],
    enabled: boolean = true,
    mode: TokenDistanceMode = "box",
    items?: InitiativeItem[],
    roundDistances: boolean = false
) {
    const [distances, setDistances] = useState<DistanceInfo[]>([]);
    const [gridVersion, setGridVersion] = useState(0);
    const { unitLabel, unitsPerCell } = getCachedGridUnits();

    const lastCalculationRef = useRef<{ tokenId: string; mode: TokenDistanceMode; positions: string; gridVersion: number } | null>(null);

    // Subscribe to grid changes to trigger recalculation when measurement type changes
    useEffect(() => {
        const unsubscribe = OBR.scene.grid.onChange(() => {
            setGridVersion(v => v + 1);
        });
        return () => {
            unsubscribe();
        };
    }, []);

    // Memoize the target token and other tokens to avoid unnecessary recalculations
    const targetToken = useMemo(() =>
        tokens.find(t => t.id === tokenId),
        [tokens, tokenId]
    );

    const otherTokens = useMemo(() =>
        tokens.filter(t => t.id !== tokenId),
        [tokens, tokenId]
    );

    // Create elevation lookup map from items
    const elevationMap = useMemo(() => {
        if (!items) return new Map<string, number>();
        return new Map(items.map(item => [item.id, item.elevation ?? 0]));
    }, [items]);

    // Track whether we need to fetch elevations from scene
    const needsSceneElevation = elevationMap.size === 0;

    // Track elevation changes from scene metadata when not using items array
    const [sceneElevationVersion, setSceneElevationVersion] = useState(0);

    // Subscribe to scene item changes to detect elevation updates
    useEffect(() => {
        if (!needsSceneElevation || !enabled) return;

        const unsubscribe = OBR.scene.items.onChange(async (changedItems) => {
            // Only care about items in our token list
            const relevantIds = new Set([tokenId, ...otherTokens.map(t => t.id)]);
            const relevantChanges = changedItems.filter(item => relevantIds.has(item.id));

            if (relevantChanges.length > 0) {
                // Trigger recalculation by bumping version
                setSceneElevationVersion(v => v + 1);
            }
        });

        return () => {
            unsubscribe();
        };
    }, [needsSceneElevation, enabled, tokenId, otherTokens]);

    // Create a signature of current positions and elevations for change detection
    const positionSignature = useMemo(() => {
        if (!targetToken || otherTokens.length === 0) return '';

        const positions = [targetToken, ...otherTokens]
            .map(t => {
                const elevation = elevationMap.get(t.id) ?? 0;
                return `${t.id}:${t.position.x},${t.position.y}:${elevation}`;
            })
            .sort()
            .join('|');

        // Include scene elevation version to trigger recalc when metadata changes
        return `${tokenId}:${mode}:${positions}:scene=${needsSceneElevation}:v${sceneElevationVersion}`;
    }, [targetToken, otherTokens, tokenId, mode, elevationMap, needsSceneElevation, sceneElevationVersion]);

    useEffect(() => {
        let cancelled = false;

        const calculateDistances = async () => {
            if (!enabled || !targetToken || otherTokens.length === 0) {
                setDistances([]);
                return;
            }

            // Check if we need to recalculate (skip cache check if grid changed)
            const currentSignature = positionSignature;
            if (lastCalculationRef.current?.positions === currentSignature && gridVersion === lastCalculationRef.current?.gridVersion) {
                return; // No position or grid changes, skip calculation
            }

            try {
                // If elevationMap is empty (tokens not in initiative), fetch elevation from scene metadata
                let targetElevation = elevationMap.get(tokenId) ?? 0;

                // Build elevation lookup from scene items if needed
                const needsSceneElevation = elevationMap.size === 0;
                const sceneElevationMap = new Map<string, number>();

                if (needsSceneElevation) {
                    const tokenIds = [tokenId, ...otherTokens.map(t => t.id)];
                    const sceneItems = await OBR.scene.items.getItems(tokenIds);
                    for (const item of sceneItems) {
                        const meta = readMeta(item);
                        if (meta) {
                            sceneElevationMap.set(item.id, meta.elevation ?? 0);
                        }
                    }
                    targetElevation = sceneElevationMap.get(tokenId) ?? 0;
                }

                const calculations = await Promise.all(
                    otherTokens.map(async (token) => {
                        const tokenElevation = needsSceneElevation
                            ? (sceneElevationMap.get(token.id) ?? 0)
                            : (elevationMap.get(token.id) ?? 0);
                        const raw = await obrDistanceBetweenTokensUnits(
                            targetToken,
                            token,
                            mode,
                            targetElevation,
                            tokenElevation
                        );
                        return {
                            id: token.id,
                            name: token.name || "(unnamed)",
                            ft: formatFeet(raw, roundDistances, unitsPerCell),
                            text: formatDistanceLabel(raw, unitLabel, unitsPerCell, roundDistances, unitsPerCell),
                        };
                    })
                );

                if (!cancelled) {
                    setDistances(calculations.sort((a, b) => a.ft - b.ft));
                    lastCalculationRef.current = {
                        tokenId,
                        mode,
                        positions: currentSignature,
                        gridVersion
                    };
                }
            } catch (error) {
                console.error("Failed to calculate distances:", error);
                if (!cancelled) {
                    setDistances([]);
                }
            }
        };

        calculateDistances();

        return () => {
            cancelled = true;
        };
    }, [positionSignature, enabled, unitLabel, unitsPerCell, targetToken, otherTokens, tokenId, mode, elevationMap, gridVersion, roundDistances]);

    return distances;
}