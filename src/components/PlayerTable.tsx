import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import type { InitiativeItem } from "./InitiativeItem";
import PlayerRow from "./PlayerRow";
import type { CMToken } from "./tokens";
import type { InitiativeSettings } from "./SceneState";

type PlayerTableProps = {
    items: InitiativeItem[];
    settings: InitiativeSettings;   // pass the whole settings object
    tokens: CMToken[];
};

export default function PlayerTable({ items, settings, tokens }: PlayerTableProps) {
    const healthMasterOn = !!settings.displayHealthStatusToPlayer;
    // Show column if master is on and at least one mode isn't "none"
    const healthAnyMode =
        (settings.pcHealthMode ?? "numbers") !== "none" ||
        (settings.npcHealthMode ?? "status") !== "none";

    const showHealthCol = healthMasterOn && healthAnyMode;

    const colCount = 4 + (showHealthCol ? 1 : 0);
    const initiativeIds = items.map((item) => item.id);

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
                        {showHealthCol && <TableCell width={62} align="center">HEALTH</TableCell>}
                    </TableRow>
                </TableHead>

                <TableBody>
                    {items
                        .map((item) => (
                            <PlayerRow
                                key={item.id}
                                row={item}
                                settings={settings} // pass all settings down
                                tokens={tokens.filter((token) => initiativeIds.includes(token.id))}
                                colSpan={colCount}
                                showHealthColumn={showHealthCol} // optional convenience for layout
                            />
                        ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
}
