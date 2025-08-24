// src/ColorPicker.tsx
import { useState } from "react";
import Box from "@mui/material/Box";
import Popover from "@mui/material/Popover";
import Divider from "@mui/material/Divider";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Slider from "@mui/material/Slider";

const PALETTE = [
    "#166cfd", "#f97639", "#fe4c50", "#ffd430",
    "#b76d25", "#884efd", "#85fe69", "#519e00",
    "#ea8bfa", "#43e1ee", "#0e0e17", "#222222",
    "#5a5a5a", "#b3b3b3", "#ffffff", "#943380",
];

// 8 width selections
const LINE_WEIGHTS = [2, 4, 8, 12, 16, 20, 24, 28] as const;

type Pattern = "solid" | "dash";


export default function ColorPicker({
    value,
    onChange,
    size = 24,

    // style controls
    weight,
    onChangeWeight,
    pattern,
    onChangePattern,
    opacity,
    onChangeOpacity,
}: {
    value: string | null | undefined;
    onChange: (hex: string | null) => void;
    size?: number;

    weight: number | string | undefined;
    onChangeWeight: (w: number) => void;

    pattern: Pattern;
    onChangePattern: (p: Pattern) => void;

    opacity: number;                     // 0..1
    onChangeOpacity: (o: number) => void; // called on release
}) {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    const effectiveWeight =
        typeof weight === "string" ? parseFloat(weight) :
            typeof weight === "number" ? weight : 12;
    const currentColor = (value ?? "#166cfd").toLowerCase();
    const isWhite = currentColor === "#ffffff";

    // local while dragging the slider (only commit on release)
    const [tempOpacity, setTempOpacity] = useState(opacity);

    // clip-paths (unchanged from your grid)
    const clipFull =
        "path('M 12 0 A 12 12 0 0 1 12 24 A 12 12 0 0 1 12 0 M 12 12 A 0 0 0 0 0 12 12 A 0 0 0 0 0 12 12')";
    const clipHollow =
        "path('M 12 0 A 12 12 1 1 1 12 24 A 12 12 1 1 1 12 0 M 12 3 A 9 9 0 0 0 12 21 A 9 9 0 0 0 12 3')";

    return (
        <>
            {/* Trigger: 24×24 filled circle */}
            <Box
                component="button"
                type="button"
                onClick={(e) => setAnchor(e.currentTarget as HTMLElement)}
                aria-label="Choose color"
                title={currentColor}
                sx={{
                    width: size,
                    height: size,
                    borderRadius: "50%",
                    bgcolor: currentColor,
                    border: isWhite ? "1px solid #BDBDBD" : "2px solid rgba(0,0,0,.25)",
                    boxShadow: 1,
                    cursor: "pointer",
                    p: "8px",
                    m: 0,
                    display: "inline-block",
                    outline: 0,
                    WebkitTapHighlightColor: "transparent",
                }}
            />

            <Popover
                open={!!anchor}
                anchorEl={anchor}
                onClose={() => setAnchor(null)}
                anchorOrigin={{ vertical: "top", horizontal: "left" }}
                transformOrigin={{ vertical: "bottom", horizontal: "left" }}
                slotProps={{
                    paper: {
                        sx: {
                            borderRadius: 2,
                            p: 0,
                            overflow: "visible",
                            maxHeight: "unset",
                        }
                    }
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", p: 2, gap: 1 }}>
                    {/* LEFT: line weight grid + pattern toggle */}
                    <Box sx={{ width: 176, display: "flex", flexDirection: "column", gap: 1, justifyContent: "center", p: "4px 8px", }}>
                        {/* 8 weight options in a 4×2 grid */}
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: "repeat(4, 36px)",
                                gridAutoRows: "36px",
                                gap: 0.5,
                                justifyContent: "center",
                            }}
                        >
                            {LINE_WEIGHTS.map((w) => {

                                const selected = w === effectiveWeight;
                                // size of center dot relative to max weight, clamped and forced to even px
                                const maxW = LINE_WEIGHTS[LINE_WEIGHTS.length - 1];
                                const raw = Math.round((w / maxW) * 18);
                                const dot = Math.max(4, raw - (raw % 2)); // even sizes: 4,6,8,...

                                return (
                                    <Box
                                        key={w}
                                        component="button"
                                        type="button"
                                        onClick={() => onChangeWeight(w)}
                                        title={`Weight ${w}`}
                                        sx={{
                                            width: 32,
                                            height: 32,
                                            p: 0,
                                            boxSizing: "border-box",
                                            borderRadius: "50%",
                                            cursor: "pointer",
                                            position: "relative",
                                            border: "2px solid rgba(255,255,255,.12)",
                                            background: "transparent",
                                            outline: 0,
                                            transition: "transform .12s ease",
                                            "&:hover": { transform: "scale(1.05)" },
                                        }}
                                    >
                                        {/* absolute-centered dot so borders/padding never shift it */}
                                        <Box
                                            sx={{
                                                position: "absolute",
                                                top: "50%",
                                                left: "50%",
                                                transform: "translate(-50%, -50%)",
                                                width: dot,
                                                height: dot,
                                                borderRadius: "50%",
                                                bgcolor: "text.primary",
                                                opacity: 0.9,
                                            }}
                                        />

                                        {selected && (
                                            <Box
                                                sx={(theme) => ({
                                                    position: "absolute",
                                                    inset: 0,
                                                    borderRadius: "50%",
                                                    // draw a clear ring:
                                                    border: `2px solid ${theme.palette.primary.main}`,
                                                    boxSizing: "border-box",
                                                    // keep it above the dot and ignore clicks
                                                    zIndex: 1,
                                                    pointerEvents: "none",
                                                })}
                                            />
                                        )}
                                    </Box>
                                );
                            })}
                        </Box>

                        {/* Solid / Dashed toggle */}
                        <ToggleButtonGroup
                            value={pattern}
                            exclusive
                            onChange={(_, val) => val && onChangePattern(val)}
                            size="small"
                            fullWidth
                            sx={{
                                "& .MuiToggleButtonGroup-grouped": {
                                    flex: 1,
                                    margin: 0,                  // no gap
                                    borderRadius: 0,            // square inner corners
                                    minHeight: 24,              // smaller height
                                    p: 0,
                                    justifyContent: "center",
                                    border: "1px solid",
                                    borderColor: "divider",
                                    "&:not(:first-of-type)": {
                                        borderLeft: "1px solid",  // middle divider line
                                        borderLeftColor: "divider",
                                    },
                                },
                                "& .MuiToggleButtonGroup-grouped:first-of-type": {
                                    borderTopLeftRadius: 999,   // left pill corner
                                    borderBottomLeftRadius: 999,
                                },
                                "& .MuiToggleButtonGroup-grouped:last-of-type": {
                                    borderTopRightRadius: 999,  // right pill corner
                                    borderBottomRightRadius: 999,
                                },
                            }}
                        >
                            <ToggleButton value="solid" aria-label="solid line">
                                <Box
                                    sx={{
                                        width: 24,
                                        height: 4,
                                        borderRadius: 2,
                                        bgcolor: "currentColor", // solid
                                    }}
                                />
                            </ToggleButton>

                            <ToggleButton value="dash" aria-label="dashed line">
                                <Box
                                    sx={{
                                        width: 24,
                                        height: 4,
                                        borderRadius: 2,
                                        backgroundImage:
                                            "repeating-linear-gradient(90deg, currentColor 0 8px, transparent 8px 14px)",
                                        backgroundRepeat: "repeat-x",
                                        backgroundSize: "auto 100%",
                                    }}
                                />
                            </ToggleButton>
                        </ToggleButtonGroup>

                        {/* ---- Opacity slider under grid ---- */}
                        <Box sx={{ px: 2 }}>
                            <Slider
                                min={0}
                                max={1}
                                step={0.01}
                                track={false}
                                size="small"
                                value={tempOpacity}
                                onChange={(_, v) => setTempOpacity(Array.isArray(v) ? v[0] : v)}
                                onChangeCommitted={(_, v) => onChangeOpacity(Array.isArray(v) ? v[0] : v)}
                                sx={{
                                    py: 1,
                                    px: 0,
                                    // use the picked color (fallback to a blue if null)
                                    color: (value ?? "#166cfd"),
                                    height: 24,
                                    borderRadius: 999,
                                    "& .MuiSlider-rail": {
                                        height: 24,
                                        borderRadius: 12,
                                        opacity: 1,
                                        left: -12,         // 👈 extend 12px to the left
                                        right: -12,        // 👈 extend 12px to the right
                                        width: "auto",     // 👈 override MUI’s default width: 100%
                                        background: `linear-gradient(to right,
                                            ${(value ?? "#166cfd")}00 0%,
                                            ${value ?? "#166cfd"} 100%
                                            )`,
                                    },

                                    // white thumb
                                    "& .MuiSlider-thumb": {
                                        width: 24,
                                        height: 24,
                                        bgcolor: "#fff",
                                        boxShadow: 1,
                                        "&:before": { display: "none" },
                                        position: "relative",
                                        zIndex: 1,
                                    },
                                }}
                            />
                        </Box>
                    </Box>

                    <Divider orientation="vertical" flexItem />

                    {/* RIGHT: your original 4×4 grid (exact sizing/markup) + opacity slider */}
                    {/* ---- Color grid (UNCHANGED) ---- */}
                    <Box
                        sx={{
                            p: "4px 8px",
                            display: "grid",
                            gridTemplateColumns: "repeat(4, 40px)",
                            gridAutoRows: "40px",
                            gap: 0,
                        }}
                    >
                        {PALETTE.map((hex) => {
                            const selected = (value ?? "").toLowerCase() === hex.toLowerCase();
                            return (
                                <Box
                                    key={hex}
                                    component="button"
                                    type="button"
                                    title={hex}
                                    // update immediately; DO NOT close popover
                                    onClick={() => { onChange(hex); }}
                                    sx={{
                                        width: 40, height: 40, p: 1,
                                        background: "transparent", border: 0, outline: 0, cursor: "pointer",
                                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                                        WebkitTapHighlightColor: "transparent",
                                        "& ._disk": { transition: "transform 100ms ease" },
                                        "&:hover ._disk": { transform: "scale(1.2)" },
                                    }}
                                >
                                    <Box
                                        className="_disk"
                                        sx={{
                                            width: 24, height: 24, background: hex, borderRadius: "50%",
                                            border: hex.toLowerCase() === "#ffffff" ? "1px solid #BDBDBD" : "none",
                                            clipPath: selected ? clipHollow : clipFull,
                                        }}
                                    />
                                </Box>
                            );
                        })}
                    </Box>
                </Box>
            </Popover >
        </>
    );
}
