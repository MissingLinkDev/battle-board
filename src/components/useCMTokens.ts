// src/useCMTokens.ts
import { useEffect, useState } from "react";
import type { CMToken } from "./tokens";
import { onCMTokensChange } from "./tokens";

export function useCMTokens() {
    const [tokens, setTokens] = useState<CMToken[]>([]);
    useEffect(() => onCMTokensChange(setTokens), []);
    return tokens;
}
