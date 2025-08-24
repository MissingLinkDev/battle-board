import OBR, { isImage } from "@owlbear-rodeo/sdk";
import { META_KEY, type MetaShape } from "./metadata";



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
                icon:
                    "/remove.svg",
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
                                attackRange: 60,

                                playerCharacter: false,
                                movementColor: "#519e00", // DEFAULT_MOVE_COLOR
                                rangeColor: "#fe4c50",    // DEFAULT_RANGE_COLOR
                                movementWeight: 12,    // e.g. 4..16
                                rangeWeight: 12,

                                movementPattern: "dash",
                                rangePattern: "dash",

                                movementOpacity: 1,   // 0..1
                                rangeOpacity: 1,
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
