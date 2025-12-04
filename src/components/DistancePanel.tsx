import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import type { DistanceInfo } from "../hooks/useDistances";

type Props = {
    distances: DistanceInfo[];
    title?: string;
};

/**
 * Reusable distance display panel
 */
export function DistancePanel({ distances, title = "Distances" }: Props) {
    return (
        <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" justifyContent="center" sx={{ px: 1, py: 0.5 }}>
                <Typography sx={{ fontWeight: 700, fontSize: "0.95rem", textAlign: "center", mb: 0.75 }}>
                    {title}
                </Typography>
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
                                {d.text}
                            </Typography>
                        </ListItem>
                    ))
                )}
            </List>
        </Box>
    );
}