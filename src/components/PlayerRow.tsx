import { useState } from "react";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUp from "@mui/icons-material/KeyboardArrowUp";
import { alpha } from "@mui/material/styles";
import type { InitiativeItem } from "./InitiativeItem";

type Props = {
    row: InitiativeItem;
    tokenUrl?: string; // optional image for the token avatar
};

export default function PlayerRow({ row, tokenUrl }: Props) {
    const [open, setOpen] = useState(row.active);
    const isActive = row.active;

    return (
        <>
            <TableRow
                hover
                selected={isActive}
                sx={{
                    "& td": { py: isActive ? 0.6 : 0.4, px: 0.5 },
                    transition: "all 120ms ease",
                    backgroundColor: isActive ? (t) => alpha(t.palette.success.main, 0.12) : "inherit",
                    outline: isActive ? (t) => `1px solid ${alpha(t.palette.success.main, 0.35)}` : "none",
                    transform: isActive ? "scale(1.01)" : "scale(1)",
                }}
            >
                {/* Expand / Collapse */}
                <TableCell width={28}>
                    <IconButton
                        aria-label="expand row"
                        size="small"
                        onClick={() => setOpen(!open)}
                        sx={{ p: 0.25 }}
                    >
                        {open ? (
                            <KeyboardArrowUp fontSize="inherit" sx={{ fontSize: "0.9rem" }} />
                        ) : (
                            <KeyboardArrowDown fontSize="inherit" sx={{ fontSize: "0.9rem" }} />
                        )}
                    </IconButton>
                </TableCell>
                <TableCell width={28} align="center">
                    <Box
                        sx={{
                            display: "inline-flex",
                            px: 0.6,
                            py: 0.25,
                            borderRadius: 1,
                            bgcolor: "action.selected",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            lineHeight: 1,
                        }}
                    >
                        {row.initiative}
                    </Box>
                </TableCell>

                {/* Token + Name (single combined cell for compactness) */}
                <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                        <Avatar
                            src={tokenUrl}
                            alt={row.name}
                            sx={{ width: isActive ? 30 : 26, height: isActive ? 30 : 26, fontSize: "0.75rem" }}
                        >
                            {row.name.slice(0, 2).toUpperCase()}
                        </Avatar>
                        <Typography
                            noWrap
                            sx={{ fontWeight: isActive ? 700 : 600, fontSize: isActive ? "0.95rem" : "0.85rem", minWidth: 0 }}
                        >
                            {row.visible ? row.name : <em>Hidden</em>}
                        </Typography>
                    </Box>
                </TableCell>

                {/* Tiny initiative pill (read-only) */}

            </TableRow>

            {/* Collapsed area: reserved for speeds/distances later */}
            <TableRow>
                <TableCell colSpan={3} sx={{ p: 0, borderBottom: 0 }}>
                    <Collapse in={open} timeout="auto" unmountOnExit>
                        <Box sx={{ p: 1, m: 0 }}>
                            <Typography sx={{ fontSize: "0.75rem" }}>
                                Movement: {row.movement} ft. &nbsp;|&nbsp; Range: {row.attackRange} ft.
                            </Typography>
                            {/* Later: distances to others, autofocus toggle, etc. */}
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
        </>
    );
}
