export const SIZE = 32;
export const BLOCKS = ['Air', 'Grass', 'Dirt', 'Stone', 'Wood', 'Leaves', 'Planks', 'Crafting table'] as const;
export type Vec3 = {
    x: number;
    y: number;
    z: number;
};
export const inside = (x: number, y: number, z: number) => [x, y, z].every(n => Number.isInteger(n) && n >= 0 && n < SIZE);
export class World {
    data = new Uint8Array(SIZE ** 3);
    get(x: number, y: number, z: number) { return inside(x, y, z) ? this.data[x + SIZE * (z + SIZE * y)] : 0; }
    set(x: number, y: number, z: number, id: number) {
        if (!inside(x, y, z) || !Number.isInteger(id) || id < 0 || id >= BLOCKS.length)
            return false;
        this.data[x + SIZE * (z + SIZE * y)] = id;
        return true;
    }
}
export function generateWorld() {
    const world = new World();
    for (let x = 0; x < SIZE; x++)
        for (let z = 0; z < SIZE; z++) {
            const height = Math.floor(7 + Math.sin(x * .19) * 1.8 + Math.cos(z * .22) * 1.7 + Math.sin((x + z) * .3));
            for (let y = 0; y <= height; y++)
                world.set(x, y, z, y === height ? 1 : y > height - 3 ? 2 : 3);
        }
    for (const [x, z] of [[5, 6], [11, 10], [23, 8], [26, 23], [8, 24], [19, 20]]) {
        let y = SIZE - 1;
        while (!world.get(x, y, z))
            y--;
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
    return world;
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
    for (let y = 0; y < SIZE; y++)
        for (let z = 0; z < SIZE; z++)
            for (let x = 0; x < SIZE; x++) {
                const id = world.get(x, y, z);
                if (!id)
                    continue;
                FACES.forEach(({ n }, face) => { if (!world.get(x + n[0], y + n[1], z + n[2]))
                    visit(x, y, z, id, face); });
            }
}
export const RADIUS = .3, HEIGHT = 1.8;
export function overlaps(player: Vec3, x: number, y: number, z: number) {
    return player.x + RADIUS > x && player.x - RADIUS < x + 1 && player.y + HEIGHT > y && player.y < y + 1 && player.z + RADIUS > z && player.z - RADIUS < z + 1;
}
export function canPlace(world: World, player: Vec3, x: number, y: number, z: number) {
    return inside(x, y, z) && !world.get(x, y, z) && !overlaps(player, x, y, z);
}
export function editBlock(world: World, player: Vec3, x: number, y: number, z: number, id: number) {
    if (id === 0)
        return y > 0 && !!world.get(x, y, z) && world.set(x, y, z, 0);
    return canPlace(world, player, x, y, z) && world.set(x, y, z, id);
}
