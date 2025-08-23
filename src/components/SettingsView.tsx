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
import OBR from "@owlbear-rodeo/sdk";

import type { InitiativeSettings } from "./SceneState";

type Props = {
    value: InitiativeSettings;
    onChange: (next: InitiativeSettings) => void;
    onBack: () => void;
};

export default function SettingsView({ value, onChange, onBack }: Props) {
    const rootRef = useRef<HTMLDivElement | null>(null);

    const set = (patch: Partial<InitiativeSettings>) =>
        onChange({ ...value, ...patch });

    const Rows = useMemo(
        () => [
            {
                title: "Initiative List",
                options: [
                    ["Armor", "showArmor"],
                    ["HP", "showHP"],
                    ["Movement Range", "showMovementRange"],
                    ["Attack Range", "showAttackRange"],
                    ["Conditions", "showConditions"],
                    ["Distances", "showDistances"],
                ] as const,
            },
            {
                title: "Gameplay",
                options: [
                    ["Disable Player Initiative List", "disablePlayerList"],
                    ["Display Player Health Status", "displayPlayerHealthStatus"],
                    ["Show Range Rings", "showRangeRings"],
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
        </Paper>
    );
}
