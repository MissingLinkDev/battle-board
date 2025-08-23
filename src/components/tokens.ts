// src/tokens.ts
import OBR, { isImage, type Item } from "@owlbear-rodeo/sdk";

export type CMToken = {
    id: string;
    name: string;
    layer: "CHARACTER" | "MOUNT";
    position: { x: number; y: number };
    attachedTo?: string | null;
};

export function itemsToCMTokens(items: Item[]): CMToken[] {
    const list: CMToken[] = [];
    for (const it of items) {
        if (!isImage(it)) continue;
        if (it.layer !== "CHARACTER" && it.layer !== "MOUNT") continue;
        list.push({
            id: it.id,
            name: it.name ?? "",
            layer: it.layer as "CHARACTER" | "MOUNT",
            position: { ...it.position },
            attachedTo: it.attachedTo ?? null,
        });
    }
    return list;
}

export async function getCMTokens(): Promise<CMToken[]> {
    return itemsToCMTokens(await OBR.scene.items.getItems());
}

export function onCMTokensChange(cb: (tokens: CMToken[]) => void) {
    const handle = (items: Item[]) => cb(itemsToCMTokens(items));
    OBR.scene.items.getItems().then((items) => cb(itemsToCMTokens(items)));
    return OBR.scene.items.onChange(handle);
}
