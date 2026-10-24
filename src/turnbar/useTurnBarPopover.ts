import { useEffect, useMemo } from "react";
import OBR, { type Popover } from "@owlbear-rodeo/sdk";
import { useEncounter } from "../encounter";
import { barCombatants } from "../encounter/turnResources";
import { getPluginId } from "../getPluginId";
import type { InitiativeSettings } from "../settings";
import { useTurnBarPreferences, type TurnBarPosition } from "./preferences";

export const TURN_BAR_POPOVER_ID = getPluginId("turn-bar");
/** Starting size; the bar resizes the popover to fit its content once drawn. */
const INITIAL_WIDTH = 460;
const INITIAL_HEIGHT = 56;

/** Clearance from the screen edge, leaving room for Owlbear's own toolbars at the sides. */
const EDGE = 16;
const SIDE_CLEARANCE = 72;

async function placement(position: TurnBarPosition): Promise<Pick<Popover, "anchorPosition" | "transformOrigin">> {
    const [width, height] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
    switch (position) {
        case "top-center":
            return { anchorPosition: { left: width / 2, top: EDGE }, transformOrigin: { horizontal: "CENTER", vertical: "TOP" } };
        default:
            return { anchorPosition: { left: SIDE_CLEARANCE, top: height - EDGE }, transformOrigin: { horizontal: "LEFT", vertical: "BOTTOM" } };
        case "bottom-right":
            return { anchorPosition: { left: width - SIDE_CLEARANCE, top: height - EDGE }, transformOrigin: { horizontal: "RIGHT", vertical: "BOTTOM" } };
        case "bottom-center":
            return { anchorPosition: { left: width / 2, top: height - EDGE }, transformOrigin: { horizontal: "CENTER", vertical: "BOTTOM" } };
    }
}

/**
 * Show the turn bar to a player while the encounter runs and they own a
 * combatant in it, unless the GM has the setting off or they hid it.
 */
export function useTurnBarPopover(role: "GM" | "PLAYER", playerId: string | null, settings: InitiativeSettings) {
    const encounter = useEncounter();
    const { position, hidden } = useTurnBarPreferences();
    const ownsCombatant = useMemo(
        () => !!playerId && barCombatants(encounter, playerId).length > 0,
        [encounter, playerId],
    );
    const show = role === "PLAYER" && settings.turnBar && encounter.started && ownsCombatant && !hidden;

    useEffect(() => {
        if (!show) return;
        let live = true;
        placement(position)
            .then((place) => {
                if (!live) return;
                return OBR.popover.open({
                    id: TURN_BAR_POPOVER_ID,
                    url: "/turnbar.html",
                    width: INITIAL_WIDTH,
                    height: INITIAL_HEIGHT,
                    anchorReference: "POSITION",
                    disableClickAway: true,
                    ...place,
                });
            })
            .catch(console.error);
        return () => {
            live = false;
            OBR.popover.close(TURN_BAR_POPOVER_ID).catch(console.error);
        };
    }, [show, position]);
}
