import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import InitiativeRow from "./InitiativeRow";
import GroupRow from "./GroupRow";
import { PlayArrowRounded } from "@mui/icons-material";
import NavigateBeforeRounded from "@mui/icons-material/NavigateBeforeRounded";
import NavigateNextRounded from "@mui/icons-material/NavigateNextRounded";
import Tooltip from "@mui/material/Tooltip";
import SettingsRounded from "@mui/icons-material/SettingsRounded";

import type { InitiativeItem } from "./InitiativeItem";
import type { Group, InitiativeSettings } from "./SceneState";
import type { CMToken } from "./tokens";
import { useMemo } from "react";
import { deleteGroup } from "./SceneState";
import StopRounded from "@mui/icons-material/StopRounded";

type Props = {
    items: InitiativeItem[];
    expandedIds: Set<string>;
    onToggleExpand: (id: string) => void;
    onRowChange: (id: string, draft: Partial<InitiativeItem>) => void;
    onRowRemove: (id: string) => void;

    settings: InitiativeSettings;
    globalSettings: InitiativeSettings; // Pass global settings for ring management

    started: boolean;
    round: number;
    onStart: () => void;
    onEnd: () => void;
    onNext: () => void;
    onPrev: () => void;

    tokens: CMToken[];
    onAddAll: (includeHidden: boolean) => void;
    onOpenSettings: () => void;
    ready?: boolean;
    groups: Group[];
    /** Ask parent to re-measure the action panel (optional) */
    onRequestResize?: () => void;
};

// Helper type for rendering
type RenderItem = {
    type: 'group';
    group: Group;
    items: InitiativeItem[];
    staged: boolean;
} | {
    type: 'individual';
    item: InitiativeItem;
};

export default function GmTable({
    items,
    expandedIds,
    onToggleExpand,
    onRowChange,
    onRowRemove,
    settings,
    globalSettings,
    started,
    round,
    onStart,
    onEnd,
    onNext,
    onPrev,
    tokens,
    onAddAll,
    onOpenSettings,
    ready = true,
    groups,
    onRequestResize,
}: Props) {
    const showAC = settings.showArmor;
    const showHP = settings.showHP;
    const showDMR = settings.dmRingToggle;
    const showConc = settings.showConcentration ?? false;

    const gmColCount = 3 + (showAC ? 1 : 0) + (showHP ? 2 : 0) + (showConc ? 1 : 0) + (showDMR ? 1 : 0);

    const getActiveIndex = (renderItems: RenderItem[]) => {
        return renderItems.findIndex((item) => {
            if (item.type === 'group') {
                return !item.staged && item.items.some(i => i.active);
            } else {
                return item.item.active;
            }
        });
    };

    // Create render lists - separate active from staged
    const { activeRenderItems, stagedRenderItems } = useMemo(() => {
        const active: RenderItem[] = [];
        const staged: RenderItem[] = [];

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

        // Process groups
        for (const group of groups) {
            const groupItems = groupedItems.get(group.id) || [];
            const isStaged = group.staged ?? false;

            const renderItem: RenderItem = {
                type: 'group',
                group: group,
                items: groupItems,
                staged: isStaged
            };

            if (isStaged) {
                staged.push(renderItem);
            } else {
                active.push(renderItem);
            }
        }

        // Add individual items to active (they're always participating)
        for (const item of individualItems) {
            active.push({
                type: 'individual',
                item: item
            });
        }

        // Sort active items by initiative
        active.sort((a, b) => {
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

        // Sort staged items by name (initiative doesn't matter when staged)
        staged.sort((a, b) => {
            const aName = a.type === 'group' ? a.group.name : a.item.name;
            const bName = b.type === 'group' ? b.group.name : b.item.name;
            return aName.localeCompare(bName);
        });

        return { activeRenderItems: active, stagedRenderItems: staged };
    }, [items, groups]);

    const handleGroupStagingToggle = async (_groupId: string, staged: boolean, wasActiveInCombat?: boolean) => {
        // If we're staging an active group during combat, advance the turn
        if (staged && wasActiveInCombat) {
            // The group was active and is now being staged, so advance to next turn
            await onNext();
        }
        onRequestResize?.();
    };

    const handleGroupUngroup = async (groupId: string) => {
        try {
            await deleteGroup(groupId);
        } catch (error) {
            console.error("Failed to delete group:", error);
        }
        onRequestResize?.();
    };

    const renderTable = (renderItems: RenderItem[], showHeader: boolean = true) => (
        <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <Table
                size="small"
                aria-label="initiative table"
                sx={{
                    tableLayout: "fixed",
                    width: "100%",
                    "& td, & th": { py: 0.25, px: 0.25 },
                    "& thead th": { fontSize: "0.72rem", letterSpacing: 0.4, py: 0.9, height: 28 },
                }}
            >
                {showHeader && (
                    <TableHead>
                        <TableRow>
                            <TableCell width={18}></TableCell>
                            <TableCell width={40} align="center">INIT</TableCell>
                            <TableCell align="center">NAME</TableCell>
                            {showAC && <TableCell width={36} align="center">AC</TableCell>}
                            {showHP && <TableCell width={62} align="center">HP</TableCell>}
                            {showHP && <TableCell width={36} align="center">TP</TableCell>}
                            {showConc && (
                                <TableCell width={28} align="center">
                                    <Box
                                        sx={{
                                            width: 14,
                                            height: 14,
                                            bgcolor: "grey.600",
                                            transform: "rotate(45deg)",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            mx: "auto",
                                        }}
                                    >
                                        <Typography
                                            sx={{
                                                fontSize: "0.55rem",
                                                fontWeight: 700,
                                                color: "white",
                                                transform: "rotate(-45deg)",
                                                lineHeight: 1,
                                            }}
                                        >
                                            C
                                        </Typography>
                                    </Box>
                                </TableCell>
                            )}
                            {showDMR && <TableCell width={24}></TableCell>}
                        </TableRow>
                    </TableHead>
                )}

                {/* MAIN TABLE BODY - This will expand to fill available space */}
                <TableBody sx={{ flex: 1 }}>
                    {renderItems.map((renderItem) => {
                        if (renderItem.type === 'group') {
                            return (
                                <GroupRow
                                    key={`group-${renderItem.group.id}`}
                                    group={renderItem.group}
                                    items={renderItem.items}
                                    expanded={expandedIds.has(`group-${renderItem.group.id}`)}
                                    onToggleExpand={() => {
                                        onToggleExpand(`group-${renderItem.group.id}`);
                                        onRequestResize?.();
                                    }}
                                    onRowChange={onRowChange}
                                    onRowRemove={onRowRemove}
                                    settings={{
                                        showMovementRange: settings.showMovementRange,
                                        showAttackRange: settings.showAttackRange,
                                        showConditions: settings.showConditions,
                                        showDistances: settings.showDistances,
                                        showAC,
                                        showHP,
                                        showDMR,
                                        showConc,
                                    }}
                                    globalSettings={globalSettings}
                                    started={started}
                                    tokens={tokens}
                                    colSpan={gmColCount}
                                    groups={groups}
                                    ready={ready}
                                    expandedIds={expandedIds}
                                    onToggleItemExpand={(itemId) => {
                                        onToggleExpand(itemId);
                                        onRequestResize?.();
                                    }}
                                    staged={renderItem.staged}
                                    onGroupStagingToggle={handleGroupStagingToggle}
                                    onGroupUngroup={handleGroupUngroup}
                                />
                            );
                        } else {
                            return (
                                <InitiativeRow
                                    key={renderItem.item.id}
                                    row={renderItem.item}
                                    expanded={expandedIds.has(renderItem.item.id)}
                                    onToggleExpand={() => {
                                        onToggleExpand(renderItem.item.id);
                                        onRequestResize?.();
                                    }}
                                    onChange={(draft) => onRowChange(renderItem.item.id, draft)}
                                    onRemove={onRowRemove}
                                    settings={{
                                        showMovementRange: settings.showMovementRange,
                                        showAttackRange: settings.showAttackRange,
                                        showConditions: settings.showConditions,
                                        showDistances: settings.showDistances,
                                        showAC,
                                        showHP,
                                        showDMR,
                                        showConc,
                                    }}
                                    globalSettings={globalSettings}
                                    started={started}
                                    tokens={tokens}
                                    colSpan={gmColCount}
                                    groups={groups}
                                    ready={ready}
                                    hideInitiative={false}
                                />
                            );
                        }
                    })}
                </TableBody>
            </Table>

            {/* Empty State for Active Initiative - Now positioned to fill remaining space */}
            {renderItems.length === 0 && (
                <Box
                    sx={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        px: 2,
                        py: 4,
                        textAlign: "center",
                    }}
                >
                    <Box>
                        <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
                            No creatures in initiative yet. Add a character to the Battle Board to get started.
                        </Typography>

                        <Stack direction="row" spacing={1} justifyContent="center">
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={() => onAddAll(true)}
                                sx={{ borderRadius: 1 }}
                            >
                                Add All in Scene
                            </Button>

                            <Button
                                size="small"
                                variant="outlined"
                                onClick={() => onAddAll(false)}
                                sx={{ borderRadius: 1 }}
                            >
                                Add Visible Only
                            </Button>
                        </Stack>
                    </Box>
                </Box>
            )}
        </Box>
    );

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                minHeight: 250,
            }}
        >
            {/* Main Content Area - This will expand */}
            <TableContainer
                component={Paper}
                sx={{
                    flex: 1,
                    borderRadius: 0,
                    overflow: "auto",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {/* Main Initiative Table */}
                {renderTable(activeRenderItems, true)}
            </TableContainer>

            {/* Control Bar - Fixed in middle */}
            <Box sx={{
                px: 1,
                py: 0.75,
                bgcolor: "background.default",
                borderTop: 1,
                borderColor: "divider",
                flexShrink: 0,
            }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                    <Stack direction="row" alignItems="center" spacing={1.25}>
                        {started ? (
                            <Button
                                disabled={activeRenderItems.length === 0}
                                size="small"
                                variant="contained"
                                color="error"
                                startIcon={<StopRounded />}
                                onClick={onEnd}
                                sx={{ minWidth: 96 }}
                            >
                                End
                            </Button>
                        ) : (
                            <Button
                                disabled={activeRenderItems.length === 0}
                                size="small"
                                variant="contained"
                                startIcon={<PlayArrowRounded />}
                                onClick={onStart}
                                sx={{ minWidth: 96 }}
                            >
                                Start
                            </Button>
                        )}

                        <IconButton
                            size="small"
                            onClick={onPrev}
                            disabled={!started || activeRenderItems.length === 0 || (round === 1 && getActiveIndex(activeRenderItems) === 0)}
                        >
                            <NavigateBeforeRounded />
                        </IconButton>

                        <Typography variant="body2" sx={{ minWidth: 72, textAlign: "center", fontWeight: 700 }}>
                            Round: {round}
                        </Typography>

                        <IconButton size="small" onClick={onNext} disabled={!started || activeRenderItems.length === 0}>
                            <NavigateNextRounded />
                        </IconButton>
                    </Stack>

                    <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Tooltip title="Settings">
                            <IconButton size="small" onClick={onOpenSettings}>
                                <SettingsRounded fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Patreon">
                            <IconButton
                                size="small"
                                component="a"
                                href="https://www.patreon.com/MissingLinkDev"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Box
                                    component="img"
                                    src="/patreon-icon.png"
                                    alt="Patreon"
                                    sx={{ width: 20, height: 20 }}
                                />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                </Stack>
            </Box>

            {/* Staged Groups Section - Below control bar */}
            {stagedRenderItems.length > 0 && (
                <TableContainer
                    component={Paper}
                    sx={{
                        borderRadius: 0,
                        borderTop: 1,
                        borderColor: "divider",
                        flexShrink: 0,
                        overflow: "auto",
                    }}
                >
                    <Table
                        size="small"
                        sx={{
                            tableLayout: "fixed",
                            width: "100%",
                            "& td, & th": { py: 0.25, px: 0.25 },
                            "& thead th": { fontSize: "0.72rem", letterSpacing: 0.4, py: 0.9, height: 28 },
                        }}
                    >
                        {/* Hidden header to maintain column widths */}
                        <colgroup>
                            <col style={{ width: "22px" }} />
                            <col style={{ width: "40px" }} />
                            <col />
                            {showAC && <col style={{ width: "36px" }} />}
                            {showHP && <col style={{ width: "62px" }} />}
                            {showHP && <col style={{ width: "36px" }} />}
                            {showConc && <col style={{ width: "28px" }} />}
                            {showDMR && <col style={{ width: "24px" }} />}
                        </colgroup>
                        <TableBody>
                            {stagedRenderItems.map((renderItem) => {
                                if (renderItem.type === 'group') {
                                    return (
                                        <GroupRow
                                            key={`staged-group-${renderItem.group.id}`}
                                            group={renderItem.group}
                                            items={renderItem.items}
                                            expanded={expandedIds.has(`group-${renderItem.group.id}`)}
                                            onToggleExpand={() => {
                                                onToggleExpand(`group-${renderItem.group.id}`);
                                                onRequestResize?.();
                                            }}
                                            onRowChange={onRowChange}
                                            onRowRemove={onRowRemove}
                                            settings={{
                                                showMovementRange: settings.showMovementRange,
                                                showAttackRange: settings.showAttackRange,
                                                showConditions: settings.showConditions,
                                                showDistances: settings.showDistances,
                                                showAC,
                                                showHP,
                                                showDMR,
                                                showConc,
                                            }}
                                            globalSettings={globalSettings}
                                            started={started}
                                            tokens={tokens}
                                            colSpan={gmColCount}
                                            groups={groups}
                                            ready={ready}
                                            expandedIds={expandedIds}
                                            onToggleItemExpand={(itemId) => {
                                                onToggleExpand(itemId);
                                                onRequestResize?.();
                                            }}
                                            staged={renderItem.staged}
                                            onGroupStagingToggle={handleGroupStagingToggle}
                                            onGroupUngroup={handleGroupUngroup}
                                        />
                                    );
                                }
                                return null; // Staged section should only have groups
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );
}