import { useEffect, useState, useMemo, useRef } from "react";
import type { CMToken } from "../components/tokens";
import { formatFeet, formatDistanceLabel, obrDistanceBetweenTokensUnits, getCachedGridUnits, type TokenDistanceMode } from "../components/utils";

export type DistanceInfo = {
    id: string;
    name: string;
    ft: number;
    text: string;
};

/**
 * Centralized distance calculation hook - optimized for position changes
 */
export function useDistances(
    tokenId: string,
    tokens: CMToken[],
    enabled: boolean = true,
    mode: TokenDistanceMode = "box"
) {
    const [distances, setDistances] = useState<DistanceInfo[]>([]);
    const { unitLabel, unitsPerCell } = getCachedGridUnits();

    const lastCalculationRef = useRef<{ tokenId: string; mode: TokenDistanceMode; positions: string } | null>(null);

    // Memoize the target token and other tokens to avoid unnecessary recalculations
    const targetToken = useMemo(() =>
        tokens.find(t => t.id === tokenId),
        [tokens, tokenId]
    );

    const otherTokens = useMemo(() =>
        tokens.filter(t => t.id !== tokenId),
        [tokens, tokenId]
    );

    // Create a signature of current positions for change detection
    const positionSignature = useMemo(() => {
        if (!targetToken || otherTokens.length === 0) return '';

        const positions = [targetToken, ...otherTokens]
            .map(t => `${t.id}:${t.position.x},${t.position.y}`)
            .sort()
            .join('|');

        return `${tokenId}:${mode}:${positions}`;
    }, [targetToken, otherTokens, tokenId, mode]);

    useEffect(() => {
        let cancelled = false;

        const calculateDistances = async () => {
            if (!enabled || !targetToken || otherTokens.length === 0) {
                setDistances([]);
                return;
            }

            // Check if we need to recalculate
            const currentSignature = positionSignature;
            if (lastCalculationRef.current?.positions === currentSignature) {
                return; // No position changes, skip calculation
            }

            try {
                const calculations = await Promise.all(
                    otherTokens.map(async (token) => {
                        const raw = await obrDistanceBetweenTokensUnits(targetToken, token, mode);
                        return {
                            id: token.id,
                            name: token.name || "(unnamed)",
                            ft: formatFeet(raw),
                            text: formatDistanceLabel(raw, unitLabel, unitsPerCell),
                        };
                    })
                );

                if (!cancelled) {
                    setDistances(calculations.sort((a, b) => a.ft - b.ft));
                    lastCalculationRef.current = {
                        tokenId,
                        mode,
                        positions: currentSignature
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
    }, [positionSignature, enabled, unitLabel, unitsPerCell, targetToken, otherTokens, tokenId, mode]);

    return distances;
}