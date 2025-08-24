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
    movementColor?: string | null;  // NEW
    rangeColor?: string | null;     // NEW
};