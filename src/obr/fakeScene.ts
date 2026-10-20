import type { Item, Metadata } from "@owlbear-rodeo/sdk";
import type { BroadcastDestination, ObrPort, Role, Unsubscribe } from "./port";

/**
 * In-memory adapter for `ObrPort`. One fake scene is the shared room; each
 * `connect()` returns a port for one client. Change events are delivered
 * asynchronously, so tests should `await flush()` before asserting on what
 * subscribers saw. No ordering between a write's promise and its change event
 * is promised, matching what callers may assume of the real SDK.
 */
export function createFakeScene(initial: { items?: Item[]; sceneMetadata?: Metadata; roomMetadata?: Metadata } = {}) {
    let items: Item[] = clone(initial.items ?? []);
    let sceneMetadata: Metadata = clone(initial.sceneMetadata ?? {});
    let roomMetadata: Metadata = clone(initial.roomMetadata ?? {});

    const itemListeners = new Set<(items: Item[]) => void>();
    const sceneListeners = new Set<(m: Metadata) => void>();
    const roomListeners = new Set<(m: Metadata) => void>();
    const clients: { id: number; messages: Map<string, Set<(data: unknown) => void>> }[] = [];
    /** Every write applied to the scene, in order. Lets tests count round-trips. */
    const writes: { kind: "items.update" | "items.add" | "items.delete" | "sceneMetadata" | "roomMetadata"; ids?: string[] }[] = [];

    const emit = <T>(listeners: Set<(v: T) => void>, value: () => T) => {
        queueMicrotask(() => listeners.forEach((l) => l(value())));
    };
    const emitItems = () => emit(itemListeners, () => clone(items));

    const subscribe = <T>(listeners: Set<T>, cb: T): Unsubscribe => {
        listeners.add(cb);
        return () => listeners.delete(cb);
    };

    function connect(role: Role = "GM"): ObrPort {
        const client = { id: clients.length, messages: new Map<string, Set<(data: unknown) => void>>() };
        clients.push(client);

        return {
            items: {
                async get(ids) {
                    const wanted = ids ? new Set(ids) : null;
                    return clone(wanted ? items.filter((i) => wanted.has(i.id)) : items);
                },
                async update(ids, update) {
                    const wanted = new Set(ids);
                    const drafts = clone(items.filter((i) => wanted.has(i.id)));
                    update(drafts);
                    const byId = new Map(drafts.map((d) => [d.id, d]));
                    items = items.map((i) => byId.get(i.id) ?? i);
                    writes.push({ kind: "items.update", ids: drafts.map((d) => d.id) });
                    emitItems();
                },
                async add(added) {
                    items = [...items, ...clone(added)];
                    writes.push({ kind: "items.add", ids: added.map((i) => i.id) });
                    emitItems();
                },
                async delete(ids) {
                    const gone = new Set(ids);
                    items = items.filter((i) => !gone.has(i.id));
                    writes.push({ kind: "items.delete", ids });
                    emitItems();
                },
                onChange: (cb) => subscribe(itemListeners, cb),
            },
            sceneMetadata: {
                get: async () => clone(sceneMetadata),
                async set(patch) {
                    sceneMetadata = { ...sceneMetadata, ...clone(patch) };
                    writes.push({ kind: "sceneMetadata" });
                    emit(sceneListeners, () => clone(sceneMetadata));
                },
                onChange: (cb) => subscribe(sceneListeners, cb),
            },
            roomMetadata: {
                get: async () => clone(roomMetadata),
                async set(patch) {
                    roomMetadata = { ...roomMetadata, ...clone(patch) };
                    writes.push({ kind: "roomMetadata" });
                    emit(roomListeners, () => clone(roomMetadata));
                },
                onChange: (cb) => subscribe(roomListeners, cb),
            },
            broadcast: {
                async send(channel, data, destination: BroadcastDestination) {
                    for (const c of clients) {
                        const isSelf = c === client;
                        if (destination === "LOCAL" && !isSelf) continue;
                        if (destination === "REMOTE" && isSelf) continue;
                        const listeners = c.messages.get(channel);
                        if (listeners) queueMicrotask(() => listeners.forEach((l) => l(clone(data))));
                    }
                },
                onMessage(channel, cb) {
                    if (!client.messages.has(channel)) client.messages.set(channel, new Set());
                    return subscribe(client.messages.get(channel)!, cb);
                },
            },
            player: {
                getRole: async () => role,
            },
        };
    }

    return {
        connect,
        writes,
        /** Synchronous peek at scene state, for assertions. */
        peek: () => ({ items: clone(items), sceneMetadata: clone(sceneMetadata), roomMetadata: clone(roomMetadata) }),
    };
}

/** Resolve after all queued change events have been delivered. */
export function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function clone<T>(value: T): T {
    return value === undefined ? value : structuredClone(value);
}
