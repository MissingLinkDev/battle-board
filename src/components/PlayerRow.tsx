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
import { formatDistanceLabel, formatFeet, getCachedGridUnits, obrDistanceBetweenTokensUnits, type TokenDistanceMode } from "./utils";
import type { CMToken } from "./tokens";
import type { InitiativeSettings } from "./SceneState";

type Props = {
    row: InitiativeItem;
    tokenUrl?: string;
    settings: InitiativeSettings;       // NEW: pass full settings
    tokens: CMToken[];
    colSpan?: number;
    showHealthColumn?: boolean;
};

export default function PlayerRow({
    row,
    tokenUrl,
    settings,
    tokens,
    colSpan,
    showHealthColumn,
}: Props) {
    const [open, setOpen] = useState(row.active);
    const isActive = row.active;
    const prevActiveRef = useRef(row.active);

    // Token Image
    const [avatarUrl, setAvatarUrl] = useState<string | undefined>(tokenUrl);

    //Health helpers
    const isPC = !!row.playerCharacter;
    const isBloodied = row.maxHP > 0 ? row.currentHP < row.maxHP / 2 : false;
    const statusText = row.currentHP === 0 ? row.playerCharacter ? "Dying" : "Dead" : isBloodied ? "Bloodied" : "Healthy";

    //Distances
    const [distances, setDistances] = useState<{ id: string; name: string; ft: number; text: string }[]>([]);
    const { unitLabel, unitsPerCell } = getCachedGridUnits();

    // --------- derive health visibility for THIS row ----------
    const healthMasterOn = !!settings.displayHealthStatusToPlayer;
    const pcMode = (settings.pcHealthMode ?? "numbers") as "none" | "status" | "numbers";
    const npcMode = (settings.npcHealthMode ?? "status") as "none" | "status" | "numbers";
    const rowMode = isPC ? pcMode : npcMode;

    // If parent didn't pass showHealthColumn, derive defensively (matches PlayerTable logic)
    const computedShowHealthColumn =
        showHealthColumn ??
        (healthMasterOn && (pcMode !== "none" || npcMode !== "none"));

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
            if (!settings.showDistances) {
                setDistances([]);
                return;
            }

            const me = tokens.find((t) => t.id === row.id);
            if (!me) {
                setDistances([]);
                return;
            }
            const tokenMode: TokenDistanceMode = "box";

            const list = await Promise.all(
                tokens
                    .filter((t) => t.id !== row.id && t.visible !== false)
                    .map(async (t) => {
                        const raw = await obrDistanceBetweenTokensUnits(me, t, tokenMode);
                        return {
                            id: t.id,
                            name: t.name || "(unnamed)",
                            ft: formatFeet(raw),
                            text: formatDistanceLabel(raw, unitLabel, unitsPerCell),
                        };
                    })
            );

            if (!cancelled) {
                setDistances(list.sort((a, b) => a.ft - b.ft));
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [tokens, row.id, settings.showDistances]);

    const renderHealthCell = () => {
        if (!healthMasterOn || rowMode === "none") return null;

        if (rowMode === "numbers") {
            // Numbers: show current/max; temp on second line if present (PC or NPC as configured)
            return (
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
            );
        }

        // Status
        return (
            <Typography
                sx={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: isBloodied ? "error.main" : "success.main",
                }}
            >
                {statusText}
            </Typography>
        );
    };

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
                    {settings.showDistances && (
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

                {/* Health (only render cell if table allocated the column) */}
                {computedShowHealthColumn && (
                    <TableCell width={62} align="center">
                        {renderHealthCell()}
                    </TableCell>
                )}
            </TableRow>

            {settings.showDistances && (
                <TableRow>
                    <TableCell colSpan={colSpan} sx={{ p: 0, borderBottom: 0 }}>
                        <Collapse in={open} timeout="auto" unmountOnExit>
                            <Box sx={{ flex: 1, minWidth: 0, px: 4, py: 1 }}>
                                <Stack direction="row" alignItems="center" justifyContent="center" sx={{ px: 1, py: 0.5 }}>
                                    <Stack direction="row" alignItems="center" spacing={0.5}>
                                        <Typography sx={{ fontWeight: 700, fontSize: "0.95rem", textAlign: "center", mb: 0.75 }}>
                                            Distances
                                        </Typography>
                                        <Tooltip
                                            title="Measured from edge to edge; attack range must be greater than distance."
                                            enterDelay={300}
                                        >
                                            <InfoRounded fontSize="small" sx={{ color: "text.secondary", cursor: "help" }} />
                                        </Tooltip>
                                    </Stack>
                                </Stack>
                                <List dense disablePadding sx={{ px: 0, "& .MuiListItem-root": { py: 0.25 } }}>
                                    {distances.length === 0 ? (
                                        <ListItem disableGutters>
                                            <Typography sx={{ fontSize: "0.8rem", color: "text.secondary" }}>
                                                No other tokens found.
                                            </Typography>
                                        </ListItem>
                                    ) : (
                                        distances.map((d) => (
                                            <ListItem
                                                key={d.id}
                                                disableGutters
                                                sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                                            >
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
                                                    {d.text}
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
