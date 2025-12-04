import OBR from "@owlbear-rodeo/sdk";
import { META_KEY } from "../components/metadata";

export async function removeFromInitiative(id: string) {
    await OBR.scene.items.updateItems([id], (items) => {
        const it: any = items[0];
        const meta = (it.metadata ?? {})[META_KEY];
        if (meta) {
            meta.inInitiative = false;
            meta.active = false;
            meta.groupId = null;      // Clear group association
            meta.initiative = 0;      // Reset initiative
            it.metadata = { ...(it.metadata ?? {}), [META_KEY]: { ...meta } };
        }
    });
}
