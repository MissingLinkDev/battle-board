import { useEffect, useRef, useState, useMemo } from "react";

import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import StopRounded from "@mui/icons-material/StopRounded";
import NavigateBeforeRounded from "@mui/icons-material/NavigateBeforeRounded";
import NavigateNextRounded from "@mui/icons-material/NavigateNextRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";

import OBR, { isImage, type Item, type Player } from "@owlbear-rodeo/sdk";

import { initiativeFromItem, metaPatchFromRowDiff, type InitiativeItem } from "./InitiativeItem";
import InitiativeRow from "./InitiativeRow";
import PlayerTable from "./PlayerTable";
import SettingsView from "./SettingsView";

import { META_KEY, batchUpdateMeta, createMetaForItem, isMetadata, type MetaShape } from "./metadata";
import { ensureRings, clearRings } from "./rings";
import { registerInitiativeContextMenu } from "./initiativeMenu";
import { sortByInitiativeDesc } from "./utils";
import {
    readSceneState,
    saveSceneState,
    onSceneStateChange,
    type SceneState,
    type InitiativeSettings,
    DEFAULT_SETTINGS,
} from "./SceneState";
import { useCMTokens } from "./useCMTokens";


export function InitiativeTracker() {
    const [role, setRole] = useState<"GM" | "PLAYER">("PLAYER");
    const [started, setStarted] = useState(false);
    const [round, setRound] = useState(0);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [rows, setRows] = useState<InitiativeItem[]>([]);

    const [settings, setSettings] = useState<InitiativeSettings>(DEFAULT_SETTINGS);
    const [view, setView] = useState<"tracker" | "settings">("tracker");

    // local edits tracking for diff effect
    const localEditRef = useRef(false);
    const prevRowsRef = useRef<InitiativeItem[]>([]);

    //watching the root box for size changes
    const rootRef = useRef<HTMLDivElement | null>(null); // attach to the outer <Box>
    const MIN_ACTION_HEIGHT = 200;
    const measureAndApply = (el: HTMLElement) => {
        const h = el.getBoundingClientRect().height;
        OBR.action.setHeight(Math.max(h, MIN_ACTION_HEIGHT));
    };

    const kickMeasure = (el: HTMLElement) => {
        // let layout settle (fonts/CSS/collapse) then measure once
        requestAnimationFrame(() => requestAnimationFrame(() => measureAndApply(el)));
    };

    const active = useMemo(() => rows.find((r) => r.active) ?? null, [rows]);
    const prevActiveId = useRef<string | null>(null);
    const rafIdRef = useRef<number | null>(null);

    const sortedRows = useMemo(() => sortByInitiativeDesc(rows), [rows]);
    const initiativeItemIds = useMemo(
        () => new Set(sortedRows.map(r => r.id)),
        [sortedRows]
    );
    // Column visibility (NEW)
    const showAC = settings.showArmor;
    const showHP = settings.showHP;
    const showDMR = settings.dmRingToggle;

    const gmColCount =
        3 +                       // chevron, INIT, NAME
        (showAC ? 1 : 0) +
        (showHP ? 2 : 0) +
        (showDMR ? 1 : 0);
    //Get all tokens
    const cmTokens = useCMTokens();


    const toggleExpanded = (id: string) =>
        setExpandedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    const getActiveIndex = (items: InitiativeItem[]) =>
        items.findIndex((it) => it.active);

    // Role
    useEffect(() => {
        const onPlayer = (p: Player) => setRole(p.role);
        OBR.player.getRole().then(setRole);
        return OBR.player.onChange(onPlayer);
    }, []);

    // Load saved scene state on mount, then keep in sync with remote updates
    useEffect(() => {
        let unmounted = false;

        const apply = (s: SceneState | null) => {
            if (!s) return;
            setStarted((prev) => (prev !== s.started ? s.started : prev));
            setRound((prev) => (prev !== s.round ? s.round : prev));
            setSettings((prev) => {
                const merged = { ...prev, ...(s.settings ?? {}) };
                return merged;
            });
        };

        readSceneState()
            .then((s) => {
                if (!unmounted) apply(s);
            })
            .catch(console.error);

        const unsub = onSceneStateChange(apply);
        return () => {
            unmounted = true;
            unsub();
        };
    }, []);

    // Attach a ResizeObserver to the root ONCE
    useEffect(() => {
        const el = rootRef.current;
        if (!el || typeof ResizeObserver === "undefined") return;

        const measure = (entry: ResizeObserverEntry) => {
            // Prefer border-box if available
            const bbs: any = (entry as any).borderBoxSize;
            let h: number;

            if (bbs && (bbs.blockSize || (Array.isArray(bbs) && bbs[0]?.blockSize))) {
                const box = Array.isArray(bbs) ? bbs[0] : bbs;
                h = box.blockSize as number;
            } else {
                // Fallback that works everywhere (includes borders)
                h = (entry.target as HTMLElement).getBoundingClientRect().height;
            }

            // Round up and add 1 to avoid rare 1px gutter from fractional layout
            const next = Math.max(h, MIN_ACTION_HEIGHT);
            OBR.action.setHeight(next);
        };

        const ro = new ResizeObserver((entries) => {
            if (entries[0]) measure(entries[0]);
        });

        // Try to observe border-box when supported (ignored otherwise)
        ro.observe(el, { box: "border-box" });

        // Do an initial measure (some browsers don’t fire RO immediately on mount)
        requestAnimationFrame(() => {
            const rect = el.getBoundingClientRect();
            OBR.action.setHeight(Math.max(rect.height, MIN_ACTION_HEIGHT));
        });

        return () => {
            ro.disconnect();
            // Optional: set a sensible default when unmounted
            OBR.action.setHeight(MIN_ACTION_HEIGHT); // or whatever your collapsed height is
        };
    }, []);

    useEffect(() => {
        if (view === "tracker" && rootRef.current) {
            kickMeasure(rootRef.current);
        }
    }, [view]);

    // Scene → UI sync
    useEffect(() => {
        const handle = async (items: Item[]) => {
            if (localEditRef.current) return;

            const list: InitiativeItem[] = [];
            for (const it of items) {
                if (!isImage(it)) continue;
                const row = initiativeFromItem(it);
                if (row) list.push(row);
            }
            const sorted = sortByInitiativeDesc(list);
            setRows(sorted);
            prevRowsRef.current = sorted;
            localEditRef.current = false;
        };

        OBR.scene.items.getItems().then(handle);
        return OBR.scene.items.onChange(handle);
    }, []);

    // Context menu
    useEffect(() => registerInitiativeContextMenu(), []);

    // Centralized metadata writer (diff local edits) + resort on initiative change
    useEffect(() => {
        if (!localEditRef.current) {
            prevRowsRef.current = rows;
            return;
        }

        (async () => {
            const prev = prevRowsRef.current;
            const prevById = new Map(prev.map((r) => [r.id, r]));

            const patches: { id: string; patch: Partial<MetaShape> }[] = [];
            let initiativeChanged = false;

            for (const now of rows) {
                const before = prevById.get(now.id);
                if (!before) continue;

                const patch = metaPatchFromRowDiff(before, now);
                if ("initiative" in patch) initiativeChanged = true;
                if (Object.keys(patch).length) patches.push({ id: now.id, patch });
            }

            if (patches.length) {
                await batchUpdateMeta(OBR, patches);
            }

            if (initiativeChanged) {
                setRows((s) => sortByInitiativeDesc(s));
            }

            localEditRef.current = false;
            prevRowsRef.current = rows;
        })().catch(console.error);
    }, [rows]);


    // Auto-manage rings when the active row (or started state) changes, including remote updates
    useEffect(() => {
        if (!settings.showRangeRings) {
            // If disabled, always clear rings
            clearRings("normal").catch(console.error);
            return;
        }
        // cancel any scheduled work from a previous run
        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }

        // sync path only; no async/await here
        if (!started || !active) {
            // end combat or no active → wipe any rings
            clearRings("normal").catch(console.error);
            prevActiveId.current = null;
            return;
        }

        // NEW: only show rings for Player Characters
        if (!active.playerCharacter) {
            clearRings("normal").catch(console.error);
            prevActiveId.current = null;
            return;
        }

        // if the active token changed, remove old rings first
        if (prevActiveId.current && prevActiveId.current !== active.id) {
            clearRings("normal").catch(console.error);
        }

        // schedule the async ensure call without making the effect async
        rafIdRef.current = requestAnimationFrame(() => {
            ensureRings({
                tokenId: active.id,
                movement: active.movement ?? 0,
                attackRange: active.attackRange ?? 0,
                moveAttached: false,
                rangeAttached: true,
                movementColor: active.movementColor ?? null,
                rangeColor: active.rangeColor ?? null,
                movementWeight: active.movementWeight ?? 10,
                rangeWeight: active.rangeWeight ?? 10,
                movementPattern: active.movementPattern ?? "dash",
                rangePattern: active.rangePattern ?? "dash",
                movementOpacity: active.movementOpacity ?? 1,
                rangeOpacity: active.rangeOpacity ?? 1,
            }).catch(console.error);

            prevActiveId.current = active.id;
            rafIdRef.current = null;
        });

        // cleanup stays synchronous
        return () => {
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
        };
    }, [
        started, active?.id, active?.movement,
        active?.attackRange, active?.playerCharacter, settings.showRangeRings,
        active?.movementColor, active?.rangeColor, active?.movementWeight,
        active?.rangeWeight, active?.movementPattern, active?.rangePattern,
        active?.movementOpacity, active?.rangeOpacity,]);

    // Turn controls
    const handleStart = async () => {
        const sorted = sortByInitiativeDesc(rows);
        if (!sorted.length) return;

        setRows(sorted.map((r, i) => ({ ...r, active: i === 0 })));
        await OBR.scene.items.updateItems(sorted.map((r) => r.id), (items) => {
            for (let i = 0; i < items.length; i++) {
                const meta = (items[i].metadata as any)[META_KEY];
                if (meta) meta.active = i === 0;
            }
        });
        setRound(1);
        setStarted(true);

        // persist to scene
        await saveSceneState({ started: true, round: 1 });
    };

    const handleEnd = async () => {
        const ids = rows.map((r) => r.id);
        setRows((prev) => prev.map((r) => ({ ...r, active: false })));
        await OBR.scene.items.updateItems(ids, (items) => {
            for (const it of items) {
                const meta = (it.metadata as any)[META_KEY];
                if (meta) meta.active = false;
            }
        });
        // setOnlyExpanded(null);
        setRound(0);
        setStarted(false);
        await clearRings("normal");

        // persist to scene
        await saveSceneState({ started: false, round: 0 });
    };

    const handleNext = async () => {
        if (!started || rows.length === 0) return;
        const sorted = sortByInitiativeDesc(rows);
        const activeIdx = getActiveIndex(sorted);
        const nextIdx = activeIdx === -1 ? 0 : (activeIdx + 1) % sorted.length;
        const wrapped = activeIdx !== -1 && nextIdx === 0;
        const nextRound = wrapped ? round + 1 : round;

        setRows(sorted.map((r, i) => ({ ...r, active: i === nextIdx })));
        await OBR.scene.items.updateItems(sorted.map((r) => r.id), (items) => {
            for (let i = 0; i < items.length; i++) {
                const meta = (items[i].metadata as any)[META_KEY];
                if (meta) meta.active = i === nextIdx;
            }
        });
        if (wrapped) {
            setRound(nextRound);
            // persist only when we wrapped
            await saveSceneState({ started: true, round: nextRound });
        }

    };

    const handlePrev = async () => {
        if (!started || rows.length === 0) return;
        const sorted = sortByInitiativeDesc(rows);
        const activeIdx = getActiveIndex(sorted);
        const prevIdx = activeIdx === -1 ? sorted.length - 1 : (activeIdx - 1 + sorted.length) % sorted.length;
        const wrappedBack = activeIdx === 0;
        const nextRound = wrappedBack ? Math.max(1, round - 1) : round;

        setRows(sorted.map((r, i) => ({ ...r, active: i === prevIdx })));
        await OBR.scene.items.updateItems(sorted.map((r) => r.id), (items) => {
            for (let i = 0; i < items.length; i++) {
                const meta = (items[i].metadata as any)[META_KEY];
                if (meta) meta.active = i === prevIdx;
            }
        });
        if (wrappedBack) {
            setRound(nextRound);
            // persist only when we wrapped back to bottom
            await saveSceneState({ started: true, round: nextRound });
        }

    };

    const removeFromInitiative = async (id: string) => {
        try {
            // Remove initiative metadata from the item (which removes it from your board)
            await OBR.scene.items.updateItems([id], (items) => {
                for (const it of items) {
                    if ((it.metadata as any)[META_KEY]) {
                        delete (it.metadata as any)[META_KEY];
                    }
                }
            });

            // Update local UI state
            setRows((prev) => prev.filter((r) => r.id !== id));
            setExpandedIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        } catch (e) {
            console.error("Failed to remove from initiative:", e);
        }
    };

    const handleAddAll = async (addHidden: boolean = true) => {
        // rows = current initiative rows; skip anything already added
        const existingIds = new Set(rows.map((r) => r.id));
        const idsToAdd = cmTokens
            .filter((t) => !existingIds.has(t.id) && (addHidden || t.visible !== false))
            .map((t) => t.id);

        if (idsToAdd.length === 0) return;

        await OBR.scene.items.updateItems(idsToAdd, (items) => {
            for (const it of items) {
                // don’t overwrite if a valid block already exists
                const current = (it.metadata as any)[META_KEY];
                if (!isMetadata(current)) {
                    (it.metadata as any)[META_KEY] = {
                        ...createMetaForItem(it),
                        inInitiative: true,
                    };
                    continue;
                }

                // If it was removed previously, revive without nuking fields
                current.inInitiative = true;
                // (Optionally update name from live label/name)
                const displayName =
                    (isImage(it) && (it as any).text?.plainText) || (it as any).name || current.name || "Unnamed";
                current.name = displayName;
            }
        });

        // Your existing Scene→UI sync effect will pick up the change and populate rows
    };


    return (
        <Box
            ref={rootRef}
            sx={{ display: "flex", flexDirection: "column", height: "100%", minWidth: 0, minHeight: 200 }}
        >
            <Box
                sx={{
                    display: view === "tracker" ? "flex" : "none",
                    flex: 1,
                    minHeight: 200,
                    flexDirection: "column",
                }}
            >
                {role === "GM" ? (
                    <TableContainer
                        component={Paper}
                        sx={{
                            flex: 1,
                            minHeight: 166,
                            borderRadius: 0,
                            overflow: "auto",
                            display: "flex",
                            flexDirection: "column",
                        }}
                    >
                        <Box>
                            <Table
                                stickyHeader
                                size="small"
                                aria-label="initiative table"
                                sx={{
                                    tableLayout: "fixed",
                                    width: "100%",
                                    "& td, & th": { py: 0.25, px: 0.25 },
                                    "& thead th": { fontSize: "0.72rem", letterSpacing: 0.4, py: 0.9, height: 28 },
                                }}
                            >
                                <TableHead>
                                    <TableRow>
                                        <TableCell width={18}></TableCell>
                                        <TableCell width={40} align="center">INIT</TableCell>
                                        <TableCell align="center">NAME</TableCell>
                                        {showAC && <TableCell width={36} align="center">AC</TableCell>}
                                        {showHP && <TableCell width={62} align="center">HP</TableCell>}
                                        {showHP && <TableCell width={36} align="center">TP</TableCell>}
                                        {showDMR && <TableCell width={24}></TableCell>}
                                    </TableRow>
                                </TableHead>

                                <TableBody>
                                    {sortedRows.map((it) => (
                                        <InitiativeRow
                                            key={it.id}
                                            row={it}
                                            expanded={expandedIds.has(it.id)}
                                            onToggleExpand={() => {
                                                toggleExpanded(it.id);
                                            }}
                                            onChange={(draft) => {
                                                localEditRef.current = true;
                                                setRows((prev) => prev.map((r) => (r.id === it.id ? { ...r, ...draft } : r)));
                                            }}
                                            // onSizeChange={resizeNow}
                                            onRemove={removeFromInitiative}
                                            settings={{
                                                showMovementRange: settings.showMovementRange,
                                                showAttackRange: settings.showAttackRange,
                                                showConditions: settings.showConditions,
                                                showDistances: settings.showDistances,
                                                showAC,
                                                showHP,
                                                showDMR,
                                            }}
                                            started={started}
                                            tokens={cmTokens.filter((token) => initiativeItemIds.has(token.id))}
                                            colSpan={gmColCount}
                                        />
                                    ))}
                                </TableBody>
                            </Table>

                            {sortedRows.length === 0 ? (
                                // Empty-state fills the table's row area
                                <Box
                                    sx={{
                                        flex: 1,
                                        minHeight: 0,
                                        height: "100%",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        px: 2,
                                        textAlign: "center",
                                    }}
                                >
                                    <Box>
                                        <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
                                            No creatures in initiative yet. Add a character to the Battle Board to get started.
                                        </Typography>

                                        <Stack direction="row" spacing={1} justifyContent="center">
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                onClick={() => handleAddAll(true)}
                                                sx={{ borderRadius: 1 }}
                                            >
                                                Add All in Scene
                                            </Button>

                                            <Button
                                                size="small"
                                                variant="outlined"
                                                onClick={() => handleAddAll(false)}
                                                sx={{ borderRadius: 1 }}
                                            >
                                                Add Visible Only
                                            </Button>
                                        </Stack>
                                    </Box>
                                </Box>
                            ) : (
                                // Spacer ensures the footer is pinned to the bottom even with few rows
                                <Box sx={{ flex: 1, minHeight: 0 }} />
                            )}
                        </Box>
                        <Box sx={{ px: 1, py: 0.75, bgcolor: "background.default" }}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                                <Stack direction="row" alignItems="center" spacing={1.25}>
                                    {started ? (
                                        <Button disabled={sortedRows.length === 0} size="small" variant="contained" color="error" startIcon={<StopRounded />} onClick={handleEnd} sx={{ minWidth: 96 }}>
                                            End
                                        </Button>
                                    ) : (
                                        <Button disabled={sortedRows.length === 0} size="small" variant="contained" startIcon={<PlayArrowRounded />} onClick={handleStart} sx={{ minWidth: 96 }}>
                                            Start
                                        </Button>
                                    )}

                                    <IconButton
                                        size="small"
                                        onClick={handlePrev}
                                        disabled={!started || sortedRows.length === 0 || (round === 1 && getActiveIndex(sortedRows) === 0)}
                                    >
                                        <NavigateBeforeRounded />
                                    </IconButton>

                                    <Typography variant="body2" sx={{ minWidth: 72, textAlign: "center", fontWeight: 700 }}>
                                        Round: {round}
                                    </Typography>

                                    <IconButton size="small" onClick={handleNext} disabled={!started || sortedRows.length === 0}>
                                        <NavigateNextRounded />
                                    </IconButton>
                                </Stack>

                                <Stack direction="row" alignItems="center" spacing={0.5}>
                                    <Tooltip title="Settings">
                                        <IconButton size="small" onClick={() => setView("settings")}>
                                            <SettingsRounded fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Patreon">
                                        <IconButton
                                            size="small"
                                            component="a"
                                            href="https://www.patreon.com/MissingLinkDev"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <Box
                                                component="img"
                                                src="/patreon-icon.png"
                                                alt="Patreon"
                                                sx={{ width: 20, height: 20 }}
                                            />
                                        </IconButton>
                                    </Tooltip>
                                </Stack>
                            </Stack>
                        </Box>
                    </TableContainer>
                ) : (
                    settings.disablePlayerList ? (
                        <Box sx={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            p: 2,
                            textAlign: "center",
                            color: "text.secondary"
                        }}>
                            <Typography variant="body2">The DM has disabled the player initiative list.</Typography>
                        </Box>
                    ) : !started ? (
                        <Box sx={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            p: 2,
                            textAlign: "center",
                            color: "text.secondary"
                        }}>
                            <Typography variant="body2">Initiative has not started yet.</Typography>
                        </Box>
                    ) :
                        (
                            <PlayerTable
                                items={sortedRows.filter((r) => r.visible !== false)}
                                settings={settings}
                                tokens={cmTokens}
                            />
                        )
                )}
            </Box>
            {/* Settings view (also mounted only when needed, but doesn't force unmount of tracker) */}
            {role === "GM" && (
                <Box
                    sx={{
                        display: view === "settings" ? "block" : "none",
                        flex: 1,
                        minHeight: 0,
                    }}
                >
                    <SettingsView
                        value={settings}
                        onChange={async (next) => {
                            setSettings(next);
                            await saveSceneState({ settings: next });
                        }}
                        onBack={() => setView("tracker")}
                        rows={sortedRows}
                    />
                </Box>
            )}
        </Box>
    );
}
