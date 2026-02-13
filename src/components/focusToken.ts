import OBR from "@owlbear-rodeo/sdk";
import type { CMToken } from "./tokens";

/**
 * Animate the viewport to center on a token's position in the scene.
 * Preserves the current zoom level.
 */
export async function focusToken(tokenId: string, tokens: CMToken[]): Promise<void> {
    const token = tokens.find((t) => t.id === tokenId);
    if (!token) return;

    const [scale, width, height] = await Promise.all([
        OBR.viewport.getScale(),
        OBR.viewport.getWidth(),
        OBR.viewport.getHeight(),
    ]);

    const position = {
        x: -token.position.x * scale + width / 2,
        y: -token.position.y * scale + height / 2,
    };

    await OBR.viewport.animateTo({ position, scale });
}
