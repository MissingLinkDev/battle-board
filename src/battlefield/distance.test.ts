import { describe, expect, it } from "vitest";
import { createFakeScene, flush } from "../obr/fakeScene";
import { makeToken } from "../test/tokens";
import { DEFAULT_META, META_KEY } from "../components/metadata";
import { toCMToken } from "../components/tokens";
import { distancesFrom, distanceBetween, formatDistance, type Body } from "./distance";
import { footprintCells } from "./footprint";
import { readGrid } from "./grid";

const DPI = 150;
/** A body standing on the cell whose top-left corner is (col, row). */
const at = (id: string, col: number, row: number, extra: Partial<Body> = {}): Body => {
    const size = extra.cells?.w ?? 1;
    return { id, name: id, center: { x: (col + size / 2) * DPI, y: (row + size / 2) * DPI }, cells: { w: size, h: size }, elevation: 0, ...extra };
};

async function grid(measurement: "CHEBYSHEV" | "EUCLIDEAN" = "CHEBYSHEV") {
    return readGrid(createFakeScene({ grid: { dpi: DPI, measurement } }).connect());
}

describe("distance between creatures", () => {
    it("measures neighbouring squares as one cell", async () => {
        expect(await distanceBetween(at("a", 0, 0), at("b", 1, 0), await grid())).toBe(5);
    });

    it("measures from the nearest square of a large creature", async () => {
        const large = at("large", 0, 0, { cells: { w: 2, h: 2 } });
        expect(await distanceBetween(large, at("b", 4, 1), await grid())).toBe(15);
    });

    it("adds height the way the grid counts diagonals", async () => {
        const ground = at("ground", 0, 0);
        const flying = at("flying", 2, 0, { elevation: 20 });
        expect(await distanceBetween(ground, flying, await grid("CHEBYSHEV"))).toBe(20);
        expect(Math.round(await distanceBetween(ground, flying, await grid("EUCLIDEAN")))).toBe(22);
    });

    it("lists distances nearest first", async () => {
        const list = await distancesFrom("me", [at("me", 0, 0), at("far", 6, 0), at("near", 2, 0)], await grid(), { round: false });
        expect(list.map((d) => [d.id, d.text])).toEqual([["near", "10 ft"], ["far", "30 ft"]]);
    });
});

describe("formatDistance", () => {
    const g = { unitsPerCell: 5, unitLabel: "ft" };
    it("reads under one cell as Touch", () => {
        expect(formatDistance(3, g, { round: false }).text).toBe("Touch");
    });

    it("rounds to the nearest grid multiple when rounding is on", () => {
        expect(formatDistance(22.4, g, { round: false }).text).toBe("22 ft");
        expect(formatDistance(22.4, g, { round: true }).text).toBe("20 ft");
    });
});

describe("grid and token snapshots", () => {
    it("re-read the grid after the GM changes its scale", async () => {
        const scene = createFakeScene({ grid: { multiplier: 5 } });
        const port = scene.connect();
        scene.setGrid({ multiplier: 10, unit: "m" });
        await flush();
        expect(await readGrid(port)).toMatchObject({ unitsPerCell: 10, unitLabel: "m" });
    });

    it("count a token smaller than a cell as one cell", () => {
        const tiny = makeToken({ id: "tiny" });
        tiny.scale = { x: 0.5, y: 0.5 };
        expect(footprintCells(tiny)).toEqual({ w: 1, h: 1 });
    });

    it("take elevation from the token itself, combatant or not", () => {
        const token = makeToken({ id: "a", metadata: { [META_KEY]: { ...DEFAULT_META, name: "a", visible: true, elevation: 30, inInitiative: false } } });
        expect(toCMToken(token)?.elevation).toBe(30);
    });
});
