import { useEffect, useMemo, useState } from "react";
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

import type { InitiativeItem } from "./InitiativeItem";
import { CommitNumberField } from "./CommitFields";
import { ensureRings, clearRingsFor } from "./rings";
import ColorPicker from "./ColorPicker";


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
};

// const CONDITIONS_2024 = [
//     "Blinded", "Charmed", "Deafened", "Frightened", "Grappled", "Incapacitated",
//     "Invisible", "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained", "Stunned",
//     // Common extras DMs track
//     "Concentrating", "Dodging", "Disengaging", "Dashing", "Helped", "Ready", "Inspired"
// ] as const;
// type ConditionName = (typeof CONDITIONS_2024)[number];


export default function InitiativeRow({
    row,
    expanded,
    onToggleExpand,
    onRequestActivate,
    onChange,
    onSizeChange,
    onRemove,
    settings,
    started,
}: Props) {
    // Local UI state for inputs
    const [initiative, setInitiative] = useState<number>(row.initiative);
    const [currentHP, setCurrentHP] = useState<number>(row.currentHP);
    const [maxHP, setMaxHP] = useState<number>(row.maxHP);
    const [tempHP, setTempHP] = useState<number>(row.tempHP);
    const [ac, setAc] = useState<number>(row.ac);
    const [movement, setMovement] = useState<number>(row.movement);
    const [attackRange, setAttackRange] = useState<number>(row.attackRange);
    const [editingField, setEditingField] = useState<null | "cur" | "max" | "temp" | "ac" | null>(null);
    const [menuPos, setMenuPos] = useState<{ mouseX: number; mouseY: number } | null>(null);
    const [playerCharacter, setPlayerCharacter] = useState<boolean>(!!row.playerCharacter);
    const [movementColor, setMovementColor] = useState<string | null | undefined>(row.movementColor ?? null);
    const [rangeColor, setRangeColor] = useState<string | null | undefined>(row.rangeColor ?? null);


    const [dmPreview, setDmPreview] = useState(false);

    const commitAc = (v: number) => {
        const next = Math.max(0, v);
        setAc(next);
        bubble({ ac: next });
        setEditingField(null);
    };

    const applyMaxChange = (nextMaxRaw: number) => {
        const m = Math.max(0, nextMaxRaw);
        const prevMax = row.maxHP;               // stable previous value for delta calc
        let nextCur = currentHP;

        if (!started) {
            const delta = m - prevMax;
            nextCur = currentHP + delta;
            // clamp to [0, m]
            if (nextCur < 0) nextCur = 0;
            if (nextCur > m) nextCur = m;
        } else {
            // in combat: only clamp down if current > new max
            if (nextCur > m) nextCur = m;
        }

        setMaxHP(m);
        if (nextCur !== currentHP) setCurrentHP(nextCur);

        const patch: Partial<InitiativeItem> = { maxHP: m };
        if (nextCur !== currentHP) patch.currentHP = nextCur;
        onChange?.(patch);

        setEditingField(null);
    };

    // small helper so Enter commits, Esc cancels, blur commits
    const keyCommit = (doCommit: () => void) => (e: React.KeyboardEvent) => {
        if (e.key === "Enter") doCommit();
        if (e.key === "Escape") setEditingField(null);
    };


    // Sync local when parent row changes
    useEffect(() => {
        setInitiative(row.initiative);
        setCurrentHP(row.currentHP);
        setMaxHP(row.maxHP);
        setTempHP(row.tempHP);
        setAc(row.ac);
        setMovement(row.movement);
        setAttackRange(row.attackRange);
        setPlayerCharacter(!!row.playerCharacter); // NEW
        setMovementColor(row.movementColor ?? null);
        setRangeColor(row.rangeColor ?? null);
    }, [
        row.id,
        row.initiative,
        row.currentHP,
        row.maxHP,
        row.tempHP,
        row.ac,
        row.movement,
        row.attackRange,
        row.playerCharacter,
        row.movementColor,
        row.rangeColor
    ]);

    // Style helpers
    const inputSx = useMemo(
        () => ({
            "& .MuiOutlinedInput-root": {
                borderRadius: 0.25,
                height: 28,
                p: 0,
            },
            "& .MuiOutlinedInput-input": {
                fontSize: "0.8rem",  // match NAME
                lineHeight: 1.25,
                py: 0,
            },
        }),
        []
    );

    const baseHtmlInput = useMemo(
        () => ({
            inputMode: "numeric",
            pattern: "[0-9]*",
            style: {
                textAlign: "center" as const,
                padding: "0 1px",
                fontSize: "0.8rem",  // match NAME
            },
        }),
        []
    );

    const hpTextSx = useMemo(
        () => ({ fontSize: "0.8rem", fontWeight: 600, lineHeight: 1.25 }),
        []
    );

    const bubble = (draft: Partial<InitiativeItem>) => onChange?.(draft);


    const clickCommit =
        (commit: () => void) =>
            (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
                const el = e.currentTarget as HTMLInputElement;
                if (document.activeElement === el) {
                    e.preventDefault(); // don't move caret
                    commit();
                }
            };

    const vis = {
        ac: settings?.showAC ?? true,
        hp: settings?.showHP ?? true,
        move: settings?.showMovementRange ?? true,
        range: settings?.showAttackRange ?? true,
        conditions: settings?.showConditions ?? true,
        distances: settings?.showDistances ?? true,
        dmr: settings?.showDMR ?? true,
    };

    const handleContextMenuCapture = (e: React.MouseEvent) => {
        e.preventDefault(); // stop native context menu (esp. on inputs)
        // close then reopen at the new coords to handle repeated right-clicks
        setMenuPos(null);
        requestAnimationFrame(() => {
            setMenuPos({ mouseX: e.clientX + 2, mouseY: e.clientY - 6 });
        });

        // preserve selection on Safari/Firefox (optional nicety)
        const sel = document.getSelection();
        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            setTimeout(() => sel.addRange(range));
        }
    };

    const closeMenu = () => setMenuPos(null);

    useEffect(() => {
        if (!dmPreview) return;
        ensureRings({
            tokenId: row.id,
            movement,
            attackRange,
            moveAttached: false,
            rangeAttached: true,
            visible: false,   // DM-only
            variant: "dm",
            movementColor,
            rangeColor,
        }).catch(console.error);
    }, [dmPreview, movement, attackRange, movementColor, rangeColor, row.id]);

    useEffect(() => () => { clearRingsFor(row.id, "dm").catch(() => { }); }, [row.id]);

    const toggleDmPreview = async () => {
        if (!dmPreview) {
            // turn ON
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
            });
            setDmPreview(true);
        } else {
            // turn OFF
            await clearRingsFor(row.id, "dm");
            setDmPreview(false);
        }
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
                onContextMenuCapture={handleContextMenuCapture}
                sx={{
                    cursor: "context-menu",
                    "& > *": { borderBottom: "unset" },
                    "& td": { py: 0.5, px: 0.5 },
                    borderLeft: row.active ? "3px solid" : "3px solid transparent",
                    borderLeftColor: row.active ? "success.light" : "transparent",
                }}
            >
                {/* Expand chevron (toggles expansion only) */}
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
                <TableCell
                    sx={{
                        fontWeight: 600,
                        fontSize: "0.8rem",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                            minWidth: 0,
                            maxWidth: "100%",
                        }}
                    >
                        {row.visible === false && (
                            <>
                                <Box sx={{ width: 12, height: 12, lineHeight: 0 }}>
                                    <VisibilityOffRounded sx={{ fontSize: 12, display: "block", opacity: 0.7 }} />
                                </Box>
                                <Box /> {/* tiny gap */}
                            </>
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
                                        // live-parse as you type
                                        onChange: (e: any) => {
                                            const n = Number(e.target.value.replace(/[^\d-]/g, ""));
                                            if (Number.isFinite(n)) setAc(n);
                                        },
                                        // commit on click-away
                                        onBlur: () => commitAc(ac),
                                        // second-click commits immediately (optional nicety)
                                        onMouseDown: clickCommit(() => commitAc(ac)),
                                        onTouchStart: clickCommit(() => commitAc(ac)),
                                    },
                                }}
                            />
                        ) : (
                            <Typography
                                component="button"
                                onClick={(e) => { e.stopPropagation(); setEditingField("ac"); }}
                                style={{ all: "unset", cursor: "text" }}
                            >
                                <Typography component="span" sx={{ fontSize: "0.9rem", lineHeight: 1.1 }}>
                                    {ac}
                                </Typography>
                            </Typography>
                        )}
                    </TableCell>
                ) : null}

                {/* HP (combined) */}
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
                                            setEditingField(null)
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
                                                // live-parse as you type

                                            },
                                        }}
                                    />
                                ) : (
                                    <Typography
                                        component="button"
                                        onClick={(e) => { e.stopPropagation(); setEditingField("cur"); }}
                                        style={{ all: "unset", cursor: "text" }}
                                    >
                                        <Typography component="span" sx={hpTextSx}>
                                            {currentHP}
                                        </Typography>
                                    </Typography>
                                )}

                                <Typography component="span" sx={{ fontSize: "0.95rem", opacity: 0.85 }}>/</Typography>

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
                                                "aria-label": "current hp",
                                                style: { ...baseHtmlInput.style, width: 34 },
                                                // live-parse as you type

                                            },
                                        }}
                                    />
                                ) : (
                                    <Typography
                                        component="button"
                                        onClick={(e) => { e.stopPropagation(); setEditingField("max"); }}
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
                            {/* TEMP */}
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
                                        setEditingField(null)
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
                                            // live-parse as you type

                                        },
                                    }}
                                />
                            ) : (
                                <Typography
                                    component="button"
                                    onClick={(e) => { e.stopPropagation(); setEditingField("temp"); }}
                                    style={{ all: "unset", cursor: "text" }}
                                >
                                    <Typography component="span" sx={hpTextSx}>
                                        {tempHP || 0}
                                    </Typography>
                                </Typography>
                            )}
                        </TableCell>

                    </>) : null}
                {vis.dmr === true ? (
                    <TableCell width={24} align="center" onClick={(e) => e.stopPropagation()}>
                        <Box
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleDmPreview();
                            }}
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
                        >
                            <RadarRounded sx={{ fontSize: 18, display: "block" }} />
                        </Box>
                    </TableCell>
                ) : null}
            </TableRow >
            {/* --- Right-click menu --- */}
            < Menu
                open={!!menuPos
                }
                onClose={closeMenu}
                anchorReference="anchorPosition"
                anchorPosition={menuPos ? { top: menuPos.mouseY, left: menuPos.mouseX } : undefined}
            >
                <MenuItem
                    onClick={() => {
                        closeMenu();
                        onRemove?.(row.id); // delegate to parent
                    }}
                >
                    Remove
                </MenuItem>
            </Menu >
            {/* Expanded panel */}
            < TableRow sx={{ "& > *": { borderBottom: "unset" } }}>
                <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
                    <Collapse
                        in={!!expanded}
                        timeout="auto"
                        unmountOnExit
                        onEntered={onSizeChange}
                        onExited={onSizeChange}
                        onEntering={onSizeChange}
                    >
                        <Box sx={{ p: 1 }}>
                            <Stack direction="row" spacing={1.5} alignItems="stretch">
                                {/* Left: Overlays */}
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography sx={{ fontWeight: 700, fontSize: "0.8rem", textAlign: "center" }}>
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
                                            sx={{ "& .MuiFormControlLabel-label": { fontSize: "0.75rem" } }}
                                        />
                                    </Box>
                                    {/* Movement + Attack Range inputs (conditional) */}
                                    {(vis.move || vis.range) && (
                                        <Stack direction="column" spacing={1} justifyContent="center" sx={{ mb: 1 }}>
                                            {/* Move */}
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                                <Typography sx={{ fontSize: "0.75rem" }}>Move</Typography>
                                                <CommitNumberField
                                                    size="small" variant="outlined" value={movement}
                                                    onCommit={(v) => { setMovement(v); bubble?.({ movement: v }); }}
                                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 0.5, fontSize: "0.75rem", height: 24, p: 0 } }}
                                                    slotProps={{ htmlInput: { inputMode: "numeric", pattern: "[0-9]*", "aria-label": "movement", style: { textAlign: "center", padding: "0 2px", width: 40, fontSize: "0.75rem" } } }}
                                                />
                                                <Typography sx={{ fontSize: "0.65rem", color: "text.secondary" }}>ft</Typography>
                                                {/* NEW color dot (nullable → default) */}
                                                <ColorPicker
                                                    value={movementColor ?? null}
                                                    onChange={(hex) => { setMovementColor(hex); bubble?.({ movementColor: hex }); }}
                                                />
                                            </Box>

                                            {/* Range */}
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                                <Typography sx={{ fontSize: "0.75rem" }}>Range</Typography>
                                                <CommitNumberField
                                                    size="small" variant="outlined" value={attackRange}
                                                    onCommit={(v) => { setAttackRange(v); bubble?.({ attackRange: v }); }}
                                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 0.5, fontSize: "0.75rem", height: 24, p: 0 } }}
                                                    slotProps={{ htmlInput: { inputMode: "numeric", pattern: "[0-9]*", "aria-label": "attack range", style: { textAlign: "center", padding: "0 2px", width: 40, fontSize: "0.75rem" } } }}
                                                />
                                                <Typography sx={{ fontSize: "0.65rem", color: "text.secondary" }}>ft</Typography>
                                                {/* NEW color dot (nullable → default) */}
                                                <ColorPicker
                                                    value={rangeColor ?? null}
                                                    onChange={(hex) => { setRangeColor(hex); bubble?.({ rangeColor: hex }); }}
                                                />
                                            </Box>
                                        </Stack>
                                    )}

                                </Box>

                                <Divider orientation="vertical" flexItem />

                                {/* Right: Distances (conditional) */}
                                {vis.distances ? (
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography sx={{ fontWeight: 700, fontSize: "0.8rem", textAlign: "center", mb: 0.75 }}>
                                            Distances
                                        </Typography>

                                        <List dense disablePadding sx={{ px: 1, "& .MuiListItem-root": { py: 0.25 } }}>
                                            {[
                                                { name: "Goblin A", ft: 18 },
                                                { name: "Orc Brute", ft: 27 },
                                                { name: "Cultist", ft: 35 },
                                            ].map((d) => (
                                                <ListItem key={d.name} disableGutters sx={{ display: "flex", justifyContent: "space-between" }}>
                                                    <Typography sx={{ fontSize: "0.75rem" }}>{d.name}</Typography>
                                                    <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>{d.ft} ft</Typography>
                                                </ListItem>
                                            ))}
                                        </List>
                                    </Box>
                                ) : (
                                    <Box sx={{ flex: 1, minWidth: 0 }} />
                                )}
                            </Stack>
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow >
        </>
    );
}
