import type { ObrPort } from "../obr/port";
import type { Combatant } from "./combatant";
import { concentrationAudience } from "./health";

export const CONCENTRATION_CHANNEL = "com.battleboard.concentration";

export type ConcentrationMessage =
    | { type: "CHECK_NEEDED"; tokenId: string; tokenName: string; dc: number }
    | { type: "DISMISS"; tokenId: string };

/** Tell the right audience that `c` must make a concentration check (see `concentrationAudience`). */
export function announceConcentrationCheck(port: ObrPort, c: Pick<Combatant, "id" | "name" | "playerCharacter">, dc: number) {
    const message: ConcentrationMessage = { type: "CHECK_NEEDED", tokenId: c.id, tokenName: c.name, dc };
    return port.broadcast.send(CONCENTRATION_CHANNEL, message, concentrationAudience(c));
}
