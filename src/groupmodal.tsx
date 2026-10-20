import React from "react";
import ReactDOM from "react-dom/client";
import OBR from "@owlbear-rodeo/sdk";
import Button from "@mui/material/Button";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import InputLabel from "@mui/material/InputLabel";
import { PluginGate } from "./PluginGate";
import { PluginThemeProvider } from "./PluginThemeProvider";
import { getPluginId } from "./getPluginId";
import { settingsStore } from "./settings";
import { encounterStore, useEncounter, type GroupTarget } from "./encounter";
import "./styles/index.css";

const META_KEY = getPluginId("metadata");
const MODAL_ID = META_KEY + "/group-modal";

function GroupModal() {
    const { groups } = useEncounter();
    const [tokenIds, setTokenIds] = React.useState<string[]>([]);
    const [showCreateForm, setShowCreateForm] = React.useState(false);
    const [newGroupName, setNewGroupName] = React.useState("");
    const [createAsStaged, setCreateAsStaged] = React.useState(false);

    React.useEffect(() => {
        // Read the token IDs stored by the context menu
        OBR.player.getMetadata().then((meta) => {
            const pendingTokens = meta[META_KEY + "/pendingGroupTokens"] as string[] | undefined;
            if (pendingTokens && pendingTokens.length > 0) setTokenIds(pendingTokens);
        });
    }, []);

    const closeModal = async () => {
        // Clean up pending tokens from player metadata
        await OBR.player.setMetadata({ [META_KEY + "/pendingGroupTokens"]: undefined });
        await OBR.modal.close(MODAL_ID);
    };

    const addTokens = async (target: GroupTarget) => {
        try {
            const settings = await settingsStore.read();
            await encounterStore.addToGroup(tokenIds, target, {
                hideWhenStaged: settings.groupStagingControlsVisibility,
            });
        } catch (error) {
            console.error("Failed to add tokens to group:", error);
        }
        await closeModal();
    };

    const handleSelectGroup = (groupId: string) => addTokens({ groupId });

    const handleCreateGroup = async () => {
        const trimmed = newGroupName.trim();
        if (!trimmed) return;
        await addTokens({ newGroup: { name: trimmed, staged: createAsStaged, initiative: 0 } });
    };

    const handleSelectChange = (event: any) => {
        const value = event.target.value;
        if (value === "CREATE_NEW") {
            setShowCreateForm(true);
        } else if (value) {
            handleSelectGroup(value);
        }
    };

    return (
        <Box sx={{ p: 2, display: "flex", flexDirection: "column", height: "100%" }}>
            <Typography variant="h6" sx={{ textAlign: "center", fontSize: "1rem", fontWeight: 600, mb: 1.5 }}>
                {showCreateForm ? "Create New Group" : "Add to Group"}
            </Typography>

            {showCreateForm ? (
                <Box sx={{ flex: 1 }}>
                    <TextField
                        autoFocus
                        fullWidth
                        label="Group Name"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                handleCreateGroup();
                            }
                        }}
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={createAsStaged}
                                onChange={(e) => setCreateAsStaged(e.target.checked)}
                                size="small"
                            />
                        }
                        label="Create as Staged"
                        sx={{ mt: 1 }}
                    />
                </Box>
            ) : (
                <Box sx={{ flex: 1 }}>
                    <FormControl fullWidth size="small">
                        <InputLabel id="group-select-label">Select Group</InputLabel>
                        <Select
                            labelId="group-select-label"
                            id="group-select"
                            value=""
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

            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 2 }}>
                {showCreateForm ? (
                    <>
                        <Button onClick={() => setShowCreateForm(false)} size="small">
                            Back
                        </Button>
                        <Button
                            onClick={handleCreateGroup}
                            variant="contained"
                            disabled={!newGroupName.trim()}
                            size="small"
                        >
                            Create
                        </Button>
                    </>
                ) : (
                    <Button onClick={closeModal} size="small">
                        Cancel
                    </Button>
                )}
            </Box>
        </Box>
    );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <PluginGate>
            <PluginThemeProvider>
                <GroupModal />
            </PluginThemeProvider>
        </PluginGate>
    </React.StrictMode>
);
