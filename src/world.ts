// The surface starts GROUND blocks up; each biome's caves fill the layer underneath it.
export const SIZE_X = 96, SIZE_Y = 64, SIZE_Z = 64, BIOME_SIZE = 32, GROUND = 32, SEA_LEVEL = GROUND + 6;
export const BLOCKS = ['Air', 'Grass', 'Dirt', 'Stone', 'Wood', 'Leaves', 'Planks', 'Crafting table', 'Sand', 'Snow', 'Water', 'Cactus', 'Ice',
    'Stove', 'Smelter', 'Chest', 'Window', 'Door', 'Open door', 'Bed', 'Bed head',
    'Lava', 'Ice crystal', 'Quicksand', 'Vine', 'Glow mushroom', 'Torch', 'Sandstone', 'Mossy stone', 'Glow coral', 'Dripstone',
    'Wall torch', 'Wall torch', 'Wall torch', 'Wall torch'] as const;
export const SAND = 8, SNOW = 9, WATER = 10, CACTUS = 11, ICE = 12, STOVE = 13, SMELTER = 14, CHEST = 15, WINDOW = 16, DOOR = 17, OPEN_DOOR = 18, BED = 19, BED_HEAD = 20;
export const LAVA = 21, ICE_CRYSTAL = 22, QUICKSAND = 23, VINE = 24, GLOW_MUSHROOM = 25, TORCH = 26, SANDSTONE = 27, MOSSY_STONE = 28, GLOW_CORAL = 29, DRIPSTONE = 30;
// A torch fixed to a wall, one ID per side the wall is on: +x, -x, +z, -z. They drop plain torches.
export const WALL_TORCHES = [31, 32, 33, 34], WALL_SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// Doors, beds, torches, mushrooms, vines, coral trees, and dripstone spikes are drawn as their own shapes rather than cube faces.
export const SHAPED = [DOOR, OPEN_DOOR, BED, BED_HEAD, TORCH, ...WALL_TORCHES, GLOW_MUSHROOM, DRIPSTONE, VINE, GLOW_CORAL];
// Light each block gives off (0–15). Everything else is dark underground.
export const LIGHT: Record<number, number> = { [LAVA]: 15, [TORCH]: 14, ...Object.fromEntries(WALL_TORCHES.map(id => [id, 14])), [ICE_CRYSTAL]: 8, [GLOW_CORAL]: 8, [GLOW_MUSHROOM]: 7 };
export const LIQUIDS = [WATER, LAVA];
export const BED_HEIGHT = 9 / 16;
// Test layout: two rows of three 32×32 biomes (row z 0–31, then z 32–63).
export const BIOMES = ['snow', 'mountain', 'forest', 'ocean', 'plains', 'desert'] as const;
export type Biome = typeof BIOMES[number];
const clampIndex = (n: number, max: number) => Math.min(max, Math.max(0, Math.floor(n / BIOME_SIZE)));
export const biomeAt = (x: number, z: number): Biome => BIOMES[clampIndex(x, 2) + 3 * clampIndex(z, 1)];
export const biomeOrigin = (biome: Biome) => { const i = BIOMES.indexOf(biome); return { x: i % 3 * BIOME_SIZE, z: Math.floor(i / 3) * BIOME_SIZE }; };
// Water and lava fill a cell but never block movement or placement.
export const solid = (id: number) => id !== 0 && !LIQUIDS.includes(id);
// Hides the faces behind it. Windows, crystals, and shaped blocks let you see past them.
export const opaque = (id: number) => solid(id) && id !== WINDOW && id !== ICE_CRYSTAL && !SHAPED.includes(id);
// Stops bodies. These fill their cell (you can't build into them) but you pass through them.
const PASSABLE = [OPEN_DOOR, QUICKSAND, VINE, TORCH, ...WALL_TORCHES, GLOW_MUSHROOM, GLOW_CORAL];
export const blocking = (id: number) => solid(id) && !PASSABLE.includes(id);
// The same rules as lookup tables by block ID, for the loops that visit every cell.
const table = (test: (id: number) => boolean) => Uint8Array.from({ length: 256 }, (_, id) => id < BLOCKS.length && test(id) ? 1 : 0);
export const OPAQUE = table(opaque), IS_SHAPED = table(id => SHAPED.includes(id)), IS_LIQUID = table(id => LIQUIDS.includes(id));
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
            const height = GROUND + Math.floor(sum / count), biome = biomeAt(x, z);
            for (let y = 0; y <= height; y++) {
                const top = y === height;
                let id = 3;
                if (y > height - 3) {
                    if (biome === 'plains' || biome === 'forest') id = top ? 1 : 2;
                    else if (biome === 'desert' || biome === 'ocean') id = SAND;
                    else if (biome === 'snow') id = top ? SNOW : 2;
                    else id = top && height >= GROUND + 18 ? SNOW : 3;
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
    // Hidden quicksand pits, three deep, under the desert's top layer.
    for (const [cx, cz] of PITS)
        for (let x = cx - 2; x <= cx + 2; x++) for (let z = cz - 2; z <= cz + 2; z++) {
            if (Math.hypot(x - cx, z - cz) > 1.6) continue;
            const y = top(world, x, z);
            for (let d = 0; d < 3; d++) if (world.get(x, y - d, z) === SAND) world.set(x, y - d, z, QUICKSAND);
        }
    // A few glowing corals on the sea floor.
    const random = seeded(77);
    for (let x = 0; x < 18; x++) for (let z = BIOME_SIZE; z < 2 * BIOME_SIZE; z++)
        // Only where it stays under water, so it never leaves a gap in the surface.
        if (world.get(x, floorUnder(world, x, z) + 2, z) === WATER && random() < .04) world.set(x, floorUnder(world, x, z) + 1, z, GLOW_CORAL);
    BIOMES.forEach((biome, i) => carveCaves(world, biome, i));
    for (const [x, z] of TREES) growTree(world, x, z);
    return world;
}
// The sea floor under ocean column (x, z).
function floorUnder(world: World, x: number, z: number) { let y = SEA_LEVEL; while (y > 0 && world.get(x, y, z) === WATER) y--; return y; }
// Desert quicksand pits: x, z.
const PITS = [[72, 44], [83, 48], [90, 53], [75, 57]];
// Deterministic random numbers, the same LCG as the texture atlas.
const seeded = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
// Each biome's stair entrance: where it starts (biome-local x, z) and which way it heads down.
export const ENTRANCES: Record<Biome, [number, number, number, number]> = {
    snow: [4, 14, 1, 0], mountain: [3, 16, 1, 0], forest: [3, 12, 1, 0], ocean: [28, 4, 0, 1], plains: [20, 4, 0, 1], desert: [14, 10, 0, 1],
};
const STAIRS = 16;
// Cave air at or below this height turns to lava (water in the flooded sea cave).
const POOL: Record<Biome, number> = { snow: 4, mountain: 10, forest: 4, ocean: 12, plains: 4, desert: 4 };
// Carves one biome's caves: a stair down from the surface, then three worms of tunnels that stay under the biome,
// then fills and decorates them in the biome's style.
function carveCaves(world: World, biome: Biome, index: number) {
    const random = seeded(4001 + index * 97), { x: ox, z: oz } = biomeOrigin(biome);
    const within = (x: number, z: number) => x >= ox + 2 && x < ox + BIOME_SIZE - 2 && z >= oz + 2 && z < oz + BIOME_SIZE - 2;
    const carved: number[] = [];
    const clear = (x: number, y: number, z: number) => {
        if (y < 1 || !within(x, z) || !world.get(x, y, z)) return;
        world.set(x, y, z, 0);
        carved.push(x + SIZE_X * (z + SIZE_Z * y));
    };
    // The stairs: two wide and three tall, one block down per step.
    const [lx, lz, dx, dz] = ENTRANCES[biome], sx = ox + lx, sz = oz + lz, start = top(world, sx, sz);
    for (let i = 0; i <= STAIRS; i++)
        for (let h = 0; h < 3; h++) { clear(sx + dx * i, start - i + h, sz + dz * i); clear(sx + dx * i + dz, start - i + h, sz + dz * i + dx); }
    // Worms: the first starts at the foot of the stairs, the others branch off an earlier tunnel.
    const path: Vec3[] = [{ x: sx + dx * STAIRS + .5, y: start - STAIRS + 1, z: sz + dz * STAIRS + .5 }];
    const carveBall = (x: number, y: number, z: number, r: number) => {
        for (let cx = Math.floor(x - r); cx <= x + r; cx++) for (let cy = Math.floor(y - r); cy <= y + r; cy++) for (let cz = Math.floor(z - r); cz <= z + r; cz++)
            if (Math.hypot(cx + .5 - x, cy + .5 - y, cz + .5 - z) <= r) clear(cx, cy, cz);
    };
    // Each worm drifts toward its own depth, so the caves reach down to the lava.
    for (const depth of [6, 12, 19]) {
        let { x, y, z } = path[Math.floor(random() * path.length)], yaw = random() * Math.PI * 2, pitch = -.3;
        for (let step = 0; step < 60; step++) {
            x += Math.cos(yaw) * Math.cos(pitch); z += Math.sin(yaw) * Math.cos(pitch); y += Math.sin(pitch);
            yaw += (random() - .5) * .8;
            pitch = Math.max(-.6, Math.min(.6, pitch * .8 + (random() - .5) * .6 + (depth - y) * .03));
            // Turn back at the biome's edge; stay between the bedrock and the surface.
            if (!within(Math.floor(x), Math.floor(z)) || !within(Math.floor(x + 3 * Math.cos(yaw)), Math.floor(z + 3 * Math.sin(yaw)))) yaw += Math.PI;
            x = Math.max(ox + 4, Math.min(ox + BIOME_SIZE - 4, x)); z = Math.max(oz + 4, Math.min(oz + BIOME_SIZE - 4, z));
            y = Math.max(3, Math.min(GROUND - 4, y));
            carveBall(x, y, z, 1.6 + random() * .8);
            path.push({ x, y, z });
        }
        // Each worm ends in a wide cavern, with room for stalactites and a pool.
        carveBall(x, y + 1, z, 4.2);
    }
    // Pools first, then the biome's walls, floors, and ceilings, top down so hanging vines aren't revisited.
    carved.sort((a, b) => b - a);
    for (const i of carved) {
        const x = i % SIZE_X, z = Math.floor(i / SIZE_X) % SIZE_Z, y = Math.floor(i / (SIZE_X * SIZE_Z));
        if (y >= GROUND || world.get(x, y, z)) continue;
        if (y <= POOL[biome]) { world.set(x, y, z, biome === 'ocean' ? WATER : LAVA); continue; }
        const below = world.get(x, y - 1, z), above = world.get(x, y + 1, z), roll = random();
        const wall = biome === 'desert' ? SANDSTONE : biome === 'forest' ? MOSSY_STONE : 0;
        if (wall) for (const [nx, ny, nz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]])
            if (world.get(x + nx, y + ny, z + nz) === 3 && (biome === 'desert' || random() < .5)) world.set(x + nx, y + ny, z + nz, wall);
        const floor = blocking(world.get(x, y - 1, z)), ceiling = blocking(above);
        // Stalactites hang from the ceiling, sometimes two long; stalagmites rise from the floor.
        if (ceiling && roll > .9 && roll <= .96) {
            world.set(x, y, z, DRIPSTONE);
            if (roll > .93 && !world.get(x, y - 1, z) && !blocking(world.get(x, y - 2, z))) world.set(x, y - 1, z, DRIPSTONE);
            continue;
        }
        if (floor && roll < .05 && biome !== 'desert') { world.set(x, y, z, DRIPSTONE); continue; }
        if (biome === 'snow') {
            if (floor && below !== ICE && roll < .5) world.set(x, y - 1, z, ICE);
            else if ((floor || ceiling) && roll > .965) world.set(x, y, z, ICE_CRYSTAL);
        } else if (biome === 'forest') {
            if (ceiling && roll < .12) { const length = 1 + Math.floor(random() * 3); for (let h = 0; h < length && !world.get(x, y - h, z); h++) world.set(x, y - h, z, VINE); }
            else if (floor && roll > .94) world.set(x, y, z, GLOW_MUSHROOM);
        } else if (biome === 'desert') {
            if (floor && roll < .12) for (let d = 1; d <= 2; d++) if (world.solid(x, y - d, z) && y - d > 0) world.set(x, y - d, z, QUICKSAND);
        } else if (biome === 'plains') {
            if (floor && roll > .97) world.set(x, y, z, TORCH);
            // Torches fixed to the tunnel walls at head height, like an old mine.
            else if (floor && roll < .25) WALL_SIDES.forEach(([dx, dz], side) => { if (!world.get(x, y + 1, z) && world.get(x + dx, y + 1, z + dz) === 3 && random() < .3) world.set(x, y + 1, z, WALL_TORCHES[side]); });
        }
    }
    // Glowing coral trees grow on the flooded sea cave's floor, and line the lake's shore.
    if (biome === 'ocean') for (const i of carved) {
        const x = i % SIZE_X, z = Math.floor(i / SIZE_X) % SIZE_Z, y = Math.floor(i / (SIZE_X * SIZE_Z));
        if (world.get(x, y, z) !== WATER) continue;
        if (world.get(x, y - 1, z) === 3 && world.get(x, y + 1, z) === WATER && random() < .22) { world.set(x, y, z, GLOW_CORAL); continue; }
        if (y === POOL.ocean) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
            if (!world.get(x + dx, y + 1, z + dz) && world.blocking(x + dx, y, z + dz) && random() < .25) world.set(x + dx, y + 1, z + dz, GLOW_CORAL);
    }
}
// The ground under a tree spot, looking past its trunk and leaves.
function treeGround(world: World, x: number, z: number) {
    let y = SIZE_Y - 1;
    while (y > 0 && [0, 4, 5].includes(world.get(x, y, z))) y--;
    return y;
}
// A four-high trunk under a leafy crown. Leaves only fill air. Forest trees trail vines to climb.
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
    if (biomeAt(x, z) === 'forest')
        for (const [dx, dz] of [[2, 1], [-2, -1], [-1, 2], [1, -2]])
            for (let h = 2; h >= 1 && world.get(x + dx, y + 3, z + dz) === 5 && !world.get(x + dx, y + h, z + dz); h--) world.set(x + dx, y + h, z + dz, VINE);
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
// Every cube face that can be seen. With `water` set, only water's faces (true) or everything but water's (false).
export function visibleFaces(world: World, visit: (x: number, y: number, z: number, id: number, face: number) => void, water?: boolean) {
    const data = world.data;
    for (let y = 0; y < SIZE_Y; y++)
        for (let z = 0; z < SIZE_Z; z++)
            for (let x = 0; x < SIZE_X; x++) {
                const id = data[x + SIZE_X * (z + SIZE_Z * y)];
                if (!id || IS_SHAPED[id] || (water !== undefined && (id === WATER) !== water))
                    continue;
                // Solid faces show through water and windows; liquids only show where they meet air.
                for (let face = 0; face < 6; face++) {
                    const [dx, dy, dz] = FACES[face].n, nx = x + dx, ny = y + dy, nz = z + dz;
                    const next = nx < 0 || ny < 0 || nz < 0 || nx >= SIZE_X || ny >= SIZE_Y || nz >= SIZE_Z ? 0 : data[nx + SIZE_X * (nz + SIZE_Z * ny)];
                    if (IS_LIQUID[id] ? !next : !OPAQUE[next] && !(id === next && !OPAQUE[id]))
                        visit(x, y, z, id, face);
                }
            }
}
// Brightness for each light level, like Minecraft's: each step down is 75% as bright.
export const BRIGHTNESS = Array.from({ length: 16 }, (_, level) => level ? .75 ** (15 - level) : 0);
export type Light = { sky: Uint8Array; block: Uint8Array };
// Sky light (15 straight down open columns) and block light (from LIGHT emitters), each fading by one per step
// through anything see-through. ponytail: recomputes the whole world per edit; light dirty chunks only if edits stall.
export function computeLight(world: World): Light {
    const sky = new Uint8Array(world.data.length), block = new Uint8Array(world.data.length);
    for (let x = 0; x < SIZE_X; x++) for (let z = 0; z < SIZE_Z; z++)
        for (let y = SIZE_Y - 1; y >= 0 && !opaque(world.get(x, y, z)); y--) sky[x + SIZE_X * (z + SIZE_Z * y)] = 15;
    world.data.forEach((id, i) => { if (LIGHT[id]) block[i] = LIGHT[id]; });
    spread(world, sky); spread(world, block);
    return { sky, block };
}
// Bucketed flood fill from the brightest cells down, so each cell is set once, at its final level.
function spread(world: World, light: Uint8Array) {
    const buckets: number[][] = Array.from({ length: 16 }, () => []);
    light.forEach((level, i) => { if (level > 1) buckets[level].push(i); });
    const layer = SIZE_X * SIZE_Z;
    for (let level = 15; level > 1; level--) for (const i of buckets[level]) {
        const x = i % SIZE_X, z = Math.floor(i / SIZE_X) % SIZE_Z, y = Math.floor(i / layer);
        for (const j of [x > 0 ? i - 1 : -1, x < SIZE_X - 1 ? i + 1 : -1, z > 0 ? i - SIZE_X : -1, z < SIZE_Z - 1 ? i + SIZE_X : -1, y > 0 ? i - layer : -1, y < SIZE_Y - 1 ? i + layer : -1])
            if (j >= 0 && light[j] < level - 1 && !OPAQUE[world.data[j]]) { light[j] = level - 1; buckets[level - 1].push(j); }
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
