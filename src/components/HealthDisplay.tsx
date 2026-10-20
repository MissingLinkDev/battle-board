import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { Combatant } from "../encounter";
import type { HealthMode } from "../settings";
import { healthFraction, showsBar, status } from "../encounter/health";

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

    // Bar only: nothing to draw without a max; at 0 HP the status says why the bar is empty
    if (mode === "bar") {
        if (healthFraction(row) === null) return null;
        return (
            <Box sx={{ lineHeight: 1.1 }}>
                <HealthBar row={row} />
                {row.currentHP === 0 && (
                    <Typography sx={{ fontSize: "0.7rem", fontWeight: 600, color, mt: 0.25 }}>
                        {statusText}
                    </Typography>
                )}
            </Box>
        );
    }

    // Numbers, optionally with a bar underneath
    const displayText = row.currentHP === 0
        ? statusText
        : `${row.currentHP}/${row.maxHP}`;

    return (
        <Box sx={{ lineHeight: 1.1 }}>
            <Typography sx={{ fontSize, fontWeight: 600, color }}>
                {displayText}
            </Typography>
            {showsBar(mode) && <HealthBar row={row} sx={{ mt: 0.25 }} />}
            {row.tempHP > 0 && (
                <Typography sx={{ fontSize: "0.7rem", color: "text.secondary" }}>
                    temp: {row.tempHP}
                </Typography>
            )}
        </Box>
    );
}

/**
 * A thin bar for the share of max HP left, green when full fading to red at 0.
 * Temp HP shows as a blue strip along the top, on the same scale. Renders
 * nothing when no max HP is set.
 */
export function HealthBar({ row, sx }: { row: Pick<Combatant, "currentHP" | "maxHP" | "tempHP">; sx?: object }) {
    const fraction = healthFraction(row);
    if (fraction === null) return null;
    const temp = Math.min(row.tempHP / row.maxHP, 1);

    return (
        <Box
            role="meter"
            aria-label="health"
            aria-valuemin={0}
            aria-valuemax={row.maxHP}
            aria-valuenow={row.currentHP}
            sx={{ position: "relative", width: "100%", minWidth: 40, height: 5, borderRadius: 2.5, overflow: "hidden", bgcolor: "action.disabledBackground", ...sx }}
        >
            <Box sx={{ height: "100%", width: `${fraction * 100}%`, bgcolor: healthColor(fraction), transition: "width 200ms, background-color 200ms" }} />
            {temp > 0 && (
                <Box sx={{ position: "absolute", top: 0, left: 0, height: 2, width: `${temp * 100}%`, bgcolor: "info.main" }} />
            )}
        </Box>
    );
}

/** Hue slides from green (120°) at full health through yellow to red (0°) at 0. */
function healthColor(fraction: number): string {
    return `hsl(${Math.round(fraction * 120)}, 70%, 45%)`;
}
