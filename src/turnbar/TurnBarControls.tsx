import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { POSITIONS, setPreferences, useTurnBarPreferences, type TurnBarPosition } from "./preferences";

/** A player's own show/position choice for the turn bar, saved on this device. */
export function TurnBarControls() {
    const { position, hidden } = useTurnBarPreferences();
    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, py: 0.5, borderTop: (t) => `1px solid ${t.palette.divider}` }}>
            <Typography sx={{ fontWeight: 600, fontSize: "0.8rem", flex: 1 }}>Turn bar</Typography>
            <Select
                size="small"
                value={position}
                disabled={hidden}
                onChange={(e) => setPreferences({ position: e.target.value as TurnBarPosition })}
                sx={{ width: 130, fontSize: "0.8rem", "& .MuiSelect-select": { py: 0.5 } }}
                MenuProps={{ disableScrollLock: true }}
                inputProps={{ "aria-label": "turn bar position" }}
            >
                {POSITIONS.map((p) => (
                    <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                ))}
            </Select>
            <Switch
                size="small"
                checked={!hidden}
                onChange={(e) => setPreferences({ hidden: !e.target.checked })}
                inputProps={{ "aria-label": "show turn bar" }}
            />
        </Box>
    );
}
