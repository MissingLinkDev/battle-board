import { getPluginId } from "../getPluginId";

/** Room metadata key holding settings, shared by every scene in the room. */
export const ROOM_META_KEY = getPluginId("roomSettings");

/** What players may see of a combatant's health. */
export type HealthMode = "none" | "status" | "numbers";

/** Room settings, always complete once read through `migrateSettings`. */
export type InitiativeSettings = {
    // Display (GM list)
    showArmor: boolean;
    showHP: boolean;
    showMovementRange: boolean;
    showAttackRange: boolean;
    showConditions: boolean;
    showDistances: boolean;
    roundDistances: boolean;
    /** DM-only range ring toggle button in each row */
    dmRingToggle: boolean;
    /** Show concentration column in the GM list */
    showConcentration: boolean;
    // Players
    /** When true the list is hidden from players (UI shows the inverted "Show to players" switch) */
    disablePlayerList: boolean;
    /** Master switch for whether players see any health info */
    displayHealthStatusToPlayer: boolean;
    pcHealthMode: HealthMode;
    npcHealthMode: HealthMode;
    /** Players may edit their PCs' health */
    playerEditableHealth: boolean;
    // Gameplay
    /** Turn rings for the active PC */
    showRangeRings: boolean;
    /** Staging a group hides its tokens; releasing shows them */
    groupStagingControlsVisibility: boolean;
};

export const DEFAULT_SETTINGS: InitiativeSettings = {
    showArmor: true,
    showHP: true,
    showMovementRange: true,
    showAttackRange: true,
    showConditions: true,
    showDistances: true,
    roundDistances: false,
    dmRingToggle: true,
    showConcentration: false,
    disablePlayerList: false,
    displayHealthStatusToPlayer: true,
    pcHealthMode: "numbers",
    npcHealthMode: "status",
    playerEditableHealth: false,
    showRangeRings: true,
    groupStagingControlsVisibility: true,
};

/**
 * Complete settings from whatever an older version saved (ADR-0002): missing
 * fields take their defaults. Unknown legacy fields (e.g. the retired
 * `displayPlayerHealthNumbers`) are ignored, matching what earlier versions
 * actually displayed.
 */
export function migrateSettings(saved: unknown): InitiativeSettings {
    const incoming = (saved && typeof saved === "object" ? saved : {}) as Partial<InitiativeSettings>;
    const merged = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof InitiativeSettings)[]) {
        const value = incoming[key];
        if (value !== undefined && typeof value === typeof DEFAULT_SETTINGS[key]) {
            (merged as Record<string, unknown>)[key] = value;
        }
    }
    return merged;
}
