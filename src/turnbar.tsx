import React from "react";
import ReactDOM from "react-dom/client";
import { PluginGate } from "./PluginGate";
import { PluginThemeProvider } from "./PluginThemeProvider";
import { TurnBar } from "./turnbar/TurnBar";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <PluginGate>
            <PluginThemeProvider>
                <TurnBar />
            </PluginThemeProvider>
        </PluginGate>
    </React.StrictMode>
);
