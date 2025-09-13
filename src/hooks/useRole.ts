import { useEffect, useState } from "react";
import OBR, { type Player } from "@owlbear-rodeo/sdk";

export function useRole() {
    const [role, setRole] = useState<"GM" | "PLAYER">("PLAYER");

    useEffect(() => {
        const onPlayer = (p: Player) => setRole(p.role);
        OBR.player.getRole().then(setRole);
        return OBR.player.onChange(onPlayer);
    }, []);

    return role;
}
