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

import type { Combatant, CombatantPatch } from "../encounter";
import type { InitiativeSettings } from "../settings";
import type { Group } from "../encounter";
import type { CMToken } from "./tokens";
import { useMemo } from "react";
import { canPrev, stagedGroups, turnOrder, type Turn } from "../encounter/turnOrder";
import StopRounded from "@mui/icons-material/StopRounded";

type Props = {
    items: Combatant[];
    expandedIds: Set<string>;
    onToggleExpand: (id: string) => void;
    onRowChange: (id: string, draft: CombatantPatch) => void;
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
    groups: Group[];
    /** Ask parent to re-measure the action panel (optional) */
    onRequestResize?: () => void;
};

// Helper type for rendering
type RenderItem = {
    type: 'group';
    group: Group;
    items: Combatant[];
    staged: boolean;
} | {
    type: 'individual';
    item: Combatant;
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
    groups,
    onRequestResize,
}: Props) {
    const showAC = settings.showArmor;
    const showHP = settings.showHP;
    const showDMR = settings.dmRingToggle;
    const showConc = settings.showConcentration;

    const gmColCount = 3 + (showAC ? 1 : 0) + (showHP ? 2 : 0) + (showConc ? 1 : 0) + (showDMR ? 1 : 0);

    // Display order is the turn order, by construction.
    const { activeRenderItems, stagedRenderItems } = useMemo(() => {
        const toRenderItem = (turn: Turn): RenderItem => turn.kind === "group"
            ? { type: "group", group: turn.group, items: turn.members, staged: false }
            : { type: "individual", item: turn.combatant };
        const byId = new Map(items.map((c) => [c.id, c]));
        return {
            activeRenderItems: turnOrder({ combatants: items, groups }).map(toRenderItem),
            stagedRenderItems: stagedGroups(groups).map((group): RenderItem => ({
                type: "group",
                group,
                items: group.memberIds.map((id) => byId.get(id)).filter((c): c is Combatant => !!c),
                staged: true,
            })),
        };
    }, [items, groups]);

    const prevDisabled = !canPrev({ combatants: items, groups, started, round });

    // Staging and ungrouping change row counts; the store handles the turn.
    const handleGroupChanged = () => {
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
                                    expandedIds={expandedIds}
                                    onToggleItemExpand={(itemId) => {
                                        onToggleExpand(itemId);
                                        onRequestResize?.();
                                    }}
                                    staged={renderItem.staged}
                                    onGroupStagingToggle={handleGroupChanged}
                                    onGroupUngroup={handleGroupChanged}
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
                                    items={items}
                                    colSpan={gmColCount}
                                    groups={groups}
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
                            disabled={prevDisabled}
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
                                            expandedIds={expandedIds}
                                            onToggleItemExpand={(itemId) => {
                                                onToggleExpand(itemId);
                                                onRequestResize?.();
                                            }}
                                            staged={renderItem.staged}
                                            onGroupStagingToggle={handleGroupChanged}
                                            onGroupUngroup={handleGroupChanged}
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