import OBR, { type Player } from "@owlbear-rodeo/sdk";
import type { ObrPort, PartyMember } from "./port";

// The SDK types drafts as immer `Draft<Item>`; they are mutable Items in practice.
type SdkItemUpdate = Parameters<typeof OBR.scene.items.updateItems>[1];

const toMember = (p: Player): PartyMember => ({ id: p.id, role: p.role });

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
        getId: () => OBR.player.getId(),
    },
    party: {
        getPlayers: async () => (await OBR.party.getPlayers()).map(toMember),
        onChange: (callback) => OBR.party.onChange((players) => callback(players.map(toMember))),
    },
    grid: {
        getDpi: () => OBR.scene.grid.getDpi(),
        getScale: async () => {
            const scale = await OBR.scene.grid.getScale();
            return { multiplier: scale.parsed?.multiplier ?? 5, unit: String(scale.parsed?.unit ?? "ft") };
        },
        getMeasurement: () => OBR.scene.grid.getMeasurement(),
        getDistance: (from, to) => OBR.scene.grid.getDistance(from, to),
        onChange: (callback) => OBR.scene.grid.onChange(() => callback()),
    },
};
