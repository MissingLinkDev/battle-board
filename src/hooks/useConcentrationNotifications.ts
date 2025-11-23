import { useState, useEffect } from "react";
import OBR from "@owlbear-rodeo/sdk";

export type ConcentrationCheck = {
    tokenId: string;
    tokenName: string;
    dc: number;
};

type ConcentrationMessage =
    | { type: "CHECK_NEEDED"; tokenId: string; tokenName: string; dc: number }
    | { type: "DISMISS"; tokenId: string };

export function useConcentrationNotifications() {
    const [checks, setChecks] = useState<ConcentrationCheck[]>([]);

    useEffect(() => {
        const unsubscribe = OBR.broadcast.onMessage(
            "com.battleboard.concentration",
            (event) => {
                const message = event.data as ConcentrationMessage;

                if (message.type === "CHECK_NEEDED") {
                    setChecks((prev) => {
                        // Check if this token already has a pending check
                        const existing = prev.find((c) => c.tokenId === message.tokenId);
                        if (existing) {
                            // Update the DC if it's higher
                            if (message.dc > existing.dc) {
                                return prev.map((c) =>
                                    c.tokenId === message.tokenId
                                        ? { tokenId: message.tokenId, tokenName: message.tokenName, dc: message.dc }
                                        : c
                                );
                            }
                            return prev; // Keep existing if new DC is lower
                        }
                        // Add new check
                        return [
                            ...prev,
                            { tokenId: message.tokenId, tokenName: message.tokenName, dc: message.dc },
                        ];
                    });
                } else if (message.type === "DISMISS") {
                    setChecks((prev) => prev.filter((c) => c.tokenId !== message.tokenId));
                }
            }
        );

        return unsubscribe;
    }, []);

    const dismiss = (tokenId: string) => {
        // Broadcast dismiss to all clients
        OBR.broadcast.sendMessage(
            "com.battleboard.concentration",
            {
                type: "DISMISS",
                tokenId,
            },
            { destination: "ALL" }
        );
    };

    return {
        checks,
        dismiss,
    };
}
