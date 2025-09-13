import OBR, { isImage } from "@owlbear-rodeo/sdk";
import { createMetaForItem, isMetadata, META_KEY, readMeta } from "../components/metadata";
import { getGroups } from "../components/SceneState";
import type { InitiativeItem } from "../components/InitiativeItem";
import type { CMToken } from "../components/tokens";

export function useAddAll(rows: InitiativeItem[], cmTokens: CMToken[]) {
    return async function handleAddAll(addHidden: boolean = true) {
        const existingIds = new Set(rows.map((r) => r.id));
        const idsToAdd = cmTokens
            .filter((t) => !existingIds.has(t.id) && (addHidden || t.visible !== false))
            .map((t) => t.id);

        if (!idsToAdd.length) return;

        // Get current groups to sync initiatives properly
        const groups = await getGroups();
        const groupsById = new Map(groups.map(g => [g.id, g]));

        await OBR.scene.items.updateItems(idsToAdd, (items) => {
            for (const it of items) {
                const current = (it.metadata as any)[META_KEY];
                if (!isMetadata(current)) {
                    const newMeta = createMetaForItem(it);

                    // Check if this token should be part of a group (from existing metadata)
                    const existingMeta = readMeta(it);
                    if (existingMeta?.groupId) {
                        const group = groupsById.get(existingMeta.groupId);
                        if (group) {
                            // Sync initiative with the group
                            newMeta.initiative = group.initiative;
                            newMeta.groupId = existingMeta.groupId;
                        }
                    }

                    (it.metadata as any)[META_KEY] = {
                        ...newMeta,
                        inInitiative: true,
                    };
                    continue;
                }

                // Token already has metadata, just mark as in initiative
                current.inInitiative = true;

                // Sync initiative with group if the token belongs to one
                if (current.groupId) {
                    const group = groupsById.get(current.groupId);
                    if (group) {
                        current.initiative = group.initiative;
                    }
                }

                // Update display name
                const displayName =
                    (isImage(it) && (it as any).text?.plainText) || (it as any).name || current.name || "Unnamed";
                current.name = displayName;
            }
        });
    };
}