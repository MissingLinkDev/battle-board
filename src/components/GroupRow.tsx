import { useMemo } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUp from "@mui/icons-material/KeyboardArrowUp";
import GroupRounded from "@mui/icons-material/GroupRounded";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import PauseRounded from "@mui/icons-material/PauseRounded";
import ScatterPlotRounded from "@mui/icons-material/ScatterPlotRounded";

import type { Group } from "./SceneState";
import type { InitiativeItem } from "./InitiativeItem";
import type { InitiativeSettings } from "./SceneState";
import type { CMToken } from "./tokens";
import { CommitNumberField } from "./CommitFields";
import InitiativeRow from "./InitiativeRow";
import { updateGroupInitiative, setGroupActive, setGroupStaged } from "./SceneState";
import { removeTokenFromGroup, updateGroupTokensVisibility, batchUpdateMeta } from "./metadata";
import { useContextMenu } from "../hooks/useContextMenu";
import { GroupRowContextMenu } from "./GroupRowContextMenu";
import OBR from "@owlbear-rodeo/sdk";

type RowSettings = {
    showMovementRange: boolean;
    showAttackRange: boolean;
    showConditions: boolean;
    showDistances: boolean;
    showAC: boolean;
    showHP: boolean;
    showDMR: boolean;
    showConc: boolean;
};

type Props = {
    group: Group;
    items: InitiativeItem[];
    expanded?: boolean;
    onToggleExpand?: () => void;
    onRowChange: (id: string, draft: Partial<InitiativeItem>) => void;
    onRowRemove: (id: string) => void;
    settings: RowSettings;
    globalSettings: InitiativeSettings;
    started: boolean;
    tokens: CMToken[];
    colSpan?: number;
    ready?: boolean;
    groups: Group[];
    expandedIds: Set<string>;
    onToggleItemExpand: (id: string) => void;
    staged?: boolean;
    onGroupStagingToggle?: (groupId: string, staged: boolean, wasActiveInCombat?: boolean) => void;
    onGroupUngroup?: (groupId: string) => void;
};

export default function GroupRow({
    group,
    items,
    expanded,
    onToggleExpand,
    onRowChange,
    onRowRemove,
    settings,
    globalSettings,
    started,
    tokens,
    colSpan,
    ready = true,
    groups,
    expandedIds,
    onToggleItemExpand,
    staged = false,
    onGroupStagingToggle,
    onGroupUngroup,
}: Props) {
    const { contextMenu, handleContextMenu, handleClose } = useContextMenu();

    const inputSx = useMemo(() => ({
        "& .MuiOutlinedInput-root": { borderRadius: 0.25, height: 28, p: 0 },
        "& .MuiOutlinedInput-input": { fontSize: "0.8rem", lineHeight: 1.25, py: 0 },
    }), []);

    const baseHtmlInput = useMemo(() => ({
        inputMode: "numeric" as const,
        pattern: "[0-9]*",
        style: { textAlign: "center" as const, padding: "0 1px", fontSize: "0.8rem" },
    }), []);

    const vis = useMemo(() => ({
        ac: settings?.showAC ?? true,
        hp: settings?.showHP ?? true,
        dmr: settings?.showDMR ?? true,
        conc: settings?.showConc ?? false,
    }), [settings]);

    const handleInitiativeChange = async (newInitiative: number) => {
        try {
            await updateGroupInitiative(group.id, newInitiative);
        } catch (error) {
            console.error("Failed to update group initiative:", error);
        }
    };

    const handleToggleStaging = async () => {
        if (!onGroupStagingToggle) return;

        try {
            const newStaged = !staged;
            const wasActive = group.active || items.some(item => item.active);

            // If we're staging an active group during combat, we need special handling
            if (newStaged && wasActive && started) {
                // First, clear the active state from this group and its members
                await setGroupActive(group.id, false);

                // Clear active state from all group members in metadata
                const memberPatches = items.map(item => ({
                    id: item.id,
                    patch: { active: false }
                }));
                await batchUpdateMeta(OBR, memberPatches);

                // Update local state to reflect members are no longer active
                items.forEach(item => {
                    onRowChange(item.id, { active: false });
                });
            }

            // Update the group's staged status
            await setGroupStaged(group.id, newStaged);

            // Handle visibility if the setting is enabled
            if (globalSettings.groupStagingControlsVisibility) {
                if (newStaged) {
                    // Staging: hide tokens
                    await updateGroupTokensVisibility(OBR, group.id, false);
                } else {
                    // Unstaging: show tokens  
                    await updateGroupTokensVisibility(OBR, group.id, true);
                }
            }

            // If unstaging (adding to active initiative), ensure group is not active yet
            if (!newStaged) {
                await setGroupActive(group.id, false);

                // Ensure members don't have lingering active state
                const memberPatches = items.map(item => ({
                    id: item.id,
                    patch: { active: false }
                }));
                await batchUpdateMeta(OBR, memberPatches);

                // Update local state
                items.forEach(item => {
                    onRowChange(item.id, { active: false });
                });
            }

            // Notify parent - let it handle turn advancement if needed
            onGroupStagingToggle(group.id, newStaged, wasActive && started);
        } catch (error) {
            console.error("Failed to toggle group staging:", error);
        }
    };

    const handleUngroup = async () => {
        if (!onGroupUngroup) return;

        try {
            // Remove all items from the group
            const itemIds = items.map(item => item.id);
            for (const itemId of itemIds) {
                await removeTokenFromGroup(OBR, itemId);
                // Update local state
                onRowChange(itemId, { groupId: null });
            }

            onGroupUngroup(group.id);
        } catch (error) {
            console.error("Failed to ungroup items:", error);
        }
    };

    const isActive = items.some(item => item.active) && !staged;
    const displayInitiative = group.initiative;

    // Calculate how many columns the name should span
    const nameColSpan = 1 + (vis.ac ? 1 : 0) + (vis.hp ? 2 : 0) + (vis.conc ? 1 : 0) + (vis.dmr ? 1 : 0);

    return (
        <>
            <TableRow
                hover
                selected={isActive}
                onClick={() => onToggleExpand?.()}
                onContextMenu={handleContextMenu}
                sx={{
                    cursor: "context-menu",
                    "& > td, & > th": (theme) => ({
                        borderBottom: expanded ? "none" : `1px solid ${theme.palette.divider}`,
                    }),
                    "& td": { py: 0.5, px: 0.5 },
                    borderLeft: isActive ? "3px solid" : "3px solid transparent",
                    borderLeftColor: isActive ? "warning.light" : "transparent",
                    bgcolor: "action.hover",
                }}
            >
                {/* Expand chevron */}
                <TableCell width={18} onClick={(e) => e.stopPropagation()}>
                    <IconButton
                        aria-label="expand group"
                        size="small"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpand?.();
                        }}
                        sx={{ p: 0.25 }}
                    >
                        {expanded ? (
                            <KeyboardArrowUp sx={{ fontSize: "1rem" }} />
                        ) : (
                            <KeyboardArrowDown sx={{ fontSize: "1rem" }} />
                        )}
                    </IconButton>
                </TableCell>

                {/* INIT */}
                <TableCell width={40} align="center" onClick={(e) => e.stopPropagation()}>
                    <CommitNumberField
                        size="small"
                        variant="outlined"
                        value={displayInitiative}
                        allowMath={false}
                        inputMode="decimal"
                        pattern="[0-9]*\\.?[0-9]?"
                        finalize={(n) => Math.round(n * 10) / 10}
                        onCommit={handleInitiativeChange}
                        sx={inputSx}
                        slotProps={{
                            htmlInput: {
                                ...baseHtmlInput,
                                autoFocus: true,
                                onFocus: (e: any) => e.currentTarget.select(),
                                "aria-label": "group initiative",
                                style: { ...baseHtmlInput.style, width: 32 },
                            },
                        }}
                    />
                </TableCell>

                {/* GROUP NAME - spans multiple columns with buttons right-justified */}
                <TableCell
                    colSpan={nameColSpan}
                    sx={{
                        fontWeight: 700,
                        fontSize: "0.85rem",
                        color: "primary.main",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, pr: 0.5 }}>
                        {/* Left side - Group info */}
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
                            <GroupRounded sx={{ fontSize: 16, opacity: 0.8 }} />
                            <span>{group.name}</span>
                            <Typography variant="caption" sx={{ color: "text.secondary", ml: 0.5 }}>
                                ({items.length} {items.length === 1 ? 'member' : 'members'})
                            </Typography>
                            {staged && (
                                <Typography variant="caption" sx={{ color: "warning.main", ml: 0.5, fontWeight: 600 }}>
                                    (Staged)
                                </Typography>
                            )}
                        </Box>

                        {/* Right side - Action buttons */}
                        <Box sx={{ display: "flex", gap: 0.25, flexShrink: 0, mr: -0.25 }} onClick={(e) => e.stopPropagation()}>
                            {/* Initiative Staging Toggle Button */}
                            <Tooltip
                                title={staged ? "Activate group in initiative" : "Stage group (remove from active initiative)"}
                                enterDelay={500}
                            >
                                <IconButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleStaging();
                                    }}
                                    sx={{
                                        p: 0.25,
                                        color: staged ? "text.secondary" : "success.main",
                                        "&:hover": {
                                            color: staged ? "success.main" : "success.dark",
                                        }
                                    }}
                                >
                                    {staged ? (
                                        <PlayArrowRounded sx={{ fontSize: 16 }} />
                                    ) : (
                                        <PauseRounded sx={{ fontSize: 16 }} />
                                    )}
                                </IconButton>
                            </Tooltip>

                            {/* Ungroup Button */}
                            <Tooltip
                                title="Ungroup - add all members individually to initiative"
                                enterDelay={500}
                            >
                                <IconButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleUngroup();
                                    }}
                                    sx={{
                                        p: 0.25,
                                        color: "text.secondary",
                                        "&:hover": {
                                            color: "primary.main",
                                        }
                                    }}
                                >
                                    <ScatterPlotRounded sx={{ fontSize: 16 }} />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    </Box>
                </TableCell>
            </TableRow>

            {/* Context Menu */}
            <GroupRowContextMenu
                staged={staged}
                contextMenu={contextMenu}
                onClose={handleClose}
                onToggleStaging={handleToggleStaging}
                onUngroup={handleUngroup}
            />

            {/* Expanded group members */}
            {expanded && items.map((item) => (
                <InitiativeRow
                    key={item.id}
                    row={item}
                    expanded={expandedIds.has(item.id)}
                    onToggleExpand={() => onToggleItemExpand(item.id)}
                    onChange={(draft) => onRowChange(item.id, draft)}
                    onRemove={onRowRemove}
                    settings={settings}
                    globalSettings={globalSettings}
                    started={started}
                    tokens={tokens}
                    items={items}
                    colSpan={colSpan}
                    ready={ready}
                    groups={groups}
                    hideInitiative={true}
                />
            ))}
        </>
    );
}