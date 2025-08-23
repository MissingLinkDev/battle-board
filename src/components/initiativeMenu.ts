import OBR, { isImage } from "@owlbear-rodeo/sdk";
import { META_KEY, type MetaShape } from "./metadata";

export function registerInitiativeContextMenu() {
    const id = META_KEY + "/menu";

    OBR.contextMenu.create({
        id,
        icons: [
            {
                icon: "/src/assets/add.svg",
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
                icon:
                    "/src/assets/remove.svg",
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
                            const displayName =
                                (isImage(it) && it.text.plainText) || (it as any).name;

                            (it.metadata as any)[META_KEY] = {
                                initiative: 0,
                                name: displayName,
                                active: false,
                                visible: it.visible,

                                ac: 10,
                                currentHP: 10,
                                maxHP: 10,
                                tempHP: 0,
                                conditions: [],

                                movement: 30,
                                attackRange: 0,  // default 0 so range ring won’t draw

                                elevation: 0,
                            } as MetaShape;
                        } else {
                            delete (it.metadata as any)[META_KEY];
                        }
                    }
                });
            })();
        },
    });

    // Return a sync cleanup (optional; remove API if available)
    return () => {
        // OBR.contextMenu.remove(id);
    };
}
