import OBR from "@owlbear-rodeo/sdk";
import { META_KEY } from "../components/metadata";

export async function removeFromInitiative(id: string) {
    await OBR.scene.items.updateItems([id], (items) => {
        const it: any = items[0];
        const meta = (it.metadata ?? {})[META_KEY];
        if (meta) {
            meta.inInitiative = false;
            meta.active = false;
            it.metadata = { ...(it.metadata ?? {}), [META_KEY]: { ...meta } };
        }
    });
}
