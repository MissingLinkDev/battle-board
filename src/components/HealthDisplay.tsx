import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { Combatant } from "../encounter";
import type { HealthMode } from "../settings";
import { status } from "../encounter/health";

type Props = {
    row: Combatant;
    mode: HealthMode;
    variant?: "compact" | "full";
};

/** A combatant's health as players may see it. */
export function HealthDisplay({ row, mode, variant = "compact" }: Props) {
    if (mode === "none") return null;

    const statusText = status(row);
    const color = statusText === "Dead" || statusText === "Dying"
        ? "error.main"
        : statusText === "Bloodied" ? "warning.main" : "success.main";
    const fontSize = variant === "compact" ? "0.75rem" : "0.8rem";

    if (mode === "status") {
        return (
            <Typography sx={{ fontSize, fontWeight: 600, color }}>
                {statusText}
            </Typography>
        );
    }

    // Numbers mode
    const displayText = row.currentHP === 0
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
