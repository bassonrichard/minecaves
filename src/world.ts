export const SIZE_X = 96, SIZE_Y = 32, SIZE_Z = 64, BIOME_SIZE = 32, SEA_LEVEL = 6;
export const BLOCKS = ['Air', 'Grass', 'Dirt', 'Stone', 'Wood', 'Leaves', 'Planks', 'Crafting table', 'Sand', 'Snow', 'Water', 'Cactus', 'Ice',
    'Stove', 'Smelter', 'Chest', 'Window', 'Door', 'Open door', 'Bed', 'Bed head'] as const;
export const SAND = 8, SNOW = 9, WATER = 10, CACTUS = 11, ICE = 12, STOVE = 13, SMELTER = 14, CHEST = 15, WINDOW = 16, DOOR = 17, OPEN_DOOR = 18, BED = 19, BED_HEAD = 20;
// Doors and beds are drawn as their own shapes rather than cube faces.
export const SHAPED = [DOOR, OPEN_DOOR, BED, BED_HEAD];
export const BED_HEIGHT = 9 / 16;
// Test layout: two rows of three 32×32 biomes (row z 0–31, then z 32–63).
export const BIOMES = ['snow', 'mountain', 'forest', 'ocean', 'plains', 'desert'] as const;
export type Biome = typeof BIOMES[number];
const clampIndex = (n: number, max: number) => Math.min(max, Math.max(0, Math.floor(n / BIOME_SIZE)));
export const biomeAt = (x: number, z: number): Biome => BIOMES[clampIndex(x, 2) + 3 * clampIndex(z, 1)];
export const biomeOrigin = (biome: Biome) => { const i = BIOMES.indexOf(biome); return { x: i % 3 * BIOME_SIZE, z: Math.floor(i / 3) * BIOME_SIZE }; };
// Water fills a cell but never blocks movement or placement.
export const solid = (id: number) => id !== 0 && id !== WATER;
// Hides the faces behind it. Windows and shaped blocks let you see past them.
export const opaque = (id: number) => solid(id) && id !== WINDOW && !SHAPED.includes(id);
// Stops bodies. An open door fills its cell (you can't build into it) but you walk through it.
export const blocking = (id: number) => solid(id) && id !== OPEN_DOOR;
export type Vec3 = {
    x: number;
    y: number;
    z: number;
};
const axis = (n: number, size: number) => Number.isInteger(n) && n >= 0 && n < size;
export const inside = (x: number, y: number, z: number) => axis(x, SIZE_X) && axis(y, SIZE_Y) && axis(z, SIZE_Z);
export class World {
    data = new Uint8Array(SIZE_X * SIZE_Y * SIZE_Z);
    get(x: number, y: number, z: number) { return inside(x, y, z) ? this.data[x + SIZE_X * (z + SIZE_Z * y)] : 0; }
    solid(x: number, y: number, z: number) { return solid(this.get(x, y, z)); }
    blocking(x: number, y: number, z: number) { return blocking(this.get(x, y, z)); }
    // How tall the block in this cell stands, for collision.
    height(x: number, y: number, z: number) { const id = this.get(x, y, z); return id === BED || id === BED_HEAD ? BED_HEIGHT : 1; }
    set(x: number, y: number, z: number, id: number) {
        if (!inside(x, y, z) || !Number.isInteger(id) || id < 0 || id >= BLOCKS.length)
            return false;
        this.data[x + SIZE_X * (z + SIZE_Z * y)] = id;
        return true;
    }
}
function rawHeight(x: number, z: number) {
    const lx = x % BIOME_SIZE, lz = z % BIOME_SIZE;
    switch (biomeAt(x, z)) {
        // Deep water, then a sandy ramp up to the plains.
        case 'ocean': return lx < 18 ? 2 + Math.sin(z * .4) * .5 : 2 + (lx - 18) * .55;
        case 'plains': return 8 + Math.sin(x * .15) + Math.cos(z * .13);
        case 'desert': return 8 + Math.sin(x * .3 + z * .12) * 2;
        case 'forest': return 9 + Math.sin(x * .19) * 1.8 + Math.cos(z * .22) * 1.7 + Math.sin((x + z) * .3);
        case 'snow': return 9 + Math.sin(x * .17) * 1.5 + Math.cos(z * .2) * 1.2;
        case 'mountain': return 9 + 16 * Math.max(0, 1 - Math.hypot(lx - 15.5, lz - 15.5) / 17) + Math.sin(x * .5) * Math.cos(z * .4) * 1.5;
    }
}
export const TREES: [number, number][] = [
    [69, 5], [76, 9], [84, 5], [91, 10], [70, 15], [79, 17], [88, 20], [73, 24], [82, 27], [91, 27], // forest
    [38, 38], [58, 40], [40, 58], // plains
    [6, 6], [20, 10], [12, 24], // snow
];
// Desert cacti: x, z, height.
const CACTI = [[68, 36, 2], [75, 38, 3], [88, 37, 1], [92, 45, 2], [70, 51, 3], [86, 55, 2], [93, 60, 1], [66, 60, 2]];
const top = (world: World, x: number, z: number) => { let y = SIZE_Y - 1; while (y > 0 && !world.get(x, y, z)) y--; return y; };
export function generateWorld() {
    const world = new World();
    const raw = new Float32Array(SIZE_X * SIZE_Z);
    for (let x = 0; x < SIZE_X; x++)
        for (let z = 0; z < SIZE_Z; z++)
            raw[x + SIZE_X * z] = rawHeight(x, z);
    for (let x = 0; x < SIZE_X; x++)
        for (let z = 0; z < SIZE_Z; z++) {
            // A 7×7 average turns biome borders into slopes instead of cliffs.
            let sum = 0, count = 0;
            for (let dx = -3; dx <= 3; dx++)
                for (let dz = -3; dz <= 3; dz++)
                    if (x + dx >= 0 && x + dx < SIZE_X && z + dz >= 0 && z + dz < SIZE_Z) { sum += raw[x + dx + SIZE_X * (z + dz)]; count++; }
            const height = Math.floor(sum / count), biome = biomeAt(x, z);
            for (let y = 0; y <= height; y++) {
                const top = y === height;
                let id = 3;
                if (y > height - 3) {
                    if (biome === 'plains' || biome === 'forest') id = top ? 1 : 2;
                    else if (biome === 'desert' || biome === 'ocean') id = SAND;
                    else if (biome === 'snow') id = top ? SNOW : 2;
                    else id = top && height >= 18 ? SNOW : 3;
                }
                world.set(x, y, z, id);
            }
            if (biome === 'ocean')
                for (let y = height + 1; y <= SEA_LEVEL; y++)
                    world.set(x, y, z, WATER);
        }
    // A frozen pond in the snow biome: flatten to the lowest bank, then ice over a layer of water.
    const pond: [number, number][] = [];
    for (let x = 19; x <= 29; x++) for (let z = 17; z <= 27; z++) if (Math.hypot(x - 24, z - 22) < 4) pond.push([x, z]);
    const level = Math.min(...pond.map(([x, z]) => top(world, x, z)));
    for (const [x, z] of pond) {
        for (let y = level + 1; y < SIZE_Y; y++) world.set(x, y, z, 0);
        world.set(x, level, z, ICE);
        world.set(x, level - 1, z, WATER);
    }
    for (const [x, z, height] of CACTI) {
        const y = top(world, x, z);
        for (let h = 1; h <= height; h++) world.set(x, y + h, z, CACTUS);
    }
    for (const [x, z] of TREES) growTree(world, x, z);
    return world;
}
// The ground under a tree spot, looking past its trunk and leaves.
function treeGround(world: World, x: number, z: number) {
    let y = SIZE_Y - 1;
    while (y > 0 && [0, 4, 5].includes(world.get(x, y, z))) y--;
    return y;
}
// A four-high trunk under a leafy crown. Leaves only fill air.
export function growTree(world: World, x: number, z: number) {
    const y = treeGround(world, x, z);
    for (let h = 1; h <= 4; h++)
        world.set(x, y + h, z, 4);
    for (let dx = -2; dx <= 2; dx++)
        for (let dz = -2; dz <= 2; dz++)
            for (let h = 3; h <= 5; h++) {
                if (Math.abs(dx) + Math.abs(dz) > (h === 5 ? 2 : 3))
                    continue;
                if (!world.get(x + dx, y + h, z + dz))
                    world.set(x + dx, y + h, z + dz, 5);
            }
}
export const REGROW_DAYS = 2;
// Run at each dawn. `missingSince[i]` is the day tree i was first seen gone (-1 while standing).
// A tree regrows once it has been gone REGROW_DAYS days, on bare ground with room for its trunk.
// Returns whether any tree grew back.
export function regrowTrees(world: World, day: number, missingSince: number[], player?: Vec3) {
    let grew = false;
    TREES.forEach(([x, z], i) => {
        const y = treeGround(world, x, z);
        if (world.get(x, y + 1, z) === 4) { missingSince[i] = -1; return; }
        if (!(missingSince[i] >= 0)) { missingSince[i] = day; return; }
        if (day - missingSince[i] < REGROW_DAYS || ![1, 2, SNOW].includes(world.get(x, y, z))) return;
        if ([1, 2, 3, 4].some(h => ![0, 4, 5].includes(world.get(x, y + h, z)) || (player && overlaps(player, x, y + h, z)))) return;
        growTree(world, x, z);
        missingSince[i] = -1; grew = true;
    });
    return grew;
}
// Sand with nothing solid below falls straight to rest (instantly). Returns the cells it left.
export function settleSand(world: World, x: number, z: number, from: number) {
    const vacated: Vec3[] = [];
    for (let y = Math.max(1, from); y < SIZE_Y; y++) {
        if (world.get(x, y, z) !== SAND) continue;
        let to = y;
        while (to > 0 && !world.solid(x, to - 1, z)) to--;
        if (to === y) continue;
        world.set(x, to, z, SAND);
        world.set(x, y, z, 0);
        vacated.push({ x, y, z });
    }
    return vacated;
}
// ponytail: instant fill with no flow levels. Air fills from water above, or from water beside it at or below sea level.
export function flowWater(world: World, start: Vec3[], limit = 2000) {
    const queue = [...start];
    let filled = 0;
    for (let i = 0; i < queue.length && filled < limit; i++) {
        const { x, y, z } = queue[i];
        if (!inside(x, y, z) || world.get(x, y, z) !== 0) continue;
        const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        if (world.get(x, y + 1, z) !== WATER && !(y <= SEA_LEVEL && sides.some(([dx, dz]) => world.get(x + dx, y, z + dz) === WATER))) continue;
        world.set(x, y, z, WATER);
        filled++;
        queue.push({ x, y: y - 1, z }, ...sides.map(([dx, dz]) => ({ x: x + dx, y, z: z + dz })));
    }
    return filled;
}
// Run after any edit at (x, y, z): loose sand falls, then water pours into any gaps.
export function settle(world: World, x: number, y: number, z: number) {
    flowWater(world, [{ x, y, z }, ...settleSand(world, x, z, y)]);
}
// Corners wind counterclockwise when seen from outside the block.
export const FACES = [
    { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
    { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
    { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
    { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
    { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
    { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
export function visibleFaces(world: World, visit: (x: number, y: number, z: number, id: number, face: number) => void) {
    for (let y = 0; y < SIZE_Y; y++)
        for (let z = 0; z < SIZE_Z; z++)
            for (let x = 0; x < SIZE_X; x++) {
                const id = world.get(x, y, z);
                if (!id)
                    continue;
                if (SHAPED.includes(id))
                    continue;
                // Solid faces show through water and windows; water only shows where it meets air.
                FACES.forEach(({ n }, face) => {
                    const next = world.get(x + n[0], y + n[1], z + n[2]);
                    if (id === WATER ? !next : !opaque(next) && !(id === WINDOW && next === WINDOW))
                        visit(x, y, z, id, face);
                });
            }
}
export const RADIUS = .3, HEIGHT = 1.8;
export function overlaps(player: Vec3, x: number, y: number, z: number) {
    return player.x + RADIUS > x && player.x - RADIUS < x + 1 && player.y + HEIGHT > y && player.y < y + 1 && player.z + RADIUS > z && player.z - RADIUS < z + 1;
}
export function canPlace(world: World, player: Vec3, x: number, y: number, z: number) {
    return inside(x, y, z) && !world.solid(x, y, z) && !overlaps(player, x, y, z);
}
export function editBlock(world: World, player: Vec3, x: number, y: number, z: number, id: number) {
    if (id === 0)
        return y > 0 && world.solid(x, y, z) && world.set(x, y, z, 0);
    return canPlace(world, player, x, y, z) && world.set(x, y, z, id);
}
