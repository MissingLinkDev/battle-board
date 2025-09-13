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
import OBR, { isImage, type Item } from "@owlbear-rodeo/sdk";

import type { InitiativeItem } from "./InitiativeItem";
import { HealthDisplay } from "./HealthDisplay";
import { DistancePanel } from "./DistancePanel";
import { useDistances } from "../hooks/useDistances";
import { useHealthLogic } from "../hooks/useHealthLogic";
import type { CMToken } from "./tokens";
import type { InitiativeSettings } from "./SceneState";

type Props = {
    row: InitiativeItem;
    tokenUrl?: string;
    settings: InitiativeSettings;
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
    const [open, setOpen] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | undefined>(tokenUrl);
    const prevActiveRef = useRef(row.active);

    // Centralized hooks
    const { getHealthInfo } = useHealthLogic(settings);
    const distances = useDistances(row.id, tokens, settings.showDistances);
    const healthInfo = getHealthInfo(row);

    // Auto-expand/collapse logic for player characters
    useEffect(() => {
        const wasActive = prevActiveRef.current;
        const isActive = row.active;

        // Auto-expand when becoming active (only for player characters)
        if (!wasActive && isActive && row.playerCharacter) {
            setOpen(true);
        }

        // Auto-collapse when becoming inactive
        if (wasActive && !isActive) {
            setOpen(false);
        }

        prevActiveRef.current = isActive;
    }, [row.active, row.playerCharacter, row.name, row.id]);

    // Token image management
    useEffect(() => {
        let cancelled = false;

        const updateAvatar = async () => {
            try {
                const items = await OBR.scene.items.getItems();
                if (cancelled) return;
                const me = items.find((it) => it.id === row.id);
                if (me && isImage(me)) {
                    setAvatarUrl(me.image?.url ?? undefined);
                }
            } catch (error) {
                // Silently handle errors - avatar is not critical
                console.warn("Failed to update avatar:", error);
            }
        };

        updateAvatar();
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

    const isActive = row.active;
    const computedShowHealthColumn = showHealthColumn ?? healthInfo.showColumn;

    const handleToggleOpen = () => {
        setOpen(!open);
    };

    return (
        <>
            <TableRow
                hover
                selected={isActive}
                onClick={settings.showDistances ? handleToggleOpen : undefined}
                sx={{
                    height: "45px",
                    "& td": { py: isActive ? 0.6 : 0.4, px: 0.5 },
                    transition: "all 120ms ease",
                    backgroundColor: isActive ? (t) => alpha(t.palette.success.main, 0.12) : "inherit",
                    outline: isActive ? (t) => `1px solid ${alpha(t.palette.success.main, 0.35)}` : "none",
                    transform: isActive ? "scale(1.01)" : "scale(1)",
                    cursor: settings.showDistances ? "pointer" : "default",
                }}
            >
                {/* Expand / Collapse */}
                <TableCell width={28}>
                    {settings.showDistances && (
                        <IconButton
                            aria-label="expand row"
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleToggleOpen();
                            }}
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

                {/* Avatar */}
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

                {/* Health */}
                {computedShowHealthColumn && (
                    <TableCell width={62} align="center">
                        <HealthDisplay row={row} healthInfo={healthInfo} variant="compact" />
                    </TableCell>
                )}
            </TableRow>

            {/* Expanded distances panel */}
            {settings.showDistances && (
                <TableRow>
                    <TableCell colSpan={colSpan} sx={{ p: 0, borderBottom: 0 }}>
                        <Collapse in={open} timeout="auto" unmountOnExit>
                            <Box sx={{ flex: 1, minWidth: 0, px: 4, py: 1 }}>
                                <DistancePanel distances={distances} />
                            </Box>
                        </Collapse>
                    </TableCell>
                </TableRow>
            )}
        </>
    );
}