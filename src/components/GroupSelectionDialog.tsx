import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import type { Group } from "./SceneState";
import InputLabel from "@mui/material/InputLabel";

type Props = {
    open: boolean;
    onClose: () => void;
    groups: Group[];
    currentGroupId?: string | null;
    onSelectGroup: (groupId: string) => void;
    onCreateGroup: (name: string) => void;
    onRemoveFromGroup?: () => void;
};

export function GroupSelectionDialog({
    open,
    onClose,
    groups,
    currentGroupId,
    onSelectGroup,
    onCreateGroup,
    onRemoveFromGroup,
}: Props) {
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");

    const handleCreateSubmit = () => {
        const trimmed = newGroupName.trim();
        if (trimmed) {
            onCreateGroup(trimmed);
            setNewGroupName("");
            setShowCreateForm(false);
            onClose();
        }
    };

    const handleCancel = () => {
        setNewGroupName("");
        setShowCreateForm(false);
        onClose();
    };

    const handleSelectChange = (event: any) => {
        const value = event.target.value;
        if (value === "CREATE_NEW") {
            setShowCreateForm(true);
        } else if (value !== currentGroupId) {
            onSelectGroup(value);
            onClose();
        }
    };

    const handleRemoveFromGroup = () => {
        onRemoveFromGroup?.();
        onClose();
    };

    return (
        <Dialog
            open={open}
            onClose={handleCancel}
            maxWidth="sm"
            fullWidth
            slotProps={{
                paper: {
                    sx: { borderRadius: "16px" }
                }
            }}
        >
            <DialogTitle sx={{ p: 1, pb: 0.5 }}>
                <Box sx={{ textAlign: "center", fontSize: "1rem", fontWeight: 600 }}>
                    {showCreateForm ? "Create New Group" : "Manage Groups"}
                </Box>
            </DialogTitle>

            <DialogContent sx={{ p: 1 }}>
                {showCreateForm ? (
                    // Create Group Form
                    <Box sx={{ pt: 1 }}>
                        <TextField
                            autoFocus
                            fullWidth
                            label="Group Name"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleCreateSubmit();
                                }
                            }}
                        />
                    </Box>
                ) : (
                    // Group Selection
                    <Box sx={{ pt: 1 }}>
                        {/* Group Selection */}
                        <FormControl fullWidth size="small">
                            <InputLabel id="group-select-label">Select Group</InputLabel>
                            <Select
                                labelId="group-select-label"
                                id="group-select"
                                value={currentGroupId || ""}
                                onChange={handleSelectChange}
                                label="Select Group"
                            >
                                {groups.length === 0 ? (
                                    <MenuItem value="" disabled>
                                        <em>No groups available</em>
                                    </MenuItem>
                                ) : (
                                    groups.map((group) => (
                                        <MenuItem key={group.id} value={group.id}>
                                            {group.name} {group.active ? "(Active)" : ""}
                                        </MenuItem>
                                    ))
                                )}
                                <Divider />
                                <MenuItem value="CREATE_NEW" sx={{ color: "primary.main" }}>
                                    + Create New Group
                                </MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                )}
            </DialogContent>

            <DialogActions>
                {showCreateForm ? (
                    <>
                        <Button onClick={() => setShowCreateForm(false)} size="small">
                            Back
                        </Button>
                        <Button
                            onClick={handleCreateSubmit}
                            variant="contained"
                            disabled={!newGroupName.trim()}
                            size="small"
                        >
                            Create
                        </Button>
                    </>
                ) : (
                    <>
                        {currentGroupId && onRemoveFromGroup && (
                            <Button
                                onClick={handleRemoveFromGroup}
                                color="error"
                                sx={{ mr: "auto" }}
                                size="small"
                            >
                                Remove from Group
                            </Button>
                        )}
                        <Button onClick={handleCancel} size="small">
                            Cancel
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
}