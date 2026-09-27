import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { terrainGeometry } from './terrain.ts';
import { World, generateWorld, visibleFaces, canPlace, editBlock, SIZE } from './world.ts';
import { Player } from './player.ts';
test('voxel bounds, generation, visible faces, movement, and editing', () => {
    const world = new World();
    assert.equal(world.set(-1, 0, 0, 1), false);
    assert.equal(world.set(SIZE, 0, 0, 1), false);
    assert.equal(world.set(.5, 0, 0, 1), false);
    assert.equal(world.set(0, 0, 0, 8), false);
    assert.equal(world.get(-1, 0, 0), 0);
    world.set(0, 0, 0, 1);
    const countFaces = () => { let faces = 0; visibleFaces(world, () => faces++); return faces; };
    assert.equal(countFaces(), 6);
    world.set(1, 0, 0, 1);
    assert.equal(countFaces(), 10);
    world.set(1, 0, 0, 0);
    assert.equal(countFaces(), 6);
    assert.deepEqual(generateWorld().data, generateWorld().data);
    assert.deepEqual(new Set(generateWorld().data), new Set([0, 1, 2, 3, 4, 5]));
    const floor = new World();
    for (let x = 0; x < SIZE; x++)
        for (let z = 0; z < SIZE; z++)
            floor.set(x, 0, z, 3);
    const geometry = terrainGeometry(floor);
    const material = new MeshBasicMaterial();
    const mesh = new Mesh(geometry, material);
    const ray = new Raycaster(new Vector3(10.5, 2.62, 10.5), new Vector3(0, -1, 0), 0, 5);
    const hit = ray.intersectObject(mesh)[0];
    assert.equal(hit.point.y, 1);
    assert.equal(hit.face!.normal.y, 1);
    ray.far = 1;
    assert.equal(ray.intersectObject(mesh).length, 0);
    geometry.dispose();
    material.dispose();
    const player = new Player(floor);
    const tick = (dx = 0, dz = 0, jump = false) => player.step(floor, 1 / 120, dx, dz, jump);
    tick();
    assert.equal(player.grounded, true);
    assert.equal(player.position.y, 1);
    tick(0, 0, true);
    assert.ok(player.position.y > 1);
    assert.equal(player.grounded, false);
    for (let i = 0; i < 180; i++)
        tick();
    assert.equal(player.position.y, 1);
    assert.equal(player.grounded, true);
    floor.set(17, 1, 27, 3);
    floor.set(17, 2, 27, 3);
    for (let i = 0; i < 60; i++)
        tick(4.6);
    assert.ok(player.position.x <= 16.7);
    for (let i = 0; i < 1000; i++)
        tick(-4.6);
    assert.equal(player.position.x, .3);
    floor.set(0, 3, 27, 3);
    tick(0, 0, true);
    for (let i = 0; i < 12; i++)
        tick();
    assert.ok(player.position.y + 1.8 <= 3);
    const p = { x: 10.5, y: 1, z: 10.5 };
    assert.equal(canPlace(floor, p, 10, 1, 10), false);
    assert.equal(canPlace(floor, p, 10, 2, 10), false);
    assert.equal(canPlace(floor, p, 11, 1, 10), true);
    assert.equal(canPlace(floor, p, -1, 1, 10), false);
    assert.equal(canPlace(floor, p, 10, 0, 10), false);
    assert.equal(editBlock(floor, p, 10, 0, 10, 0), false);
    assert.equal(editBlock(floor, p, 11, 1, 10, 4), true);
    assert.equal(floor.get(11, 1, 10), 4);
    assert.equal(editBlock(floor, p, 11, 1, 10, 0), true);
    assert.equal(floor.get(11, 1, 10), 0);
});

import { AXE, PICKAXE, PLANKS, TABLE, STICKS, TOOL_USES, createInventory, craft, harvest, place, miningSeconds, tableNearby } from './crafting.ts';
test('gather wood, craft and place a table, make tools, mine, and wear tools out', () => {
    const world = new World();
    const player = { x: 10.5, y: 1, z: 10.5 };
    const inventory = createInventory();
    assert.equal(craft(inventory, 'planks', false), false);
    assert.equal(craft(inventory, 'unknown', true), false);
    assert.equal(place(world, player, inventory, 4, 12, 1, 10), false);
    for (let i = 0; i < 4; i++) {
        world.set(12, 1, 10, 4);
        assert.equal(harvest(world, player, inventory, 1, 12, 1, 10), true);
        assert.equal(world.get(12, 1, 10), 0);
    }
    assert.equal(inventory.counts[4], 4);
    for (let i = 0; i < 4; i++) assert.equal(craft(inventory, 'planks', false), true);
    assert.equal(inventory.counts[PLANKS], 16);
    assert.equal(inventory.counts[4], 0);
    assert.equal(craft(inventory, 'table', false), true);
    assert.equal(craft(inventory, 'sticks', false), true);
    assert.equal(inventory.counts[STICKS], 4);
    assert.equal(inventory.counts[PLANKS], 10);
    const before = structuredClone(inventory);
    assert.equal(craft(inventory, 'pickaxe', false), false);
    assert.deepEqual(inventory, before);
    assert.equal(tableNearby(world, player), false); // Carrying a table is insufficient.
    assert.equal(place(world, player, inventory, TABLE, 10, 1, 10), false); // Player overlap.
    assert.equal(place(world, player, inventory, TABLE, -1, 1, 10), false);
    assert.deepEqual(inventory, before);
    assert.equal(place(world, player, inventory, TABLE, 12, 1, 10), true);
    assert.equal(inventory.counts[TABLE], 0);
    assert.equal(tableNearby(world, player), true);
    assert.equal(tableNearby(world, { x: 25, y: 1, z: 25 }), false);
    assert.equal(craft(inventory, 'pickaxe', tableNearby(world, player)), true);
    assert.equal(craft(inventory, 'axe', tableNearby(world, player)), true);
    assert.equal(inventory.counts[PLANKS], 4);
    assert.equal(inventory.counts[STICKS], 0);
    assert.equal(inventory.durability[PICKAXE], TOOL_USES);
    assert.equal(inventory.durability[AXE], TOOL_USES);
    assert.ok(miningSeconds(inventory, AXE, 4)! < miningSeconds(inventory, 1, 4)!);
    world.set(13, 1, 10, 3);
    assert.equal(harvest(world, player, inventory, AXE, 13, 1, 10), false);
    assert.equal(inventory.durability[AXE], TOOL_USES);
    assert.equal(harvest(world, player, inventory, PICKAXE, 13, 1, 10), true);
    assert.equal(inventory.counts[3], 1);
    assert.equal(place(world, player, inventory, 3, 13, 1, 10), true);
    assert.equal(inventory.counts[3], 0);
    assert.equal(place(world, player, inventory, PICKAXE, 14, 1, 10), false);
    world.set(13, 0, 10, 3);
    assert.equal(harvest(world, player, inventory, PICKAXE, 13, 0, 10), false);
    assert.equal(inventory.durability[PICKAXE], TOOL_USES - 1);
    for (let i = 1; i < TOOL_USES; i++) {
        world.set(13, 1, 10, 3);
        assert.equal(harvest(world, player, inventory, PICKAXE, 13, 1, 10), true);
    }
    assert.equal(inventory.counts[PICKAXE], 0);
    assert.equal(inventory.durability[PICKAXE], 0);
    assert.equal(miningSeconds(inventory, PICKAXE, 3), null);
    assert.equal(harvest(world, player, inventory, AXE, 12, 1, 10), true);
    assert.equal(inventory.counts[TABLE], 1);
    assert.equal(tableNearby(world, player), false);
    assert.equal(craft(inventory, 'pickaxe', false), false);
    // A spare tool starts at full durability when the equipped one breaks.
    inventory.counts[AXE] = 2;
    inventory.durability[AXE] = 1;
    world.set(12, 1, 10, 4);
    assert.equal(harvest(world, player, inventory, AXE, 12, 1, 10), true);
    assert.equal(inventory.counts[AXE], 1);
    assert.equal(inventory.durability[AXE], TOOL_USES);
    // New blocks must still produce valid atlas coordinates.
    world.set(12, 1, 10, TABLE);
    world.set(13, 1, 10, PLANKS);
    const geometry = terrainGeometry(world);
    assert.ok([...geometry.getAttribute('uv').array].every(value => value >= 0 && value <= 1));
    geometry.dispose();
});

import { animalGround, createAnimals } from './animals.ts';
import { CHICKEN_MEAT, FEATHER } from './crafting.ts';
import { DAY_LENGTH, createEnvironment } from './environment.ts';
test('friendly animals spawn clear, wander within terrain, recover after edits, and dispose', () => {
    const world = generateWorld();
    const wildlife = createAnimals(world);
    assert.equal(wildlife.group.children.length, 8);
    assert.equal(wildlife.group.children.filter(animal => animal.name === 'Chicken').length, 4);
    assert.equal(wildlife.group.children.filter(animal => animal.name === 'Gecko').length, 3);
    assert.equal(wildlife.group.children[7].name, 'Garry Da Snake');
    assert.equal(wildlife.group.children.filter(animal => animal.name === 'Gecko').every(gecko => {
        let eyes = 0, pupils = 0;
        gecko.traverse(object => { if (object.name === 'Gecko eye') eyes++; if (object.name === 'Gecko pupil') pupils++; });
        return eyes === 2 && pupils === 2;
    }), true);
    assert.equal(animalGround(world, -.5, 10, .56, 1.3), null);
    assert.equal(animalGround(new World(), 10, 10, .56, 1.3), null);
    const initial = wildlife.group.children.map(animal => animal.position.clone());
    for (let step = 0; step < 900; step++) {
        wildlife.update(1 / 30);
        wildlife.group.children.forEach((animal, i) => {
            assert.equal(animal.visible, true);
            const floor = animalGround(world, animal.position.x, animal.position.z, i >= 7 ? .86 : i >= 4 ? .48 : .56, i >= 7 ? .5 : i >= 4 ? 1.15 : 1.3);
            assert.notEqual(floor, null);
            assert.equal(animal.position.y, floor);
        });
    }
    assert.ok(wildlife.group.children.some((animal, i) => animal.position.distanceTo(initial[i]) > .1));
    const bird = wildlife.group.children[0];
    // Build through one animal's patch: it relocates to the nearest clear ground.
    world.set(Math.floor(bird.position.x), bird.position.y, Math.floor(bird.position.z), 3);
    wildlife.update(1 / 30);
    assert.equal(bird.position.y, animalGround(world, bird.position.x, bird.position.z, .56, 1.3));
    const chickenMesh = bird.children.find(child => child instanceof Mesh)!;
    assert.deepEqual(wildlife.damage(chickenMesh), { dead: false, feathers: 0, meat: 0 });
    assert.deepEqual(wildlife.damage(chickenMesh), { dead: false, feathers: 0, meat: 0 });
    const loot = wildlife.damage(chickenMesh);
    assert.equal(loot?.dead, true);
    assert.ok((loot?.feathers ?? 0) >= 1 && (loot?.meat ?? 0) >= 1);
    assert.equal(bird.visible, false);
    assert.equal(wildlife.damage(wildlife.group.children[7]), null);
    const geometries = new Set(), materials = new Set();
    wildlife.group.traverse(object => {
        if (object instanceof Mesh) { geometries.add(object.geometry); materials.add(object.material); }
    });
    let disposed = 0;
    for (const resource of [...geometries, ...materials]) resource.addEventListener('dispose', () => disposed++);
    wildlife.dispose();
    assert.equal(disposed, geometries.size + materials.size);
});

test('sky environment advances from daylight toward night and disposes its scene resources', () => {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#b9d6da', 35, 75);
    const environment = createEnvironment(scene);
    const clouds = scene.getObjectByName('Cloud layer');
    const stars = scene.getObjectByName('Night sky stars') as THREE.Points;
    const sky = scene.getObjectByName('Sky dome');
    assert.ok(sky && stars && clouds);
    const starMaterial = stars.material as THREE.PointsMaterial;
    assert.equal(starMaterial.opacity, 0);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(16, 10, 16);
    environment.update(DAY_LENGTH / 2, camera);
    assert.equal(sky.position.distanceTo(camera.position), 0);
    assert.ok(starMaterial.opacity > 0);
    assert.ok((scene.fog as THREE.Fog).color.getHex() !== new THREE.Color('#b9d6da').getHex());
    environment.dispose();
    assert.equal(scene.getObjectByName('Cloud layer'), undefined);
    assert.equal(scene.getObjectByName('Night sky stars'), undefined);
    assert.equal(scene.getObjectByName('Sky dome'), undefined);
});

import { findPath, createZombie } from './zombie.ts';
import { SWORD, MAX_HEALTH, attackDamage, eat, wear } from './crafting.ts';
test('sword, eating, zombie pathfinding, night spawning, fighting, and losing interest', () => {
    const pack = createInventory();
    pack.counts[PLANKS] = 2; pack.counts[STICKS] = 1;
    assert.equal(craft(pack, 'sword', false), false);
    assert.equal(craft(pack, 'sword', true), true);
    assert.equal(attackDamage(pack, SWORD), 3);
    assert.equal(attackDamage(pack, PLANKS), 1);
    wear(pack, SWORD);
    assert.equal(pack.durability[SWORD], TOOL_USES - 1);
    assert.equal(eat(pack, 3), 3);
    pack.counts[CHICKEN_MEAT] = 2;
    assert.equal(eat(pack, 3), 4);
    assert.equal(eat(pack, MAX_HEALTH), MAX_HEALTH);
    assert.equal(pack.counts[CHICKEN_MEAT], 1);

    const flat = () => {
        const world = new World();
        for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) world.set(x, 0, z, 3);
        return world;
    };
    const world = flat();
    // A two-high wall from z=0..30 at x=10 forces a detour through the gap at z=31.
    for (let z = 0; z < SIZE - 1; z++) { world.set(10, 1, z, 3); world.set(10, 2, z, 3); }
    world.set(5, 1, 5, 3); // one-block step
    const around = findPath(world, { x: 3.5, y: 1, z: 5.5 }, { x: 14.5, y: 1, z: 5.5 })!;
    assert.ok(around.some(cell => cell.z === 31.5));
    assert.ok(around.some(cell => cell.x === 5.5 && cell.y === 2));
    assert.deepEqual(around.at(-1), { x: 14.5, y: 1, z: 5.5 });
    world.set(10, 1, 31, 3); world.set(10, 2, 31, 3);
    assert.equal(findPath(world, { x: 3.5, y: 1, z: 5.5 }, { x: 14.5, y: 1, z: 5.5 }), null);

    const arena = flat(), zombie = createZombie(arena);
    const player = { x: 16.5, y: 1, z: 16.5 };
    const run = (seconds: number, night = true) => {
        let damage = 0;
        for (let i = 0; i < seconds * 120; i++) damage += zombie.update(1 / 120, night, player);
        return damage;
    };
    run(1, false);
    assert.equal(zombie.root.visible, false);
    run(1 / 120);
    assert.equal(zombie.root.visible, true);
    assert.ok(Math.hypot(zombie.root.position.x - player.x, zombie.root.position.z - player.z) >= 11);
    // Park the player far away: it wanders instead of chasing.
    Object.assign(player, { x: 1.5, z: 1.5 });
    const far = zombie.root.position.clone();
    player.x = far.x > 16 ? 1.5 : 30.5; player.z = far.z > 16 ? 1.5 : 30.5;
    run(3);
    assert.equal(zombie.state, 'wander');
    // Step within sight: it chases, winds up, and only then lands a blow.
    Object.assign(player, { x: zombie.root.position.x + 6, z: zombie.root.position.z });
    player.x = Math.min(player.x, SIZE - 1.5);
    run(.1);
    assert.equal(zombie.state, 'chase');
    let damage = 0, sawWindup = false;
    for (let i = 0; i < 8 * 120 && !damage; i++) {
        damage += zombie.update(1 / 120, true, player);
        if (zombie.state === 'windup') sawWindup = true;
    }
    assert.equal(damage, 1);
    assert.ok(sawWindup);
    // Two sword blows put it down; it stays gone for the rest of the night.
    assert.equal(zombie.hit(3), false);
    assert.equal(zombie.state, 'stagger');
    assert.equal(zombie.hit(3), true);
    assert.equal(zombie.hit(3), null);
    run(2);
    assert.equal(zombie.root.visible, false);
    run(1 / 120, false);
    run(1 / 120);
    assert.equal(zombie.root.visible, true);
    // Run far away: it gives up the chase.
    Object.assign(player, { x: zombie.root.position.x, z: zombie.root.position.z });
    run(.1);
    assert.equal(zombie.state === 'chase' || zombie.state === 'windup', true);
    Object.assign(player, { x: zombie.root.position.x > 16 ? .5 : 31.5, y: 1, z: zombie.root.position.z > 16 ? .5 : 31.5 });
    run(2);
    assert.equal(zombie.state, 'wander');
    let disposed = 0;
    zombie.root.traverse(object => { if (object instanceof Mesh) (object.material as THREE.Material).addEventListener('dispose', () => disposed++); });
    zombie.dispose();
    assert.ok(disposed > 0);
});
