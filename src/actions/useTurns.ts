import OBR from "@owlbear-rodeo/sdk";
import { META_KEY, isMetadata } from "../components/metadata";
import { clearRings } from "../components/rings";
import { setGroupActive, clearAllGroupsActive, getGroups } from "../components/SceneState";
import type { InitiativeItem } from "../components/InitiativeItem";
import type { Group } from "../components/SceneState";

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
    // Prevent double-clicks with a simple lock
    let isProcessing = false;

    const handleStart = async () => {
        if (isProcessing) return;
        isProcessing = true;

        try {
            const state = await getCurrentInitiativeState();
            if (state.turnOrder.length === 0) return;

            // Set first item as active
            const allItemIds = Array.from(state.items.keys());
            await setActiveTurn(state.turnOrder[0], allItemIds, setRows);

            // Update round and started state
            setRound(1);
            setStarted(true);
            await saveSceneState(true, 1);
        } finally {
            isProcessing = false;
        }
    };

    const handleEnd = async () => {
        if (isProcessing) return;
        isProcessing = true;

        try {
            const state = await getCurrentInitiativeState();
            const allItemIds = Array.from(state.items.keys());

            // Clear all active states
            await setActiveTurn(null, allItemIds, setRows);

            // Clear rings and reset state
            await clearRings("normal");
            setRound(0);
            setStarted(false);
            await saveSceneState(false, 0);
        } finally {
            isProcessing = false;
        }
    };

    const handleNext = async () => {
        if (isProcessing || !started) return;
        isProcessing = true;

        try {
            const state = await getCurrentInitiativeState();
            if (state.turnOrder.length === 0) return;

            // Calculate next index
            let nextIndex: number;
            let shouldIncrementRound = false;

            if (state.activeIndex === -1) {
                // No active item, start from beginning
                nextIndex = 0;
            } else {
                // Move to next
                nextIndex = (state.activeIndex + 1) % state.turnOrder.length;
                // Check if we wrapped around
                shouldIncrementRound = (nextIndex === 0);
            }

            // Set the new active turn
            const allItemIds = Array.from(state.items.keys());
            await setActiveTurn(state.turnOrder[nextIndex], allItemIds, setRows);

            // Update round if we wrapped
            if (shouldIncrementRound) {
                const newRound = round + 1;
                setRound(newRound);
                await saveSceneState(true, newRound);
            }
        } finally {
            isProcessing = false;
        }
    };

    const handlePrev = async () => {
        if (isProcessing || !started) return;
        isProcessing = true;

        try {
            const state = await getCurrentInitiativeState();
            if (state.turnOrder.length === 0) return;

            // Calculate previous index
            let prevIndex: number;
            let shouldDecrementRound = false;

            if (state.activeIndex === -1) {
                // No active item, go to last
                prevIndex = state.turnOrder.length - 1;
            } else if (state.activeIndex === 0) {
                // At beginning, wrap to end
                prevIndex = state.turnOrder.length - 1;
                shouldDecrementRound = true;
            } else {
                // Move to previous
                prevIndex = state.activeIndex - 1;
            }

            // Set the new active turn
            const allItemIds = Array.from(state.items.keys());
            await setActiveTurn(state.turnOrder[prevIndex], allItemIds, setRows);

            // Update round if we wrapped backward
            if (shouldDecrementRound && round > 1) {
                const newRound = round - 1;
                setRound(newRound);
                await saveSceneState(true, newRound);
            }
        } finally {
            isProcessing = false;
        }
    };

    return { handleStart, handleEnd, handleNext, handlePrev };
}