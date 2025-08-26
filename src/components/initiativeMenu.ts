import OBR from "@owlbear-rodeo/sdk";
import { META_KEY, createMetaForItem } from "./metadata";

export function registerInitiativeContextMenu() {
    const id = META_KEY + "/menu";

    OBR.contextMenu.create({
        id,
        icons: [
            {
                icon: "/add.svg",
                label: "Add to BattleBoard",
                filter: {
                    every: [
                        { key: "layer", value: "CHARACTER", coordinator: "||" },
                        { key: "layer", value: "MOUNT" },
                        { key: "type", value: "IMAGE" },
                        { key: ["metadata", META_KEY], value: undefined },
                    ],
                    permissions: ["UPDATE"],
                    roles: ["GM"],
                },
            },
            {
                icon: "/remove.svg",
                label: "Remove from BattleBoard",
                filter: {
                    every: [
                        { key: "layer", value: "CHARACTER", coordinator: "||" },
                        { key: "layer", value: "MOUNT" },
                        { key: "type", value: "IMAGE" },
                    ],
                    permissions: ["UPDATE"],
                    roles: ["GM"],
                },
            },
        ],
        onClick(context) {
            (async () => {
                await OBR.scene.items.updateItems(context.items, (items) => {
                    const add = items.every((it) => (it.metadata as any)[META_KEY] === undefined);

                    for (const it of items) {
                        if (add) {
                            (it.metadata as any)[META_KEY] = createMetaForItem(it);
                        } else {
                            delete (it.metadata as any)[META_KEY];
                        }
                    }
                });
            })();
        },
    });

    return () => { };
}
