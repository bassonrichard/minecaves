import * as THREE from 'three';
import { addItem, hasRoom, type Inventory, type Stack } from './crafting.ts';
import { itemGeometry } from './items.ts';
import { blockGeometry } from './terrain.ts';
import { BLOCKS, LAVA, WATER, type Vec3, type World } from './world.ts';

// Items lying in the world, Minecraft style: they pop out, fall, bob, and wait to be picked up.
export const DESPAWN = 300, PICKUP = 1.2, MAGNET = 3;
export type DropSave = { id: number; count: number; durability: number; x: number; y: number; z: number; age: number };
type Drop = { stack: Stack; position: Vec3; vx: number; vy: number; vz: number; age: number; delay: number; mesh: THREE.Mesh };

export function createDrops(world: World, blockMaterial: THREE.Material) {
    const group = new THREE.Group();
    group.name = 'Dropped items';
    // Flat items face sideways, away from the overhead sun, so they get a little extra brightness.
    const itemMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, color: new THREE.Color(1.35, 1.35, 1.35) });
    const geometries = new Map<number, THREE.BufferGeometry>();
    const drops: Drop[] = [];
    const isBlock = (id: number) => id < BLOCKS.length;
    function geometry(id: number) {
        if (!geometries.has(id)) geometries.set(id, isBlock(id) ? blockGeometry(id) : itemGeometry(id));
        return geometries.get(id)!;
    }
    function remove(i: number) { drops[i].mesh.removeFromParent(); drops.splice(i, 1); }
    // Pops a stack out at `at`; thrown items can't be picked back up until `delay` runs out.
    function spawn(stack: Stack, at: Vec3, velocity?: Vec3, delay = 0, age = 0) {
        const mesh = new THREE.Mesh(geometry(stack.id), isBlock(stack.id) ? blockMaterial : itemMaterial);
        mesh.scale.setScalar(isBlock(stack.id) ? .25 : .4);
        mesh.name = 'Dropped item';
        mesh.position.set(at.x, at.y + .2, at.z);
        // Spin around the world's up axis while leaning back toward the sky.
        mesh.rotation.order = 'YXZ';
        if (!isBlock(stack.id)) mesh.rotation.x = -.45;
        group.add(mesh);
        const v = velocity ?? { x: (Math.random() - .5) * 2, y: 3, z: (Math.random() - .5) * 2 };
        drops.push({ stack: { ...stack }, position: { ...at }, vx: v.x, vy: v.y, vz: v.z, age, delay, mesh });
    }
    // Moves, collects, and ages every drop. Reports whether anything was picked up or left behind for lack of room.
    function update(dt: number, player: Vec3 | null, inventory: Inventory) {
        let picked = false, full = false;
        for (let i = drops.length - 1; i >= 0; i--) {
            const drop = drops[i], p = drop.position;
            drop.age += dt; drop.delay -= dt;
            if (drop.age > DESPAWN) { remove(i); continue; }
            if (player && drop.delay <= 0) {
                const dx = player.x - p.x, dy = player.y + .6 - p.y, dz = player.z - p.z, d = Math.hypot(dx, dy, dz);
                const room = hasRoom(inventory, drop.stack.id);
                if (d < PICKUP) {
                    const left = room ? addItem(inventory, drop.stack.id, drop.stack.count, drop.stack.durability) : drop.stack.count;
                    if (left < drop.stack.count) picked = true;
                    if (!left) { remove(i); continue; }
                    drop.stack.count = left; full = true;
                } else if (d < MAGNET && room) {
                    // Drift toward the player, faster the closer it gets.
                    const pull = 8 * (1 - d / MAGNET) / d;
                    drop.vx = dx * pull; drop.vz = dz * pull; drop.vy = Math.max(drop.vy, dy * pull);
                }
            }
            const cell = (x: number, y: number, z: number) => world.blocking(Math.floor(x), Math.floor(y), Math.floor(z));
            // Lava burns it up.
            if (world.get(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)) === LAVA) { remove(i); continue; }
            // Pushed up out of any block placed on top of it.
            while (cell(p.x, p.y, p.z) && p.y < 40) p.y = Math.floor(p.y) + 1;
            if (world.get(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)) === WATER) drop.vy = Math.min(1, drop.vy + 30 * dt); // floats
            else drop.vy -= 20 * dt;
            if (cell(p.x + drop.vx * dt, p.y, p.z)) drop.vx *= -.3; else p.x += drop.vx * dt;
            if (cell(p.x, p.y, p.z + drop.vz * dt)) drop.vz *= -.3; else p.z += drop.vz * dt;
            const y = p.y + drop.vy * dt;
            if (drop.vy < 0 && cell(p.x, y, p.z)) {
                p.y = Math.floor(y) + 1; drop.vy = 0; drop.vx *= .6; drop.vz *= .6;
            } else p.y = y;
            drop.mesh.position.set(p.x, p.y + .2 + Math.sin(drop.age * 3) * .06, p.z);
            drop.mesh.rotation.y = drop.age * 1.6;
        }
        return { picked, full };
    }
    return {
        group,
        spawn,
        update,
        get count() { return drops.length; },
        snapshot: (): DropSave[] => drops.map(({ stack, position, age }) => ({ ...stack, ...position, age })),
        restore(saved: DropSave[]) { for (const d of saved) spawn({ id: d.id, count: d.count, durability: d.durability }, d, { x: 0, y: 0, z: 0 }, 0, d.age); },
        dispose() { group.removeFromParent(); geometries.forEach(g => g.dispose()); itemMaterial.dispose(); },
    };
}
