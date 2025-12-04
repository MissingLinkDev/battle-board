import { useMemo } from "react";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUp from "@mui/icons-material/KeyboardArrowUp";
import Stack from "@mui/material/Stack";
import VisibilityOffRounded from "@mui/icons-material/VisibilityOffRounded";
import RadarRounded from "@mui/icons-material/RadarRounded";
import Checkbox from "@mui/material/Checkbox";

import type { InitiativeItem } from "./InitiativeItem";
import { CommitNumberField } from "./CommitFields";
import { DistancePanel } from "./DistancePanel";
import { RingControls } from "./RingControls";
import type { CMToken } from "./tokens";
import { useDistances } from "../hooks/useDistances";
import { useRingState } from "../hooks/useRingState";
import { useRingManager } from "../hooks/useRingsManager";
import type { InitiativeSettings } from "./SceneState";
import type { Group } from "./SceneState";
import { useContextMenu } from "../hooks/useContextMenu";
import { useHPEditing } from "../hooks/useHPEditing";
import { InitiativeRowContextMenu } from "./InitiativeRowContextMenu";

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
    row: InitiativeItem;
    expanded?: boolean;
    onToggleExpand?: () => void;
    onRequestActivate?: () => void;
    onChange?: (draft: Partial<InitiativeItem>) => void;
    onSizeChange?: () => void;
    onRemove?: (id: string) => void;
    settings?: RowSettings;
    globalSettings: InitiativeSettings;
    started: boolean;
    tokens: CMToken[];
    items?: InitiativeItem[];
    colSpan?: number;
    ready?: boolean;
    groups: Group[];
    hideInitiative?: boolean;
};

export default function InitiativeRow({
    row,
    expanded,
    onToggleExpand,
    onRequestActivate,
    onChange,
    onSizeChange,
    onRemove,
    settings,
    globalSettings,
    tokens,
    items,
    started,
    colSpan,
    ready = true,
    groups = [],
    hideInitiative = false, // NEW: Default to false
}: Props) {
    // Custom hooks for cleaner logic separation
    const { contextMenu, handleContextMenu, handleClose } = useContextMenu();
    const {
        editingField,
        setEditingField,
        commitAc,
        commitCurrentHP,
        commitTempHP,
        applyMaxChange
    } = useHPEditing(row, started, onChange || (() => { }));

    // Use the dmPreview from the row data directly instead of local state
    const dmPreview = !!row.dmPreview;

    // Centralized hooks
    const distances = useDistances(row.id, tokens, settings?.showDistances, "box", items);
    const { config } = useRingState(row);

    // Ring management with centralized logic
    useRingManager({
        tokenId: row.id,
        active: row.active,
        started,
        playerCharacter: !!row.playerCharacter,
        showGlobalRings: globalSettings.showRangeRings,
        showDmPreview: dmPreview,
        ready,
    }, config);

    const inputSx = useMemo(() => ({
        "& .MuiOutlinedInput-root": { borderRadius: 0.25, height: 28, p: 0 },
        "& .MuiOutlinedInput-input": { fontSize: "0.8rem", lineHeight: 1.25, py: 0 },
    }), []);

    const baseHtmlInput = useMemo(() => ({
        inputMode: "numeric" as const,
        pattern: "[0-9]*",
        style: { textAlign: "center" as const, padding: "0 1px", fontSize: "0.8rem" },
    }), []);

    const hpTextSx = useMemo(() => ({
        fontSize: "0.8rem",
        fontWeight: 600,
        lineHeight: 1.25
    }), []);

    const vis = useMemo(() => ({
        ac: settings?.showAC ?? true,
        hp: settings?.showHP ?? true,
        move: settings?.showMovementRange ?? true,
        range: settings?.showAttackRange ?? true,
        conditions: settings?.showConditions ?? true,
        distances: settings?.showDistances ?? true,
        dmr: settings?.showDMR ?? true,
        conc: settings?.showConc ?? false,
    }), [settings]);

    // Event handlers
    const bubble = (draft: Partial<InitiativeItem>) => onChange?.(draft);

    const toggleDmPreview = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const next = !dmPreview;
        bubble({ dmPreview: next });
    };

    return (
        <>
            <TableRow
                hover
                selected={!!row.active}
                onClick={() => {
                    onToggleExpand?.();
                    onRequestActivate?.();
                }}
                onContextMenu={handleContextMenu}
                sx={{
                    cursor: "context-menu",
                    "& > td, & > th": (theme) => ({
                        borderBottom: expanded ? "none" : `1px solid ${theme.palette.divider}`,
                    }),
                    "& td": { py: 0.5, px: 0.5 },
                    borderLeft: row.active ? "3px solid" : "3px solid transparent",
                    borderLeftColor: row.active ? "success.light" : "transparent",
                }}
            >
                {/* Expand chevron */}
                <TableCell width={18} onClick={(e) => e.stopPropagation()}>
                    <IconButton
                        aria-label="expand row"
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
                    {!hideInitiative ?
                        <CommitNumberField
                            size="small"
                            variant="outlined"
                            value={row.initiative}
                            allowMath={false}
                            inputMode="decimal"
                            pattern="[0-9]*\\.?[0-9]?"
                            finalize={(n) => Math.round(n * 10) / 10}
                            onCommit={(val) => bubble({ initiative: val })}
                            sx={inputSx}
                            slotProps={{
                                htmlInput: {
                                    ...baseHtmlInput,
                                    autoFocus: true,
                                    onFocus: (e: any) => e.currentTarget.select(),
                                    "aria-label": "initiative",
                                    style: { ...baseHtmlInput.style, width: 32 },
                                },
                            }}
                        />
                        : null}
                </TableCell>

                {/* NAME */}
                <TableCell sx={{
                    fontWeight: 600,
                    fontSize: "0.8rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    pl: hideInitiative ? 3 : undefined, // Indent when part of a group
                }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0, maxWidth: "100%" }}>
                        {row.visible === false && (
                            <Box sx={{ width: 12, height: 12, lineHeight: 0 }}>
                                <VisibilityOffRounded sx={{ fontSize: 12, display: "block", opacity: 0.7 }} />
                            </Box>
                        )}
                        <Box
                            component="span"
                            sx={{
                                minWidth: 0,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                font: "inherit",
                                lineHeight: "inherit",
                            }}
                        >
                            {row.name ?? <em>Unnamed</em>}
                        </Box>
                    </Box>
                </TableCell>

                {/* AC */}
                {vis.ac && (
                    <TableCell width={36} align="center" onClick={(e) => e.stopPropagation()} sx={{ cursor: "default" }}>
                        {editingField === "ac" ? (
                            <CommitNumberField
                                size="small"
                                variant="outlined"
                                value={row.ac}
                                onCommit={commitAc}
                                sx={inputSx}
                                slotProps={{
                                    htmlInput: {
                                        ...baseHtmlInput,
                                        autoFocus: true,
                                        onFocus: (e: any) => e.currentTarget.select(),
                                        "aria-label": "armor class",
                                        style: { ...baseHtmlInput.style, width: 34 },
                                    },
                                }}
                            />
                        ) : (
                            <Typography
                                component="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingField("ac");
                                }}
                                style={{ all: "unset", cursor: "text" }}
                            >
                                <Typography component="span" sx={{ fontSize: "0.9rem", lineHeight: 1.1 }}>
                                    {row.ac}
                                </Typography>
                            </Typography>
                        )}
                    </TableCell>
                )}

                {/* HP */}
                {vis.hp && (
                    <>
                        <TableCell width={62} align="center" onClick={(e) => e.stopPropagation()} sx={{ cursor: "default" }}>
                            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                                {/* CURRENT */}
                                {editingField === "cur" ? (
                                    <CommitNumberField
                                        size="small"
                                        variant="outlined"
                                        value={row.currentHP}
                                        allowMath
                                        min={0}
                                        max={Math.max(0, row.maxHP)}
                                        onCommit={commitCurrentHP}
                                        sx={inputSx}
                                        slotProps={{
                                            htmlInput: {
                                                ...baseHtmlInput,
                                                inputMode: "text",
                                                pattern: undefined,
                                                autoFocus: true,
                                                onFocus: (e: any) => e.currentTarget.select(),
                                                "aria-label": "current hp",
                                                style: { ...baseHtmlInput.style, width: 34 },
                                            },
                                        }}
                                    />
                                ) : (
                                    <Typography
                                        component="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingField("cur");
                                        }}
                                        style={{ all: "unset", cursor: "text" }}
                                    >
                                        <Typography component="span" sx={hpTextSx}>
                                            {row.currentHP}
                                        </Typography>
                                    </Typography>
                                )}

                                <Typography component="span" sx={{ fontSize: "0.95rem", opacity: 0.85 }}>
                                    /
                                </Typography>

                                {/* MAX */}
                                {editingField === "max" ? (
                                    <CommitNumberField
                                        size="small"
                                        variant="outlined"
                                        value={row.maxHP}
                                        allowMath
                                        min={0}
                                        onCommit={applyMaxChange}
                                        sx={inputSx}
                                        slotProps={{
                                            htmlInput: {
                                                ...baseHtmlInput,
                                                inputMode: "text",
                                                pattern: undefined,
                                                autoFocus: true,
                                                onFocus: (e: any) => e.currentTarget.select(),
                                                "aria-label": "max hp",
                                                style: { ...baseHtmlInput.style, width: 34 },
                                            },
                                        }}
                                    />
                                ) : (
                                    <Typography
                                        component="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingField("max");
                                        }}
                                        style={{ all: "unset", cursor: "text" }}
                                    >
                                        <Typography component="span" sx={hpTextSx}>
                                            {row.maxHP}
                                        </Typography>
                                    </Typography>
                                )}
                            </Box>
                        </TableCell>

                        {/* TEMP */}
                        <TableCell width={36} align="center" onClick={(e) => e.stopPropagation()} sx={{ cursor: "default" }}>
                            {editingField === "temp" ? (
                                <CommitNumberField
                                    size="small"
                                    variant="outlined"
                                    value={row.tempHP}
                                    allowMath
                                    onCommit={commitTempHP}
                                    sx={inputSx}
                                    slotProps={{
                                        htmlInput: {
                                            ...baseHtmlInput,
                                            inputMode: "text",
                                            pattern: undefined,
                                            autoFocus: true,
                                            onFocus: (e: any) => e.currentTarget.select(),
                                            "aria-label": "temp hp",
                                            style: { ...baseHtmlInput.style, width: 34 },
                                        },
                                    }}
                                />
                            ) : (
                                <Typography
                                    component="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingField("temp");
                                    }}
                                    style={{ all: "unset", cursor: "text" }}
                                >
                                    <Typography component="span" sx={hpTextSx}>
                                        {row.tempHP || 0}
                                    </Typography>
                                </Typography>
                            )}
                        </TableCell>
                    </>
                )}

                {/* CONCENTRATION */}
                {vis.conc && (
                    <TableCell width={28} align="center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                            checked={!!row.concentrating}
                            onChange={(e) => {
                                e.stopPropagation();
                                bubble({ concentrating: !row.concentrating });
                            }}
                            size="small"
                            sx={{
                                p: 0,
                                width: 24,
                                height: 24,
                            }}
                            aria-label="concentration"
                        />
                    </TableCell>
                )}

                {/* DM PREVIEW TOGGLE */}
                {vis.dmr && (
                    <TableCell width={24} align="center" onClick={(e) => e.stopPropagation()}>
                        <Box
                            onClick={toggleDmPreview}
                            sx={{
                                width: 18,
                                height: 18,
                                lineHeight: 0,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                color: dmPreview ? "primary.main" : "text.secondary",
                            }}
                            aria-label="DM rings"
                            role="switch"
                            aria-checked={dmPreview}
                        >
                            <RadarRounded sx={{ fontSize: 18, display: "block" }} />
                        </Box>
                    </TableCell>
                )}
            </TableRow>

            {/* Context Menu */}
            <InitiativeRowContextMenu
                row={row}
                groups={groups}
                contextMenu={contextMenu}
                onClose={handleClose}
                onRemove={onRemove || (() => { })}
                onChange={bubble}
                globalSettings={globalSettings}
            />

            {/* Expanded panel */}
            <TableRow
                sx={{
                    "& > td": (theme) => ({
                        paddingTop: 0,
                        paddingBottom: 0,
                        borderBottom: expanded ? `1px solid ${theme.palette.divider}` : "none",
                    }),
                }}
            >
                <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={colSpan ?? 7}>
                    <Collapse
                        in={!!expanded}
                        timeout="auto"
                        unmountOnExit
                        onEntered={onSizeChange}
                        onExited={onSizeChange}
                        onEntering={onSizeChange}
                    >
                        <Box sx={{ px: 1, pb: 1 }}>
                            <Stack direction="row" spacing={1.5} alignItems="stretch">
                                {/* Left: Ring Controls */}
                                <RingControls
                                    row={row}
                                    config={config}
                                    onUpdate={bubble}
                                />

                                <Divider orientation="vertical" flexItem />

                                {/* Right: Distances */}
                                {vis.distances ? (
                                    <DistancePanel distances={distances} />
                                ) : (
                                    <Box sx={{ flex: 1, minWidth: 0 }} />
                                )}
                            </Stack>
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
        </>
    );
}