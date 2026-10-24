import type { Image } from "@owlbear-rodeo/sdk";

/**
 * A character token as it would sit on the map, optionally carrying saved metadata.
 * Built by hand because the SDK's builders need a live Owlbear connection.
 */
export function makeToken(opts: {
    id: string;
    name?: string;
    metadata?: Record<string, unknown>;
    visible?: boolean;
    layer?: "CHARACTER" | "MOUNT";
    position?: { x: number; y: number };
    /** The owning player's id (`createdUserId`). */
    owner?: string;
}): Image {
    return {
        id: opts.id,
        type: "IMAGE",
        name: opts.name ?? opts.id,
        visible: opts.visible ?? true,
        locked: false,
        createdUserId: opts.owner ?? "test-user",
        zIndex: 0,
        lastModified: "2026-01-01T00:00:00.000Z",
        lastModifiedUserId: "test-user",
        layer: opts.layer ?? "CHARACTER",
        position: opts.position ?? { x: 0, y: 0 },
        rotation: 0,
        scale: { x: 1, y: 1 },
        metadata: (opts.metadata ?? {}) as Image["metadata"],
        image: { url: `https://example.test/${opts.id}.png`, mime: "image/png", width: 300, height: 300 },
        grid: { dpi: 300, offset: { x: 150, y: 150 } },
        text: {
            richText: [],
            plainText: "",
            style: {
                padding: 8, fontFamily: "Roboto", fontSize: 24, fontWeight: 400, textAlign: "CENTER",
                textAlignVertical: "BOTTOM", fillColor: "white", fillOpacity: 1, strokeColor: "white",
                strokeOpacity: 1, strokeWidth: 0, lineHeight: 1.5,
            },
            type: "PLAIN",
            width: "AUTO",
            height: "AUTO",
        },
        textItemType: "LABEL",
    } as Image;
}
