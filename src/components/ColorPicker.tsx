// src/ColorPicker.tsx
import { useState } from "react";
import Box from "@mui/material/Box";
import Popover from "@mui/material/Popover";

const PALETTE = [
    "#2F80ED", "#F2994A", "#F2C94C", "#A66E2C",
    "#BB6BD9", "#6FCF97", "#219653", "#EB5757",
    "#2D9CDB", "#000000", "#4F4F4F", "#828282",
    "#BDBDBD", "#E0E0E0", "#FFFFFF", "#27AE60",
];

export default function ColorPicker({
    value, onChange, size = 16,
}: { value: string | null | undefined; onChange: (hex: string | null) => void; size?: number }) {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    return (
        <>
            <Box
                role="button"
                onClick={(e) => setAnchor(e.currentTarget)}
                sx={{
                    width: size, height: size, borderRadius: "50%",
                    border: "2px solid rgba(0,0,0,0.25)",
                    bgcolor: value ?? "#2F80ED",
                    cursor: "pointer",
                    boxShadow: 1,
                }}
            />
            <Popover
                open={!!anchor}
                anchorEl={anchor}
                onClose={() => setAnchor(null)}
                anchorOrigin={{ vertical: "top", horizontal: "left" }}
                transformOrigin={{ vertical: "bottom", horizontal: "left" }}
                PaperProps={{ sx: { borderRadius: 2, p: 1 } }}
            >
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 24px)", gap: 1 }}>
                    {/* “Default” dot (uses null to fall back to rings.ts constants) */}
                    <Box
                        onClick={() => { onChange(null); setAnchor(null); }}
                        sx={{ width: 20, height: 20, borderRadius: "50%", bgcolor: "#28a745", boxShadow: 1, cursor: "pointer" }}
                        title="Use default"
                    />
                    {PALETTE.map((hex) => (
                        <Box
                            key={hex}
                            onClick={() => { onChange(hex); setAnchor(null); }}
                            sx={{
                                width: 20, height: 20, borderRadius: "50%", bgcolor: hex, cursor: "pointer",
                                border: hex === "#FFFFFF" ? "1px solid #BDBDBD" : "none", boxShadow: 1,
                            }}
                            title={hex}
                        />
                    ))}
                </Box>
            </Popover>
        </>
    );
}
