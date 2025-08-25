import { useEffect, useMemo, useRef } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import Divider from "@mui/material/Divider";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Paper from "@mui/material/Paper";
import DeleteForeverRounded from "@mui/icons-material/DeleteForever";
import OBR from "@owlbear-rodeo/sdk";

import type { InitiativeSettings } from "./SceneState";
import { META_KEY, isMetadata } from "./metadata";
import { ensureRings, clearRings } from "./rings";
import Button from "@mui/material/Button";
import type { InitiativeItem } from "./InitiativeItem";

type Props = {
    value: InitiativeSettings;
    onChange: (next: InitiativeSettings) => void;
    onBack: () => void;
    rows?: InitiativeItem[];
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
    rangeOpacity?: number | null;    // 0..1
};

export default function SettingsView({ value, onChange, onBack, rows }: Props) {
    const rootRef = useRef<HTMLDivElement | null>(null);

    const hasInitiative = (rows?.length ?? 0) > 0;

    const set = (patch: Partial<InitiativeSettings>) =>
        onChange({ ...value, ...patch });

    const Rows = useMemo(
        () => [
            {
                title: "Initiative List",
                options: [
                    ["Armor", "showArmor"],
                    ["HP", "showHP"],
                    // ["Movement Range", "showMovementRange"],
                    // ["Attack Range", "showAttackRange"],
                    ["Distances", "showDistances"],
                    ["DM Distance Rings Toggle", "dmRingToggle"],
                ] as const,
            },
            {
                title: "Gameplay",
                options: [
                    ["Disable Player Initiative List", "disablePlayerList"],
                    ["Display Player Health Status", "displayPlayerHealthStatus"],
                    ["Show Range Rings for Player Characters", "showRangeRings"],
                ] as const,
            },
        ],
        []
    );

    // Observe the whole panel and size action height to its exact rendered height.
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

    useEffect(() => {
        let cancelled = false;

        const refreshRingsFromSettings = async () => {
            try {
                // If rings are globally hidden or neither type is enabled → nuke any shown rings
                if (!value.showRangeRings || (!value.showMovementRange && !value.showAttackRange)) {
                    await clearRings("normal");
                    return;
                }

                // Find the currently active creature
                const items = await OBR.scene.items.getItems();
                if (cancelled) return;

                const active = items.find((it: any) => {
                    const meta = (it.metadata as any)?.[META_KEY];
                    return isMetadata?.(meta) && meta.active === true;
                });

                // No active → just clear (prevents stale rings hanging around)
                if (!active) {
                    await clearRings("normal");
                    return;
                }

                const meta = ((active.metadata as any)[META_KEY] ?? {}) as MetaForRings;

                // If the toggle is "Show Range Rings for Player Characters", do nothing for non‑PCs
                if (!meta?.playerCharacter) {
                    await clearRings("normal");
                    return;
                }

                // Only pass through the ring types that are enabled
                await ensureRings({
                    // identity / wiring
                    tokenId: active.id,
                    variant: "normal",
                    visible: true,
                    moveAttached: false,
                    rangeAttached: true,
                    // distances (respect settings switches)
                    movement: value.showMovementRange ? (meta.movement ?? 0) : 0,
                    attackRange: value.showAttackRange ? (meta.attackRange ?? 0) : 0,
                    // style (pull entirely from metadata; fall back to your defaults)
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

        // Run whenever any of the three switches change
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
                    if ((it.metadata as any)[META_KEY]) {
                        delete (it.metadata as any)[META_KEY];
                    }
                }
            });
        } catch (err) {
            console.error("Failed to clear initiative list:", err);
        }
    };

    return (
        <Paper ref={rootRef} sx={{ borderRadius: 0 }}>
            {/* Header */}
            <Box sx={{ px: 1, py: 1, display: "flex", alignItems: "center", gap: 1 }}>
                <IconButton size="small" onClick={onBack}>
                    <ArrowBackRounded />
                </IconButton>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Settings
                </Typography>
            </Box>
            <Divider />

            {/* Content */}
            <Box sx={{ p: 2 }}>
                <Stack spacing={3}>
                    {Rows.map((group) => (
                        <Box key={group.title}>
                            <Typography
                                sx={{
                                    fontWeight: 700,
                                    mb: 1,
                                    textAlign: "center",
                                    fontSize: "1.1rem",
                                }}
                            >
                                {group.title}
                            </Typography>
                            <FormGroup>
                                {group.options.map(([label, key]) => (
                                    <FormControlLabel
                                        key={key}
                                        control={
                                            <Switch
                                                size="medium"
                                                checked={(value as any)[key]}
                                                onChange={(e) =>
                                                    set({ [key]: e.target.checked } as any)
                                                }
                                            />
                                        }
                                        label={<Typography sx={{ fontSize: "0.95rem" }}>{label}</Typography>}
                                        sx={{ mx: 2 }}
                                    />
                                ))}
                            </FormGroup>
                        </Box>
                    ))}
                </Stack>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ textAlign: "center", p: 2 }}>
                <Button
                    variant="contained"
                    color="error"
                    startIcon={<DeleteForeverRounded />}
                    onClick={handleClearAll}
                    disabled={!hasInitiative}
                >
                    Clear All from Initiative
                </Button>
            </Box>
        </Paper>
    );
}
