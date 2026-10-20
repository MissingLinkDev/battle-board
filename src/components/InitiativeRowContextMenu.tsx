import { useState } from "react";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import GroupAddRounded from "@mui/icons-material/GroupAddRounded";
import DeleteForeverRounded from "@mui/icons-material/DeleteForeverRounded";
import type { Combatant } from "../encounter";
import type { InitiativeSettings } from "./SceneState";
import type { Group } from "../encounter";
import { encounterStore } from "../encounter";
import { GroupSelectionDialog } from "./GroupSelectionDialog";

type Props = {
    row: Combatant;
    groups: Group[];
    contextMenu: { mouseX: number; mouseY: number } | null;
    onClose: () => void;
    onRemove: (id: string) => void;
    globalSettings: InitiativeSettings;
};

export function InitiativeRowContextMenu({
    row,
    groups,
    contextMenu,
    onClose,
    onRemove,
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

    const hideWhenStaged = !!globalSettings.groupStagingControlsVisibility;

    const handleSelectGroup = (groupId: string) => {
        encounterStore.addToGroup([row.id], { groupId }, { hideWhenStaged }).catch(console.error);
    };

    const handleCreateGroup = (name: string, staged: boolean) => {
        encounterStore
            .addToGroup([row.id], { newGroup: { name, staged, initiative: row.initiative } }, { hideWhenStaged })
            .catch(console.error);
    };

    const handleRemoveFromGroup = () => {
        encounterStore.leaveGroup([row.id], { showIfWasStaged: hideWhenStaged }).catch(console.error);
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
                    <ListItemText>Remove from BattleBoard</ListItemText>
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