import { useState, useEffect, useRef } from "react";
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
import OBR, { isImage, type Item } from "@owlbear-rodeo/sdk";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import InfoRounded from "@mui/icons-material/InfoRounded";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import { distanceBetweenTokensUnits, formatDistanceLabel, formatFeet, getGridInfo, type TokenDistanceMode } from "./utils";
import type { CMToken } from "./tokens";

type Props = {
    row: InitiativeItem;
    tokenUrl?: string;
    showHealthStatus?: boolean;  // new
    showHealthNumber?: boolean;  // new
    showDistances?: boolean;
    tokens: CMToken[];
    colSpan?: number;
};

export default function PlayerRow({ row, tokenUrl, showHealthStatus, showHealthNumber, showDistances, tokens, colSpan }: Props) {
    const [open, setOpen] = useState(row.active);
    const isActive = row.active;
    const prevActiveRef = useRef(row.active);

    // Token Image
    const [avatarUrl, setAvatarUrl] = useState<string | undefined>(tokenUrl);

    //Health helpers
    const isPC = !!row.playerCharacter;
    const isBloodied = row.maxHP > 0 ? row.currentHP < row.maxHP / 2 : false;
    const statusText = isBloodied ? "Bloodied" : "Healthy";

    //Distances
    const [distances, setDistances] = useState<{ id: string; name: string; ft: number }[]>([]);

    useEffect(() => {
        // when row becomes active (false -> true), open the panel
        if (!prevActiveRef.current && row.active) {
            setOpen(true);
        }
        if (prevActiveRef.current && !row.active) {
            setOpen(false);
        }
        prevActiveRef.current = row.active;
    }, [row.active]);

    useEffect(() => {
        let cancelled = false;

        async function bootstrap() {
            const items = await OBR.scene.items.getItems();
            if (cancelled) return;
            const me = items.find((it) => it.id === row.id);
            if (me && isImage(me)) {
                setAvatarUrl(me.image?.url ?? undefined);
            }
        }

        // initial load
        bootstrap();

        // subscribe to changes
        const unsub = OBR.scene.items.onChange((items: Item[]) => {
            if (cancelled) return;
            const me = items.find((it) => it.id === row.id);
            if (me && isImage(me)) {
                setAvatarUrl(me.image?.url ?? undefined);
            }
        });

        return () => {
            cancelled = true;
            unsub?.();
        };
    }, [row.id]);

    // ------------ Distances list ------------
    useEffect(() => {
        let cancelled = false;

        (async () => {
            if (!showDistances) {
                setDistances([]);
                return;
            }

            const me = tokens.find((t) => t.id === row.id);
            if (!me) {
                setDistances([]);
                return;
            }

            const grid = await getGridInfo();
            const tokenMode: TokenDistanceMode = "box";

            const list = tokens
                .filter((t) => t.id !== row.id && t.visible !== false)
                .map((t) => {
                    const raw = distanceBetweenTokensUnits(me, t, grid, tokenMode); // feet
                    return {
                        id: t.id,
                        name: t.name || "(unnamed)",
                        ft: formatFeet(raw),          // numeric, good for sorting/comparisons
                        text: formatDistanceLabel(raw) // "Touch" if <5, else "N ft"
                    };
                })
                .sort((a, b) => a.ft - b.ft);

            if (!cancelled) setDistances(list);
        })();

        return () => {
            cancelled = true;
        };
    }, [tokens, row.id, showDistances]);

    return (
        <>
            <TableRow
                hover
                selected={isActive}
                onClick={() => setOpen(!open)}
                sx={{
                    height: "45px",
                    "& td": { py: isActive ? 0.6 : 0.4, px: 0.5 },
                    transition: "all 120ms ease",
                    backgroundColor: isActive ? (t) => alpha(t.palette.success.main, 0.12) : "inherit",
                    outline: isActive ? (t) => `1px solid ${alpha(t.palette.success.main, 0.35)}` : "none",
                    transform: isActive ? "scale(1.01)" : "scale(1)",
                }}
            >
                {/* Expand / Collapse */}
                <TableCell width={28}>
                    {showDistances && (
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
                    )}
                </TableCell>

                {/* Initiative */}
                <TableCell width={40} align="center">
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

                {/* Avatar (new 3rd column) */}
                <TableCell align="center">
                    <Avatar
                        src={avatarUrl}
                        alt={row.name}
                        sx={{ width: isActive ? 60 : 42, height: isActive ? 60 : 42, fontSize: "0.75rem" }}
                    >
                        {row.name.slice(0, 2).toUpperCase()}
                    </Avatar>
                </TableCell>

                {/* Name */}
                <TableCell>
                    <Typography
                        noWrap
                        sx={{
                            fontWeight: isActive ? 700 : 600,
                            fontSize: isActive ? "0.95rem" : "0.85rem",
                            minWidth: 0,
                        }}
                    >
                        {row.visible ? row.name : <em>Hidden</em>}
                    </Typography>
                </TableCell>

                {/* Health*/}

                {(showHealthStatus || showHealthNumber) && (
                    <TableCell width={62} align="center">
                        {isPC && showHealthNumber ? (
                            // PC + numbers: show current/max, and 2nd line "temp: XX" if any
                            <Box sx={{ lineHeight: 1.1 }}>
                                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600 }}>
                                    {row.currentHP}/{row.maxHP}
                                </Typography>
                                {row.tempHP > 0 && (
                                    <Typography sx={{ fontSize: "0.7rem", color: "text.secondary" }}>
                                        temp: {row.tempHP}
                                    </Typography>
                                )}
                            </Box>
                        ) : showHealthStatus ? (
                            // Status (PC without numbers, or any non-PC when status is enabled)
                            <Typography
                                sx={{
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                    color: isBloodied ? "error.main" : "success.main",
                                }}
                            >
                                {statusText}
                            </Typography>
                        ) : null}
                    </TableCell>
                )}
            </TableRow>


            {/* Collapsed area: reserved for speeds/distances later */}
            {showDistances && (
                <TableRow>
                    <TableCell colSpan={colSpan} sx={{ p: 0, borderBottom: 0 }}>
                        <Collapse in={open} timeout="auto" unmountOnExit>
                            <Box sx={{ flex: 1, minWidth: 0, px: 4, py: 1 }}>
                                <Stack direction="row" alignItems="center" justifyContent="center" sx={{ px: 1, py: 0.5 }}>
                                    <Stack direction="row" alignItems="center" spacing={0.5}>
                                        <Typography sx={{ fontWeight: 700, fontSize: "0.95rem", textAlign: "center", mb: 0.75 }}>
                                            Distances
                                        </Typography>
                                        <Tooltip title="Measured from edge to edge; attack range must be greater than distance." enterDelay={300}>
                                            <InfoRounded fontSize="small" sx={{ color: "text.secondary", cursor: "help" }} />
                                        </Tooltip>
                                    </Stack>
                                </Stack>
                                <List dense disablePadding sx={{ px: 0, "& .MuiListItem-root": { py: 0.25 } }}>
                                    {distances.length === 0 ? (
                                        <ListItem disableGutters>
                                            <Typography sx={{ fontSize: "0.8rem", color: "text.secondary" }}>No other tokens found.</Typography>
                                        </ListItem>
                                    ) : (
                                        distances.map((d) => (
                                            <ListItem key={d.id} disableGutters sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                                <Typography
                                                    sx={{
                                                        flex: 1,
                                                        minWidth: 0,
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                        fontSize: "0.8rem",
                                                    }}
                                                >
                                                    {d.name}
                                                </Typography>
                                                <Typography
                                                    sx={{
                                                        flex: "0 0 35px",
                                                        textAlign: "right",
                                                        fontSize: "0.8rem",
                                                        color: "text.secondary",
                                                    }}
                                                >
                                                    {d.ft < 5 ? "Touch" : `${d.ft} ft`}
                                                </Typography>
                                            </ListItem>
                                        ))
                                    )}
                                </List>
                            </Box>
                        </Collapse>
                    </TableCell>
                </TableRow>
            )}
        </>
    );
}
