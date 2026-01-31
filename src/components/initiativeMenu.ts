import OBR from "@owlbear-rodeo/sdk";
import { META_KEY, createMetaForItem } from "./metadata";

const MODAL_ID = META_KEY + "/group-modal";

export function registerInitiativeContextMenu() {
    const addSoloId = META_KEY + "/menu";
    const addGroupId = META_KEY + "/add-group-menu";
    const removeId = META_KEY + "/remove-menu";
    const elevationId = META_KEY + "/elevation-menu";

    // "Add Solo" - adds token directly to the battleboard
    OBR.contextMenu.create({
        id: addSoloId,
        icons: [
            {
                icon: "/add.svg",
                label: "Add to BattleBoard Solo",
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
        ],
        onClick(context) {
            (async () => {
                await OBR.scene.items.updateItems(context.items, (items) => {
                    for (const it of items) {
                        const meta = (it.metadata as any)[META_KEY];
                        if (!meta) {
                            (it.metadata as any)[META_KEY] = { ...createMetaForItem(it), inInitiative: true };
                        } else {
                            meta.inInitiative = true;
                        }
                    }
                });
            })();
        },
    });

    // "Add to Group" - adds token to battleboard and opens group selection modal
    OBR.contextMenu.create({
        id: addGroupId,
        icons: [
            {
                icon: "/add.svg",
                label: "Add to BattleBoard Group",
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
        ],
        onClick(context) {
            (async () => {
                // Store token IDs in player metadata for the modal to read
                // Don't add to initiative yet - modal will handle that after group selection
                const tokenIds = context.items.map(item => item.id);
                await OBR.player.setMetadata({ [META_KEY + "/pendingGroupTokens"]: tokenIds });

                // Open the group selection modal
                await OBR.modal.open({
                    id: MODAL_ID,
                    url: "/groupmodal.html",
                    height: 300,
                    width: 400,
                });
            })();
        },
    });

    // "Remove from BattleBoard" - separate click action
    OBR.contextMenu.create({
        id: removeId,
        icons: [
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
                    for (const it of items) {
                        const meta = (it.metadata as any)[META_KEY];
                        if (meta) {
                            meta.inInitiative = false;
                            meta.active = false;
                            meta.groupId = null;
                            meta.groupName = null;
                            meta.groupStaged = false;
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
