import * as THREE from 'three';
import { CHICKEN_MEAT, FEATHER, MUTTON, WOOL, type Stack } from './crafting.ts';
import { BIOME_SIZE, CACTUS, SEA_LEVEL, SIZE_X, SIZE_Y, SIZE_Z, WATER, biomeAt, biomeOrigin, type Biome, type World } from './world.ts';

// Chickens, geckos, and Garry keep their original slots (0–7) so saved defeats line up; new animals go at the end.
const SPECS: { kind: string; biome: Biome; radius: number; height: number; speed: number; starts: number[][] }[] = [
    { kind: 'chicken', biome: 'plains', radius: .56, height: 1.3, speed: .55, starts: [[43, 43], [54, 44], [44, 54], [56, 56]] },
    { kind: 'gecko', biome: 'desert', radius: .48, height: 1.15, speed: .7, starts: [[74, 42], [84, 50], [78, 58]] },
    { kind: 'snake', biome: 'forest', radius: .86, height: .5, speed: .35, starts: [[80, 12]] },
    { kind: 'cat', biome: 'plains', radius: .5, height: .9, speed: .6, starts: [[50, 38]] },
    { kind: 'fish', biome: 'ocean', radius: .3, height: .4, speed: .9, starts: [[8, 42], [14, 52], [6, 58]] },
    // Sheep check only the cell under their middle, so they can hop from one terrace of the slope to the next.
    { kind: 'sheep', biome: 'mountain', radius: .05, height: 1.1, speed: .45, starts: [[36, 27], [59, 5], [58, 27]] },
];
// What each huntable animal drops: [item, fewest, most]. Everything else is friendly and can't be hurt.
const LOOT: Record<string, [number, number, number][]> = {
    chicken: [[FEATHER, 1, 2], [CHICKEN_MEAT, 1, 2]],
    sheep: [[WOOL, 1, 2], [MUTTON, 1, 2]],
};
// Fish cruise one block under the surface.
const FISH_Y = SEA_LEVEL - .6;

// A tiny local terrain check is enough for a dozen animals in this bounded world.
export function animalGround(world: World, x: number, z: number, radius: number, height: number) {
    if (x - radius < 0 || z - radius < 0 || x + radius > SIZE_X || z + radius > SIZE_Z) return null;
    let highest = 0, lowest = SIZE_Y;
    for (let ix = Math.floor(x - radius); ix <= Math.floor(x + radius - 1e-6); ix++) {
        for (let iz = Math.floor(z - radius); iz <= Math.floor(z + radius - 1e-6); iz++) {
            let y = SIZE_Y - 1;
            while (y >= 0 && !world.get(ix, y, iz)) y--;
            // Land animals avoid treetops, water, and cacti.
            if (y < 0 || y + 1 + height > SIZE_Y || [5, WATER, CACTUS].includes(world.get(ix, y, iz))) return null;
            highest = Math.max(highest, y + 1);
            lowest = Math.min(lowest, y + 1);
        }
    }
    return highest !== lowest ? null : highest;
}

export function createAnimals(world: World) {
    const group = new THREE.Group();
    group.name = 'Friendly wildlife';
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const colors = ['#fff3d6', '#e3d5b2', '#edb743', '#dc6355', '#263e30', '#a7cf77', '#7eaf63', '#f3d7a6', '#ec9d9e', '#7cc47a', '#cfe8b0', '#5aa866', '#6b2a3a', '#2f5a36', '#e59a4a', '#b8692c', '#f7e3c4', '#6fbf4a', '#ff9f40', '#4aa3df', '#f1eee6', '#6e6a64', '#dcd8cf'];
    const materials = colors.map(color => new THREE.MeshLambertMaterial({ color }));
    function box(parent: THREE.Group, color: number, x: number, y: number, z: number, w: number, h: number, d: number) {
        const mesh = new THREE.Mesh(geometry, materials[color]);
        mesh.position.set(x, y, z); mesh.scale.set(w, h, d); parent.add(mesh);
        return mesh;
    }
    function chicken() {
        const root = new THREE.Group(); root.name = 'Chicken';
        box(root, 0, 0, .53, 0, .5, .5, .65);
        const wings = [-1, 1].map(side => box(root, 1, side * .28, .53, -.02, .12, .32, .44));
        const legs = [-1, 1].map(side => {
            const leg = new THREE.Group(); leg.position.set(side * .14, .27, 0); root.add(leg);
            box(leg, 2, 0, -.1, 0, .055, .22, .055);
            box(leg, 2, 0, -.24, .055, .12, .05, .2);
            return leg;
        });
        const head = new THREE.Group(); head.position.set(0, .78, .22); root.add(head);
        box(head, 0, 0, .13, .02, .35, .37, .35);
        box(head, 2, 0, .1, .24, .2, .11, .17);
        box(head, 3, 0, -.015, .2, .09, .14, .07);
        box(head, 3, 0, .37, 0, .07, .13, .24);
        for (const side of [-1, 1]) {
            box(head, 4, side * .18, .2, .105, .025, .065, .065);
            box(head, 0, side * .194, .22, .12, .012, .019, .019);
        }
        const tail = box(root, 1, 0, .65, -.39, .26, .3, .15); tail.rotation.x = -.4;
        return { root, legs, wings, head };
    }
    function snake() {
        const root = new THREE.Group(); root.name = 'Garry Da Snake';
        const segments = Array.from({ length: 6 }, (_, i) => {
            const segment = new THREE.Group(); segment.position.z = .22 - i * .18; root.add(segment);
            const size = .3 - i * .032;
            box(segment, i % 2 ? 6 : 5, 0, .13, 0, size, size * .7, .25);
            box(segment, 7, 0, .055, 0, size * .85, .045, .23);
            return segment;
        });
        const head = new THREE.Group(); head.position.set(0, .19, .42); root.add(head);
        box(head, 5, 0, .03, 0, .42, .28, .38);
        box(head, 7, 0, -.085, .02, .36, .065, .35);
        for (const side of [-1, 1]) {
            box(head, 0, side * .14, .2, .065, .14, .14, .12);
            box(head, 4, side * .14, .2, .13, .075, .09, .025);
            box(head, 0, side * .14 - .018, .22, .145, .025, .025, .015);
            box(head, 8, side * .19, -.015, .14, .045, .05, .065);
        }
        const tongue = box(head, 8, 0, -.055, .27, .04, .025, .19);
        return { root, segments, head, tongue };
    }
    function gecko() {
        const root = new THREE.Group(); root.name = 'Gecko';
        // Upright cartoon gecko: tall mint body, pale belly, bug eyes on top, curling tail.
        const body = box(root, 9, 0, .4, 0, .34, .5, .3); body.rotation.x = -.12;
        const belly = box(root, 10, 0, .38, .15, .26, .42, .03); belly.rotation.x = -.12;
        const legs = [-1, 1].map(side => {
            const leg = new THREE.Group(); leg.position.set(side * .13, .2, -.02); root.add(leg);
            box(leg, 9, side * .02, -.08, 0, .12, .2, .14);
            box(leg, 9, side * .03, -.18, .05, .16, .04, .16);
            for (const toe of [-1, 0, 1]) box(leg, 9, side * .03 + toe * .055, -.185, .15, .04, .03, .06);
            return leg;
        });
        const arms = [-1, 1].map(side => {
            const arm = new THREE.Group(); arm.position.set(side * .18, .55, .06); root.add(arm);
            const limb = box(arm, 9, side * .09, -.05, .02, .18, .055, .055); limb.rotation.z = side * -.5;
            for (const finger of [-1, 0, 1]) {
                const f = box(arm, 9, side * (.2 + Math.abs(finger) * -.01), -.1 + finger * .035, .03, .06, .025, .025);
                f.rotation.z = side * finger * -.6;
            }
            return arm;
        });
        const tail = new THREE.Group(); tail.position.set(0, .16, -.14); root.add(tail);
        for (const [y, z, size, tilt] of [[0, -.1, .22, 0], [-.05, -.3, .18, 0], [-.07, -.5, .14, 0], [-.06, -.68, .11, .3], [.02, -.83, .09, .8], [.14, -.9, .07, 1.3], [.26, -.88, .055, 1.8]] as const)
            box(tail, 11, 0, y, z, size, size * .8, .22).rotation.x = tilt;
        const neck = box(root, 9, 0, .72, .04, .26, .22, .24); neck.rotation.x = .1;
        box(root, 10, 0, .7, .15, .2, .2, .03);
        const head = new THREE.Group(); head.position.set(0, .82, .06); root.add(head);
        box(head, 9, 0, .08, .1, .34, .2, .38);
        box(head, 10, 0, -.03, .11, .3, .05, .34);
        box(head, 12, 0, .02, .29, .26, .025, .02);
        for (const side of [-1, 1]) box(head, 12, side * .15, .04, .27, .03, .06, .02);
        const eyes: THREE.Mesh[] = [];
        for (const side of [-1, 1]) {
            box(head, 13, side * .04, .16, .31, .02, .015, .01);
            const eye = box(head, 0, side * .1, .23, .08, .15, .15, .14);
            eye.name = 'Gecko eye';
            const pupil = box(head, 4, side * .085, .225, .155, .075, .085, .02);
            pupil.name = 'Gecko pupil';
            eyes.push(pupil);
        }
        return { root, legs, arms, tail, head, eyes };
    }
    function cat() {
        const root = new THREE.Group(); root.name = 'Cat';
        box(root, 14, 0, .36, 0, .3, .26, .6);
        for (const z of [-.12, .06]) box(root, 15, 0, .495, z, .31, .03, .08);
        box(root, 16, 0, .23, .05, .2, .03, .4);
        const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => {
            const leg = new THREE.Group(); leg.position.set(sx * .09, .24, sz * .2); root.add(leg);
            box(leg, 14, 0, -.12, 0, .08, .24, .08);
            box(leg, 16, 0, -.225, .01, .085, .03, .09);
            return leg;
        });
        const head = new THREE.Group(); head.position.set(0, .55, .33); root.add(head);
        box(head, 14, 0, 0, 0, .3, .26, .26);
        box(head, 16, 0, -.06, .14, .14, .1, .04);
        box(head, 8, 0, -.02, .165, .04, .03, .02);
        for (const side of [-1, 1]) {
            box(head, 14, side * .1, .17, -.02, .07, .1, .06);
            box(head, 8, side * .1, .16, .015, .035, .06, .01);
            box(head, 17, side * .075, .04, .135, .06, .05, .01);
            box(head, 4, side * .075, .04, .141, .02, .05, .01);
        }
        const tail = new THREE.Group(); tail.position.set(0, .45, -.3); root.add(tail);
        box(tail, 14, 0, .12, -.04, .06, .26, .06).rotation.x = -.3;
        box(tail, 15, 0, .26, -.08, .065, .07, .065);
        return { root, legs, head, tail };
    }
    function sheep() {
        const root = new THREE.Group(); root.name = 'Sheep';
        box(root, 20, 0, .62, 0, .56, .46, .8);
        box(root, 22, 0, .87, -.05, .46, .06, .6);
        const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => {
            const leg = new THREE.Group(); leg.position.set(sx * .17, .4, sz * .26); root.add(leg);
            box(leg, 21, 0, -.2, 0, .12, .4, .12);
            return leg;
        });
        const head = new THREE.Group(); head.position.set(0, .8, .42); root.add(head);
        box(head, 21, 0, 0, .1, .28, .3, .3);
        box(head, 20, 0, .17, .06, .32, .1, .26);
        for (const side of [-1, 1]) {
            box(head, 21, side * .18, .05, .04, .1, .05, .08);
            box(head, 0, side * .1, .05, .255, .06, .05, .01);
            box(head, 4, side * .1, .05, .26, .03, .05, .01);
        }
        return { root, legs, head };
    }
    function fish(color: number) {
        const root = new THREE.Group(); root.name = 'Fish';
        box(root, color, 0, 0, 0, .12, .2, .34);
        box(root, 0, 0, -.06, .03, .1, .07, .24);
        box(root, color, 0, .13, -.02, .02, .07, .14);
        for (const side of [-1, 1]) {
            box(root, 0, side * .061, .04, .1, .01, .05, .05);
            box(root, 4, side * .066, .04, .105, .01, .025, .025);
        }
        const tail = new THREE.Group(); tail.position.z = -.17; root.add(tail);
        box(tail, color, 0, 0, -.07, .03, .2, .14);
        return { root, tail };
    }
    // Nearest clear patch to (sx, sz) inside the animal's own biome; never in trees, water, or blocks.
    function settle(root: THREE.Group, spec: typeof SPECS[number], sx: number, sz: number) {
        const origin = biomeOrigin(spec.biome);
        let best = Infinity;
        for (let x = origin.x + 1; x < origin.x + BIOME_SIZE - 1; x += .5) for (let z = origin.z + 1; z < origin.z + BIOME_SIZE - 1; z += .5) {
            const y = spec.kind === 'fish' ? (swimmable(x, z) ? FISH_Y : null) : animalGround(world, x, z, spec.radius, spec.height);
            const distance = (x - sx) ** 2 + (z - sz) ** 2;
            if (y !== null && distance < best) { root.position.set(x, y, z); best = distance; }
        }
        root.visible = best < Infinity;
    }
    // Two blocks of water under the surface at this spot.
    const swimmable = (x: number, z: number) => world.get(Math.floor(x), SEA_LEVEL, Math.floor(z)) === WATER && world.get(Math.floor(x), SEA_LEVEL - 1, Math.floor(z)) === WATER;
    const birds: ReturnType<typeof chicken>[] = [], geckos: ReturnType<typeof gecko>[] = [], cats: ReturnType<typeof cat>[] = [], fishes: ReturnType<typeof fish>[] = [], flock: ReturnType<typeof sheep>[] = [];
    let noodle: ReturnType<typeof snake> | null = null;
    const animals = SPECS.flatMap(spec => spec.starts.map(([sx, sz], n) => {
        let root: THREE.Group;
        if (spec.kind === 'chicken') root = birds[birds.push(chicken()) - 1].root;
        else if (spec.kind === 'gecko') root = geckos[geckos.push(gecko()) - 1].root;
        else if (spec.kind === 'cat') root = cats[cats.push(cat()) - 1].root;
        else if (spec.kind === 'fish') root = fishes[fishes.push(fish(n % 2 ? 19 : 18)) - 1].root;
        else if (spec.kind === 'sheep') root = flock[flock.push(sheep()) - 1].root;
        else root = (noodle = snake()).root;
        return { root, spec, part: n, sx, sz };
    })).map(({ root, spec, part, sx, sz }, i) => {
        settle(root, spec, sx, sz);
        root.rotation.y = i * 1.6 + 1;
        Object.assign(root.userData, { animal: spec.kind, radius: spec.radius, height: spec.height });
        group.add(root);
        return { root, spec, part, sx, sz, timer: .6 + i * .3, turns: i, idle: false, health: LOOT[spec.kind] ? 3 : Infinity };
    });
    let time = 0;
    return {
        group,
        update(dt: number) {
            time += dt;
            animals.forEach((animal, i) => {
                const { root, spec } = animal;
                if (!root.visible) return;
                const fishy = spec.kind === 'fish';
                const ground = fishy ? (swimmable(root.position.x, root.position.z) ? FISH_Y : null) : animalGround(world, root.position.x, root.position.z, spec.radius, spec.height);
                if (ground === null) {
                    // A player may build into, dig away, or fill in an animal's patch.
                    settle(root, spec, root.position.x, root.position.z);
                    return;
                }
                root.position.y = ground;
                animal.timer -= dt;
                if (animal.timer <= 0) {
                    animal.turns++;
                    root.rotation.y += Math.sin(animal.turns * 2.4 + i) * 1.5;
                    animal.idle = animal.turns % 3 === 0;
                    animal.timer = animal.idle ? 1.5 : 2.5;
                }
                if (!animal.idle) {
                    const x = root.position.x + Math.sin(root.rotation.y) * spec.speed * dt;
                    const z = root.position.z + Math.cos(root.rotation.y) * spec.speed * dt;
                    // Fish look a little ahead so their noses stay in the water.
                    const y = biomeAt(x, z) !== spec.biome ? null : fishy
                        ? (swimmable(x + Math.sin(root.rotation.y) * .3, z + Math.cos(root.rotation.y) * .3) ? FISH_Y : null)
                        : animalGround(world, x, z, spec.radius, spec.height);
                    // ponytail: wander on clear level patches inside the home biome; add pathfinding if animals need destinations.
                    // Sheep live on the mountain's slopes, so they hop up and down single blocks.
                    if (y !== null && Math.abs(y - root.position.y) < (spec.kind === 'sheep' ? 1.01 : .01)) root.position.set(x, y, z);
                    else { root.rotation.y += 1.2; animal.timer = .5; }
                }
                const stride = animal.idle ? 0 : Math.sin(time * 10 + i) * .45;
                if (spec.kind === 'chicken') {
                    const bird = birds[animal.part], step = animal.idle ? 0 : Math.sin(time * 11 + i) * .35;
                    bird.legs[0].rotation.x = step; bird.legs[1].rotation.x = -step;
                    bird.head.rotation.x = animal.idle ? Math.max(0, Math.sin(time * 5 + i)) * .65 : 0;
                    bird.wings.forEach((wing, side) => { wing.rotation.z = Math.sin(time * 3 + i) * .06 * (side ? 1 : -1); });
                } else if (spec.kind === 'snake' && noodle) {
                    noodle.segments.forEach((segment, j) => { segment.position.x = Math.sin(time * 5 - j * .65) * .09; });
                    noodle.head.rotation.y = Math.sin(time * 2) * .13;
                    noodle.tongue.visible = Math.sin(time * 2.5) > .8;
                } else if (spec.kind === 'gecko') {
                    const gecko = geckos[animal.part];
                    gecko.legs.forEach((leg, j) => { leg.rotation.x = (j ? -1 : 1) * stride; });
                    gecko.arms.forEach((arm, j) => { arm.rotation.x = (j ? 1 : -1) * stride * .6; });
                    gecko.tail.rotation.y = Math.sin(time * (animal.idle ? 2 : 6) + i) * .25;
                    gecko.head.rotation.z = animal.idle ? Math.sin(time * 3 + i) * .15 : 0;
                } else if (spec.kind === 'sheep') {
                    const lamb = flock[animal.part];
                    lamb.legs.forEach((leg, j) => { leg.rotation.x = (j === 0 || j === 3 ? 1 : -1) * stride; });
                    lamb.head.rotation.x = animal.idle ? Math.max(0, Math.sin(time * 1.5 + i)) * .7 : 0;
                } else if (spec.kind === 'cat') {
                    const kitty = cats[animal.part];
                    kitty.legs.forEach((leg, j) => { leg.rotation.x = (j === 0 || j === 3 ? 1 : -1) * stride; });
                    kitty.tail.rotation.z = Math.sin(time * (animal.idle ? 1.5 : 4) + i) * .35;
                    kitty.head.rotation.y = animal.idle ? Math.sin(time * 1.2 + i) * .4 : 0;
                } else {
                    fishes[animal.part].tail.rotation.y = Math.sin(time * (animal.idle ? 4 : 12) + i) * .5;
                    root.position.y = FISH_Y + Math.sin(time * 1.5 + i) * .08;
                }
            });
        },
        // Hits a huntable animal. Returns its loot once it's defeated, or null for friendly ones.
        damage(target: THREE.Object3D, amount = 1): { dead: boolean; drops: Stack[] } | null {
            const animal = animals.find(candidate => candidate.root.getObjectById(target.id));
            const loot = animal && LOOT[animal.spec.kind];
            if (!animal || !loot) return null;
            animal.health -= amount;
            animal.root.position.y += .12;
            if (animal.health > 0) return { dead: false, drops: [] };
            animal.root.visible = false;
            return { dead: true, drops: loot.map(([id, min, max]) => ({ id, count: min + Math.floor(Math.random() * (max - min + 1)), durability: 0 })) };
        },
        // Dawn: everyone comes back to their starting spot, healed; defeated animals return too.
        respawn() {
            animals.forEach(animal => {
                animal.health = LOOT[animal.spec.kind] ? 3 : Infinity;
                settle(animal.root, animal.spec, animal.sx, animal.sz);
            });
        },
        dispose() { group.removeFromParent(); geometry.dispose(); materials.forEach(material => material.dispose()); },
    };
}
