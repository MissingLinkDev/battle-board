import React from "react";
import TextField, { type TextFieldProps } from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";

type NumberFieldProps = Omit<TextFieldProps, "value" | "onChange" | "type"> & {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
};

export function NumberField({
    value,
    onChange,
    min = Number.MIN_SAFE_INTEGER,
    max = Number.MAX_SAFE_INTEGER,
    step = 1,
    unit,
    ...textFieldProps
}: NumberFieldProps) {
    const [inputValue, setInputValue] = React.useState(value.toString());
    const isEditingRef = React.useRef(false);

    React.useEffect(() => {
        // Always sync when not editing (handles initial render AND external updates)
        if (!isEditingRef.current) {
            setInputValue(value.toString());
        }
    }, [value]);

    const handleIncrement = () => {
        const newValue = Math.min(max, value + step);
        setInputValue(newValue.toString());
        onChange(newValue);
    };

    const handleDecrement = () => {
        const newValue = Math.max(min, value - step);
        setInputValue(newValue.toString());
        onChange(newValue);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;

        // Mark as editing when user types
        isEditingRef.current = true;

        // Allow empty string or valid number pattern (but don't commit yet)
        if (val === "" || val === "-" || /^-?\d*\.?\d*$/.test(val)) {
            setInputValue(val);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            const numValue = parseFloat(inputValue);
            if (!isNaN(numValue)) {
                const clampedValue = Math.max(min, Math.min(max, numValue));
                // Only call onChange if the value actually changed
                if (clampedValue !== value) {
                    onChange(clampedValue);
                }
                setInputValue(clampedValue.toString());
            } else {
                // Invalid input, revert to current value
                setInputValue(value.toString());
            }

            // CRITICAL: Clear editing flag to allow external updates
            isEditingRef.current = false;

            // Pass through to parent's onKeyDown if it exists
            if (textFieldProps.onKeyDown) {
                textFieldProps.onKeyDown(e as any);
            }
        }
    };

    return (
        <TextField
            {...textFieldProps}
            type="text"
            value={inputValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            slotProps={{
                input: {
                    startAdornment: (
                        <InputAdornment position="start">
                            <IconButton
                                size="small"
                                onClick={handleDecrement}
                                disabled={value <= min}
                                edge="start"
                            >
                                <RemoveIcon fontSize="small" />
                            </IconButton>
                        </InputAdornment>
                    ),
                    endAdornment: (
                        <InputAdornment position="end">
                            {unit && (
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ mr: 1 }}
                                >
                                    {unit}
                                </Typography>
                            )}
                            <IconButton
                                size="small"
                                onClick={handleIncrement}
                                disabled={value >= max}
                                edge="end"
                            >
                                <AddIcon fontSize="small" />
                            </IconButton>
                        </InputAdornment>
                    ),
                },
                htmlInput: {
                    style: { textAlign: "center" },
                },
            }}
            sx={{
                "& input[type=text]": {
                    MozAppearance: "textfield",
                },
                ...textFieldProps.sx,
            }}
        />
    );
}
