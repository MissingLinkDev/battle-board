import { useEffect, useRef, useState } from "react";
import TextField, { type TextFieldProps } from "@mui/material/TextField";

type BaseProps = Omit<TextFieldProps, "value" | "onChange"> & {
    onCommit: (v: any) => void;
};

/* -------------------- Text -------------------- */
export function CommitTextField({
    value,
    onCommit,
    slotProps,
    ...rest
}: BaseProps & { value: string }) {
    const [text, setText] = useState(value ?? "");
    const inputRef = useRef<HTMLInputElement | null>(null);
    const composingRef = useRef(false);

    useEffect(() => setText(value ?? ""), [value]);

    const commit = () => {
        if (text !== (value ?? "")) onCommit(text);
    };

    // NOTE: use generic event target (TextField uses <div> wrapper)
    const handleKeyDown: React.KeyboardEventHandler = (e) => {
        if (e.key === "Enter" && !composingRef.current) {
            e.preventDefault();
            inputRef.current?.blur(); // triggers onBlur -> commit
        }
    };
    const handleCompStart: React.CompositionEventHandler = () => {
        composingRef.current = true;
    };
    const handleCompEnd: React.CompositionEventHandler = () => {
        composingRef.current = false;
    };

    return (
        <TextField
            {...rest}
            value={text}
            inputRef={inputRef}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                handleKeyDown(e);
                rest.onKeyDown?.(e);
            }}
            onCompositionStart={(e) => {
                handleCompStart(e);
                rest.onCompositionStart?.(e);
            }}
            onCompositionEnd={(e) => {
                handleCompEnd(e);
                rest.onCompositionEnd?.(e);
            }}
            slotProps={{
                ...slotProps,
                htmlInput: {
                    ...(slotProps?.htmlInput ?? {}),
                },
            }}
        />
    );
}

/* -------------------- Number -------------------- */
export function CommitNumberField({
    value,
    onCommit,
    min,
    max,
    slotProps,
    ...rest
}: BaseProps & { value: number; min?: number; max?: number }) {
    const [text, setText] = useState(String(value ?? 0));
    const inputRef = useRef<HTMLInputElement | null>(null);
    const composingRef = useRef(false);

    useEffect(() => setText(String(value ?? 0)), [value]);

    const parse = (t: string) => {
        const n = Number(t);
        if (!Number.isFinite(n)) return value ?? 0;
        if (min !== undefined && n < min) return min;
        if (max !== undefined && n > max) return max;
        return n;
    };

    const commit = () => {
        const next = parse(text);
        if (next !== value) onCommit(next);
    };

    const handleKeyDown: React.KeyboardEventHandler = (e) => {
        if (e.key === "Enter" && !composingRef.current) {
            e.preventDefault();
            inputRef.current?.blur();
        }
    };
    const handleCompStart: React.CompositionEventHandler = () => {
        composingRef.current = true;
    };
    const handleCompEnd: React.CompositionEventHandler = () => {
        composingRef.current = false;
    };

    return (
        <TextField
            {...rest}
            type="text"         // avoid native steppers
            inputMode="numeric"
            value={text}
            inputRef={inputRef}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                handleKeyDown(e);
                rest.onKeyDown?.(e);
            }}
            onCompositionStart={(e) => {
                handleCompStart(e);
                rest.onCompositionStart?.(e);
            }}
            onCompositionEnd={(e) => {
                handleCompEnd(e);
                rest.onCompositionEnd?.(e);
            }}
            slotProps={{
                ...slotProps,
                htmlInput: {
                    ...(slotProps?.htmlInput ?? {}),
                },
            }}
        />
    );
}
