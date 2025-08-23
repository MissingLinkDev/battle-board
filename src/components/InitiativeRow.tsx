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
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Popover from "@mui/material/Popover";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import VisibilityOffRounded from "@mui/icons-material/VisibilityOffRounded";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";

import type { InitiativeItem } from "./InitiativeItem";
import { CommitNumberField } from "./CommitFields";
import CloseRounded from "@mui/icons-material/CloseRounded";
import Add from "@mui/icons-material/Add";

type RowSettings = {
    showMovementRange: boolean;
    showAttackRange: boolean;
    showConditions: boolean;
    showDistances: boolean;
    showAC: boolean;
    showHP: boolean;
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

    // HP popover state
    const [hpAnchor, setHpAnchor] = useState<HTMLElement | null>(null);
    const hpOpen = Boolean(hpAnchor);
    const closeHp = () => setHpAnchor(null);

    const commitAc = (v: number) => {
        const next = Math.max(0, v);
        setAc(next);
        bubble({ ac: next });
        setEditingField(null);
    };
    const commitCur = (v: number) => {
        setCurrentHP(v);
        onChange?.({ currentHP: v });
        setEditingField(null);
    };

    const commitMax = (v: number) => {
        const m = Math.max(0, v);
        setMaxHP(m);
        if (currentHP > m) { setCurrentHP(m); onChange?.({ currentHP: m }); }
        onChange?.({ maxHP: m });
        setEditingField(null);
    };

    const commitTemp = (v: number) => {
        setTempHP(v);
        onChange?.({ tempHP: v });
        setEditingField(null);
    };

    // small helper so Enter commits, Esc cancels, blur commits
    const keyCommit = (doCommit: () => void) => (e: React.KeyboardEvent) => {
        if (e.key === "Enter") doCommit();
        if (e.key === "Escape") setEditingField(null);
    };

    const [adjAmount, setAdjAmount] = useState(0);

    const doDamage = () => {
        const amt = Math.max(0, Math.abs(adjAmount));
        if (amt === 0) return;

        let t = tempHP;
        let c = currentHP;
        const fromTemp = Math.min(t, amt);
        t -= fromTemp;
        const remaining = amt - fromTemp;
        if (remaining > 0) c = Math.max(0, c - remaining);

        setTempHP(t);
        setCurrentHP(c);
        onChange?.({ tempHP: t, currentHP: c });
        setAdjAmount(0);
        closeHp();                         // ← close after apply
    };

    const doHeal = () => {
        const amt = Math.max(0, Math.abs(adjAmount));
        if (amt === 0) return;

        const c = Math.min(maxHP, currentHP + amt);
        setCurrentHP(c);
        onChange?.({ currentHP: c });
        setAdjAmount(0);
        closeHp();                         // ← close after apply
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
    }, [
        row.id,
        row.initiative,
        row.currentHP,
        row.maxHP,
        row.tempHP,
        row.ac,
        row.movement,
        row.attackRange,
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

    return (
        <>
            <TableRow
                hover
                selected={!!row.active}
                onClick={onRequestActivate}
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
                                style: { ...baseHtmlInput.style, width: 24 },
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
                            display: "grid",
                            gridTemplateColumns: row.visible === false ? "12px 4px 1fr" : "1fr",
                            alignItems: "center",
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
                                        onCommit={commitCur}
                                        onBlur={() => commitCur(currentHP)}
                                        onKeyDown={keyCommit(() => commitCur(currentHP))}
                                        sx={inputSx}
                                        slotProps={{
                                            htmlInput: {
                                                ...baseHtmlInput,
                                                autoFocus: true,
                                                onFocus: (e: any) => e.currentTarget.select(),
                                                "aria-label": "current hp",
                                                style: { ...baseHtmlInput.style, width: 34 },
                                                // live-parse as you type
                                                onChange: (e: any) => {
                                                    const n = Number(e.target.value.replace(/[^\d-]/g, ""));
                                                    if (Number.isFinite(n)) setCurrentHP(n);
                                                },
                                                // ← commit on click-away
                                                onBlur: () => commitCur(currentHP),
                                                // optional: second-click commits immediately
                                                onMouseDown: clickCommit(() => commitCur(currentHP)),
                                                onTouchStart: clickCommit(() => commitCur(currentHP)),
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
                                        onCommit={commitMax}
                                        onBlur={() => commitMax(maxHP)}
                                        onKeyDown={keyCommit(() => commitMax(maxHP))}
                                        sx={inputSx}
                                        slotProps={{
                                            htmlInput: {
                                                ...baseHtmlInput,
                                                autoFocus: true,
                                                onFocus: (e: any) => e.currentTarget.select(),
                                                "aria-label": "max hp",
                                                style: { ...baseHtmlInput.style, width: 34 },
                                                onChange: (e: any) => {
                                                    const n = Number(e.target.value.replace(/[^\d-]/g, ""));
                                                    if (Number.isFinite(n)) setMaxHP(n);
                                                },
                                                onBlur: () => commitMax(maxHP),                 // ← commit on click-away
                                                onMouseDown: clickCommit(() => commitMax(maxHP)),
                                                onTouchStart: clickCommit(() => commitMax(maxHP)),
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
                                    onCommit={commitTemp}
                                    onBlur={() => commitTemp(tempHP)}
                                    onKeyDown={keyCommit(() => commitTemp(tempHP))}
                                    sx={inputSx}
                                    slotProps={{
                                        htmlInput: {
                                            ...baseHtmlInput,
                                            autoFocus: true,
                                            onFocus: (e: any) => e.currentTarget.select(),
                                            "aria-label": "temp hp",
                                            style: { ...baseHtmlInput.style, width: 34 },
                                            onChange: (e: any) => {
                                                const n = Number(e.target.value.replace(/[^\d-]/g, ""));
                                                if (Number.isFinite(n)) setTempHP(n);
                                            },
                                            onBlur: () => commitTemp(tempHP),               // ← commit on click-away
                                            onMouseDown: clickCommit(() => commitTemp(tempHP)),
                                            onTouchStart: clickCommit(() => commitTemp(tempHP)),
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
                        <TableCell width={18} align="center" onClick={(e) => e.stopPropagation()}>
                            {/* Chevron opens the existing popover menu */}
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setHpAnchor((prev) => (prev ? null : e.currentTarget as HTMLElement));
                                }}
                                sx={{ p: 0.25, ml: 0.25 }}
                            >
                                <KeyboardArrowDown sx={{ fontSize: "1.05rem", opacity: 0.9 }} />
                            </IconButton>



                            {/* HP Popover */}
                            <Popover
                                open={hpOpen}
                                anchorEl={hpAnchor}
                                onClose={closeHp}
                                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
                                transformOrigin={{ vertical: "top", horizontal: "center" }}
                                container={typeof window !== "undefined" ? document.body : undefined}
                                slotProps={{
                                    paper: {
                                        sx: { p: 1.25, borderRadius: 1, width: 320 },   // ← padding + shape
                                        onClick: (e: React.MouseEvent) => e.stopPropagation(), // keep row click from firing
                                    },
                                }}
                            >
                                <ClickAwayListener onClickAway={closeHp}>
                                    <Box onKeyDown={(e) => { if (e.key === "Escape") closeHp(); }}>
                                        {/* Top row: Cur / Max / Temp (commit immediately) */}
                                        <Stack direction="row" spacing={1} justifyContent="space-around" alignItems="center">
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                                                <Typography sx={{ fontSize: "0.72rem" }}>Cur</Typography>
                                                <CommitNumberField
                                                    size="small" variant="outlined" value={currentHP}
                                                    onCommit={(v) => {
                                                        setCurrentHP(v);
                                                        bubble({ currentHP: v });
                                                        closeHp();                 // ← close after commit
                                                    }}
                                                    sx={inputSx}
                                                    slotProps={{
                                                        htmlInput: {
                                                            ...baseHtmlInput,
                                                            autoFocus: true,
                                                            onFocus: (e: any) => e.currentTarget.select(),
                                                            style: { ...baseHtmlInput.style, width: 56 }
                                                        }
                                                    }}
                                                />
                                            </Box>

                                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                                                <Typography sx={{ fontSize: "0.72rem" }}>Max</Typography>
                                                <CommitNumberField
                                                    size="small" variant="outlined" value={maxHP}
                                                    onCommit={(v) => {
                                                        const m = Math.max(0, v);
                                                        setMaxHP(m);
                                                        if (currentHP > m) { setCurrentHP(m); bubble({ currentHP: m }); }
                                                        bubble({ maxHP: m });
                                                        closeHp();                 // ← close after commit
                                                    }}
                                                    sx={inputSx}
                                                    slotProps={{
                                                        htmlInput: {
                                                            ...baseHtmlInput,
                                                            autoFocus: true,
                                                            onFocus: (e: any) => e.currentTarget.select(),
                                                            style: { ...baseHtmlInput.style, width: 56 }
                                                        }
                                                    }}
                                                />
                                            </Box>

                                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                                                <Typography sx={{ fontSize: "0.72rem" }}>Temp</Typography>
                                                <CommitNumberField
                                                    size="small" variant="outlined" value={tempHP}
                                                    onCommit={(v) => {
                                                        setTempHP(v);
                                                        bubble({ tempHP: v });
                                                        closeHp();                 // ← close after commit
                                                    }}
                                                    sx={inputSx}
                                                    slotProps={{
                                                        htmlInput: {
                                                            ...baseHtmlInput,
                                                            autoFocus: true,
                                                            onFocus: (e: any) => e.currentTarget.select(),
                                                            style: { ...baseHtmlInput.style, width: 56 }
                                                        }
                                                    }}
                                                />
                                            </Box>
                                        </Stack>

                                        <Divider sx={{ my: 0.75 }} />

                                        {/* Quick adjust: [Damage] [amount input] [Heal] */}
                                        <Stack direction="row" alignItems="center" justifyContent="space-around" spacing={1}>
                                            {/* DAMAGE apply */}
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                color="error"
                                                onClick={doDamage}
                                                sx={{ minWidth: 72 }}
                                            >
                                                Damage
                                            </Button>

                                            {/* AMOUNT input (center) */}
                                            <CommitNumberField
                                                size="small"
                                                variant="outlined"
                                                value={adjAmount}
                                                onCommit={(v) => setAdjAmount(Math.max(0, v))}
                                                sx={inputSx}
                                                slotProps={{
                                                    htmlInput: {
                                                        ...baseHtmlInput,
                                                        autoFocus: true,
                                                        onFocus: (e: any) => e.currentTarget.select(),
                                                        "aria-label": "adjust amount",
                                                        style: { ...baseHtmlInput.style, width: 80, textAlign: "center" },
                                                        // optional nicety: Enter to heal by default; Shift+Enter to damage
                                                        onKeyDown: (e: any) => {
                                                            if (e.key === "Enter" && e.shiftKey) doDamage();
                                                            else if (e.key === "Enter") doHeal();
                                                        },
                                                    },
                                                }}
                                            />

                                            {/* HEAL apply */}
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                color="success"
                                                onClick={doHeal}
                                                sx={{ minWidth: 72 }}
                                            >
                                                Heal
                                            </Button>
                                        </Stack>
                                    </Box>
                                </ClickAwayListener>
                            </Popover>
                        </TableCell >
                    </>) : null}
            </TableRow >
            {/* --- Right-click menu --- */}
            <Menu
                open={!!menuPos}
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
            </Menu>
            {/* Expanded panel */}
            <TableRow sx={{ "& > *": { borderBottom: "unset" } }}>
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
                                    <Typography sx={{ fontWeight: 700, fontSize: "0.8rem", textAlign: "center", mb: 0.75 }}>
                                        Overlays
                                    </Typography>
                                    {/* Movement + Attack Range inputs (conditional) */}
                                    {(vis.move || vis.range) && (
                                        <Stack direction="row" spacing={1} justifyContent="center" sx={{ mb: 1 }}>
                                            {vis.move && (
                                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                                    <Typography sx={{ fontSize: "0.75rem" }}>Move</Typography>
                                                    <CommitNumberField
                                                        size="small"
                                                        variant="outlined"
                                                        value={movement}
                                                        onCommit={(v) => { setMovement(v); bubble?.({ movement: v }); }}
                                                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 0.5, fontSize: "0.75rem", height: 24, p: 0 } }}
                                                        slotProps={{
                                                            htmlInput: {
                                                                inputMode: "numeric",
                                                                pattern: "[0-9]*",
                                                                "aria-label": "movement",
                                                                style: { textAlign: "center", padding: "0 2px", width: 40, fontSize: "0.75rem" },
                                                            },
                                                        }}
                                                    />
                                                    <Typography sx={{ fontSize: "0.65rem", color: "text.secondary" }}>ft</Typography>
                                                </Box>
                                            )}
                                            {vis.range && (
                                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                                    <Typography sx={{ fontSize: "0.75rem" }}>Range</Typography>
                                                    <CommitNumberField
                                                        size="small"
                                                        variant="outlined"
                                                        value={attackRange}
                                                        onCommit={(v) => { setAttackRange(v); bubble?.({ attackRange: v }); }}
                                                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 0.5, fontSize: "0.75rem", height: 24, p: 0 } }}
                                                        slotProps={{
                                                            htmlInput: {
                                                                inputMode: "numeric",
                                                                pattern: "[0-9]*",
                                                                "aria-label": "attack range",
                                                                style: { textAlign: "center", padding: "0 2px", width: 40, fontSize: "0.75rem" },
                                                            },
                                                        }}
                                                    />
                                                    <Typography sx={{ fontSize: "0.65rem", color: "text.secondary" }}>ft</Typography>
                                                </Box>
                                            )}
                                        </Stack>
                                    )}
                                    {/* Conditions (conditional) */}
                                    {vis.conditions && (
                                        <Box sx={{ textAlign: "center" }}>
                                            {/* Title row with + icon on the right of the text */}
                                            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                                                <Typography sx={{ fontWeight: 700, fontSize: "0.8rem" }}>
                                                    Conditions
                                                </Typography>
                                                <IconButton
                                                    size="small"
                                                    aria-label="add condition"
                                                    onClick={() => { console.log("Open conditions modal"); }}
                                                    sx={{ p: 0.25 }}
                                                >
                                                    <Add sx={{ fontSize: "1rem" }} />
                                                </IconButton>
                                            </Box>

                                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, justifyContent: "center" }}>
                                                {row.conditions.length && (
                                                    row.conditions.map((c) => {
                                                        const remove = () => {
                                                            const next = row.conditions.filter((x) => x !== c);
                                                            bubble?.({ conditions: next });
                                                        };
                                                        return (
                                                            <Chip
                                                                key={c}
                                                                label={c}
                                                                size="small"
                                                                onClick={remove}                 // clicking the chip removes it
                                                                onDelete={remove}                // clicking the close icon removes it
                                                                deleteIcon={<CloseRounded sx={{ fontSize: "0.9rem" }} />}
                                                                sx={{ borderRadius: 1, fontSize: "0.7rem", height: 22 }}
                                                            />
                                                        );
                                                    })
                                                )}
                                            </Box>
                                        </Box>
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
            </TableRow>
        </>
    );
}
