export type InitiativeItem = {
    id: string;
    name: string;
    initiative: number;
    active: boolean;
    visible: boolean;
    ac: number;
    currentHP: number;
    maxHP: number;
    tempHP: number;
    conditions: string[];
    movement: number;
    attackRange: number;
    playerCharacter: boolean;
    movementColor?: string | null;
    rangeColor?: string | null;
    // NEW ring styling
    movementWeight?: number | null;    // e.g. 4..16
    rangeWeight?: number | null;

    movementPattern?: "solid" | "dash" | null;
    rangePattern?: "solid" | "dash" | null;

    movementOpacity?: number | null;   // 0..1
    rangeOpacity?: number | null;
};