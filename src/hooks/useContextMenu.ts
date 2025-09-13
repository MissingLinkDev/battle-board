import { useState } from "react";

export function useContextMenu() {
    const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number } | null>(null);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setContextMenu({ mouseX: e.clientX, mouseY: e.clientY });
    };

    const handleClose = () => {
        setContextMenu(null);
    };

    return {
        contextMenu,
        handleContextMenu,
        handleClose,
    };
}