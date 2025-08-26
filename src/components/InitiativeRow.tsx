import { useEffect, useMemo, useState, useRef } from "react";
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
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import VisibilityOffRounded from "@mui/icons-material/VisibilityOffRounded";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import RadarRounded from "@mui/icons-material/RadarRounded";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Tooltip from "@mui/material/Tooltip";
import InfoRounded from "@mui/icons-material/InfoRounded";

import type { InitiativeItem } from "./InitiativeItem";
import { CommitNumberField } from "./CommitFields";
import { ensureRings, clearRingsFor } from "./rings";
import ColorPicker from "./ColorPicker";
import type { CMToken } from "./tokens";
import { getGridInfo, formatFeet, type TokenDistanceMode, distanceBetweenTokensUnits, formatDistanceLabel } from "./utils";

type RowSettings = {
    showMovementRange: boolean;
    showAttackRange: boolean;
    showConditions: boolean;
    showDistances: boolean;
    showAC: boolean;
    showHP: boolean;
    showDMR: boolean;
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
    started: boolean;
    tokens: CMToken[];
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
    tokens,
    started,
}: Props) {
    // ------------ Local mirrors ------------
    const [initiative, setInitiative] = useState(row.initiative);
    const [currentHP, setCurrentHP] = useState(row.currentHP);
    const [maxHP, setMaxHP] = useState(row.maxHP);
    const [tempHP, setTempHP] = useState(row.tempHP);
    const [ac, setAc] = useState(row.ac);
    const [movement, setMovement] = useState(row.movement);
    const [attackRange, setAttackRange] = useState(row.attackRange);
    const [playerCharacter, setPlayerCharacter] = useState(!!row.playerCharacter);

    // ring style mirrors
    const [movementColor, setMovementColor] = useState<string | null>(row.movementColor ?? null);
    const [rangeColor, setRangeColor] = useState<string | null>(row.rangeColor ?? null);
    const [moveWeight, setMoveWeight] = useState<number>(row.movementWeight ?? 10);
    const [movePattern, setMovePattern] = useState<"solid" | "dash">(row.movementPattern ?? "dash");
    const [moveOpacity, setMoveOpacity] = useState<number>(row.movementOpacity ?? 1);
    const [rangeWeight, setRangeWeight] = useState<number>(row.rangeWeight ?? 10);
    const [rangePattern, setRangePattern] = useState<"solid" | "dash">(row.rangePattern ?? "dash");
    const [rangeOpacity, setRangeOpacity] = useState<number>(row.rangeOpacity ?? 1);

    // distances + dm preview
    const [distances, setDistances] = useState<{ id: string; name: string; ft: number }[]>([]);
    const [dmPreview, setDmPreview] = useState(!!row.dmPreview);

    // single reference for "did active state change?"
    const lastActiveRef = useRef(row.active);
    // cancel token for in-flight ring updates
    const cancelRef = useRef({ cancelled: false });
    //inline editing
    const [editingField, setEditingField] = useState<null | "cur" | "max" | "temp" | "ac">(null);

    // ------------ Sync incoming props to local ------------
    useEffect(() => {
        setInitiative(row.initiative);
        setCurrentHP(row.currentHP);
        setMaxHP(row.maxHP);
        setTempHP(row.tempHP);
        setAc(row.ac);
        setMovement(row.movement);
        setAttackRange(row.attackRange);
        setPlayerCharacter(!!row.playerCharacter);

        setMovementColor(row.movementColor ?? null);
        setRangeColor(row.rangeColor ?? null);
        setMoveWeight(row.movementWeight ?? 10);
        setMovePattern(row.movementPattern ?? "dash");
        setMoveOpacity(row.movementOpacity ?? 1);
        setRangeWeight(row.rangeWeight ?? 10);
        setRangePattern(row.rangePattern ?? "dash");
        setRangeOpacity(row.rangeOpacity ?? 1);

        setDmPreview(!!row.dmPreview);
    }, [row]);

    // ------------ Small helpers ------------
    const bubble = (draft: Partial<InitiativeItem>) => onChange?.(draft);

    const inputSx = useMemo(
        () => ({
            "& .MuiOutlinedInput-root": { borderRadius: 0.25, height: 28, p: 0 },
            "& .MuiOutlinedInput-input": { fontSize: "0.8rem", lineHeight: 1.25, py: 0 },
        }),
        []
    );
    const baseHtmlInput = useMemo(
        () => ({
            inputMode: "numeric" as const,
            pattern: "[0-9]*",
            style: { textAlign: "center" as const, padding: "0 1px", fontSize: "0.8rem" },
        }),
        []
    );
    const hpTextSx = useMemo(() => ({ fontSize: "0.8rem", fontWeight: 600, lineHeight: 1.25 }), []);

    const vis = {
        ac: settings?.showAC ?? true,
        hp: settings?.showHP ?? true,
        move: settings?.showMovementRange ?? true,
        range: settings?.showAttackRange ?? true,
        conditions: settings?.showConditions ?? true,
        distances: settings?.showDistances ?? true,
        dmr: settings?.showDMR ?? true,
    };

    // ------------ DM PREVIEW: single effect, one call ------------
    useEffect(() => {
        // cancel any previous async run
        cancelRef.current.cancelled = true;
        cancelRef.current = { cancelled: false };

        // nothing to do if toggle is off
        if (!dmPreview) return;

        // only preview for this token; do not enforce global exclusivity here
        // compute "active changed" once
        const activeChanged = row.active !== lastActiveRef.current;
        lastActiveRef.current = row.active;

        (async () => {
            try {
                // coalesce both rings into one ensure call (no more "only: move/range" two-step)
                await ensureRings({
                    tokenId: row.id,
                    movement,
                    attackRange,
                    moveAttached: false,
                    rangeAttached: true,
                    visible: false,
                    variant: "dm",
                    movementColor,
                    rangeColor,
                    movementWeight: moveWeight,
                    rangeWeight,
                    movementPattern: movePattern,
                    rangePattern,
                    movementOpacity: moveOpacity,
                    rangeOpacity,
                    forceRecenter: activeChanged,
                });
            } catch (e) {
                console.error(e);
            }
        })();

        // cleanup: if the effect re-runs or unmounts and the toggle is off, remove our rings
        return () => {
            // if we’re turning preview OFF (next run or unmount), clear just our token’s dm rings
            if (!dmPreview) {
                clearRingsFor(row.id, "dm").catch(() => { });
            }
        };
        // trigger on any relevant change
    }, [
        dmPreview,
        row.id,
        row.active,
        movement,
        attackRange,
        movementColor,
        rangeColor,
        moveWeight,
        rangeWeight,
        movePattern,
        rangePattern,
        moveOpacity,
        rangeOpacity,
    ]);

    // Always clear this row's DM rings when unmounting or token id changes
    useEffect(() => {
        return () => {
            clearRingsFor(row.id, "dm").catch(() => { });
        };
    }, [row.id]);

    const toggleDmPreview = async (e: React.MouseEvent) => {
        e.stopPropagation();
        // optimistic local toggle
        const next = !dmPreview;
        setDmPreview(next);
        bubble({ dmPreview: next });
        // when turning off, be explicit about clearing
        if (!next) await clearRingsFor(row.id, "dm").catch(() => { });
    };

    // ------------ Distances list ------------
    useEffect(() => {
        let cancelled = false;

        (async () => {
            if (!settings?.showDistances) {
                setDistances([]);
                return;
            }

            const me = tokens.find((t) => t.id === row.id);
            if (!me) {
                setDistances([]);
                return;
            }

            const grid = await getGridInfo();
            const modeSetting = (settings as any)?.distanceMode ?? "edge";
            const tokenMode: TokenDistanceMode = modeSetting === "edge" ? "box" : "center";

            const list = tokens
                .filter((t) => t.id !== row.id && t.visible !== false)
                .map((t) => {
                    const raw = distanceBetweenTokensUnits(me, t, grid, tokenMode); // feet
                    return {
                        id: t.id,
                        name: t.name || "(unnamed)",
                        ft: formatFeet(raw),          // numeric, good for sorting/comparisons
                        text: formatDistanceLabel(raw) // "Touch" if <5, else "N ft"
                    };
                })
                .sort((a, b) => a.ft - b.ft);

            if (!cancelled) setDistances(list);
        })();

        return () => {
            cancelled = true;
        };
    }, [tokens, row.id, settings?.showDistances]);

    //inline editing helpers
    const commitAc = (v: number) => {
        const next = Math.max(0, v);
        setAc(next);
        bubble({ ac: next });
        setEditingField(null);
    };

    const applyMaxChange = (nextMaxRaw: number) => {
        const m = Math.max(0, nextMaxRaw);
        const prevMax = row.maxHP;
        let nextCur = currentHP;

        if (!started) {
            const delta = m - prevMax;
            nextCur = currentHP + delta;
            if (nextCur < 0) nextCur = 0;
            if (nextCur > m) nextCur = m;
        } else {
            if (nextCur > m) nextCur = m;
        }

        setMaxHP(m);
        if (nextCur !== currentHP) setCurrentHP(nextCur);

        const patch: Partial<InitiativeItem> = { maxHP: m };
        if (nextCur !== currentHP) patch.currentHP = nextCur;
        onChange?.(patch);

        setEditingField(null);
    };

    const keyCommit = (doCommit: () => void) => (e: React.KeyboardEvent) => {
        if (e.key === "Enter") doCommit();
        if (e.key === "Escape") setEditingField(null);
    };

    const clickCommit =
        (commit: () => void) =>
            (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
                const el = e.currentTarget as HTMLInputElement;
                if (document.activeElement === el) {
                    e.preventDefault();
                    commit();
                }
            };

    // ------------ Render ------------
    const [menuPos, setMenuPos] = useState<{ mouseX: number; mouseY: number } | null>(null);
    const handleContextMenuCapture = (e: React.MouseEvent) => {
        e.preventDefault();
        setMenuPos(null);
        requestAnimationFrame(() => setMenuPos({ mouseX: e.clientX + 2, mouseY: e.clientY - 6 }));
    };
    const closeMenu = () => setMenuPos(null);

    return (
        <>
            <TableRow
                hover
                selected={!!row.active}
                onClick={() => {
                    onToggleExpand?.();
                    onRequestActivate?.();
                }}
                onContextMenuCapture={handleContextMenuCapture}
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
                        {expanded ? <KeyboardArrowUp sx={{ fontSize: "1rem" }} /> : <KeyboardArrowDown sx={{ fontSize: "1rem" }} />}
                    </IconButton>
                </TableCell>

                {/* INIT */}
                <TableCell width={40} align="center" onClick={(e) => e.stopPropagation()}>
                    <CommitNumberField
                        size="small"
                        variant="outlined"
                        value={initiative}
                        allowMath={false}
                        inputMode="decimal"
                        pattern="[0-9]*\\.?[0-9]?"
                        finalize={(n) => Math.round(n * 10) / 10}
                        onCommit={(val) => {
                            setInitiative(val);
                            bubble({ initiative: val });
                        }}
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
                </TableCell>

                {/* NAME */}
                <TableCell sx={{ fontWeight: 600, fontSize: "0.8rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
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
                {vis.ac ? (
                    <TableCell width={36} align="center" onClick={(e) => e.stopPropagation()} sx={{ cursor: "default" }}>
                        {editingField === "ac" ? (
                            <CommitNumberField
                                size="small"
                                variant="outlined"
                                value={ac}
                                onCommit={commitAc}
                                onBlur={() => commitAc(ac)}
                                onKeyDown={keyCommit(() => commitAc(ac))}
                                sx={inputSx}
                                slotProps={{
                                    htmlInput: {
                                        ...baseHtmlInput,
                                        autoFocus: true,
                                        onFocus: (e: any) => e.currentTarget.select(),
                                        "aria-label": "armor class",
                                        style: { ...baseHtmlInput.style, width: 34 },
                                        onChange: (e: any) => {
                                            const n = Number(e.target.value.replace(/[^\d-]/g, ""));
                                            if (Number.isFinite(n)) setAc(n);
                                        },
                                        onBlur: () => commitAc(ac),
                                        onMouseDown: clickCommit(() => commitAc(ac)),
                                        onTouchStart: clickCommit(() => commitAc(ac)),
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
                                    {ac}
                                </Typography>
                            </Typography>
                        )}
                    </TableCell>
                ) : null}

                {/* HP */}
                {vis.hp ? (
                    <>
                        <TableCell width={62} align="center" onClick={(e) => e.stopPropagation()} sx={{ cursor: "default" }}>
                            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                                {/* CURRENT */}
                                {editingField === "cur" ? (
                                    <CommitNumberField
                                        size="small"
                                        variant="outlined"
                                        value={currentHP}
                                        allowMath
                                        min={0}
                                        max={Math.max(0, maxHP)}
                                        onCommit={(val) => {
                                            setCurrentHP(val);
                                            bubble({ currentHP: val });
                                            setEditingField(null);
                                        }}
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
                                            {currentHP}
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
                                        value={maxHP}
                                        allowMath
                                        min={0}
                                        onCommit={(nextMax) => applyMaxChange(nextMax)}
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
                                            {maxHP}
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
                                    value={tempHP}
                                    allowMath
                                    min={0}
                                    onCommit={(val) => {
                                        setTempHP(val);
                                        bubble({ tempHP: val });
                                        setEditingField(null);
                                    }}
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
                                        {tempHP || 0}
                                    </Typography>
                                </Typography>
                            )}
                        </TableCell>
                    </>
                ) : null}

                {/* DM PREVIEW TOGGLE */}
                {vis.dmr ? (
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
                ) : null}
            </TableRow>

            {/* Context menu */}
            <Menu
                open={!!menuPos}
                onClose={closeMenu}
                anchorReference="anchorPosition"
                anchorPosition={menuPos ? { top: menuPos.mouseY, left: menuPos.mouseX } : undefined}
            >
                <MenuItem
                    onClick={() => {
                        closeMenu();
                        onRemove?.(row.id);
                    }}
                >
                    Remove
                </MenuItem>
            </Menu>

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
                <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
                    <Collapse in={!!expanded} timeout="auto" unmountOnExit onEntered={onSizeChange} onExited={onSizeChange} onEntering={onSizeChange}>
                        <Box sx={{ px: 1, pb: 1 }}>
                            <Stack direction="row" spacing={1.5} alignItems="stretch">
                                {/* Left: Overlays */}
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography sx={{ fontWeight: 700, fontSize: "0.95rem", textAlign: "center", mb: 0.75 }}>
                                        Overlays
                                    </Typography>

                                    {/* Player Character toggle (centered) */}
                                    <Box sx={{ display: "flex", justifyContent: "center", mb: 1 }}>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    size="small"
                                                    checked={playerCharacter}
                                                    onChange={(e) => {
                                                        const val = e.target.checked;
                                                        setPlayerCharacter(val);
                                                        bubble({ playerCharacter: val });
                                                    }}
                                                />
                                            }
                                            label="Player Character"
                                            sx={{ "& .MuiFormControlLabel-label": { fontSize: "0.8rem" } }}
                                        />
                                    </Box>

                                    <Stack spacing={1}>
                                        {/* MOVE */}
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                                            <ColorPicker
                                                value={movementColor}
                                                onChange={(hex) => {
                                                    setMovementColor(hex);
                                                    bubble({ movementColor: hex });
                                                }}
                                                weight={moveWeight}
                                                onChangeWeight={(w) => {
                                                    setMoveWeight(w);
                                                    bubble({ movementWeight: w });
                                                }}
                                                pattern={movePattern}
                                                onChangePattern={(p) => {
                                                    setMovePattern(p);
                                                    bubble({ movementPattern: p });
                                                }}
                                                opacity={moveOpacity}
                                                onChangeOpacity={(o) => {
                                                    setMoveOpacity(o);
                                                    bubble({ movementOpacity: o });
                                                }}
                                            />

                                            <Typography sx={{ fontSize: "0.85rem", flexShrink: 0 }}>Movement</Typography>
                                            <Box sx={{ flex: 1, minWidth: 0 }} />

                                            <CommitNumberField
                                                size="small"
                                                variant="outlined"
                                                value={movement}
                                                onCommit={(v) => {
                                                    setMovement(v);
                                                    bubble({ movement: v });
                                                }}
                                                sx={{
                                                    "& .MuiOutlinedInput-root": { borderRadius: 0.5, fontSize: "0.85rem", height: 28, p: 0 },
                                                }}
                                                slotProps={{
                                                    htmlInput: {
                                                        inputMode: "numeric",
                                                        pattern: "[0-9]*",
                                                        "aria-label": "movement",
                                                        style: { textAlign: "center", padding: "0 2px", width: "5ch", fontSize: "0.85rem" },
                                                    },
                                                }}
                                            />
                                            <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", ml: 0.75, flexShrink: 0 }}>ft</Typography>
                                        </Box>

                                        {/* RANGE */}
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                                            <ColorPicker
                                                value={rangeColor}
                                                onChange={(hex) => {
                                                    setRangeColor(hex);
                                                    bubble({ rangeColor: hex });
                                                }}
                                                weight={rangeWeight}
                                                onChangeWeight={(w) => {
                                                    setRangeWeight(w);
                                                    bubble({ rangeWeight: w });
                                                }}
                                                pattern={rangePattern}
                                                onChangePattern={(p) => {
                                                    setRangePattern(p);
                                                    bubble({ rangePattern: p });
                                                }}
                                                opacity={rangeOpacity}
                                                onChangeOpacity={(o) => {
                                                    setRangeOpacity(o);
                                                    bubble({ rangeOpacity: o });
                                                }}
                                            />

                                            <Typography sx={{ fontSize: "0.85rem", flexShrink: 0 }}>Atk Range</Typography>
                                            <Box sx={{ flex: 1, minWidth: 0 }} />

                                            <CommitNumberField
                                                size="small"
                                                variant="outlined"
                                                value={attackRange}
                                                onCommit={(v) => {
                                                    setAttackRange(v);
                                                    bubble({ attackRange: v });
                                                }}
                                                sx={{
                                                    "& .MuiOutlinedInput-root": { borderRadius: 0.5, fontSize: "0.85rem", height: 28, p: 0 },
                                                }}
                                                slotProps={{
                                                    htmlInput: {
                                                        inputMode: "numeric",
                                                        pattern: "[0-9]*",
                                                        "aria-label": "attack range",
                                                        style: { textAlign: "center", padding: "0 2px", width: "5ch", fontSize: "0.85rem" },
                                                    },
                                                }}
                                            />
                                            <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", ml: 0.75, flexShrink: 0 }}>ft</Typography>
                                        </Box>
                                    </Stack>
                                </Box>

                                <Divider orientation="vertical" flexItem />

                                {/* Right: Distances */}
                                {vis.distances ? (
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Stack direction="row" alignItems="center" justifyContent="center" sx={{ px: 1, py: 0.5 }}>
                                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                                <Typography sx={{ fontWeight: 700, fontSize: "0.95rem", textAlign: "center", mb: 0.75 }}>
                                                    Distances
                                                </Typography>
                                                <Tooltip title="Measured from edge to edge; attack range must be greater than distance." enterDelay={300}>
                                                    <InfoRounded fontSize="small" sx={{ color: "text.secondary", cursor: "help" }} />
                                                </Tooltip>
                                            </Stack>
                                        </Stack>
                                        <List dense disablePadding sx={{ px: 0, "& .MuiListItem-root": { py: 0.25 } }}>
                                            {distances.length === 0 ? (
                                                <ListItem disableGutters>
                                                    <Typography sx={{ fontSize: "0.8rem", color: "text.secondary" }}>No other tokens found.</Typography>
                                                </ListItem>
                                            ) : (
                                                distances.map((d) => (
                                                    <ListItem key={d.id} disableGutters sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                                        <Typography
                                                            sx={{
                                                                flex: 1,
                                                                minWidth: 0,
                                                                overflow: "hidden",
                                                                textOverflow: "ellipsis",
                                                                whiteSpace: "nowrap",
                                                                fontSize: "0.8rem",
                                                            }}
                                                        >
                                                            {d.name}
                                                        </Typography>
                                                        <Typography
                                                            sx={{
                                                                flex: "0 0 35px",
                                                                textAlign: "right",
                                                                fontSize: "0.8rem",
                                                                color: "text.secondary",
                                                            }}
                                                        >
                                                            {d.ft < 5 ? "Touch" : `${d.ft} ft`}
                                                        </Typography>
                                                    </ListItem>
                                                ))
                                            )}
                                        </List>
                                    </Box>
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
