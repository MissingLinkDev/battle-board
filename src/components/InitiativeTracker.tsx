import { useState, useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import PlayerTable from "./PlayerTable";
import SettingsView from "./SettingsView";
import GmTable from "./GMTable";
import { useRole } from "../hooks/useRole";
import { useResizeToOBR } from "../hooks/useResizeToOBR";
import { useInitiativeState } from "../hooks/useInitiativeState";
import { useHealthLogic } from "../hooks/useHealthLogic";
import { useTurns } from "../actions/useTurns";
import { removeFromInitiative as removeAction } from "../actions/removeFromInitiative";
import { useAddAll } from "../actions/useAddAll";
import { registerInitiativeContextMenu } from "./initiativeMenu";
import { useGlobalRingCleanup } from "../hooks/useRingsManager";

export function InitiativeTracker() {
    const role = useRole();
    const { rootRef, kickMeasure } = useResizeToOBR();
    const [view, setView] = useState<"tracker" | "settings">("tracker");
    const [ready, setReady] = useState(false);

    // Centralized state management
    const {
        rows,
        setRows,
        started,
        setStarted,
        round,
        setRound,
        settings,
        setSettings,
        saveSceneState,
        groups,
        sortedRows,
        visibleRows,
        initiativeTokens,
        updateRow,
        cmTokens,
        expandedIds,
        toggleExpanded,
    } = useInitiativeState();

    useGlobalRingCleanup(started, ready);
    const { showHealthColumn } = useHealthLogic(settings);

    // Readiness management
    const rafsRef = useRef<number[]>([]);
    useEffect(() => {
        const a = requestAnimationFrame(() => {
            const b = requestAnimationFrame(() => setReady(true));
            rafsRef.current.push(b);
        });
        rafsRef.current.push(a);
        return () => {
            rafsRef.current.forEach((id) => cancelAnimationFrame(id));
            rafsRef.current = [];
        };
    }, []);

    // Turn management - now includes groups
    const { handleStart, handleEnd, handleNext, handlePrev } = useTurns(
        setRows, round, setRound, started, setStarted, saveSceneState
    );

    // Token management
    const handleAddAll = useAddAll(rows, cmTokens);

    const removeFromInitiative = async (id: string) => {
        try {
            await removeAction(id);
            setRows((prev) => prev.filter((r) => r.id !== id));
        } catch (e) {
            console.error("Failed to remove from initiative:", e);
        }
    };

    // Initialize context menu
    useEffect(() => registerInitiativeContextMenu(), []);

    return (
        <Box
            ref={rootRef}
            sx={{ display: "flex", flexDirection: "column", height: "100%", minWidth: 0, minHeight: 200 }}
        >
            {/* Tracker View */}
            <Box
                sx={{
                    display: view === "tracker" ? "flex" : "none",
                    flex: 1,
                    minHeight: 200,
                    flexDirection: "column",
                }}
            >
                {role === "GM" ? (
                    <Box sx={{ width: '100%', bgcolor: 'background.paper' }}>
                        <GmTable
                            items={sortedRows}
                            expandedIds={expandedIds}
                            onToggleExpand={(id) => {
                                toggleExpanded(id);
                                kickMeasure();
                            }}
                            onRowChange={updateRow}
                            onRowRemove={removeFromInitiative}
                            settings={settings}
                            globalSettings={settings}
                            started={started}
                            round={round}
                            onStart={handleStart}
                            onEnd={handleEnd}
                            onNext={handleNext}
                            onPrev={handlePrev}
                            tokens={initiativeTokens}
                            onAddAll={handleAddAll}
                            onOpenSettings={() => {
                                setView("settings");
                                kickMeasure();
                            }}
                            groups={groups}
                            onRequestResize={kickMeasure}
                            ready={ready}
                        />
                    </Box>
                ) : (
                    // Player view logic
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
                            <Typography variant="body2">
                                The DM has disabled the player initiative list.
                            </Typography>
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
                            <Typography variant="body2">
                                Initiative has not started yet.
                            </Typography>
                        </Box>
                    ) : (
                        <PlayerTable
                            items={visibleRows}
                            settings={settings}
                            tokens={initiativeTokens}
                            showHealthColumn={showHealthColumn}
                        />
                    )
                )}
            </Box>

            {/* Settings View */}
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
                        onChange={setSettings}
                        onBack={() => setView("tracker")}
                        rows={sortedRows}
                        ready={ready}
                    />
                </Box>
            )}
        </Box>
    );
}