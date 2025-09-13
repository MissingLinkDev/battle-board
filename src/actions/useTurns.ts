import OBR from "@owlbear-rodeo/sdk";
import { META_KEY } from "../components/metadata";
import { clearRings } from "../components/rings";
import { setGroupActive, clearAllGroupsActive } from "../components/SceneState";
import type { InitiativeItem } from "../components/InitiativeItem";
import type { Group } from "../components/SceneState";

// Helper type for turn management
type TurnItem = {
    type: 'group';
    group: Group;
    items: InitiativeItem[];
} | {
    type: 'individual';
    item: InitiativeItem;
};

export function useTurns(
    rows: InitiativeItem[],
    setRows: React.Dispatch<React.SetStateAction<InitiativeItem[]>>,
    round: number,
    setRound: (n: number) => void,
    started: boolean,
    setStarted: (b: boolean) => void,
    saveSceneState: (started: boolean, round: number) => Promise<void>,
    groups: Group[],
) {
    // Create sorted turn order mixing groups and individuals - ONLY non-staged groups
    const createTurnOrder = (items: InitiativeItem[], groups: Group[]): TurnItem[] => {
        const result: TurnItem[] = [];

        // Group items by their groupId
        const groupedItems = new Map<string, InitiativeItem[]>();
        const individualItems: InitiativeItem[] = [];

        for (const item of items) {
            if (item.groupId) {
                const existing = groupedItems.get(item.groupId) || [];
                existing.push(item);
                groupedItems.set(item.groupId, existing);
            } else {
                individualItems.push(item);
            }
        }

        // Add groups that have members and are NOT staged
        for (const group of groups) {
            const groupItems = groupedItems.get(group.id);
            if (groupItems && groupItems.length > 0 && !group.staged) {
                result.push({
                    type: 'group',
                    group: group,
                    items: groupItems
                });
            }
        }

        // Add individual items (they're always participating)
        for (const item of individualItems) {
            result.push({
                type: 'individual',
                item: item
            });
        }

        // Sort by initiative
        result.sort((a, b) => {
            const aInit = a.type === 'group' ? a.group.initiative : a.item.initiative;
            const bInit = b.type === 'group' ? b.group.initiative : b.item.initiative;

            const af = Math.floor(aInit);
            const bf = Math.floor(bInit);

            if (bf !== af) return bf - af; // higher integer first
            if (aInit !== bInit) return aInit - bInit; // then smaller decimal first

            // Stable sort by name
            const aName = a.type === 'group' ? a.group.name : a.item.name;
            const bName = b.type === 'group' ? b.group.name : b.item.name;
            return aName.localeCompare(bName);
        });

        return result;
    };

    const getActiveIndex = (turnOrder: TurnItem[]) => {
        return turnOrder.findIndex((item) => {
            if (item.type === 'group') {
                return item.group.active && !item.group.staged;
            } else {
                return item.item.active;
            }
        });
    };

    // Helper function to update group member metadata
    const updateGroupMembersMetadata = async (groupItems: InitiativeItem[], active: boolean) => {
        const groupMemberIds = groupItems.map(item => item.id);
        if (groupMemberIds.length > 0) {
            await OBR.scene.items.updateItems(groupMemberIds, (items) => {
                for (const it of items) {
                    const meta = (it.metadata as any)[META_KEY];
                    if (meta) meta.active = active;
                }
            });
        }
    };

    const handleStart = async () => {
        const turnOrder = createTurnOrder(rows, groups);
        if (!turnOrder.length) return;

        // Clear all active states first
        await clearAllGroupsActive();
        setRows(prev => prev.map(r => ({ ...r, active: false })));

        // Set first item/group as active
        const firstItem = turnOrder[0];
        if (firstItem.type === 'group') {
            await setGroupActive(firstItem.group.id, true);
            // Set all group members as active in local state
            setRows(prev => prev.map(r => ({
                ...r,
                active: r.groupId === firstItem.group.id
            })));
            // Update group member metadata
            await updateGroupMembersMetadata(firstItem.items, true);
        } else {
            setRows(prev => prev.map(r => ({
                ...r,
                active: r.id === firstItem.item.id
            })));
            await OBR.scene.items.updateItems([firstItem.item.id], (items) => {
                const meta = (items[0].metadata as any)[META_KEY];
                if (meta) meta.active = true;
            });
        }

        setRound(1);
        setStarted(true);
        await saveSceneState(true, 1);
    };

    const handleEnd = async () => {
        // Clear all active states
        await clearAllGroupsActive();
        const ids = rows.map((r) => r.id);
        setRows(prev => prev.map(r => ({ ...r, active: false })));

        await OBR.scene.items.updateItems(ids, (items) => {
            for (const it of items) {
                const meta = (it.metadata as any)[META_KEY];
                if (meta) meta.active = false;
            }
        });

        setRound(0);
        setStarted(false);
        await clearRings("normal");
        await saveSceneState(false, 0);
    };

    const handleNext = async () => {
        if (!started) return;

        const turnOrder = createTurnOrder(rows, groups);
        if (!turnOrder.length) return;

        const activeIdx = getActiveIndex(turnOrder);
        const nextIdx = activeIdx === -1 ? 0 : (activeIdx + 1) % turnOrder.length;
        const wrapped = activeIdx !== -1 && nextIdx === 0;
        const nextRound = wrapped ? round + 1 : round;

        // Clear all active states first
        await clearAllGroupsActive();
        setRows(prev => prev.map(r => ({ ...r, active: false })));
        await OBR.scene.items.updateItems(rows.map(r => r.id), (items) => {
            for (const it of items) {
                const meta = (it.metadata as any)[META_KEY];
                if (meta) meta.active = false;
            }
        });

        // Set next item/group as active
        const nextItem = turnOrder[nextIdx];
        if (nextItem.type === 'group') {
            await setGroupActive(nextItem.group.id, true);
            // Set all group members as active in local state
            setRows(prev => prev.map(r => ({
                ...r,
                active: r.groupId === nextItem.group.id
            })));
            // Update group member metadata
            await updateGroupMembersMetadata(nextItem.items, true);
        } else {
            setRows(prev => prev.map(r => ({
                ...r,
                active: r.id === nextItem.item.id
            })));
            await OBR.scene.items.updateItems([nextItem.item.id], (items) => {
                const meta = (items[0].metadata as any)[META_KEY];
                if (meta) meta.active = true;
            });
        }

        // Update round and save when wrapping to next round
        if (wrapped) {
            setRound(nextRound);
            await saveSceneState(true, nextRound);
        }
    };

    const handlePrev = async () => {
        if (!started) return;

        const turnOrder = createTurnOrder(rows, groups);
        if (!turnOrder.length) return;

        const activeIdx = getActiveIndex(turnOrder);
        const prevIdx = activeIdx === -1 ? turnOrder.length - 1 : (activeIdx - 1 + turnOrder.length) % turnOrder.length;
        const wrappedBack = activeIdx === 0;
        const nextRound = wrappedBack ? Math.max(1, round - 1) : round;

        // Clear all active states first
        await clearAllGroupsActive();
        setRows(prev => prev.map(r => ({ ...r, active: false })));
        await OBR.scene.items.updateItems(rows.map(r => r.id), (items) => {
            for (const it of items) {
                const meta = (it.metadata as any)[META_KEY];
                if (meta) meta.active = false;
            }
        });

        // Set previous item/group as active
        const prevItem = turnOrder[prevIdx];
        if (prevItem.type === 'group') {
            await setGroupActive(prevItem.group.id, true);
            // Set all group members as active in local state
            setRows(prev => prev.map(r => ({
                ...r,
                active: r.groupId === prevItem.group.id
            })));
            // Update group member metadata
            await updateGroupMembersMetadata(prevItem.items, true);
        } else {
            setRows(prev => prev.map(r => ({
                ...r,
                active: r.id === prevItem.item.id
            })));
            await OBR.scene.items.updateItems([prevItem.item.id], (items) => {
                const meta = (items[0].metadata as any)[META_KEY];
                if (meta) meta.active = true;
            });
        }

        // Update round and save when wrapping back to previous round
        if (wrappedBack) {
            setRound(nextRound);
            await saveSceneState(true, nextRound);
        }
    };

    return { handleStart, handleEnd, handleNext, handlePrev };
}