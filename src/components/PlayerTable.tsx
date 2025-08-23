import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import type { InitiativeItem } from "./InitiativeItem";
import PlayerRow from "./PlayerRow";

export default function PlayerTable({ items }: { items: InitiativeItem[] }) {
    return (
        <TableContainer
            component={Paper}
            sx={{
                flex: 1,
                minHeight: 0,
                borderRadius: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
            }}
        >
            <Table
                stickyHeader
                size="small"
                aria-label="initiative table"
                sx={{
                    borderCollapse: "collapse",
                    tableLayout: "fixed",
                    width: "100%",
                    "& td, & th": { borderBottom: "1px solid", borderColor: "divider" },
                    "& thead th": {
                        fontSize: "0.72rem",
                        letterSpacing: 0.4,
                        py: 0.9,          // taller header
                        height: 28,
                    },
                    "& .MuiTableRow-root": { borderSpacing: 0 }
                }}
            >
                <TableHead>
                    <TableRow>
                        <TableCell width={20} />
                        <TableCell width={36}>INIT</TableCell>
                        <TableCell>NAME</TableCell>
                    </TableRow>
                </TableHead>

                <TableBody>
                    {items.map((item) => <PlayerRow key={item.id} row={item} />)}
                </TableBody>
            </Table>
        </TableContainer>
    );
}
