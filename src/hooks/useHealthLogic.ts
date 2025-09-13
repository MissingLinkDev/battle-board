import { useMemo } from "react";
import type { InitiativeItem } from "../components/InitiativeItem";
import type { InitiativeSettings } from "../components/SceneState";

export type HealthMode = "none" | "status" | "numbers";
export type HealthInfo = {
    mode: HealthMode;
    statusText: string;
    isBloodied: boolean;
    isDead: boolean;
    showColumn: boolean;
};

/**
 * Centralized health logic to eliminate duplication
 */
export function useHealthLogic(settings: InitiativeSettings) {
    return useMemo(() => {
        const healthMasterOn = !!settings.displayHealthStatusToPlayer;
        const pcMode = (settings.pcHealthMode ?? "numbers") as HealthMode;
        const npcMode = (settings.npcHealthMode ?? "status") as HealthMode;

        const showHealthColumn = healthMasterOn && (pcMode !== "none" || npcMode !== "none");

        const getHealthInfo = (row: InitiativeItem): HealthInfo => {
            const isPC = !!row.playerCharacter;
            const mode = isPC ? pcMode : npcMode;
            const isBloodied = row.maxHP > 0 ? row.currentHP < row.maxHP / 2 : false;
            const isDead = row.currentHP === 0;
            const statusText = isDead
                ? (row.playerCharacter ? "Dying" : "Dead")
                : (isBloodied ? "Bloodied" : "Healthy");

            return {
                mode: healthMasterOn ? mode : "none",
                statusText,
                isBloodied,
                isDead,
                showColumn: showHealthColumn,
            };
        };

        return {
            showHealthColumn,
            getHealthInfo,
            pcMode,
            npcMode,
            healthMasterOn,
        };
    }, [settings.displayHealthStatusToPlayer, settings.pcHealthMode, settings.npcHealthMode]);
}