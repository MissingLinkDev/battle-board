import { useEffect, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { connectedPlayerIds } from "../encounter/turnEndSync";
import { obrAdapter } from "../obr/obrAdapter";

/** This client's player id, and the ids of every connected player (this one included). */
export function usePlayerIdentity(): { playerId: string | null; connected: Set<string> } {
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [connected, setConnected] = useState<Set<string>>(new Set());

    useEffect(() => {
        let live = true;
        const update = async () => {
            const [id, role, party] = await Promise.all([OBR.player.getId(), OBR.player.getRole(), obrAdapter.party.getPlayers()]);
            if (!live) return;
            setPlayerId(id);
            setConnected(connectedPlayerIds([...party, { id, role }]));
        };
        update().catch(console.error);
        const unsubscribe = obrAdapter.party.onChange(() => void update().catch(console.error));
        return () => {
            live = false;
            unsubscribe();
        };
    }, []);

    return { playerId, connected };
}
