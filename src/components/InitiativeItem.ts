export interface InitiativeItem {
    initiative: number;
    name: string;
    id: string;
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
}