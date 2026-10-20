import { useMemo } from "react";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import type { Combatant, CombatantPatch } from "../encounter";
import PlayerRow from "./PlayerRow";
import { playerCanEditHP, showPlayerHealthColumn } from "../encounter/health";
import type { CMToken } from "./tokens";
import type { InitiativeSettings } from "./SceneState";

type PlayerTableProps = {
    items: Combatant[];
    settings: InitiativeSettings;
    tokens: CMToken[];
    updateRow?: (id: string, patch: CombatantPatch) => void;
};

export default function PlayerTable({
    items,
    settings,
    tokens,
    updateRow
}: PlayerTableProps) {
    // Columns: base (4) + health + temp HP (when any row is editable). Rows render matching cells.
    const showHealthColumn = showPlayerHealthColumn(settings);
    const showTempColumn = showHealthColumn && items.some((item) => playerCanEditHP(item, settings));
    const colCount = 4 + (showHealthColumn ? 1 : 0) + (showTempColumn ? 1 : 0);

    // Memoize the initiative token IDs to avoid unnecessary recalculations
    const initiativeTokenIds = useMemo(() =>
        new Set(items.map(item => item.id)),
        [items]
    );

    // Filter tokens to only include those in initiative
    const filteredTokens = useMemo(() =>
        tokens.filter(token => initiativeTokenIds.has(token.id)),
        [tokens, initiativeTokenIds]
    );

    return (
        <TableContainer
            component={Paper}
            sx={{
                flex: 1,
                minHeight: 166,
                borderRadius: 0,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
            }}
        >
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
                        <TableCell width={60} align="center"></TableCell>
                        <TableCell align="center">NAME</TableCell>
                        {showHealthColumn && <TableCell width={62} align="center">HEALTH</TableCell>}
                        {showTempColumn && <TableCell width={36} align="center">TEMP</TableCell>}
                    </TableRow>
                </TableHead>

                <TableBody>
                    {items.map((item) => {
                        // Get the current token data for this item
                        const tokenData = tokens.find(token => token.id === item.id);

                        return (
                            <PlayerRow
                                key={item.id}
                                row={item}
                                tokenUrl={tokenData?.id ? undefined : undefined} // Let PlayerRow handle token URL fetching
                                settings={settings}
                                tokens={filteredTokens}
                                items={items}
                                colSpan={colCount}
                                showHealthColumn={showHealthColumn}
                                showTempColumn={showTempColumn}
                                updateRow={updateRow}
                            />
                        );
                    })}
                </TableBody>
            </Table>
        </TableContainer>
    );
}