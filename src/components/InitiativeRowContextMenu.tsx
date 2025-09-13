import { useState } from "react";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import GroupAddRounded from "@mui/icons-material/GroupAddRounded";
import DeleteForeverRounded from "@mui/icons-material/DeleteForeverRounded";
import OBR from "@owlbear-rodeo/sdk";
import type { InitiativeItem } from "./InitiativeItem";
import type { Group, InitiativeSettings } from "./SceneState";
import { addTokenToGroup, removeTokenFromGroup, getTokensInGroup, updateTokenVisibility } from "./metadata";
import { createGroup, deleteGroup } from "./SceneState";
import { GroupSelectionDialog } from "./GroupSelectionDialog";

type Props = {
    row: InitiativeItem;
    groups: Group[];
    contextMenu: { mouseX: number; mouseY: number } | null;
    onClose: () => void;
    onRemove: (id: string) => void;
    onChange: (draft: Partial<InitiativeItem>) => void;
    globalSettings: InitiativeSettings;
};

export function InitiativeRowContextMenu({
    row,
    groups,
    contextMenu,
    onClose,
    onRemove,
    onChange,
    globalSettings,
}: Props) {
    const [groupDialogOpen, setGroupDialogOpen] = useState(false);

    const handleGroupDialogOpen = () => {
        onClose(); // Close context menu
        setGroupDialogOpen(true);
    };

    const handleGroupDialogClose = () => {
        setGroupDialogOpen(false);
    };

    const handleSelectGroup = async (groupId: string) => {
        try {
            // Find the target group to get its initiative and staged status
            const targetGroup = groups.find(g => g.id === groupId);
            const groupInitiative = targetGroup?.initiative ?? 0;
            const groupStaged = targetGroup?.staged ?? false;

            // Add token to group (this will sync the initiative automatically)
            await addTokenToGroup(OBR, row.id, groupId);

            // Handle visibility if the setting is enabled and group is staged
            if (globalSettings.groupStagingControlsVisibility && groupStaged) {
                await updateTokenVisibility(OBR, row.id, false);
            }

            // Update local state for immediate UI feedback
            onChange({
                groupId,
                initiative: groupInitiative // Sync initiative with group
            });
        } catch (error) {
            console.error("Failed to add token to group:", error);
        }
    };

    const handleCreateGroup = async (name: string) => {
        try {
            // Create group with the current row's initiative as the default
            const group = await createGroup(name, row.initiative);

            // Add token to the new group (this will sync initiatives automatically)
            await addTokenToGroup(OBR, row.id, group.id);

            // Update local state for immediate UI feedback
            onChange({
                groupId: group.id
                // Initiative should already match since we created the group with this token's initiative
            });
        } catch (error) {
            console.error("Failed to create group:", error);
        }
    };

    const handleRemoveFromGroup = async () => {
        try {
            const currentGroupId = row.groupId;

            // Remove token from group
            await removeTokenFromGroup(OBR, row.id);

            // Handle visibility if the setting is enabled - make token visible when removed from group
            if (globalSettings.groupStagingControlsVisibility && currentGroupId) {
                const currentGroup = groups.find(g => g.id === currentGroupId);
                if (currentGroup?.staged) {
                    // Token was in a staged group, make it visible when removed
                    await updateTokenVisibility(OBR, row.id, true);
                }
            }

            // Update local state - only remove groupId, keep current initiative
            onChange({ groupId: null });

            // Check if this was the last token in the group and delete the group if so
            if (currentGroupId) {
                // Check how many tokens are left in the group after this removal
                const remainingTokens = await getTokensInGroup(OBR, currentGroupId);

                // If no tokens left, delete the empty group
                if (remainingTokens.length === 0) {
                    await deleteGroup(currentGroupId);
                }
            }
        } catch (error) {
            console.error("Failed to remove token from group:", error);
        }
    };

    return (
        <>
            <Menu
                open={contextMenu !== null}
                onClose={onClose}
                anchorReference="anchorPosition"
                anchorPosition={
                    contextMenu !== null
                        ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
                        : undefined
                }
                slotProps={{
                    paper: {
                        sx: {
                            borderRadius: "16px",
                            minWidth: 160,
                            maxWidth: 250,
                            boxShadow: '0px 5px 5px -3px rgba(0,0,0,0.2), 0px 8px 10px 1px rgba(0,0,0,0.14), 0px 3px 14px 2px rgba(0,0,0,0.12)',
                            '& .MuiMenuItem-root': {
                                py: 0.75,
                                px: 1.25,
                                fontSize: '0.875rem',
                                minHeight: 'auto',
                            },
                            '& .MuiListItemIcon-root': {
                                minWidth: 36,
                                '& .MuiSvgIcon-root': {
                                    fontSize: '1.25rem',
                                },
                            },
                        },
                    },
                }}
            >
                {/* Group Management */}
                <MenuItem onClick={handleGroupDialogOpen}>
                    <ListItemIcon>
                        <GroupAddRounded />
                    </ListItemIcon>
                    <ListItemText>{row.groupId ? "Manage Group" : "Add to Group"}</ListItemText>
                </MenuItem>

                {/* Remove Item */}
                <MenuItem onClick={() => { onClose(); onRemove(row.id); }}>
                    <ListItemIcon>
                        <DeleteForeverRounded />
                    </ListItemIcon>
                    <ListItemText>Remove</ListItemText>
                </MenuItem>
            </Menu>

            {/* Group Selection Dialog */}
            <GroupSelectionDialog
                open={groupDialogOpen}
                onClose={handleGroupDialogClose}
                groups={groups}
                currentGroupId={row.groupId}
                onSelectGroup={handleSelectGroup}
                onCreateGroup={handleCreateGroup}
                onRemoveFromGroup={row.groupId ? handleRemoveFromGroup : undefined}
            />
        </>
    );
}