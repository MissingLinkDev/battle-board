import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import Divider from "@mui/material/Divider";
import Switch from "@mui/material/Switch";
import Paper from "@mui/material/Paper";
import DeleteForeverRounded from "@mui/icons-material/DeleteForever";
import OBR from "@owlbear-rodeo/sdk";
import Button from "@mui/material/Button";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";

import type { InitiativeSettings } from "./SceneState";
import { META_KEY, isMetadata } from "./metadata";
import { ensureRings, clearRings } from "./rings";
import type { InitiativeItem } from "./InitiativeItem";
import CircularProgress from "@mui/material/CircularProgress";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
type Props = {
    value: InitiativeSettings;
    onChange: (next: InitiativeSettings) => void;
    onBack: () => void;
    rows?: InitiativeItem[];
    ready?: boolean;
};

type MetaForRings = {
    movement?: number;
    attackRange?: number;
    playerCharacter?: boolean;

    movementColor?: string | null;
    rangeColor?: string | null;
    movementWeight?: number | null;
    rangeWeight?: number | null;
    movementPattern?: "solid" | "dash" | null;
    rangePattern?: "solid" | "dash" | null;
    movementOpacity?: number | null; // 0..1
    rangeOpacity?: number | null; // 0..1
};

/* ------------------------------------------------------------------ */
/* Helpers / mini components                                           */
/* ------------------------------------------------------------------ */

function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <Typography
            sx={{
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: ".08em",
                color: "text.secondary",
                fontSize: "0.72rem",
                px: 1,
                mb: 0.5,
            }}
        >
            {children}
        </Typography>
    );
}

function RowShell({
    title,
    description,
    right,
    dense,
}: {
    title: string;
    description?: string;
    right: React.ReactNode;
    dense?: boolean;
}) {
    return (
        <Box
            sx={{
                display: "flex",
                gap: 1,
                alignItems: "center",
                justifyContent: "space-between",
                px: 1,
                py: dense ? 0.5 : 1,
                maxWidth: "100%",
                overflow: "hidden",
            }}
        >
            <Box sx={{ minWidth: 0, overflow: "hidden" }}>
                <Typography
                    sx={{
                        fontWeight: 600,
                        fontSize: dense ? "0.85rem" : "0.9rem",
                        lineHeight: 1.15,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                    }}
                    title={title}
                >
                    {title}
                </Typography>
                {description ? (
                    <Typography
                        sx={{
                            color: "text.secondary",
                            fontSize: dense ? "0.7rem" : "0.75rem",
                            lineHeight: 1.1,
                            mt: 0.25,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        }}
                        title={description}
                    >
                        {description}
                    </Typography>
                ) : null}
            </Box>
            <Box sx={{ flex: "0 0 auto", maxWidth: "45%", display: "flex", alignItems: "center" }}>
                {right}
            </Box>
        </Box>
    );
}

function Toggle({
    checked,
    onChange,
    "aria-label": ariaLabel,
}: {
    checked: boolean;
    onChange: (next: boolean) => void;
    "aria-label"?: string;
}) {
    return (
        <Switch
            size="small"
            checked={!!checked}
            onChange={(e) => onChange(e.target.checked)}
            inputProps={{ "aria-label": ariaLabel ?? "toggle setting" }}
        />
    );
}

/* Compact Select for health mode */
function HealthModeSelect({
    value,
    onChange,
    width = 120,
}: {
    value: "none" | "status" | "numbers";
    onChange: (next: "none" | "status" | "numbers") => void;
    width?: number;
}) {
    return (
        <Select
            size="small"
            value={value}
            onChange={(e) => onChange(e.target.value as any)}
            sx={{
                width,
                "& .MuiSelect-select": { py: 0.5 },
            }}
            MenuProps={{ disableScrollLock: true }}
        >
            <MenuItem value="none">None</MenuItem>
            <MenuItem value="status">Status</MenuItem>
            <MenuItem value="numbers">Numbers</MenuItem>
        </Select>
    );
}

function ConfirmProgress({ value, size = 18 }: { value: number; size?: number }) {
    return (
        <Box sx={{ position: "relative", width: size, height: size }}>
            <CircularProgress
                variant="determinate"
                value={100}
                size={size}
                thickness={10}
                sx={{ color: "action.disabledBackground", position: "absolute", inset: 0 }}
            />
            <CircularProgress
                variant="determinate"
                value={Math.max(0, Math.min(100, value))}
                size={size}
                thickness={10}
                sx={{ position: "absolute", inset: 0 }}
            />
        </Box>
    );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function SettingsView({ value, onChange, onBack, rows, ready = true }: Props) {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const hasInitiative = (rows?.length ?? 0) > 0;

    const set = (patch: Partial<InitiativeSettings>) => onChange({ ...value, ...patch });

    // Local expansion state for sub-categories
    const [openDisplayColumns, setOpenDisplayColumns] = useState(false);
    const [openDisplayInfo, setOpenDisplayInfo] = useState(false);
    const [openPlayerColumns, setOpenPlayerColumns] = useState(false);

    //Local for confirm ring
    const [confirming, setConfirming] = useState(false);
    const [progress, setProgress] = useState(100); // 100 → 0
    const confirmDeadlineRef = useRef<number | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const CONFIRM_MS = 4000;

    const stopInterval = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    const cancelConfirm = () => {
        stopInterval();
        confirmDeadlineRef.current = null;
        setConfirming(false);
        setProgress(100);
    };

    const startConfirm = () => {
        if (intervalRef.current) return; // already counting
        setConfirming(true);
        setProgress(100);
        confirmDeadlineRef.current = performance.now() + CONFIRM_MS;

        intervalRef.current = setInterval(() => {
            const end = confirmDeadlineRef.current;
            if (!end) {
                cancelConfirm();
                return;
            }
            const now = performance.now();
            const remaining = Math.max(0, end - now);
            const pct = (remaining / CONFIRM_MS) * 100;
            setProgress(pct);

            if (remaining <= 0) {
                cancelConfirm(); // auto-revert
            }
        }, 80); // smooth enough; light on CPU
    };

    // cleanup on unmount
    useEffect(() => () => stopInterval(), []);

    // --- Resize to content
    useEffect(() => {
        if (!rootRef.current || typeof ResizeObserver === "undefined") return;

        const MIN_H = 200;
        const compute = () => {
            const h = rootRef.current!.getBoundingClientRect().height || 0;
            OBR.action.setHeight(Math.max(h, MIN_H));
        };

        compute(); // initial
        const ro = new ResizeObserver(compute);
        ro.observe(rootRef.current);

        return () => {
            ro.disconnect();
        };
    }, []);

    // --- Keep your rings sync effect
    useEffect(() => {
        let cancelled = false;

        const refreshRingsFromSettings = async () => {
            try {
                if (!ready) return;
                if (!value.showRangeRings || (!value.showMovementRange && !value.showAttackRange)) {
                    await clearRings("normal");
                    return;
                }

                const items = await OBR.scene.items.getItems();
                if (cancelled) return;

                const active = items.find((it: any) => {
                    const meta = (it.metadata as any)?.[META_KEY];
                    return isMetadata?.(meta) && meta.active === true;
                });

                if (!active) {
                    await clearRings("normal");
                    return;
                }

                const meta = ((active.metadata as any)[META_KEY] ?? {}) as MetaForRings;

                if (!meta?.playerCharacter) {
                    await clearRings("normal");
                    return;
                }

                await ensureRings({
                    tokenId: active.id,
                    variant: "normal",
                    visible: true,
                    moveAttached: false,
                    rangeAttached: true,
                    movement: value.showMovementRange ? (meta.movement ?? 0) : 0,
                    attackRange: value.showAttackRange ? (meta.attackRange ?? 0) : 0,
                    movementColor: meta.movementColor ?? "#519e00",
                    rangeColor: meta.rangeColor ?? "#fe4c50",
                    movementWeight: meta.movementWeight ?? 12,
                    rangeWeight: meta.rangeWeight ?? 12,
                    movementPattern: meta.movementPattern ?? "dash",
                    rangePattern: meta.rangePattern ?? "dash",
                    movementOpacity: meta.movementOpacity ?? 1,
                    rangeOpacity: meta.rangeOpacity ?? 1,
                });
            } catch (err) {
                console.error("Failed to refresh rings from settings:", err);
            }
        };

        refreshRingsFromSettings();
        return () => {
            cancelled = true;
        };
    }, [value.showMovementRange, value.showAttackRange, value.showRangeRings]);

    const handleClearAll = async () => {
        try {
            const items = await OBR.scene.items.getItems();
            const ids = items.map((it) => it.id);
            await OBR.scene.items.updateItems(ids, (items) => {
                for (const it of items) {
                    const meta = (it.metadata as any)[META_KEY];
                    if (meta) {
                        meta.initiative = 0;
                        meta.active = false;
                        meta.inInitiative = false;
                    }
                }
            });
        } catch (err) {
            console.error("Failed to clear initiative list:", err);
        }
    };

    // Resolve UI defaults without forcing state writes yet
    const pcHealthMode = ((value as any).pcHealthMode ?? "numbers") as "none" | "status" | "numbers";
    const npcHealthMode = ((value as any).npcHealthMode ?? "status") as "none" | "status" | "numbers";

    return (
        <Paper ref={rootRef} sx={{ borderRadius: 0, overflowX: "hidden" }}>
            {/* Header */}
            <Box sx={{ px: 1, py: 0.75, display: "flex", alignItems: "center", gap: 1 }}>
                <IconButton size="small" onClick={onBack}>
                    <ArrowBackRounded />
                </IconButton>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: "0.95rem" }}>
                    Settings
                </Typography>
            </Box>
            <Divider />

            {/* Content */}
            <Box sx={{ p: 1 }}>
                <Stack spacing={2}>
                    {/* ===================== Display Settings ===================== */}
                    <Box>
                        <SectionTitle>Display Settings</SectionTitle>

                        {/* Columns (Accordion) */}
                        <Accordion
                            elevation={0}
                            disableGutters
                            square
                            expanded={openDisplayColumns}
                            onChange={(_, exp) => setOpenDisplayColumns(exp)}
                            sx={{
                                border: (t) => `1px solid ${t.palette.divider}`,
                                borderRadius: 1,
                                "&:before": { display: "none" },
                            }}
                        >
                            <AccordionSummary expandIcon={<ExpandMoreRounded />} sx={{ px: 1, minHeight: 38 }}>
                                <Typography sx={{ fontWeight: 700, fontSize: "0.85rem" }}>DM Columns</Typography>
                            </AccordionSummary>
                            <AccordionDetails sx={{ p: 0 }}>
                                <RowShell
                                    title="Armor"
                                    description="Show AC column."
                                    right={
                                        <Toggle
                                            checked={!!value.showArmor}
                                            onChange={(next) => set({ showArmor: next })}
                                            aria-label="toggle-armor"
                                        />
                                    }
                                />
                                <Divider />
                                <RowShell
                                    title="HP"
                                    description="Show HP columns."
                                    right={
                                        <Toggle
                                            checked={!!value.showHP}
                                            onChange={(next) => set({ showHP: next })}
                                            aria-label="toggle-hp"
                                        />
                                    }
                                />
                                <Divider />
                                <RowShell
                                    title="Concentration"
                                    description="Show concentration tracking."
                                    right={
                                        <Toggle
                                            checked={!!value.showConcentration}
                                            onChange={(next) => set({ showConcentration: next })}
                                            aria-label="toggle-concentration"
                                        />
                                    }
                                />
                                <Divider />
                                <RowShell
                                    title="Range Ring Toggle"
                                    description="Show DM ring button."
                                    right={
                                        <Toggle
                                            checked={!!value.dmRingToggle}
                                            onChange={(next) => set({ dmRingToggle: next })}
                                            aria-label="toggle-dm-ring-toggle"
                                        />
                                    }
                                />
                            </AccordionDetails>
                        </Accordion>
                        {/* Player Columns (Accordion) */}
                        <Accordion
                            elevation={0}
                            disableGutters
                            square
                            expanded={openPlayerColumns}
                            onChange={(_, exp) => setOpenPlayerColumns(exp)}

                            sx={{
                                border: (t) => `1px solid ${t.palette.divider}`,
                                borderRadius: 1,
                                mt: 1,
                                "&:before": { display: "none" },
                            }}
                        >
                            <AccordionSummary expandIcon={<ExpandMoreRounded />} sx={{ px: 1, minHeight: 38 }}>
                                <Typography sx={{ fontWeight: 700, fontSize: "0.85rem" }}>Player Columns</Typography>
                            </AccordionSummary>
                            <AccordionDetails sx={{ p: 0 }}>
                                {/* Health Status row with inline expanded panel (borderless) */}
                                <Box sx={{ position: "relative" }}>
                                    <RowShell
                                        title="Health Status"
                                        description="Allow player health info."
                                        right={
                                            <Toggle
                                                checked={!!value.displayHealthStatusToPlayer}
                                                onChange={(next) => set({ displayHealthStatusToPlayer: next })}
                                                aria-label="toggle-health-status"
                                            />
                                        }
                                    />
                                    {value.displayHealthStatusToPlayer ? (
                                        <Box
                                            sx={{
                                                px: 1,
                                                pb: 0.5,
                                                pt: 0,
                                                display: "grid",
                                                rowGap: 0.25,
                                                maxWidth: "100%",
                                            }}
                                        >
                                            <RowShell
                                                dense
                                                title="Player Characters"
                                                description="PC health shown."
                                                right={
                                                    <HealthModeSelect
                                                        value={pcHealthMode}
                                                        onChange={(next) => set({ pcHealthMode: next } as any)}
                                                    />
                                                }
                                            />
                                            <RowShell
                                                dense
                                                title="NPCs"
                                                description="NPC health shown."
                                                right={
                                                    <HealthModeSelect
                                                        value={npcHealthMode}
                                                        onChange={(next) => set({ npcHealthMode: next } as any)}
                                                    />
                                                }
                                            />
                                            <RowShell
                                                dense
                                                title="Editable Health"
                                                description="Players can edit health for player characters."
                                                right={
                                                    <Toggle
                                                        checked={!!value.playerEditableHealth}
                                                        onChange={(next) => set({ playerEditableHealth: next })}
                                                        aria-label="toggle-player-editable-health"
                                                    />
                                                }
                                            />
                                        </Box>
                                    ) : null}
                                </Box>

                                {/* Range Rings (independent row) */}
                                <Divider />
                                <RowShell
                                    title="Range Rings"
                                    description="PC rings on turn."
                                    right={
                                        <Toggle
                                            checked={!!value.showRangeRings}
                                            onChange={(next) => set({ showRangeRings: next })}
                                            aria-label="toggle-show-range-rings"
                                        />
                                    }
                                />
                            </AccordionDetails>
                        </Accordion>

                        {/* Info Panel (Accordion) */}
                        <Accordion
                            elevation={0}
                            disableGutters
                            square
                            expanded={openDisplayInfo}
                            onChange={(_, exp) => setOpenDisplayInfo(exp)}
                            sx={{
                                border: (t) => `1px solid ${t.palette.divider}`,
                                borderRadius: 1,
                                mt: 1,
                                "&:before": { display: "none" },
                            }}
                        >
                            <AccordionSummary expandIcon={<ExpandMoreRounded />} sx={{ px: 1, minHeight: 38 }}>
                                <Typography sx={{ fontWeight: 700, fontSize: "0.85rem" }}>Info Panel</Typography>
                            </AccordionSummary>
                            <AccordionDetails sx={{ p: 0 }}>
                                <RowShell
                                    title="Distances"
                                    description="Show distances table."
                                    right={
                                        <Toggle
                                            checked={!!value.showDistances}
                                            onChange={(next) => set({ showDistances: next })}
                                            aria-label="toggle-distances"
                                        />
                                    }
                                />
                                <Divider />
                                <RowShell
                                    title="Round Distances"
                                    description="Round to nearest grid unit."
                                    right={
                                        <Toggle
                                            checked={!!value.roundDistances}
                                            onChange={(next) => set({ roundDistances: next })}
                                            aria-label="toggle-round-distances"
                                        />
                                    }
                                />
                            </AccordionDetails>
                        </Accordion>
                    </Box>

                    {/* ========================== Gameplay ======================== */}
                    <Box>
                        <SectionTitle>Gameplay</SectionTitle>

                        {/* Player Initiative List (flipped logic: SHOW when true, HIDE when false) */}
                        <Box
                            sx={{
                                borderRadius: 1,
                                overflow: "hidden",
                                border: (t) => `1px solid ${t.palette.divider}`,
                                mb: 1,
                            }}
                        >
                            <RowShell
                                title="Player Initiative List"
                                description="Show list to players."
                                right={
                                    <Toggle
                                        checked={!value.disablePlayerList /* show when ON */}
                                        onChange={(next) => set({ disablePlayerList: !next })}
                                        aria-label="toggle-player-list-show"
                                    />
                                }
                            />
                        </Box>

                        {/* Group Staging Controls Visibility */}
                        <Box
                            sx={{
                                borderRadius: 1,
                                overflow: "hidden",
                                border: (t) => `1px solid ${t.palette.divider}`,
                                mb: 1,
                            }}
                        >
                            <RowShell
                                title="Staging Controls Visibility"
                                description="Hide/show tokens when groups are staged/unstaged."
                                right={
                                    <Toggle
                                        checked={!!value.groupStagingControlsVisibility}
                                        onChange={(next) => set({ groupStagingControlsVisibility: next })}
                                        aria-label="toggle-group-staging-visibility"
                                    />
                                }
                            />
                        </Box>
                    </Box>
                </Stack>
            </Box>

            <Divider sx={{ my: 1.5 }} />
            <Box sx={{ textAlign: "center", p: 1.5 }}>
                <Button
                    variant="contained"
                    color="error"
                    startIcon={<DeleteForeverRounded />}
                    endIcon={confirming ? <ConfirmProgress value={progress} /> : null}
                    onClick={async () => {
                        const end = confirmDeadlineRef.current;
                        if (confirming && end && performance.now() < end) {
                            // confirmed during window
                            cancelConfirm();
                            await handleClearAll();
                        } else {
                            startConfirm();
                        }
                    }}
                    disabled={!hasInitiative}
                >
                    {confirming ? "Confirm" : "Clear All from Initiative"}
                </Button>

            </Box>
        </Paper>
    );
}
