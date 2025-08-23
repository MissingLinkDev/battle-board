import CardHeader from "@mui/material/CardHeader";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";

export function InitiativeHeader({
    subtitle
}: {
    subtitle?: string;
}) {
    return (
        <>
            <CardHeader
                title="Initiative"
                slotProps={{
                    title: {
                        sx: {
                            fontSize: "1.125rem",
                            fontWeight: "bold",
                            lineHeight: "32px",
                            color: "text.primary",
                        },
                    }
                }}
            />
            <Divider variant="middle" />
            {subtitle && (
                <Typography
                    variant="caption"
                    sx={{
                        px: 2,
                        py: 1,
                        display: "inline-block",
                        color: "text.secondary",
                    }}
                >
                    {subtitle}
                </Typography>
            )}
        </>
    );
}