// CommitField.tsx
import { useEffect, useRef, useState } from "react";
import TextField, { type TextFieldProps } from "@mui/material/TextField";
import { clamp, evalMathInput } from "./utils";

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

/* -------------------- Number (with optional math & clamp) -------------------- */
type CommitNumberFieldProps = BaseProps & {
    value: number;
    /** Enable math parsing like "+5", "-3", "10+2-4". Default: false */
    allowMath?: boolean;
    /** Base used for relative math; defaults to current `value` */
    mathBase?: number;
    /** Clamp range */
    min?: number;
    max?: number;
    /** Optional final transform before commit (e.g., rounding) */
    finalize?: (n: number) => number;
};

export function CommitNumberField({
    value,
    onCommit,
    allowMath = false,
    mathBase,
    min,
    max,
    finalize,
    slotProps,
    ...rest
}: CommitNumberFieldProps) {
    const [text, setText] = useState(String(value ?? 0));
    const inputRef = useRef<HTMLInputElement | null>(null);
    const composingRef = useRef(false);

    useEffect(() => setText(String(value ?? 0)), [value]);

    const compute = (raw: string) => {
        const base = mathBase ?? value;
        let next: number;

        if (allowMath) {
            next = evalMathInput(raw, base);
        } else {
            const digits = (raw ?? "").toString().replace(/[^\d-]/g, "");
            const parsed = Number(digits);
            next = Number.isFinite(parsed) ? parsed : value;
        }

        if (min !== undefined || max !== undefined) {
            next = clamp(
                next,
                min ?? Number.NEGATIVE_INFINITY,
                max ?? Number.POSITIVE_INFINITY
            );
        }

        return finalize ? finalize(next) : next;
    };

    const commit = (raw: string) => {
        const next = compute(raw);
        // Always notify the parent so it can exit edit mode even if value didn't change
        onCommit(next);
    };

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
            type="text"       // avoid native steppers
            inputMode="numeric"
            value={text}
            inputRef={inputRef}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
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
