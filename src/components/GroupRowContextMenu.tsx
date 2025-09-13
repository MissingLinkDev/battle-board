import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import PauseRounded from "@mui/icons-material/PauseRounded";
import ScatterPlotRounded from "@mui/icons-material/ScatterPlotRounded";

type Props = {
    staged: boolean;
    contextMenu: { mouseX: number; mouseY: number } | null;
    onClose: () => void;
    onToggleStaging: () => void;
    onUngroup: () => void;
};

export function GroupRowContextMenu({
    staged,
    contextMenu,
    onClose,
    onToggleStaging,
    onUngroup,
}: Props) {
    const handleToggleStaging = () => {
        onClose();
        onToggleStaging();
    };

    const handleUngroup = () => {
        onClose();
        onUngroup();
    };

    return (
        <Menu
            open={contextMenu !== null}
            onClose={onClose}
            anchorReference="anchorPosition"
            anchorPosition={
                contextMenu !== null
                    ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
                    : undefined
            }
            slotProps={{
                paper: {
                    sx: {
                        borderRadius: "16px",
                        minWidth: 180,
                        maxWidth: 250,
                        boxShadow: '0px 5px 5px -3px rgba(0,0,0,0.2), 0px 8px 10px 1px rgba(0,0,0,0.14), 0px 3px 14px 2px rgba(0,0,0,0.12)',
                        '& .MuiMenuItem-root': {
                            py: 0.75,
                            px: 1.25,
                            fontSize: '0.875rem',
                            minHeight: 'auto',
                        },
                        '& .MuiListItemIcon-root': {
                            minWidth: 36,
                            '& .MuiSvgIcon-root': {
                                fontSize: '1.25rem',
                            },
                        },
                    },
                },
            }}
        >
            {/* Initiative Staging Toggle */}
            <MenuItem onClick={handleToggleStaging}>
                <ListItemIcon>
                    {staged ? (
                        <PlayArrowRounded />
                    ) : (
                        <PauseRounded />
                    )}
                </ListItemIcon>
                <ListItemText>
                    {staged ? "Activate Group" : "Deactivate Group"}
                </ListItemText>
            </MenuItem>

            {/* Ungroup */}
            <MenuItem onClick={handleUngroup}>
                <ListItemIcon>
                    <ScatterPlotRounded />
                </ListItemIcon>
                <ListItemText>Ungroup</ListItemText>
            </MenuItem>
        </Menu>
    );
}