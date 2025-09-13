import { useMemo } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import ColorPicker from "./ColorPicker";
import { CommitNumberField } from "./CommitFields";
import type { InitiativeItem } from "./InitiativeItem";
import type { RingConfig } from "../hooks/useRingState";

type Props = {
    row: InitiativeItem;
    config: RingConfig;
    onUpdate: (draft: Partial<InitiativeItem>) => void;
};

/**
 * Centralized ring configuration controls
 */
export function RingControls({ row, config, onUpdate }: Props) {
    const inputSx = useMemo(() => ({
        "& .MuiOutlinedInput-root": { borderRadius: 0.5, fontSize: "0.85rem", height: 28, p: 0 },
    }), []);

    const htmlInputProps = useMemo(() => ({
        inputMode: "numeric" as const,
        pattern: "[0-9]*",
        style: { textAlign: "center" as const, padding: "0 2px", width: "5ch", fontSize: "0.85rem" },
    }), []);

    return (
        <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: "0.95rem", textAlign: "center", mb: 0.75 }}>
                Overlays
            </Typography>

            {/* Player Character toggle */}
            <Box sx={{ display: "flex", justifyContent: "center", mb: 1 }}>
                <FormControlLabel
                    control={
                        <Checkbox
                            size="small"
                            checked={!!row.playerCharacter}
                            onChange={(e) => onUpdate({ playerCharacter: e.target.checked })}
                        />
                    }
                    label="Player Character"
                    sx={{ "& .MuiFormControlLabel-label": { fontSize: "0.8rem" } }}
                />
            </Box>

            <Stack spacing={1}>
                {/* Movement */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                    <ColorPicker
                        value={config.movementStyle.color}
                        onChange={(hex) => onUpdate({ movementColor: hex })}
                        weight={config.movementStyle.weight}
                        onChangeWeight={(w) => onUpdate({ movementWeight: w })}
                        pattern={config.movementStyle.pattern}
                        onChangePattern={(p) => onUpdate({ movementPattern: p })}
                        opacity={config.movementStyle.opacity}
                        onChangeOpacity={(o) => onUpdate({ movementOpacity: o })}
                    />

                    <Typography sx={{ fontSize: "0.85rem", flexShrink: 0 }}>Movement</Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }} />

                    <CommitNumberField
                        size="small"
                        variant="outlined"
                        value={config.movement}
                        onCommit={(v) => onUpdate({ movement: v })}
                        sx={inputSx}
                        slotProps={{
                            htmlInput: {
                                ...htmlInputProps,
                                "aria-label": "movement",
                            },
                        }}
                    />
                    <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", ml: 0.75, flexShrink: 0 }}>
                        ft
                    </Typography>
                </Box>

                {/* Attack Range */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                    <ColorPicker
                        value={config.rangeStyle.color}
                        onChange={(hex) => onUpdate({ rangeColor: hex })}
                        weight={config.rangeStyle.weight}
                        onChangeWeight={(w) => onUpdate({ rangeWeight: w })}
                        pattern={config.rangeStyle.pattern}
                        onChangePattern={(p) => onUpdate({ rangePattern: p })}
                        opacity={config.rangeStyle.opacity}
                        onChangeOpacity={(o) => onUpdate({ rangeOpacity: o })}
                    />

                    <Typography sx={{ fontSize: "0.85rem", flexShrink: 0 }}>Atk Range</Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }} />

                    <CommitNumberField
                        size="small"
                        variant="outlined"
                        value={config.attackRange}
                        onCommit={(v) => onUpdate({ attackRange: v })}
                        sx={inputSx}
                        slotProps={{
                            htmlInput: {
                                ...htmlInputProps,
                                "aria-label": "attack range",
                            },
                        }}
                    />
                    <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", ml: 0.75, flexShrink: 0 }}>
                        ft
                    </Typography>
                </Box>
            </Stack>
        </Box>
    );
}