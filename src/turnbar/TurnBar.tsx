import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ToggleButton from "@mui/material/ToggleButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ChevronLeftRounded from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import KeyboardArrowUpRounded from "@mui/icons-material/KeyboardArrowUpRounded";
import KeyboardArrowDownRounded from "@mui/icons-material/KeyboardArrowDownRounded";
import { encounterStore, useEncounter, type Combatant } from "../encounter";
import { turnOrder } from "../encounter/turnOrder";
import { barCombatants, endProgress, resourcesOf, turnOf, type TurnResources } from "../encounter/turnResources";
import { useGrid } from "../hooks/useGrid";
import { usePlayerIdentity } from "./usePlayerIdentity";
import { TURN_BAR_POPOVER_ID } from "./useTurnBarPopover";

/** The player's turn bar: one slide per owned combatant, cycling like a carousel. */
export function TurnBar() {
    const encounter = useEncounter();
    const { playerId, connected } = usePlayerIdentity();
    const grid = useGrid();
    const owned = useMemo(() => (playerId ? barCombatants(encounter, playerId) : []), [encounter, playerId]);
    const [shownId, setShownId] = useState<string | null>(null);
    const fitRef = useFitPopover();

    // Jump to the player's combatant whose turn starts (the first, in a group).
    const activeOwned = owned.find((c) => c.active)?.id ?? null;
    const lastActive = useRef<string | null>(null);
    useEffect(() => {
        if (activeOwned && activeOwned !== lastActive.current) setShownId(activeOwned);
        lastActive.current = activeOwned;
    }, [activeOwned]);

    const index = Math.max(0, owned.findIndex((c) => c.id === shownId));
    const combatant = owned[index];
    if (!combatant) return null;

    const step = (by: number) => setShownId(owned[(index + by + owned.length) % owned.length].id);
    const resources = resourcesOf(combatant);
    const set = (changes: Partial<TurnResources>) => encounterStore.setTurnResources(combatant.id, changes).catch(console.error);

    const turn = turnOf(turnOrder(encounter), combatant.id);
    const progress = turn?.kind === "group" ? endProgress(turn, connected) : null;

    const unitsPerCell = grid?.unitsPerCell ?? 5;
    const unit = grid?.unitLabel ?? "ft";
    const moved = resources.movementUsed * unitsPerCell;
    const overSpeed = moved > combatant.movement;
    // Off-turn, only a reaction can be taken.
    const onTurn = combatant.active;

    return (
        <Box
            ref={fitRef}
            // Natural width, not the popover's current width, so the fit can grow as well as shrink.
            sx={{ display: "flex", width: "max-content", whiteSpace: "nowrap", alignItems: "center", gap: 0.75, px: 1, py: 0.5, bgcolor: "background.paper", "& > *": { flexShrink: 0 } }}
        >
            <Carousel combatant={combatant} count={owned.length} onStep={step} />

            <Divider orientation="vertical" flexItem />

            <Resource label="Action" used={resources.actionUsed} disabled={!onTurn} onChange={(v) => set({ actionUsed: v })} />
            <Resource label="Bonus" used={resources.bonusActionUsed} disabled={!onTurn} onChange={(v) => set({ bonusActionUsed: v })} />
            <Resource label="Reaction" used={resources.reactionUsed} onChange={(v) => set({ reactionUsed: v })} />

            <Divider orientation="vertical" flexItem />

            <Box sx={{ display: "flex", alignItems: "center" }}>
                <Box sx={{ textAlign: "center", minWidth: 58 }}>
                    <Typography sx={{ fontSize: "0.65rem", color: "text.secondary", lineHeight: 1 }}>MOVED</Typography>
                    <Typography
                        sx={{ fontSize: "0.85rem", fontWeight: 700, lineHeight: 1.3, color: !onTurn ? "text.disabled" : overSpeed ? "warning.main" : "text.primary" }}
                        title={overSpeed ? "More than this combatant's speed" : undefined}
                    >
                        {moved}/{combatant.movement}{unit}
                    </Typography>
                </Box>
                <Box sx={{ display: "flex", flexDirection: "column" }}>
                    <IconButton size="small" sx={{ p: 0 }} aria-label="moved one more cell" disabled={!onTurn} onClick={() => set({ movementUsed: resources.movementUsed + 1 })}>
                        <KeyboardArrowUpRounded fontSize="small" />
                    </IconButton>
                    <IconButton size="small" sx={{ p: 0 }} aria-label="moved one fewer cell" disabled={!onTurn || resources.movementUsed === 0}
                        onClick={() => set({ movementUsed: resources.movementUsed - 1 })}>
                        <KeyboardArrowDownRounded fontSize="small" />
                    </IconButton>
                </Box>
            </Box>

            <Divider orientation="vertical" flexItem />

            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 76 }}>
                <Button
                    size="small"
                    variant={resources.ended ? "outlined" : "contained"}
                    disabled={!onTurn}
                    onClick={() => set({ ended: !resources.ended })}
                    sx={{ px: 1, minWidth: 0, whiteSpace: "nowrap", fontSize: "0.75rem" }}
                >
                    {resources.ended ? "Undo end" : "End turn"}
                </Button>
                {progress && onTurn && progress.total > 1 && (
                    <Typography sx={{ fontSize: "0.65rem", color: "text.secondary", mt: 0.25 }}>
                        {progress.ended}/{progress.total} ended
                    </Typography>
                )}
            </Box>
        </Box>
    );
}

/** Resize the popover to the bar's content, whatever its controls currently need. */
function useFitPopover() {
    const ref = useRef<HTMLDivElement | null>(null);
    const size = useRef("");
    // No deps: the bar mounts only once there is a combatant to show.
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el || typeof ResizeObserver === "undefined") return;
        const fit = () => {
            const { width, height } = el.getBoundingClientRect();
            const next = `${Math.ceil(width)}x${Math.ceil(height)}`;
            if (!width || !height || next === size.current) return;
            size.current = next;
            OBR.popover.setWidth(TURN_BAR_POPOVER_ID, Math.ceil(width)).catch(console.error);
            OBR.popover.setHeight(TURN_BAR_POPOVER_ID, Math.ceil(height)).catch(console.error);
        };
        fit();
        const observer = new ResizeObserver(fit);
        observer.observe(el);
        return () => observer.disconnect();
    });
    return ref;
}

function Carousel({ combatant, count, onStep }: { combatant: Combatant; count: number; onStep: (by: number) => void }) {
    const arrows = count > 1;
    return (
        <Box sx={{ display: "flex", alignItems: "center" }}>
            {arrows && (
                <IconButton size="small" sx={{ p: 0.25 }} aria-label="previous token" onClick={() => onStep(-1)}>
                    <ChevronLeftRounded fontSize="small" />
                </IconButton>
            )}
            <Tooltip title={combatant.active ? `${combatant.name}: your turn` : combatant.name}>
                <Avatar
                    src={combatant.imageUrl}
                    alt={combatant.name}
                    sx={{
                        width: 44,
                        height: 44,
                        bgcolor: "action.selected",
                        outline: (t) => (combatant.active ? `3px solid ${t.palette.primary.main}` : "none"),
                        outlineOffset: 1,
                    }}
                />
            </Tooltip>
            {arrows && (
                <IconButton size="small" sx={{ p: 0.25 }} aria-label="next token" onClick={() => onStep(1)}>
                    <ChevronRightRounded fontSize="small" />
                </IconButton>
            )}
        </Box>
    );
}

function Resource({ label, used, disabled, onChange }: { label: string; used: boolean; disabled?: boolean; onChange: (used: boolean) => void }) {
    return (
        <ToggleButton
            value={label}
            size="small"
            disabled={disabled}
            selected={!used && !disabled}
            onChange={() => onChange(!used)}
            aria-label={`${label} ${used ? "used" : "available"}`}
            title={used ? `${label} used` : `${label} available`}
            sx={{
                px: 0.75,
                py: 0.5,
                fontSize: "0.7rem",
                fontWeight: 700,
                lineHeight: 1.2,
                textTransform: "none",
                textDecoration: used ? "line-through" : "none",
                color: "text.disabled",
                "&.Mui-selected": { color: "primary.contrastText", bgcolor: "primary.main" },
                "&.Mui-selected:hover": { bgcolor: "primary.dark" },
            }}
        >
            {label}
        </ToggleButton>
    );
}
