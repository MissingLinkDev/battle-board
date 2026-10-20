import { isImage, type Item } from "@owlbear-rodeo/sdk";
import { createMetaForItem, isMetadata, META_KEY, type MetaShape } from "../components/metadata";
import { getPluginId } from "../getPluginId";
import type { ObrPort, Unsubscribe } from "../obr/port";
import { memberIndex, toCombatant, type Combatant, type CombatantPatch } from "./combatant";
import { deriveGroups, newGroupId, type Group } from "./groups";
import * as turns from "./turnOrder";

export const SCENE_META_KEY = getPluginId("sceneState");
export const ITEM_ADDED_CHANNEL = "com.missing-link-dev.battle-board/item-added";

export type EncounterState = {
    /** True once items and scene state have loaded. */
    ready: boolean;
    /** Combatants in display order, which is the turn order (see turnOrder.ts). */
    combatants: Combatant[];
    groups: Group[];
    started: boolean;
    round: number;
};

export type GroupTarget =
    | { groupId: string }
    | { newGroup: { name: string; staged: boolean; initiative?: number } };

export type EncounterStore = ReturnType<typeof createEncounterStore>;

/**
 * The only writer of combatant data. Write-through (ADR-0004): commands write
 * token metadata and state is rebuilt only from Owlbear's change events.
 *
 * Commands work without subscribing, so other frames (the group modal, the
 * elevation popover) can create a store just to issue them.
 */
export function createEncounterStore(port: ObrPort) {
    let state: EncounterState = { ready: false, combatants: [], groups: [], started: false, round: 0 };
    const listeners = new Set<() => void>();
    let stopSync: Unsubscribe | null = null;

    function setState(next: Partial<EncounterState>) {
        state = { ...state, ...next };
        listeners.forEach((l) => l());
    }

    function applyItems(items: Item[]) {
        const combatants = combatantsOf(items);
        const groups = deriveGroups(combatants);
        setState({ combatants: turns.orderCombatants(combatants, groups), groups });
    }

    function applyScene(metadata: Record<string, unknown>) {
        setState(readClock(metadata));
    }

    function startSync() {
        const unsubItems = port.items.onChange(applyItems);
        const unsubScene = port.sceneMetadata.onChange(applyScene);
        Promise.all([port.items.get(), port.sceneMetadata.get()])
            .then(([items, scene]) => {
                applyItems(items);
                applyScene(scene);
                setState({ ready: true });
            })
            .catch(console.error);
        stopSync = () => {
            unsubItems();
            unsubScene();
        };
    }

    /** Current combatants and groups, read fresh from the scene. */
    async function snapshot() {
        const items = await port.items.get();
        const combatants = combatantsOf(items);
        return { items, combatants, groups: deriveGroups(combatants) };
    }

    /** `snapshot` plus the encounter clock, for turn commands. */
    async function turnSnapshot(): Promise<turns.TurnState> {
        const [{ combatants, groups }, scene] = await Promise.all([snapshot(), port.sceneMetadata.get()]);
        return { combatants, groups, ...readClock(scene) };
    }

    // Commands that can move the turn run one at a time, each on fresh state.
    let queue: Promise<unknown> = Promise.resolve();
    function exclusive<T>(operation: () => Promise<T>): Promise<T> {
        const run = queue.then(operation, operation);
        queue = run.catch(() => {});
        return run;
    }

    /**
     * One write that applies `edit` to `ids` and, when the turn moves, sets
     * exactly `change.activeIds` active; then the round, if it changed.
     */
    async function writeWithTurn(state: turns.TurnState, ids: string[], edit: (meta: MetaShape, item: Item) => void, change: turns.TurnChange | null) {
        const target = change ? new Set(change.activeIds) : null;
        const flips = target ? state.combatants.filter((c) => c.active !== target.has(c.id)).map((c) => c.id) : [];
        const touched = [...new Set([...ids, ...flips])];
        if (touched.length) {
            await port.items.update(touched, (items) => {
                for (const item of items) {
                    const meta = savedMeta(item);
                    if (!meta) continue;
                    if (target) meta.active = target.has(item.id);
                    if (ids.includes(item.id)) edit(meta, item);
                }
            });
        }
        if (change && change.round !== state.round) await setClock(true, change.round);
    }

    async function announceAdded(ids: string[]) {
        for (const id of ids) await port.broadcast.send(ITEM_ADDED_CHANNEL, id, "LOCAL");
    }

    /**
     * Take combatants out of initiative. Their tokens keep all saved data. If
     * the turn holder leaves, the turn passes on.
     */
    const remove = (ids: string[]) => exclusive(async () => {
        if (!ids.length) return;
        const state = await turnSnapshot();
        await writeWithTurn(state, ids, (meta) => {
            meta.inInitiative = false;
            meta.active = false;
        }, turns.afterLeaving(state, ids));
    });

    /** Write the encounter's started flag and round, touching only this extension's scene key. */
    async function setClock(started: boolean, round: number) {
        const scene = await port.sceneMetadata.get();
        const current = (scene[SCENE_META_KEY] as Record<string, unknown> | undefined) ?? {};
        await port.sceneMetadata.set({ [SCENE_META_KEY]: { ...current, started, round } });
    }

    return {
        getState: () => state,

        subscribe(listener: () => void): Unsubscribe {
            listeners.add(listener);
            if (!stopSync) startSync();
            return () => listeners.delete(listener);
        },

        /** Stop listening to the scene. */
        dispose() {
            stopSync?.();
            stopSync = null;
            listeners.clear();
        },

        /**
         * Put tokens into initiative, keeping any saved data. A token whose saved
         * group still has combatants rejoins it at the group's current initiative,
         * last in member order; a token whose saved group is empty brings the group
         * back as saved. `solo` drops saved group membership instead.
         */
        async add(tokenIds: string[], opts: { solo?: boolean } = {}) {
            if (!tokenIds.length) return;
            const adding = new Set(tokenIds);
            const { combatants } = await snapshot();
            const others = combatants.filter((c) => !adding.has(c.id));
            const groups = new Map(deriveGroups(others).map((g) => [g.id, g]));
            const nextIndex = nextIndexByGroup(others);

            await port.items.update(tokenIds, (items) => {
                for (const item of items) {
                    const meta = editableMeta(item);
                    meta.inInitiative = true;
                    meta.name = liveName(item) || meta.name;
                    if (opts.solo) {
                        clearGroup(meta);
                        meta.active = false;
                        continue;
                    }
                    const group = meta.groupId ? groups.get(meta.groupId) : undefined;
                    if (group) {
                        meta.initiative = group.initiative;
                        meta.groupName = group.name;
                        meta.groupStaged = group.staged;
                        meta.groupIndex = takeIndex(nextIndex, group.id);
                        meta.active = group.active;
                    } else {
                        meta.active = false;
                    }
                }
            });
            await announceAdded(tokenIds);
        },

        /**
         * Put tokens into an existing or new group (adding them to initiative if
         * needed). Members take the group's initiative and go last in member order.
         * Returns the group id.
         */
        async addToGroup(tokenIds: string[], target: GroupTarget, opts: { hideWhenStaged: boolean }): Promise<string> {
            const adding = new Set(tokenIds);
            const { combatants } = await snapshot();
            const wasCombatant = new Set(combatants.map((c) => c.id));
            const others = combatants.filter((c) => !adding.has(c.id));
            const nextIndex = nextIndexByGroup(others);

            const group = "groupId" in target
                ? deriveGroups(others).find((g) => g.id === target.groupId)
                    ?? { id: target.groupId, name: "New Group", initiative: 0, staged: false, active: false }
                : {
                    id: newGroupId(),
                    name: target.newGroup.name.trim() || "New Group",
                    initiative: Math.floor(target.newGroup.initiative ?? 0),
                    staged: target.newGroup.staged,
                    active: false,
                };

            await port.items.update(tokenIds, (items) => {
                for (const item of items) {
                    const meta = editableMeta(item);
                    meta.inInitiative = true;
                    meta.name = liveName(item) || meta.name;
                    setGroup(meta, group.id, group.name, group.staged);
                    meta.initiative = group.initiative;
                    meta.groupIndex = takeIndex(nextIndex, group.id);
                    meta.active = group.active;
                    if (group.staged && opts.hideWhenStaged) item.visible = false;
                }
            });
            await announceAdded(tokenIds.filter((id) => !wasCombatant.has(id)));
            return group.id;
        },

        remove,

        /** Remove every combatant and end the encounter. */
        clearAll: () => exclusive(async () => {
            const { combatants } = await snapshot();
            const ids = combatants.map((c) => c.id);
            if (ids.length) {
                await port.items.update(ids, (items) => {
                    for (const item of items) {
                        const meta = savedMeta(item);
                        if (!meta) continue;
                        meta.inInitiative = false;
                        meta.active = false;
                    }
                });
            }
            await setClock(false, 0);
        }),

        /** Edit combatant fields. Tokens without saved data are skipped. */
        async patch(ids: string | string[], fields: CombatantPatch) {
            const list = Array.isArray(ids) ? ids : [ids];
            if (!list.length || !Object.keys(fields).length) return;
            await port.items.update(list, (items) => {
                for (const item of items) {
                    const meta = savedMeta(item);
                    if (meta) Object.assign(meta, fields);
                }
            });
        },

        /**
         * Take combatants out of their groups. A token leaving a staged group can
         * be shown again. Leavers lose the turn unless they were the whole group.
         */
        leaveGroup: (ids: string[], opts: { showIfWasStaged: boolean }) => exclusive(async () => {
            const { groups } = await snapshot();
            const leaving = new Set(ids);
            const wholeGroupLeaves = new Set(
                groups.filter((g) => g.memberIds.every((id) => leaving.has(id))).flatMap((g) => g.memberIds),
            );
            await port.items.update(ids, (items) => {
                for (const item of items) {
                    const meta = savedMeta(item);
                    if (!meta) continue;
                    const wasStaged = !!meta.groupStaged;
                    clearGroup(meta);
                    if (!wholeGroupLeaves.has(item.id)) meta.active = false;
                    if (wasStaged && opts.showIfWasStaged) item.visible = true;
                }
            });
        }),

        /** Dissolve a group. If it held the turn, its first member keeps it. */
        ungroup: (groupId: string) => exclusive(async () => {
            const { groups } = await snapshot();
            const group = groups.find((g) => g.id === groupId);
            if (!group) return;
            const [first] = group.memberIds;
            await port.items.update(group.memberIds, (items) => {
                for (const item of items) {
                    const meta = savedMeta(item);
                    if (!meta) continue;
                    clearGroup(meta);
                    meta.active = group.active && item.id === first;
                }
            });
        }),

        async setGroupInitiative(groupId: string, initiative: number) {
            const { groups } = await snapshot();
            const group = groups.find((g) => g.id === groupId);
            if (!group) return;
            const whole = Math.floor(initiative);
            await port.items.update(group.memberIds, (items) => {
                for (const item of items) {
                    const meta = savedMeta(item);
                    if (!meta) continue;
                    meta.initiative = whole;
                    // Older saves keep member order in the decimal being overwritten here.
                    meta.groupIndex = group.memberIds.indexOf(item.id);
                }
            });
        },

        async renameGroup(groupId: string, name: string) {
            const { groups } = await snapshot();
            const group = groups.find((g) => g.id === groupId);
            if (!group) return;
            await port.items.update(group.memberIds, (items) => {
                for (const item of items) {
                    const meta = savedMeta(item);
                    if (meta) meta.groupName = name.trim() || group.name;
                }
            });
        },

        /**
         * Stage or release a group. Staging the group whose turn it is passes the
         * turn on; released members start inactive. Tokens hide/show when
         * `controlVisibility`.
         */
        setGroupStaged: (groupId: string, staged: boolean, opts: { controlVisibility: boolean }) => exclusive(async () => {
            const state = await turnSnapshot();
            const group = state.groups.find((g) => g.id === groupId);
            if (!group) return;
            await writeWithTurn(state, group.memberIds, (meta, item) => {
                meta.groupStaged = staged;
                meta.active = false;
                if (opts.controlVisibility) item.visible = !staged;
            }, staged ? turns.afterLeaving(state, group.memberIds) : null);
        }),

        /** Begin the encounter at the first turn of round 1. */
        start: () => exclusive(async () => {
            const state = await turnSnapshot();
            const change = turns.start(state);
            if (!change) return;
            await writeWithTurn(state, [], () => {}, change);
            await setClock(true, 1);
        }),

        /** End the encounter: nobody active, round 0. */
        end: () => exclusive(async () => {
            const state = await turnSnapshot();
            await writeWithTurn(state, [], () => {}, { activeIds: [], round: state.round });
            await setClock(false, 0);
        }),

        next: () => exclusive(async () => {
            const state = await turnSnapshot();
            await writeWithTurn(state, [], () => {}, turns.next(state));
        }),

        prev: () => exclusive(async () => {
            const state = await turnSnapshot();
            await writeWithTurn(state, [], () => {}, turns.prev(state));
        }),
    };
}

export function readClock(metadata: Record<string, unknown>): { started: boolean; round: number } {
    const raw = metadata[SCENE_META_KEY] as { started?: unknown; round?: unknown } | undefined;
    return {
        started: raw?.started === true,
        round: typeof raw?.round === "number" ? raw.round : 0,
    };
}

/** Combatants in the scene, unordered. */
export function combatantsOf(items: Item[]): Combatant[] {
    const list: Combatant[] = [];
    for (const item of items) {
        if (!isImage(item)) continue;
        const c = toCombatant(item);
        if (c) list.push(c);
    }
    return list;
}

function liveName(item: Item): string {
    const img = item as Item & { text?: { plainText?: string } };
    return img.text?.plainText || item.name || "";
}

/** The item's saved data for in-place editing, or undefined if it has none. */
function savedMeta(item: Item): MetaShape | undefined {
    const raw = (item.metadata as Record<string, unknown>)[META_KEY];
    return isMetadata(raw) ? raw : undefined;
}

/** The item's saved data for in-place editing, created with defaults if missing. */
function editableMeta(item: Item): MetaShape {
    const existing = savedMeta(item);
    if (existing) {
        // Carry the oldest save format's group over before group fields are rewritten.
        if (!existing.groupId && existing.encounterGroups?.length) existing.groupId = existing.encounterGroups[0];
        delete existing.encounterGroups;
        return existing;
    }
    const created = createMetaForItem(item);
    (item.metadata as Record<string, unknown>)[META_KEY] = created;
    return created;
}

function setGroup(meta: MetaShape, id: string, name: string, staged: boolean) {
    meta.groupId = id;
    meta.groupName = name;
    meta.groupStaged = staged;
    delete meta.encounterGroups;
}

function clearGroup(meta: MetaShape) {
    meta.groupId = null;
    meta.groupName = null;
    meta.groupStaged = false;
    meta.groupIndex = null;
    // Otherwise readMeta would fall back to the legacy group.
    delete meta.encounterGroups;
}

function nextIndexByGroup(combatants: Combatant[]): Map<string, number> {
    const next = new Map<string, number>();
    for (const c of combatants) {
        if (!c.groupId) continue;
        next.set(c.groupId, Math.max(next.get(c.groupId) ?? 0, memberIndex(c) + 1));
    }
    return next;
}

function takeIndex(next: Map<string, number>, groupId: string): number {
    const i = next.get(groupId) ?? 0;
    next.set(groupId, i + 1);
    return i;
}
