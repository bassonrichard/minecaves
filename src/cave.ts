import * as THREE from 'three';
import { BIOMES, BIOME_SIZE, GROUND, LAVA, QUICKSAND, WATER, biomeAt, biomeOrigin, blocking, type Vec3, type World } from './world.ts';

// Cave dwellers: bats flutter about harmlessly; spiders and cave snakes hunt you when you come close.
// Unlike Garry, cave snakes bite. Each biome's cave gets two bats, a spider, and a snake where there's room.
type Kind = 'bat' | 'spider' | 'snake';
const SPECS: Record<Kind, { name: string; health: number; speed: number }> = {
    bat: { name: 'Bat', health: 5, speed: 2.4 },
    spider: { name: 'Spider', health: 18, speed: 2.1 },
    snake: { name: 'Cave snake', health: 14, speed: 1.5 },
};
export const CAVE_SIGHT = 8, BITE_RANGE = 1.1, BITE_COOLDOWN = 1.2;
const COUNTS: [Kind, number][] = [['bat', 2], ['spider', 1], ['snake', 1]];

// A cell a body can be in: not solid, not liquid, not quicksand.
const open = (world: World, x: number, y: number, z: number) => { const id = world.get(x, y, z); return !blocking(id) && id !== WATER && id !== LAVA && id !== QUICKSAND; };
// Where crawlers may stand: underground, on something solid.
const walkable = (world: World, x: number, y: number, z: number) => y > 0 && y < GROUND && world.blocking(x, y - 1, z) && open(world, x, y, z);

export function createCaveCreatures(world: World) {
    const group = new THREE.Group();
    group.name = 'Cave creatures';
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const materials: { material: THREE.MeshLambertMaterial; base: THREE.Color; owner: THREE.Group }[] = [];
    const glows: THREE.MeshBasicMaterial[] = [];
    // Lit materials are per creature, so each one can be as dark as the spot it's in; eyes glow on their own.
    function box(root: THREE.Group, parent: THREE.Object3D, color: string, x: number, y: number, z: number, w: number, h: number, d: number, glow = false) {
        let material: THREE.Material;
        if (glow) glows.push((material = new THREE.MeshBasicMaterial({ color })) as THREE.MeshBasicMaterial);
        else { const lit = new THREE.MeshLambertMaterial({ color }); materials.push({ material: lit, base: new THREE.Color(color), owner: root }); material = lit; }
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z); mesh.scale.set(w, h, d); parent.add(mesh);
        return mesh;
    }
    function bat() {
        const root = new THREE.Group();
        box(root, root, '#3b2f2a', 0, 0, 0, .2, .2, .26);
        const head = new THREE.Group(); head.position.set(0, .04, .16); root.add(head);
        box(root, head, '#4a3a33', 0, 0, 0, .16, .15, .14);
        for (const side of [-1, 1]) {
            box(root, head, '#2a211d', side * .05, .11, -.02, .04, .08, .03);
            box(root, head, '#ff6a5a', side * .04, .02, .075, .03, .03, .01, true);
        }
        const wings = [-1, 1].map(side => {
            const wing = new THREE.Group(); wing.position.set(side * .1, .03, 0); root.add(wing);
            box(root, wing, '#2a211d', side * .2, 0, 0, .4, .025, .24);
            box(root, wing, '#1c1614', side * .38, -.02, -.06, .06, .03, .12);
            return wing;
        });
        return { root, wings, legs: [] as THREE.Group[], segments: [] as THREE.Group[], head: null as THREE.Group | null };
    }
    function spider() {
        const root = new THREE.Group();
        // A round abdomen with a pale back mark, a smaller head with four red eyes, and eight jointed legs.
        box(root, root, '#4a3d38', 0, .34, -.22, .5, .38, .55);
        box(root, root, '#7a6457', 0, .535, -.24, .22, .02, .28);
        box(root, root, '#3d322e', 0, .3, .17, .34, .26, .3);
        box(root, root, '#2a221f', 0, .22, .33, .2, .06, .04);
        for (const [x, y] of [[-.08, .37], [.08, .37], [-.13, .31], [.13, .31]]) box(root, root, '#ff2a2a', x, y, .325, .06, .06, .02, true);
        const legs = [-1, 1].flatMap(side => [.2, .06, -.1, -.26].map((z, i) => {
            // Each leg rises from the body to a high knee, then reaches down and out to the ground.
            const leg = new THREE.Group(); leg.position.set(side * .16, .32, z); leg.rotation.y = side * (i - 1.5) * .35; root.add(leg);
            box(root, leg, '#332926', side * .14, .09, 0, .32, .05, .05).rotation.z = side * .55;
            box(root, leg, '#2a2220', side * .4, -.08, 0, .05, .48, .05).rotation.z = side * .35;
            return leg;
        }));
        return { root, wings: [] as THREE.Group[], legs, segments: [] as THREE.Group[], head: null as THREE.Group | null };
    }
    function snake() {
        // Garry's shape in cave colours: pale violet scales, glowing yellow eyes, and fangs.
        const root = new THREE.Group();
        const segments = Array.from({ length: 6 }, (_, i) => {
            const segment = new THREE.Group(); segment.position.z = .22 - i * .18; root.add(segment);
            const size = .3 - i * .032;
            box(root, segment, i % 2 ? '#7a5fa0' : '#5b4a78', 0, .13, 0, size, size * .7, .25);
            box(root, segment, '#c9b8e0', 0, .055, 0, size * .85, .045, .23);
            return segment;
        });
        const head = new THREE.Group(); head.position.set(0, .19, .42); root.add(head);
        box(root, head, '#5b4a78', 0, .03, 0, .4, .24, .38);
        box(root, head, '#443660', 0, .15, .02, .42, .05, .3);
        for (const side of [-1, 1]) {
            box(root, head, '#ffe14a', side * .13, .09, .17, .08, .05, .04, true);
            box(root, head, '#f4f1e8', side * .07, -.12, .15, .03, .08, .03);
        }
        return { root, wings: [] as THREE.Group[], legs: [] as THREE.Group[], segments, head: head as THREE.Group | null };
    }
    // Spawn spots, picked the same way every time from each biome's open cave cells.
    const creatures = BIOMES.flatMap((biome, index) => {
        let seed = 7717 + index * 131;
        const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
        const o = biomeOrigin(biome), floor: Vec3[] = [], air: Vec3[] = [];
        for (let x = o.x; x < o.x + BIOME_SIZE; x++) for (let z = o.z; z < o.z + BIOME_SIZE; z++) for (let y = 2; y < GROUND - 2; y++) {
            if (walkable(world, x, y, z) && open(world, x, y + 1, z)) floor.push({ x: x + .5, y, z: z + .5 });
            if (!world.get(x, y, z) && !world.get(x, y + 1, z) && !world.get(x, y - 1, z)) air.push({ x: x + .5, y: y + .5, z: z + .5 });
        }
        return COUNTS.flatMap(([kind, count]) => Array.from({ length: count }, () => {
            const spots = kind === 'bat' ? air : floor;
            if (!spots.length) return [];
            const home = spots[Math.floor(random() * spots.length)], body = kind === 'bat' ? bat() : kind === 'spider' ? spider() : snake();
            body.root.name = SPECS[kind].name;
            body.root.position.set(home.x, home.y, home.z);
            group.add(body.root);
            return [{ kind, biome, home, ...body, health: SPECS[kind].health, yaw: random() * Math.PI * 2, climb: 0, timer: 0, cooldown: 0, time: random() * 10 }];
        }).flat());
    });
    type Creature = typeof creatures[number];
    // Crawling into the next column: level, one block up, or down a drop of up to two. Never out of its biome's cave.
    function stepInto(creature: Creature, nx: number, nz: number) {
        const x = Math.floor(nx), z = Math.floor(nz), y = Math.floor(creature.root.position.y + .01);
        if (biomeAt(nx, nz) !== creature.biome) return null;
        for (const ny of [y, y + 1, y - 1, y - 2]) if (walkable(world, x, ny, z) && (ny <= y || open(world, Math.floor(creature.root.position.x), ny, Math.floor(creature.root.position.z)))) return ny;
        return null;
    }
    function wander(creature: Creature, dt: number) {
        creature.timer -= dt;
        if (creature.timer <= 0) { creature.yaw += (Math.random() - .5) * 2.4; creature.climb = (Math.random() - .5) * .6; creature.timer = 1 + Math.random() * 1.5; }
    }
    return {
        group,
        // Moves everyone. Returns the bites landed on the player this frame.
        update(dt: number, player: Vec3) {
            const bites: { damage: number; from: Vec3; name: string }[] = [];
            for (const creature of creatures) {
                const { root, kind } = creature, p = root.position;
                if (!root.visible) continue;
                creature.time += dt; creature.cooldown -= dt;
                const speed = SPECS[kind].speed;
                if (kind === 'bat') {
                    wander(creature, dt);
                    const nx = p.x + Math.sin(creature.yaw) * speed * dt, ny = p.y + creature.climb * dt, nz = p.z + Math.cos(creature.yaw) * speed * dt;
                    // Bats keep to open cave air, turning away from walls.
                    if (world.get(Math.floor(nx), Math.floor(ny), Math.floor(nz)) || ny >= GROUND - 1 || biomeAt(nx, nz) !== creature.biome) { creature.yaw += Math.PI * (.5 + Math.random()); creature.climb *= -1; }
                    else p.set(nx, ny, nz);
                    creature.wings.forEach((wing, side) => { wing.rotation.z = Math.sin(creature.time * 22) * .9 * (side ? 1 : -1); });
                    root.rotation.y = creature.yaw;
                    continue;
                }
                const dx = player.x - p.x, dz = player.z - p.z, distance = Math.hypot(dx, dz), dy = player.y - p.y;
                const hunting = distance < CAVE_SIGHT && Math.abs(dy) < 3;
                if (hunting) creature.yaw = Math.atan2(dx, dz); else wander(creature, dt);
                if (hunting && distance < BITE_RANGE && Math.abs(dy) < 1.5) {
                    if (creature.cooldown <= 0) { creature.cooldown = BITE_COOLDOWN; bites.push({ damage: 1, from: { x: p.x, y: p.y, z: p.z }, name: SPECS[kind].name }); }
                } else {
                    const nx = p.x + Math.sin(creature.yaw) * speed * (hunting ? 1 : .5) * dt, nz = p.z + Math.cos(creature.yaw) * speed * (hunting ? 1 : .5) * dt;
                    const ny = stepInto(creature, nx, nz);
                    if (ny === null) { if (!hunting) { creature.yaw += 1.5 + Math.random(); creature.timer = .5; } }
                    else p.set(nx, ny, nz);
                }
                root.rotation.y = creature.yaw;
                // A lunge while the bite lands; legs scurry and bodies wiggle as they move.
                const lunge = Math.max(0, creature.cooldown - BITE_COOLDOWN + .25) * 4;
                if (kind === 'spider') creature.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(creature.time * 18 + i * 1.3) * .35; leg.position.y = .3 + lunge * .08; });
                else {
                    creature.segments.forEach((segment, j) => { segment.position.x = Math.sin(creature.time * 7 - j * .65) * .09; });
                    if (creature.head) creature.head.position.z = .42 + lunge * .25;
                }
            }
            return bites;
        },
        // Lights each creature like the terrain where it is: `lit` scales sunlight and moonlight, `glow` is nearby block light.
        shade(light: (at: Vec3) => { lit: number; glow: THREE.Color }) {
            const levels = new Map<THREE.Group, { lit: number; glow: THREE.Color }>();
            for (const { material, base, owner } of materials) {
                if (!levels.has(owner)) levels.set(owner, light(owner.position));
                const { lit, glow } = levels.get(owner)!;
                material.color.copy(base).multiplyScalar(lit);
                material.emissive.copy(base).multiply(glow);
            }
        },
        // Hits the creature `target` belongs to, knocking it back from `from`. Null when it's not a cave creature.
        hit(target: THREE.Object3D, amount: number, from: Vec3) {
            const creature = creatures.find(candidate => candidate.root.getObjectById(target.id));
            if (!creature || !creature.root.visible) return null;
            creature.health -= amount;
            const p = creature.root.position, dx = p.x - from.x, dz = p.z - from.z, d = Math.hypot(dx, dz) || 1;
            const back = stepInto(creature, p.x + dx / d * .6, p.z + dz / d * .6);
            if (creature.kind !== 'bat' && back !== null) p.set(p.x + dx / d * .6, back, p.z + dz / d * .6);
            if (creature.health <= 0) creature.root.visible = false;
            return { name: SPECS[creature.kind].name, dead: creature.health <= 0 };
        },
        // Dawn: everyone is back home, healed.
        respawn() {
            for (const creature of creatures) {
                creature.health = SPECS[creature.kind].health;
                creature.root.position.set(creature.home.x, creature.home.y, creature.home.z);
                creature.root.visible = true;
            }
        },
        creatures,
        dispose() {
            group.removeFromParent(); geometry.dispose();
            materials.forEach(({ material }) => material.dispose()); glows.forEach(material => material.dispose());
        },
    };
}
