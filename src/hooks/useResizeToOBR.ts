// useResizeToOBR.tsx
import { useEffect, useRef } from "react";
import OBR from "@owlbear-rodeo/sdk";

export function useResizeToOBR(minHeight = 250) {
    const rootRef = useRef<HTMLDivElement | null>(null);

    // Single place to measure & set the action height
    const measureNow = () => {
        const el = rootRef.current;
        if (!el) return;
        // double rAF lets MUI/layout/fonts settle
        requestAnimationFrame(() =>
            requestAnimationFrame(() => {
                const h = el.getBoundingClientRect().height || 0;
                OBR.action.setHeight(Math.max(h, minHeight));
            })
        );
    };

    useEffect(() => {
        const el = rootRef.current;

        // If we don't have the element yet, or RO isn't supported, still try to size
        if (!el || typeof ResizeObserver === "undefined") {
            measureNow(); // best effort
            return;
        }

        // --- ResizeObserver: follow natural content changes ---
        const ro = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;

            // Use borderBoxSize when available (better cross-browser accuracy)
            const bbs: any = (entry as any).borderBoxSize;
            if (bbs && (bbs.blockSize || (Array.isArray(bbs) && bbs[0]?.blockSize))) {
                const box = Array.isArray(bbs) ? bbs[0] : bbs;
                const h = Number(box.blockSize) || el.getBoundingClientRect().height || 0;
                OBR.action.setHeight(Math.max(h, minHeight));
            } else {
                const h = (entry.target as HTMLElement).getBoundingClientRect().height || 0;
                OBR.action.setHeight(Math.max(h, minHeight));
            }
        });
        ro.observe(el);

        // --- Initial measurement (component just mounted) ---
        measureNow();
        // --- When the action popover opens (user clicks your extension button) ---
        const offOpen = OBR.action.onOpenChange((isOpen) => {
            if (isOpen) measureNow();
        });

        // --- If it's already open on mount, size immediately ---
        let live = true;
        (async () => {
            try {
                const open = await OBR.action.isOpen();
                if (live && open) measureNow();
            } catch {
                /* noop */
            }
        })();

        return () => {
            live = false;
            try { ro.disconnect(); } catch { }
            try { offOpen?.(); } catch { }
            // Optional: restore to a sane minimum when unmounting
            try { OBR.action.setHeight(minHeight); } catch { }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // mount once; the minHeight is stable by call-site

    // Manual nudge hook callers can use after animations/tabs/etc.
    const kickMeasure = () => measureNow();

    return { rootRef, kickMeasure };
}
