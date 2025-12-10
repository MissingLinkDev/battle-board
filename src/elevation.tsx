import React from "react";
import ReactDOM from "react-dom/client";
import OBR from "@owlbear-rodeo/sdk";
import { NumberField } from "./components/NumberField";
import { PluginGate } from "./PluginGate";
import { PluginThemeProvider } from "./PluginThemeProvider";
import { getPluginId } from "./getPluginId";

const META_KEY = getPluginId("metadata");

function ElevationMenu() {
    const [elevation, setElevation] = React.useState<number>(0);
    const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
    const [unit, setUnit] = React.useState<string>("ft");

    React.useEffect(() => {
        const init = async () => {
            // Get grid scale for unit label
            try {
                const scale = await OBR.scene.grid.getScale();
                const gridUnit = scale.parsed?.unit || "ft";
                setUnit(gridUnit.toString());
            } catch (e) {
                console.error("Failed to get grid scale:", e);
            }

            // Get selected items from player selection
            const selection = await OBR.player.getSelection();
            if (!selection || selection.length === 0) {
                console.warn("No items selected");
                return;
            }

            setSelectedIds(selection);

            // Get the items to read their current elevation
            const items = await OBR.scene.items.getItems(selection);

            // If single item selected, show its current elevation
            if (items.length === 1) {
                const meta = (items[0].metadata as any)?.[META_KEY];
                if (meta && typeof meta.elevation === "number") {
                    setElevation(meta.elevation);
                }
            } else if (items.length > 1) {
                // Multiple items: check if they all have the same elevation
                const elevations = items
                    .map((item) => (item.metadata as any)?.[META_KEY]?.elevation)
                    .filter((e: any) => typeof e === "number");

                if (elevations.length > 0 && elevations.every((e: number) => e === elevations[0])) {
                    setElevation(elevations[0]);
                }
            }
        };

        init();
    }, []);

    const updateElevation = (newValue: number) => {
        setElevation(newValue);

        // Update items asynchronously
        OBR.scene.items.updateItems(selectedIds, (items) => {
            for (const item of items) {
                const metadata = item.metadata as any;
                if (!metadata[META_KEY]) continue;
                metadata[META_KEY].elevation = newValue;
            }
        }).then(async () => {
            // Update elevation labels
            const { ensureElevationLabel } = await import("./components/elevationLabels");
            for (const id of selectedIds) {
                await ensureElevationLabel({
                    tokenId: id,
                    elevation: newValue,
                    unit: unit,
                });
            }
        }).catch((error) => {
            console.error("Failed to update elevation:", error);
            if (error && typeof error === 'object' && 'error' in error) {
                console.error("Detailed error:", (error as any).error);
            }
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            OBR.popover.close(META_KEY + "/elevation-menu");
        }
    };

    return (
        <NumberField
            value={elevation}
            onChange={updateElevation}
            onKeyDown={handleKeyDown}
            size="small"
            autoFocus
            fullWidth
            min={-1000}
            max={1000}
            step={5}
            unit={unit}
        />
    );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <PluginGate>
            <PluginThemeProvider>
                <ElevationMenu />
            </PluginThemeProvider>
        </PluginGate>
    </React.StrictMode>
);
