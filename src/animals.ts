import * as THREE from 'three';
import { SIZE, type World } from './world.ts';

// A tiny local terrain check is enough for five animals in this bounded world.
export function animalGround(world: World, x: number, z: number, radius: number, height: number) {
    if (x - radius < 0 || z - radius < 0 || x + radius > SIZE || z + radius > SIZE) return null;
    let highest = 0, lowest = SIZE;
    for (let ix = Math.floor(x - radius); ix <= Math.floor(x + radius - 1e-6); ix++) {
        for (let iz = Math.floor(z - radius); iz <= Math.floor(z + radius - 1e-6); iz++) {
            let y = SIZE - 1;
            while (y >= 0 && !world.get(ix, y, iz)) y--;
            if (y < 0 || y + 1 + height > SIZE || world.get(ix, y, iz) === 5) return null;
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
    const colors = ['#fff3d6', '#e3d5b2', '#edb743', '#dc6355', '#263e30', '#a7cf77', '#7eaf63', '#f3d7a6', '#ec9d9e', '#7cc47a', '#cfe8b0', '#5aa866', '#6b2a3a', '#2f5a36'];
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
    function settle(root: THREE.Group, radius: number, height: number, sx: number, sz: number) {
        let best = Infinity;
        for (let x = 1; x < SIZE - 1; x += .5) for (let z = 1; z < SIZE - 1; z += .5) {
            const y = animalGround(world, x, z, radius, height);
            const distance = (x - sx) ** 2 + (z - sz) ** 2;
            if (y !== null && distance < best) { root.position.set(x, y, z); best = distance; }
        }
        root.visible = best < Infinity;
    }
    const birds = Array.from({ length: 4 }, chicken);
    const geckos = Array.from({ length: 3 }, gecko);
    const noodle = snake();
    const roots = [...birds.map(bird => bird.root), ...geckos.map(gecko => gecko.root), noodle.root];
    const starts = [[15.5, 24.5], [22.5, 26.5], [12.5, 22.5], [24.5, 17.5], [8, 21], [18, 16], [26, 25], [21, 25]];
    const animals = roots.map((root, i) => {
        const radius = i >= 7 ? .86 : i >= 4 ? .48 : .56, height = i >= 7 ? .5 : i >= 4 ? 1.15 : 1.3;
        const [sx, sz] = starts[i];
        // Find a clear patch near the chosen spawn; never spawn in trees or blocks.
        settle(root, radius, height, sx, sz);
        root.rotation.y = i * 1.6 + 1;
        root.userData.animal = i < birds.length ? 'chicken' : i >= 7 ? 'snake' : 'gecko';
        group.add(root);
        return { root, radius, height, timer: .6 + i * .3, turns: i, idle: false, health: i < birds.length ? 3 : Infinity };
    });
    let time = 0;
    return {
        group,
        update(dt: number) {
            time += dt;
            animals.forEach((animal, i) => {
                const { root, radius, height } = animal;
                if (!root.visible) return;
                const ground = animalGround(world, root.position.x, root.position.z, radius, height);
                if (ground === null) {
                    // A player may build into or dig away an animal's patch.
                    settle(root, radius, height, root.position.x, root.position.z);
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
                    const speed = i >= 7 ? .35 : i >= 4 ? .7 : .55;
                    const x = root.position.x + Math.sin(root.rotation.y) * speed * dt;
                    const z = root.position.z + Math.cos(root.rotation.y) * speed * dt;
                    const y = animalGround(world, x, z, radius, height);
                    // ponytail: wander on clear level patches; add pathfinding if animals need destinations.
                    if (y !== null && Math.abs(y - root.position.y) < .01) root.position.set(x, y, z);
                    else { root.rotation.y += 1.2; animal.timer = .5; }
                }
                if (i < birds.length) {
                    const bird = birds[i], stride = animal.idle ? 0 : Math.sin(time * 11 + i) * .35;
                    bird.legs[0].rotation.x = stride; bird.legs[1].rotation.x = -stride;
                    bird.head.rotation.x = animal.idle ? Math.max(0, Math.sin(time * 5 + i)) * .65 : 0;
                    bird.wings.forEach((wing, side) => { wing.rotation.z = Math.sin(time * 3 + i) * .06 * (side ? 1 : -1); });
                } else if (i >= 7) {
                    noodle.segments.forEach((segment, j) => { segment.position.x = Math.sin(time * 5 - j * .65) * .09; });
                    noodle.head.rotation.y = Math.sin(time * 2) * .13;
                    noodle.tongue.visible = Math.sin(time * 2.5) > .8;
                } else {
                    const gecko = geckos[i - birds.length];
                    const stride = animal.idle ? 0 : Math.sin(time * 10 + i) * .45;
                    gecko.legs.forEach((leg, j) => { leg.rotation.x = (j ? -1 : 1) * stride; });
                    gecko.arms.forEach((arm, j) => { arm.rotation.x = (j ? 1 : -1) * stride * .6; });
                    gecko.tail.rotation.y = Math.sin(time * (animal.idle ? 2 : 6) + i) * .25;
                    gecko.head.rotation.z = animal.idle ? Math.sin(time * 3 + i) * .15 : 0;
                }
            });
        },
        damage(target: THREE.Object3D, amount = 1) {
            const animal = animals.find(candidate => candidate.root.getObjectById(target.id));
            if (!animal || animal.root.userData.animal !== 'chicken') return null;
            animal.health -= amount;
            animal.root.position.y += .12;
            if (animal.health > 0) return { dead: false, feathers: 0, meat: 0 };
            animal.root.visible = false;
            return { dead: true, feathers: 1 + Math.floor(Math.random() * 2), meat: 1 + Math.floor(Math.random() * 2) };
        },
        dispose() { group.removeFromParent(); geometry.dispose(); materials.forEach(material => material.dispose()); },
    };
}
