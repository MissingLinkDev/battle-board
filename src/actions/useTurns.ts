import OBR from "@owlbear-rodeo/sdk";
import { META_KEY, isMetadata } from "../components/metadata";
import { clearRings } from "../components/rings";
import { setGroupActive, clearAllGroupsActive, getGroups } from "../components/SceneState";
import type { InitiativeItem } from "../components/InitiativeItem";
import type { Group } from "../components/SceneState";

/* ============================================================================
   Turn Cycling Lock - Prevents concurrent turn operations
   ============================================================================ */

/**
 * Async mutex for turn cycling operations with state version tracking.
 * Ensures only one turn operation executes at a time and provides version
 * validation to detect stale state mutations.
 */
class TurnCyclingLock {
    private locked = false;
    private stateVersion = 0;
    private waitQueue: Array<() => void> = [];

    /**
     * Execute an operation exclusively with version tracking.
     * Only one operation can run at a time; others wait in queue.
     */
    async executeExclusive<T>(operation: (version: number) => Promise<T>): Promise<T | undefined> {
        // Wait for lock to be available
        while (this.locked) {
            await new Promise<void>(resolve => {
                this.waitQueue.push(resolve);
            });
        }

        this.locked = true;
        const currentVersion = ++this.stateVersion;

        try {
            return await operation(currentVersion);
        } finally {
            this.locked = false;
            // Wake up next waiter
            const next = this.waitQueue.shift();
            if (next) next();
        }
    }

    /**
     * Check if a version number is still current (no newer operations have started)
     */
    isVersionCurrent(version: number): boolean {
        return version === this.stateVersion;
    }

    /**
     * Get current lock state (for debugging)
     */
    isLocked(): boolean {
        return this.locked;
    }
}

// Shared lock instance for turn cycling
const turnLock = new TurnCyclingLock();

/* ============================================================================
   Turn Management
   ============================================================================ */

// Helper type for turn management
type TurnItem = {
    type: 'group';
    group: Group;
    memberIds: string[];
} | {
    type: 'individual';
    itemId: string;
};

// Single source of truth for getting current initiative state
async function getCurrentInitiativeState(): Promise<{
    items: Map<string, InitiativeItem>;
    groups: Group[];
    turnOrder: TurnItem[];
    activeIndex: number;
}> {
    // Get fresh groups from scene state
    const groups = await getGroups();

    // Get fresh items from OBR
    const obrItems = await OBR.scene.items.getItems();
    const items = new Map<string, InitiativeItem>();

    for (const item of obrItems) {
        const meta = (item.metadata as any)?.[META_KEY];
        if (meta && isMetadata(meta) && meta.inInitiative !== false) {
            items.set(item.id, {
                id: item.id,
                name: meta.name || "",
                initiative: meta.initiative || 0,
                active: meta.active || false,
                visible: item.visible !== false,
                ac: meta.ac || 0,
                currentHP: meta.currentHP || 0,
                maxHP: meta.maxHP || 0,
                tempHP: meta.tempHP || 0,
                movement: meta.movement || 30,
                attackRange: meta.attackRange || 60,
                elevation: meta.elevation || 0,
                playerCharacter: meta.playerCharacter || false,
                groupId: meta.groupId || null,
                movementColor: meta.movementColor,
                rangeColor: meta.rangeColor,
                movementWeight: meta.movementWeight,
                rangeWeight: meta.rangeWeight,
                movementPattern: meta.movementPattern,
                rangePattern: meta.rangePattern,
                movementOpacity: meta.movementOpacity,
                rangeOpacity: meta.rangeOpacity,
                dmPreview: meta.dmPreview,
                inInitiative: meta.inInitiative,
            });
        }
    }

    // Build turn order
    const turnOrder: TurnItem[] = [];
    const usedItemIds = new Set<string>();

    // Add non-staged groups
    for (const group of groups) {
        if (!group.staged) {
            const memberIds: string[] = [];
            for (const [id, item] of items) {
                if (item.groupId === group.id) {
                    memberIds.push(id);
                    usedItemIds.add(id);
                }
            }
            if (memberIds.length > 0) {
                turnOrder.push({
                    type: 'group',
                    group,
                    memberIds
                });
            }
        }
    }

    // Add ungrouped individuals
    for (const [id, item] of items) {
        if (!usedItemIds.has(id) && !item.groupId) {
            turnOrder.push({
                type: 'individual',
                itemId: id
            });
        }
    }

    // Sort by initiative
    turnOrder.sort((a, b) => {
        const aInit = a.type === 'group' ? a.group.initiative : items.get(a.itemId)?.initiative || 0;
        const bInit = b.type === 'group' ? b.group.initiative : items.get(b.itemId)?.initiative || 0;

        const af = Math.floor(aInit);
        const bf = Math.floor(bInit);

        if (bf !== af) return bf - af;
        if (aInit !== bInit) return aInit - bInit;

        const aName = a.type === 'group' ? a.group.name : items.get(a.itemId)?.name || "";
        const bName = b.type === 'group' ? b.group.name : items.get(b.itemId)?.name || "";
        return aName.localeCompare(bName);
    });

    // Find current active index
    let activeIndex = -1;
    for (let i = 0; i < turnOrder.length; i++) {
        const turn = turnOrder[i];
        if (turn.type === 'group') {
            if (turn.group.active) {
                activeIndex = i;
                break;
            }
        } else {
            const item = items.get(turn.itemId);
            if (item?.active) {
                activeIndex = i;
                break;
            }
        }
    }

    return { items, groups, turnOrder, activeIndex };
}

// Single atomic update for setting active turn
async function setActiveTurn(
    turnItem: TurnItem | null,
    allItemIds: string[],
    setRows: React.Dispatch<React.SetStateAction<InitiativeItem[]>>
) {
    // First, clear all groups' active state
    await clearAllGroupsActive();

    // Prepare the OBR update - all items set to inactive first
    const updates: { [id: string]: boolean } = {};
    for (const id of allItemIds) {
        updates[id] = false;
    }

    // Then set the new active item(s)
    if (turnItem) {
        if (turnItem.type === 'group') {
            // Set group as active in scene state
            await setGroupActive(turnItem.group.id, true);
            // Mark all group members as active
            for (const memberId of turnItem.memberIds) {
                updates[memberId] = true;
            }
        } else {
            // Mark individual as active
            updates[turnItem.itemId] = true;
        }
    }

    // Single atomic update to OBR
    await OBR.scene.items.updateItems(allItemIds, (items) => {
        for (const item of items) {
            const meta = (item.metadata as any)?.[META_KEY];
            if (meta) {
                meta.active = updates[item.id] || false;
            }
        }
    });

    // Update local state to match
    setRows(prev => prev.map(row => ({
        ...row,
        active: updates[row.id] || false
    })));
}

export function useTurns(
    setRows: React.Dispatch<React.SetStateAction<InitiativeItem[]>>,
    round: number,
    setRound: (n: number) => void,
    started: boolean,
    setStarted: (b: boolean) => void,
    saveSceneState: (started: boolean, round: number) => Promise<void>,
) {
    const handleStart = async () => {
        await turnLock.executeExclusive(async (version) => {
            // Fetch state under lock
            const state = await getCurrentInitiativeState();
            if (state.turnOrder.length === 0) return;

            // Verify version is still current
            if (!turnLock.isVersionCurrent(version)) return;

            // Set first item as active
            const allItemIds = Array.from(state.items.keys());
            await setActiveTurn(state.turnOrder[0], allItemIds, setRows);

            // Update round and started state
            setRound(1);
            setStarted(true);
            await saveSceneState(true, 1);
        });
    };

    const handleEnd = async () => {
        await turnLock.executeExclusive(async (version) => {
            // Fetch state under lock
            const state = await getCurrentInitiativeState();
            const allItemIds = Array.from(state.items.keys());

            // Verify version is still current
            if (!turnLock.isVersionCurrent(version)) return;

            // Clear all active states
            await setActiveTurn(null, allItemIds, setRows);

            // Clear rings and reset state
            await clearRings("normal");
            setRound(0);
            setStarted(false);
            await saveSceneState(false, 0);
        });
    };

    const handleNext = async () => {
        if (!started) return;

        await turnLock.executeExclusive(async (version) => {
            // Fetch state under lock
            const state = await getCurrentInitiativeState();
            if (state.turnOrder.length === 0) return;

            // Calculate next index
            let nextIndex: number;
            let shouldIncrementRound = false;

            if (state.activeIndex === -1) {
                nextIndex = 0;
            } else {
                nextIndex = (state.activeIndex + 1) % state.turnOrder.length;
                shouldIncrementRound = (nextIndex === 0);
            }

            // Verify version before mutation
            if (!turnLock.isVersionCurrent(version)) return;

            // Set the new active turn
            const allItemIds = Array.from(state.items.keys());
            await setActiveTurn(state.turnOrder[nextIndex], allItemIds, setRows);

            // Update round if we wrapped
            if (shouldIncrementRound) {
                const newRound = round + 1;
                setRound(newRound);
                await saveSceneState(true, newRound);
            }
        });
    };

    const handlePrev = async () => {
        if (!started) return;

        await turnLock.executeExclusive(async (version) => {
            // Fetch state under lock
            const state = await getCurrentInitiativeState();
            if (state.turnOrder.length === 0) return;

            // Calculate previous index
            let prevIndex: number;
            let shouldDecrementRound = false;

            if (state.activeIndex === -1) {
                prevIndex = state.turnOrder.length - 1;
            } else if (state.activeIndex === 0) {
                prevIndex = state.turnOrder.length - 1;
                shouldDecrementRound = true;
            } else {
                prevIndex = state.activeIndex - 1;
            }

            // Verify version before mutation
            if (!turnLock.isVersionCurrent(version)) return;

            // Set the new active turn
            const allItemIds = Array.from(state.items.keys());
            await setActiveTurn(state.turnOrder[prevIndex], allItemIds, setRows);

            // Update round if we wrapped backward
            if (shouldDecrementRound && round > 1) {
                const newRound = round - 1;
                setRound(newRound);
                await saveSceneState(true, newRound);
            }
        });
    };

    return { handleStart, handleEnd, handleNext, handlePrev };
}