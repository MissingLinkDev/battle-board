import { getPluginId } from "../getPluginId";

export const META_KEY = getPluginId("metadata");

export type MetaShape = {
    // core turn/list fields
    name: string;
    initiative: number;
    active: boolean;
    visible: boolean;

    // combat stats
    ac: number;
    currentHP: number;
    maxHP: number;
    tempHP: number;
    conditions: string[];

    // movement & tactics
    movement: number;     // e.g., feet per round
    attackRange: number;  // e.g., feet

    // isPlayerCharacter
    playerCharacter: boolean;

};

export function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function isMetadata(v: unknown): v is MetaShape {
    if (!isPlainObject(v)) return false;
    const o = v as any;
    return (
        typeof o.name === "string" &&
        typeof o.initiative === "number" &&
        typeof o.active === "boolean" &&
        typeof o.visible === "boolean" &&
        typeof o.ac === "number" &&
        typeof o.currentHP === "number" &&
        typeof o.maxHP === "number" &&
        typeof o.tempHP === "number" &&
        Array.isArray(o.conditions) &&
        typeof o.movement === "number" &&
        typeof o.attackRange === "number" &&
        typeof o.playerCharacter === "boolean"
    );
}
