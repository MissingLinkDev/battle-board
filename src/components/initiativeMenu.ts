import OBR from "@owlbear-rodeo/sdk";
import { META_KEY, createMetaForItem } from "./metadata";

export function registerInitiativeContextMenu() {
    const id = META_KEY + "/menu";
    const elevationId = META_KEY + "/elevation-menu";

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

                        // (meta === undefined) OR (inInitiative === false)
                        { key: ["metadata", META_KEY], value: undefined, coordinator: "||" },
                        { key: ["metadata", META_KEY, "inInitiative"], value: false },
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

                        // has meta (meta != undefined)
                        { key: ["metadata", META_KEY], value: undefined, operator: "!=" },

                        // not explicitly out of initiative (inInitiative != false)
                        { key: ["metadata", META_KEY, "inInitiative"], value: false, operator: "!=" },
                    ],
                    permissions: ["UPDATE"],
                    roles: ["GM"],
                },
            },
        ],
        onClick(context) {
            (async () => {
                await OBR.scene.items.updateItems(context.items, (items) => {
                    // Is this an ADD action? (no meta or meta.inInitiative === false)
                    const isAdd = items.every((it) => {
                        const meta = (it.metadata as any)[META_KEY];
                        return meta === undefined || meta?.inInitiative === false;
                    });

                    for (const it of items) {
                        const meta = (it.metadata as any)[META_KEY];
                        if (isAdd) {
                            if (!meta) {
                                (it.metadata as any)[META_KEY] = { ...createMetaForItem(it), inInitiative: true }; // create + mark in
                            } else {
                                meta.inInitiative = true; // revive existing config
                            }
                        } else {
                            if (meta) {
                                // keep everything, just mark out
                                meta.inInitiative = false;
                                meta.active = false; // sanity: ensure not active
                            }
                        }
                    }
                });
            })();
        },
    });

    // Create elevation context menu item
    OBR.contextMenu.create({
        id: elevationId,
        icons: [
            {
                icon: "/elevation.svg",
                label: "Set Elevation",
                filter: {
                    every: [
                        { key: "layer", value: "CHARACTER", coordinator: "||" },
                        { key: "layer", value: "MOUNT" },
                        { key: "type", value: "IMAGE" },
                        // Must have metadata (in initiative)
                        { key: ["metadata", META_KEY], value: undefined, operator: "!=" },
                    ],
                    permissions: ["UPDATE"],
                    roles: ["GM"],
                },
            },
        ],
        embed: {
            url: "/elevation.html",
            height: 56,
        },
    });

    return () => { };
}
