import OBR from "@owlbear-rodeo/sdk";
import type { ObrPort } from "./port";

// The SDK types drafts as immer `Draft<Item>`; they are mutable Items in practice.
type SdkItemUpdate = Parameters<typeof OBR.scene.items.updateItems>[1];

/** The production adapter: forwards the port to the real Owlbear Rodeo SDK. */
export const obrAdapter: ObrPort = {
    items: {
        get: (ids) => (ids ? OBR.scene.items.getItems(ids) : OBR.scene.items.getItems()),
        update: (ids, update) => OBR.scene.items.updateItems(ids, update as SdkItemUpdate),
        add: (items) => OBR.scene.items.addItems(items),
        delete: (ids) => OBR.scene.items.deleteItems(ids),
        onChange: (callback) => OBR.scene.items.onChange(callback),
    },
    sceneMetadata: {
        get: () => OBR.scene.getMetadata(),
        set: (patch) => OBR.scene.setMetadata(patch),
        onChange: (callback) => OBR.scene.onMetadataChange(callback),
    },
    roomMetadata: {
        get: () => OBR.room.getMetadata(),
        set: (patch) => OBR.room.setMetadata(patch),
        onChange: (callback) => OBR.room.onMetadataChange(callback),
    },
    broadcast: {
        send: (channel, data, destination) => OBR.broadcast.sendMessage(channel, data, { destination }),
        onMessage: (channel, callback) => OBR.broadcast.onMessage(channel, (event) => callback(event.data)),
    },
    player: {
        getRole: () => OBR.player.getRole(),
    },
};
