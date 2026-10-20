import type { GridMeasurement, Item, Metadata, Vector2 } from "@owlbear-rodeo/sdk";

/**
 * The slice of the Owlbear Rodeo SDK that domain modules depend on.
 *
 * Two adapters satisfy it: `obrAdapter` (the real SDK, in production) and
 * `createFakeScene().connect()` (in-memory, in tests). Several fake clients can
 * share one fake scene to simulate multiple players in the same room.
 *
 * UI-only SDK calls (action height, viewport, theme, modals, context menus)
 * are deliberately not part of the port.
 */
export interface ObrPort {
    items: ItemsPort;
    sceneMetadata: MetadataPort;
    roomMetadata: MetadataPort;
    broadcast: BroadcastPort;
    player: PlayerPort;
    grid: GridPort;
}

export interface ItemsPort {
    /** All scene items, or just those with the given ids (missing ids are skipped). */
    get(ids?: string[]): Promise<Item[]>;
    /** Mutate the given items in place inside `update`. Missing ids are skipped. */
    update(ids: string[], update: (items: Item[]) => void): Promise<void>;
    add(items: Item[]): Promise<void>;
    delete(ids: string[]): Promise<void>;
    /** Fires with every scene item whenever any item changes, including this client's own writes. */
    onChange(callback: (items: Item[]) => void): Unsubscribe;
}

export interface MetadataPort {
    get(): Promise<Metadata>;
    /** Merges top-level keys into the existing metadata, like the SDK. */
    set(patch: Metadata): Promise<void>;
    onChange(callback: (metadata: Metadata) => void): Unsubscribe;
}

export type BroadcastDestination = "LOCAL" | "REMOTE" | "ALL";

export interface BroadcastPort {
    send(channel: string, data: unknown, destination: BroadcastDestination): Promise<void>;
    onMessage(channel: string, callback: (data: unknown) => void): Unsubscribe;
}

export type Role = "GM" | "PLAYER";

export interface PlayerPort {
    getRole(): Promise<Role>;
}

export interface GridPort {
    /** Pixels per grid cell. */
    getDpi(): Promise<number>;
    /** Scene units per cell and their label, e.g. 5 "ft". */
    getScale(): Promise<{ multiplier: number; unit: string }>;
    getMeasurement(): Promise<GridMeasurement>;
    /** Distance between two scene points in cells, by the grid's measurement rules. */
    getDistance(from: Vector2, to: Vector2): Promise<number>;
    onChange(callback: () => void): Unsubscribe;
}

export type Unsubscribe = () => void;
