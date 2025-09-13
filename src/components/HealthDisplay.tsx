import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { InitiativeItem } from "./InitiativeItem";
import type { HealthInfo } from "../hooks/useHealthLogic";

type Props = {
    row: InitiativeItem;
    healthInfo: HealthInfo;
    variant?: "compact" | "full";
};

/**
 * Centralized health display component
 */
export function HealthDisplay({ row, healthInfo, variant = "compact" }: Props) {
    const { mode, statusText, isBloodied, isDead } = healthInfo;

    if (mode === "none") return null;

    const color = isDead ? "error.main" : (isBloodied ? "warning.main" : "success.main");
    const fontSize = variant === "compact" ? "0.75rem" : "0.8rem";

    if (mode === "status") {
        return (
            <Typography sx={{ fontSize, fontWeight: 600, color }}>
                {statusText}
            </Typography>
        );
    }

    // Numbers mode
    const displayText = isDead
        ? statusText
        : `${row.currentHP}/${row.maxHP}`;

    return (
        <Box sx={{ lineHeight: 1.1 }}>
            <Typography sx={{ fontSize, fontWeight: 600, color }}>
                {displayText}
            </Typography>
            {row.tempHP > 0 && (
                <Typography sx={{ fontSize: "0.7rem", color: "text.secondary" }}>
                    temp: {row.tempHP}
                </Typography>
            )}
        </Box>
    );
}