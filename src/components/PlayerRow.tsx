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
import { useHPEditing } from "../hooks/useHPEditing";
import { CommitNumberField } from "./CommitFields";
import type { CMToken } from "./tokens";
import type { InitiativeSettings } from "./SceneState";

type Props = {
    row: InitiativeItem;
    tokenUrl?: string;
    settings: InitiativeSettings;
    tokens: CMToken[];
    items?: InitiativeItem[];
    colSpan?: number;
    showHealthColumn?: boolean;
    updateRow?: (id: string, patch: Partial<InitiativeItem>) => void;
};

export default function PlayerRow({
    row,
    tokenUrl,
    settings,
    tokens,
    items,
    colSpan,
    showHealthColumn,
    updateRow,
}: Props) {
    const [open, setOpen] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | undefined>(tokenUrl);
    const prevActiveRef = useRef(row.active);

    // Centralized hooks
    const { getHealthInfo } = useHealthLogic(settings);
    const distances = useDistances(row.id, tokens, settings.showDistances, "box", items);
    const healthInfo = getHealthInfo(row);

    // Health editing hook
    const onChange = (patch: Partial<InitiativeItem>) => {
        updateRow?.(row.id, patch);
    };
    const {
        editingField,
        setEditingField,
        commitCurrentHP,
        commitTempHP,
    } = useHPEditing(row, false, onChange); // false = not started check (players always edit same way)

    // Styling for input fields to match DM view
    const inputSx = {
        "& .MuiOutlinedInput-root": { borderRadius: 0.25, height: 28, p: 0 },
        "& .MuiOutlinedInput-input": { fontSize: "0.8rem", lineHeight: 1.25, py: 0 },
    };

    const hpTextSx = {
        fontSize: "0.8rem",
        fontWeight: 600,
        lineHeight: 1.25
    };

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
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
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
                        {row.concentrating && (
                            <Box
                                sx={{
                                    width: 14,
                                    height: 14,
                                    bgcolor: "grey.600",
                                    transform: "rotate(45deg)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                }}
                            >
                                <Typography
                                    sx={{
                                        fontSize: "0.55rem",
                                        fontWeight: 700,
                                        color: "white",
                                        transform: "rotate(-45deg)",
                                        lineHeight: 1,
                                    }}
                                >
                                    C
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </TableCell>

                {/* Health */}
                {computedShowHealthColumn && (
                    <TableCell width={62} align="center" onClick={(e) => e.stopPropagation()} sx={{ cursor: "default" }}>
                        {settings.playerEditableHealth && row.playerCharacter && healthInfo.mode === "numbers" ? (
                            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, height: 28 }}>
                                {/* CURRENT */}
                                {editingField === "cur" ? (
                                    <CommitNumberField
                                        size="small"
                                        variant="outlined"
                                        value={row.currentHP}
                                        allowMath
                                        min={0}
                                        max={Math.max(0, row.maxHP)}
                                        onCommit={commitCurrentHP}
                                        sx={inputSx}
                                        slotProps={{
                                            htmlInput: {
                                                inputMode: "text",
                                                pattern: undefined,
                                                autoFocus: true,
                                                onFocus: (e: any) => e.currentTarget.select(),
                                                "aria-label": "current hp",
                                                style: { textAlign: "center", padding: "0 1px", fontSize: "0.8rem", width: 34 },
                                            },
                                        }}
                                    />
                                ) : (
                                    <Typography
                                        component="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingField("cur");
                                        }}
                                        style={{ all: "unset", cursor: "text" }}
                                    >
                                        <Typography component="span" sx={hpTextSx}>
                                            {row.currentHP}
                                        </Typography>
                                    </Typography>
                                )}

                                <Typography component="span" sx={{ fontSize: "0.95rem", opacity: 0.85 }}>
                                    /
                                </Typography>

                                {/* MAX (read-only for players) */}
                                <Typography component="span" sx={hpTextSx}>
                                    {row.maxHP}
                                </Typography>
                            </Box>
                        ) : (
                            <HealthDisplay row={row} healthInfo={healthInfo} variant="compact" />
                        )}
                    </TableCell>
                )}

                {/* TEMP HP - separate column, always shown when editable */}
                {computedShowHealthColumn && (
                    settings.playerEditableHealth && row.playerCharacter && healthInfo.mode === "numbers" ? (
                        <TableCell width={36} align="center" onClick={(e) => e.stopPropagation()} sx={{ cursor: "default" }}>
                            <Box sx={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 28 }}>
                                {editingField === "temp" ? (
                                    <CommitNumberField
                                        size="small"
                                        variant="outlined"
                                        value={row.tempHP}
                                        allowMath
                                        onCommit={commitTempHP}
                                        sx={inputSx}
                                        slotProps={{
                                            htmlInput: {
                                                inputMode: "text",
                                                pattern: undefined,
                                                autoFocus: true,
                                                onFocus: (e: any) => e.currentTarget.select(),
                                                "aria-label": "temp hp",
                                                style: { textAlign: "center", padding: "0 1px", fontSize: "0.8rem", width: 34 },
                                            },
                                        }}
                                    />
                                ) : (
                                    <Typography
                                        component="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingField("temp");
                                        }}
                                        style={{ all: "unset", cursor: "text" }}
                                    >
                                        <Typography component="span" sx={hpTextSx}>
                                            {row.tempHP || 0}
                                        </Typography>
                                    </Typography>
                                )}
                            </Box>
                        </TableCell>
                    ) : null
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