import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { terrainGeometry } from './terrain.ts';
import { World, generateWorld, visibleFaces, canPlace, editBlock, BIOMES, BLOCKS, SAND, SEA_LEVEL, SIZE_X, SIZE_Y, SIZE_Z, SNOW, WATER, CACTUS, ICE, biomeAt, flowWater, settle } from './world.ts';
import { Player } from './player.ts';
test('voxel bounds, generation, visible faces, movement, and editing', () => {
    const world = new World();
    assert.equal(world.set(-1, 0, 0, 1), false);
    assert.equal(world.set(SIZE_X, 0, 0, 1), false);
    assert.equal(world.set(0, SIZE_Y, 0, 1), false);
    assert.equal(world.set(0, 0, SIZE_Z, 1), false);
    assert.equal(world.set(SIZE_X - 1, 0, SIZE_Z - 1, 1), true);
    world.set(SIZE_X - 1, 0, SIZE_Z - 1, 0);
    assert.equal(world.set(.5, 0, 0, 1), false);
    assert.equal(world.set(0, 0, 0, BLOCKS.length), false);
    assert.equal(world.get(-1, 0, 0), 0);
    world.set(0, 0, 0, 1);
    const countFaces = () => { let faces = 0; visibleFaces(world, () => faces++); return faces; };
    assert.equal(countFaces(), 6);
    world.set(1, 0, 0, 1);
    assert.equal(countFaces(), 10);
    world.set(1, 0, 0, 0);
    assert.equal(countFaces(), 6);
    assert.deepEqual(generateWorld().data, generateWorld().data);
    const generated = generateWorld();
    assert.deepEqual(new Set(generated.data), new Set([0, 1, 2, 3, 4, 5, SAND, SNOW, WATER, CACTUS, ICE]));
    // Six 32×32 biomes: snow, mountain, forest on top; ocean, plains, desert below.
    assert.deepEqual([[5, 5], [40, 5], [70, 5], [5, 40], [40, 40], [70, 40]].map(([x, z]) => biomeAt(x, z)), [...BIOMES]);
    const top = (x: number, z: number) => { let y = SIZE_Y - 1; while (!generated.get(x, y, z)) y--; return { y, id: generated.get(x, y, z) }; };
    assert.deepEqual(top(5, 45), { y: SEA_LEVEL, id: WATER }); // open ocean
    assert.equal(top(30, 45).id, SAND); // beach
    assert.equal(top(80, 45).id, SAND); // desert
    assert.equal(top(48, 48).id, 1); // plains grass
    assert.equal(top(3, 20).id, SNOW);
    assert.ok(top(47, 15).y >= 18 && top(47, 15).id === SNOW); // snowy mountain peak
    assert.equal(top(24, 22).id, ICE); // frozen pond
    assert.equal(generated.get(24, top(24, 22).y - 1, 22), WATER);
    assert.equal(top(75, 38).id, CACTUS);
    // Loose sand falls to rest; water pours into gaps, sideways only at or below sea level.
    const box = new World();
    for (let x = 0; x < 6; x++) for (let z = 0; z < 6; z++) { box.set(x, 0, z, 3); if (x % 5 === 0 || z % 5 === 0) box.set(x, 1, z, 3); }
    box.set(2, 3, 2, SAND); box.set(2, 4, 2, SAND);
    settle(box, 2, 3, 2);
    assert.deepEqual([1, 2, 3, 4].map(y => box.get(2, y, 2)), [SAND, SAND, 0, 0]);
    box.set(1, 1, 1, WATER);
    assert.equal(flowWater(box, [{ x: 2, y: 1, z: 1 }]), 14); // the rest of the 4×4 basin floor, around the sand
    assert.equal(box.get(4, 1, 4), WATER);
    box.set(3, 9, 3, WATER);
    assert.equal(flowWater(box, [{ x: 4, y: 9, z: 3 }]), 0); // too high to spread sideways
    box.set(3, 6, 3, 3);
    assert.equal(flowWater(box, [{ x: 3, y: 8, z: 3 }]), 2); // but it pours down onto the stone
    const floor = new World();
    for (let x = 0; x < SIZE_X; x++)
        for (let z = 0; z < SIZE_Z; z++)
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
    assert.deepEqual([player.position.x, player.position.z], [48.5, 48.5]);
    floor.set(49, 1, 48, 3);
    floor.set(49, 2, 48, 3);
    for (let i = 0; i < 60; i++)
        tick(4.6);
    assert.ok(player.position.x <= 48.7);
    for (let i = 0; i < 1400; i++)
        tick(-4.6);
    assert.equal(player.position.x, .3);
    floor.set(0, 3, 48, 3);
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
    // Water: blocks can go into it, it can't be broken, and it has its own mesh.
    for (let y = 1; y <= 5; y++) for (let x = 20; x < 30; x++) for (let z = 20; z < 30; z++) floor.set(x, y, z, WATER);
    assert.equal(canPlace(floor, p, 22, 1, 22), true);
    assert.equal(editBlock(floor, p, 22, 1, 22, 0), false);
    const waterGeometry = terrainGeometry(floor, true);
    assert.equal(waterGeometry.getAttribute('position').count, 4 * (100 + 4 * 10 * 5)); // top plus four sides
    waterGeometry.dispose();
    // Swimming: sink slowly, rise while holding jump.
    const swimmer = new Player(floor);
    Object.assign(swimmer.position, { x: 25.5, y: 3, z: 25.5 });
    for (let i = 0; i < 60; i++) swimmer.step(floor, 1 / 120, 0, 0, false);
    assert.ok(swimmer.position.y > 2 && swimmer.position.y < 3);
    for (let i = 0; i < 120; i++) swimmer.step(floor, 1 / 120, 0, 0, true);
    assert.ok(swimmer.position.y > 5);
    // Fall damage: over three blocks hurts, water breaks the fall.
    const faller = new Player(floor);
    const drop = (from: number) => {
        Object.assign(faller.position, { x: 40.5, y: from, z: 40.5 });
        let damage = 0;
        for (let i = 0; i < 400; i++) damage += faller.step(floor, 1 / 120, 0, 0, false);
        return damage;
    };
    assert.equal(drop(1), 0);
    assert.equal(drop(4), 0);
    assert.equal(drop(10), 6);
    Object.assign(swimmer.position, { x: 25.5, y: 15, z: 25.5 });
    let splash = 0;
    for (let i = 0; i < 400; i++) splash += swimmer.step(floor, 1 / 120, 0, 0, false);
    assert.equal(splash, 0);
    // Ice: speed builds up slowly and you keep sliding after letting go.
    for (let x = 50; x < 70; x++) for (let z = 45; z < 52; z++) floor.set(x, 0, z, ICE);
    const skater = new Player(floor);
    Object.assign(skater.position, { x: 51.5, y: 1, z: 48.5 });
    skater.step(floor, 1 / 120, 0, 0, false);
    const before = skater.position.x;
    skater.step(floor, 1 / 120, 4.6, 0, false);
    assert.ok(skater.position.x - before < 4.6 / 120 / 2);
    for (let i = 0; i < 120; i++) skater.step(floor, 1 / 120, 4.6, 0, false);
    const coast = skater.position.x;
    for (let i = 0; i < 30; i++) skater.step(floor, 1 / 120, 0, 0, false);
    assert.ok(skater.position.x - coast > .3);
});

import { AXE, PICKAXE, PLANKS, TABLE, STICKS, TOOL_USES, SLOTS, addItem, countOf, craftBlocker, createInventory, craft, hasRoom, harvest, moveSlot, place, removeItem, miningSeconds, stationsNearby, RECIPES } from './crafting.ts';
test('slot inventory: empty start, stacking, overflow, moving, crafting, drops from harvesting, and tool wear', () => {
    const inventory = createInventory();
    assert.equal(inventory.slots.length, 46);
    assert.ok(inventory.slots.every(slot => slot === null)); // the hotbar starts empty
    // Stacks cap at 64; tools take a slot each; hotbar slots fill first.
    assert.equal(addItem(inventory, 4, 70), 0);
    assert.deepEqual(inventory.slots.slice(0, 2).map(stack => stack?.count), [64, 6]);
    assert.equal(addItem(inventory, PICKAXE, 2), 0);
    assert.deepEqual([inventory.slots[2], inventory.slots[3]].map(stack => [stack?.id, stack?.count, stack?.durability]), [[PICKAXE, 1, TOOL_USES], [PICKAXE, 1, TOOL_USES]]);
    assert.equal(addItem(inventory, 4, 2), 0);
    assert.equal(inventory.slots[1]?.count, 8); // tops up the existing stack
    // Removal takes from the back and frees emptied slots.
    assert.equal(removeItem(inventory, 4, 100), false);
    assert.equal(removeItem(inventory, 4, 10), true);
    assert.deepEqual([inventory.slots[0]?.count, inventory.slots[1]], [62, null]);
    assert.equal(addItem(inventory, 2, 5), 0);
    assert.equal(inventory.slots[1]?.id, 2);
    // Moving: to an empty slot, merging onto a matching stack, swapping otherwise.
    assert.equal(moveSlot(inventory, 1, 30), true);
    assert.deepEqual([inventory.slots[1], inventory.slots[30]?.count], [null, 5]);
    assert.equal(moveSlot(inventory, 30, 30), false);
    assert.equal(moveSlot(inventory, 7, 8), false); // nothing to move
    assert.equal(moveSlot(inventory, 0, 99), false);
    inventory.slots[31] = { id: 2, count: 60, durability: 0 };
    assert.equal(moveSlot(inventory, 30, 31), true);
    assert.deepEqual([inventory.slots[30]?.count, inventory.slots[31]?.count], [1, 64]);
    assert.equal(moveSlot(inventory, 0, 30), true);
    assert.deepEqual([inventory.slots[0]?.id, inventory.slots[30]?.id], [2, 4]);
    // A full pack refuses more and reports what's left over.
    const full = createInventory();
    assert.equal(addItem(full, 3, SLOTS * 64 + 5), 5);
    assert.equal(hasRoom(full, 3), false);
    assert.equal(hasRoom(full, 4), false);

    const world = new World();
    const player = { x: 10.5, y: 1, z: 10.5 };
    const pack = createInventory();
    assert.equal(craft(pack, 'planks', []), false);
    assert.equal(craft(pack, 'unknown', [TABLE]), false);
    // Harvesting returns the block to drop; the pack itself is untouched.
    world.set(12, 1, 10, 4);
    assert.equal(harvest(world, player, pack, 0, 12, 1, 10), 4);
    assert.equal(world.get(12, 1, 10), 0);
    assert.equal(countOf(pack, 4), 0);
    assert.equal(harvest(world, player, pack, 0, 12, 1, 10), null);
    // Ice melts into water and drops nothing.
    world.set(12, 1, 11, ICE);
    assert.equal(harvest(world, player, pack, 0, 12, 1, 11), 0);
    assert.equal(world.get(12, 1, 11), WATER);
    addItem(pack, 4, 4);
    for (let i = 0; i < 4; i++) assert.equal(craft(pack, 'planks', []), true);
    assert.equal(countOf(pack, PLANKS), 16);
    assert.equal(countOf(pack, 4), 0);
    assert.equal(craft(pack, 'table', []), true);
    assert.equal(craft(pack, 'sticks', []), true);
    assert.deepEqual([countOf(pack, STICKS), countOf(pack, PLANKS)], [4, 10]);
    const pickaxe = RECIPES.find(recipe => recipe.id === 'pickaxe')!;
    assert.equal(craftBlocker(pack, pickaxe, []), 'station');
    const before = structuredClone(pack);
    assert.equal(craft(pack, 'pickaxe', []), false);
    assert.deepEqual(pack, before);
    // Placing uses the selected slot; tools can't be placed.
    const tableSlot = pack.slots.findIndex(stack => stack?.id === TABLE);
    assert.deepEqual(stationsNearby(world, player), []); // Carrying a table is insufficient.
    assert.equal(place(world, player, pack, tableSlot, 10, 1, 10), false); // Player overlap.
    assert.deepEqual(pack, before);
    assert.equal(place(world, player, pack, tableSlot, 12, 1, 10), true);
    assert.equal(pack.slots[tableSlot], null);
    assert.deepEqual(stationsNearby(world, player), [TABLE]);
    assert.equal(craft(pack, 'pickaxe', stationsNearby(world, player)), true);
    assert.equal(craft(pack, 'axe', stationsNearby(world, player)), true);
    assert.deepEqual([countOf(pack, PLANKS), countOf(pack, STICKS)], [4, 0]);
    const pick = pack.slots.findIndex(stack => stack?.id === PICKAXE), axe = pack.slots.findIndex(stack => stack?.id === AXE);
    assert.equal(place(world, player, pack, pick, 14, 1, 10), false);
    assert.ok(miningSeconds(pack, axe, 4)! < miningSeconds(pack, 20, 4)!);
    world.set(13, 1, 10, 3);
    assert.equal(harvest(world, player, pack, axe, 13, 1, 10), null); // stone needs a pickaxe
    assert.equal(pack.slots[axe]?.durability, TOOL_USES);
    assert.equal(harvest(world, player, pack, pick, 13, 1, 10), 3);
    world.set(13, 0, 10, 3);
    assert.equal(harvest(world, player, pack, pick, 13, 0, 10), null); // bedrock layer
    assert.equal(pack.slots[pick]?.durability, TOOL_USES - 1);
    for (let i = 1; i < TOOL_USES; i++) {
        world.set(13, 1, 10, 3);
        assert.equal(harvest(world, player, pack, pick, 13, 1, 10), 3);
    }
    assert.equal(pack.slots[pick], null); // worn out
    assert.equal(miningSeconds(pack, pick, 3), null);
    assert.equal(harvest(world, player, pack, axe, 12, 1, 10), TABLE);
    assert.deepEqual(stationsNearby(world, player), []);
    // Crafting never overflows: blocked when the output has nowhere to go.
    const cramped = createInventory();
    addItem(cramped, 3, (SLOTS - 1) * 64);
    addItem(cramped, 4, 2);
    assert.equal(craftBlocker(cramped, RECIPES[0], []), 'room');
    removeItem(cramped, 4, 1);
    assert.equal(craft(cramped, 'planks', []), true); // the last log's slot frees up for the planks
    assert.equal(countOf(cramped, PLANKS), 4);
    // New blocks must still produce valid atlas coordinates.
    world.set(12, 1, 10, TABLE);
    world.set(13, 1, 10, PLANKS);
    world.set(14, 1, 10, CACTUS);
    const geometry = terrainGeometry(world);
    assert.ok([...geometry.getAttribute('uv').array].every(value => value >= 0 && value <= 1));
    geometry.dispose();
});

import { animalGround, createAnimals } from './animals.ts';
import { CHICKEN_MEAT, FEATHER, MUTTON, WOOL } from './crafting.ts';
import { DAY_LENGTH, createEnvironment } from './environment.ts';
test('friendly animals spawn clear, wander within terrain, recover after edits, and dispose', () => {
    const world = generateWorld();
    const wildlife = createAnimals(world);
    const animals = wildlife.group.children;
    assert.equal(animals.length, 15);
    const count = (name: string) => animals.filter(animal => animal.name === name).length;
    assert.deepEqual([count('Chicken'), count('Gecko'), count('Cat'), count('Fish'), count('Sheep')], [4, 3, 1, 3, 3]);
    assert.equal(animals[7].name, 'Garry Da Snake');
    assert.deepEqual(animals.slice(12).map(animal => animal.name), ['Sheep', 'Sheep', 'Sheep']); // new animals keep old save slots in place
    const home: Record<string, string> = { Chicken: 'plains', Cat: 'plains', Gecko: 'desert', 'Garry Da Snake': 'forest', Fish: 'ocean', Sheep: 'mountain' };
    const inWater = (animal: THREE.Object3D) => world.get(Math.floor(animal.position.x), Math.floor(animal.position.y), Math.floor(animal.position.z)) === WATER;
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
        animals.forEach(animal => {
            assert.equal(animal.visible, true);
            assert.equal(biomeAt(animal.position.x, animal.position.z), home[animal.name]);
            if (animal.name === 'Fish') { assert.ok(inWater(animal)); return; }
            const floor = animalGround(world, animal.position.x, animal.position.z, animal.userData.radius, animal.userData.height);
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
    // Four punches for a chicken.
    for (let i = 0; i < 3; i++) assert.deepEqual(wildlife.damage(chickenMesh, 5), { dead: false, drops: [] });
    const loot = wildlife.damage(chickenMesh, 5);
    assert.equal(loot?.dead, true);
    assert.deepEqual(loot?.drops.map(stack => stack.id), [FEATHER, CHICKEN_MEAT]);
    assert.ok(loot?.drops.every(stack => stack.count === 1));
    assert.equal(bird.visible, false);
    assert.equal(wildlife.damage(wildlife.group.children[7]), null);
    // Sheep give wool and mutton.
    const lamb = animals[12], lambMesh = lamb.children.find(child => child instanceof Mesh)!;
    // Three sword slashes for a sheep.
    assert.deepEqual(wildlife.damage(lambMesh, 9), { dead: false, drops: [] });
    assert.deepEqual(wildlife.damage(lambMesh, 9), { dead: false, drops: [] });
    assert.deepEqual(wildlife.damage(lambMesh, 9)?.drops.map(stack => stack.id), [WOOL, MUTTON]);
    // Dawn brings everyone back, healed, including the defeated.
    wildlife.respawn();
    assert.ok(animals.every(animal => animal.visible));
    assert.deepEqual(wildlife.damage(chickenMesh), { dead: false, drops: [] });
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
    // Days count up at sunrise; sleeping jumps to just after the next one.
    assert.equal(environment.day(), 0);
    environment.update(DAY_LENGTH / 2, camera);
    assert.equal(environment.day(), 1);
    assert.equal(environment.night(), false);
    environment.update(DAY_LENGTH * .6, camera);
    assert.equal(environment.night(), true);
    environment.skipToMorning();
    assert.deepEqual([environment.day(), environment.night()], [2, false]);
    assert.equal(createEnvironment(new THREE.Scene(), 1, 7).day(), 7);
    environment.dispose();
    assert.equal(scene.getObjectByName('Cloud layer'), undefined);
    assert.equal(scene.getObjectByName('Night sky stars'), undefined);
    assert.equal(scene.getObjectByName('Sky dome'), undefined);
});

import { findPath, createZombie } from './zombie.ts';
import { SWORD, MAX_HEALTH, attackDamage, eat, wear } from './crafting.ts';
test('sword, eating, zombie pathfinding, night spawning, fighting, and losing interest', () => {
    const pack = createInventory();
    addItem(pack, PLANKS, 2); addItem(pack, STICKS, 1);
    assert.equal(craft(pack, 'sword', []), false);
    assert.equal(craft(pack, 'sword', [TABLE]), true);
    const sword = pack.slots.findIndex(stack => stack?.id === SWORD);
    assert.equal(attackDamage(pack, sword), 9);
    assert.equal(attackDamage(pack, sword + 1), 5);
    wear(pack, sword);
    assert.equal(pack.slots[sword]?.durability, TOOL_USES - 1);
    assert.deepEqual(eat(pack, 3), { food: 0, health: 3 });
    addItem(pack, CHICKEN_MEAT, 2);
    assert.deepEqual(eat(pack, 3), { food: CHICKEN_MEAT, health: 4 });
    assert.deepEqual(eat(pack, MAX_HEALTH), { food: 0, health: MAX_HEALTH });
    assert.equal(countOf(pack, CHICKEN_MEAT), 1);

    const flat = () => {
        const world = new World();
        for (let x = 0; x < SIZE_X; x++) for (let z = 0; z < SIZE_Z; z++) world.set(x, 0, z, 3);
        return world;
    };
    const world = flat();
    // A two-high wall at x=10 forces a detour through the gap at the far edge.
    for (let z = 0; z < SIZE_Z - 1; z++) { world.set(10, 1, z, 3); world.set(10, 2, z, 3); }
    world.set(5, 1, 5, 3); // one-block step
    const around = findPath(world, { x: 3.5, y: 1, z: 5.5 }, { x: 14.5, y: 1, z: 5.5 })!;
    assert.ok(around.some(cell => cell.z === SIZE_Z - .5));
    assert.ok(around.some(cell => cell.x === 5.5 && cell.y === 2));
    assert.deepEqual(around.at(-1), { x: 14.5, y: 1, z: 5.5 });
    world.set(10, 1, SIZE_Z - 1, 3); world.set(10, 2, SIZE_Z - 1, 3);
    assert.equal(findPath(world, { x: 3.5, y: 1, z: 5.5 }, { x: 14.5, y: 1, z: 5.5 }), null);

    // The snow biome covers the old 32×32 corner, so the zombie spawns and roams there.
    const arena = flat(), zombie = createZombie(arena, 'snow');
    assert.equal(zombie.root.name, 'Frost zombie');
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
    assert.equal(biomeAt(zombie.root.position.x, zombie.root.position.z), 'snow');
    // Park the player far away: it wanders instead of chasing.
    const far = zombie.root.position.clone();
    player.x = far.x > 16 ? 1.5 : 30.5; player.z = far.z > 16 ? 1.5 : 30.5;
    run(3);
    assert.equal(zombie.state, 'wander');
    // Step within sight: it chases, winds up, and only then lands a blow.
    Object.assign(player, { x: zombie.root.position.x + (zombie.root.position.x > 16 ? -6 : 6), z: zombie.root.position.z });
    run(.1);
    assert.equal(zombie.state, 'chase');
    let damage = 0, sawWindup = false;
    for (let i = 0; i < 8 * 120 && !damage; i++) {
        damage += zombie.update(1 / 120, true, player);
        if (zombie.state === 'windup') sawWindup = true;
    }
    assert.equal(damage, 1);
    assert.ok(sawWindup);
    // Six sword blows put it down; it stays gone for the rest of the night.
    for (let i = 0; i < 5; i++) assert.equal(zombie.hit(9), false);
    assert.equal(zombie.state, 'stagger');
    assert.equal(zombie.hit(9), true);
    assert.equal(zombie.hit(9), null);
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
    // Reloading mid-night: a live zombie comes back where it was; a killed one stays gone.
    const alive = zombie.snapshot();
    assert.equal(alive.spawned, true);
    const reloaded = createZombie(arena);
    reloaded.restore(alive);
    assert.equal(reloaded.root.visible, true);
    assert.deepEqual(reloaded.root.position.toArray(), [alive.position!.x, alive.position!.y, alive.position!.z]);
    assert.equal(reloaded.health, alive.health);
    const afterKill = createZombie(arena);
    afterKill.restore({ spawned: true, health: 0, position: null, state: 'gone', timer: 0, knockX: 0, knockZ: 0 });
    for (let i = 0; i < 120; i++) afterKill.update(1 / 120, true, player);
    assert.equal(afterKill.root.visible, false);
    // Reloading mid wind-up: the blow still lands, and no sooner than the saved timer allows.
    const brawler = createZombie(arena);
    Object.assign(player, { x: 16.5, y: 1, z: 16.5 });
    brawler.restore({ spawned: true, health: 6, position: { x: 16.5, y: 1, z: 17.5 }, state: 'windup', timer: .3, knockX: 0, knockZ: 0 });
    assert.equal(brawler.state, 'windup');
    let landedAt = -1;
    for (let i = 0; i < 120 && landedAt < 0; i++) if (brawler.update(1 / 120, true, player)) landedAt = i;
    assert.ok(landedAt >= 35 && landedAt <= 37, `landed at tick ${landedAt}`);
    // Out-of-range timers and unknown states are tamed rather than trusted.
    const tampered = createZombie(arena);
    tampered.restore({ spawned: true, health: 6, position: { x: 16.5, y: 1, z: 17.5 }, state: 'dance', timer: 99, knockX: 0, knockZ: 0 });
    assert.equal(tampered.state, 'wander');
    const staggered = createZombie(arena);
    staggered.restore({ spawned: true, health: 6, position: { x: 16.5, y: 1, z: 17.5 }, state: 'stagger', timer: 99, knockX: 50, knockZ: 0 });
    staggered.update(1 / 120, true, player);
    assert.equal(staggered.state, 'stagger');
    assert.ok(staggered.snapshot().timer <= .25 && staggered.snapshot().knockX === 6);
    reloaded.dispose(); afterKill.dispose(); brawler.dispose(); tampered.dispose(); staggered.dispose();
    // On the real map, each biome's zombie spawns in its own biome, including the drowned on the sea floor.
    const map = generateWorld(), spot = { x: 48.5, y: 9, z: 48.5 };
    const horde = BIOMES.map(biome => createZombie(map, biome));
    horde.forEach(z => z.update(1 / 120, true, spot));
    assert.equal(new Set(horde.map(z => z.root.name)).size, 6);
    horde.forEach((z, i) => { assert.equal(z.root.visible, true); assert.equal(biomeAt(z.root.position.x, z.root.position.z), BIOMES[i]); z.dispose(); });
    let disposed = 0;
    zombie.root.traverse(object => { if (object instanceof Mesh) (object.material as THREE.Material).addEventListener('dispose', () => disposed++); });
    zombie.dispose();
    assert.ok(disposed > 0);
});

import { clearSession, loadSession, saveSession } from './save.ts';
import { CHEST_SLOTS, GLASS } from './crafting.ts';
import { CHEST, OPEN_DOOR, TREES } from './world.ts';
test('session saves, validates untrusted data, migrates v2 saves, and clears', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } };
    assert.equal(loadSession(storage), null);
    const world = generateWorld();
    world.set(3, 20, 3, 7);
    const slots = createInventory().slots;
    slots[0] = { id: SWORD, count: 1, durability: 20 }; slots[12] = { id: 4, count: 64, durability: 0 };
    world.set(3, 21, 3, CHEST);
    const chest = { x: 3, y: 21, z: 3, slots: Array.from({ length: CHEST_SLOTS }, (_, i) => i === 4 ? { id: GLASS, count: 9, durability: 0 } : null) };
    const drops = [{ id: CHICKEN_MEAT, count: 2, durability: 0, x: 50.5, y: 9, z: 40.5, age: 12 }];
    assert.equal(saveSession({ world: world.data, slots, health: 7, selected: 3, drops,
        position: { x: 4.5, y: 9, z: 6.5 }, yaw: 1, pitch: -.2, phase: 4, animals: [true, false],
        zombies: [{ spawned: true, health: 3, position: { x: 80.5, y: 9, z: 50.5 }, state: 'windup', timer: .2, knockX: 0, knockZ: 0 }],
        day: 5, spawn: { x: 40.5, y: 10, z: 40.5 }, trees: TREES.map((_, i) => i === 2 ? 4 : -1), chests: [chest, { ...chest, x: 4 }] }, storage), true);
    const session = loadSession(storage)!;
    assert.deepEqual(session.world, world.data);
    assert.deepEqual([session.health, session.selected, session.phase, session.yaw], [7, 3, 4, 1]);
    assert.deepEqual(session.slots, slots);
    assert.deepEqual(session.drops, drops);
    assert.deepEqual(session.position, { x: 4.5, y: 9, z: 6.5 });
    assert.deepEqual(session.animals, [true, false]);
    assert.deepEqual(session.zombies, [{ spawned: true, health: 3, position: { x: 80.5, y: 9, z: 50.5 }, state: 'windup', timer: .2, knockX: 0, knockZ: 0 }]);
    assert.deepEqual([session.day, session.spawn, session.trees[2], session.trees[0]], [5, { x: 40.5, y: 10, z: 40.5 }, 4, -1]);
    assert.deepEqual(session.chests, [chest]); // the second entry had no chest block under it
    // Tampered saves: bad fields fall back, bad stacks and drops are dropped, broken worlds are rejected.
    const data = JSON.parse(store.get('minecaves-session-v4')!);
    store.set('minecaves-session-v4', JSON.stringify({ ...data, health: 99, selected: 12,
        slots: [{ id: SWORD, count: 2 }, { id: 999, count: 1 }, { id: 4, count: 65 }, { id: OPEN_DOOR, count: 1 }, { id: 3, count: 5, durability: 9 }, 'x'],
        drops: [{ id: 3, count: 1, x: 'a' }, { id: 3, count: 1, durability: 0, x: 5, y: 5, z: 5, age: 1e9 }],
        position: { x: 'a' }, zombies: [{ spawned: 'yes', health: 999, position: { x: 1 }, state: 7, timer: 'soon' }] }));
    const repaired = loadSession(storage)!;
    assert.equal(repaired.health, 3);
    assert.equal(repaired.selected, 0);
    assert.deepEqual(repaired.slots.slice(0, 6), [null, null, null, null, { id: 3, count: 5, durability: 0 }, null]);
    assert.equal(repaired.slots.length, SLOTS);
    assert.deepEqual(repaired.drops, [{ id: 3, count: 1, durability: 0, x: 5, y: 5, z: 5, age: 300 }]);
    assert.equal(repaired.position, null);
    assert.deepEqual(repaired.zombies, [{ spawned: false, health: 0, position: null, state: 'wander', timer: 0, knockX: 0, knockZ: 0 }]);
    store.set('minecaves-session-v4', JSON.stringify({ ...data, world: btoa('short') }));
    assert.equal(loadSession(storage), null);
    store.set('minecaves-session-v4', '{not json');
    assert.equal(loadSession(storage), null);
    // A v3 save predates the eight new blocks: its item IDs (sticks and up) move up by eight.
    store.set('minecaves-session-v3', JSON.stringify({ ...data, day: undefined, spawn: undefined, chests: undefined, slots: [{ id: 18, count: 1, durability: 20 }, { id: 4, count: 3 }], drops: [{ id: 17, count: 2, durability: 0, x: 5, y: 5, z: 5, age: 0 }] }));
    store.delete('minecaves-session-v4');
    const fromV3 = loadSession(storage)!;
    assert.deepEqual(fromV3.slots.slice(0, 2), [{ id: SWORD, count: 1, durability: 20 }, { id: 4, count: 3, durability: 0 }]);
    assert.equal(fromV3.drops[0].id, CHICKEN_MEAT);
    assert.deepEqual([fromV3.day, fromV3.spawn, fromV3.chests], [0, null, []]);
    // A v2 save keeps its world; per-item counts become stacks, with item IDs shifted past cactus, ice, and the v4 blocks.
    store.delete('minecaves-session-v3');
    const oldCounts = Array(17).fill(0); oldCounts[4] = 70; oldCounts[16] = 1; // wood, and the old sword ID
    store.set('minecaves-session-v2', JSON.stringify({ ...data, slots: undefined, counts: oldCounts, durability: [], hotbar: [1] }));
    const migrated = loadSession(storage)!;
    assert.deepEqual(migrated.world, world.data);
    assert.deepEqual(migrated.slots.slice(0, 3).map(stack => stack && [stack.id, stack.count]), [[4, 64], [4, 6], [SWORD, 1]]);
    clearSession(storage);
    assert.equal(store.size, 0);
    assert.equal(saveSession({ ...session }, { ...storage, setItem: () => { throw new Error('quota'); } }), false);
});

import { createDrops, DESPAWN } from './drops.ts';
test('dropped items fall and rest, get picked up with room, wait when full, and despawn', () => {
    const world = new World();
    for (let x = 0; x < 20; x++) for (let z = 0; z < 20; z++) world.set(x, 0, z, 3);
    const material = new MeshBasicMaterial();
    const drops = createDrops(world, material);
    const still = { x: 0, y: 0, z: 0 };
    drops.spawn({ id: 3, count: 5, durability: 0 }, { x: 5.5, y: 4, z: 5.5 }, still);
    const pack = createInventory();
    for (let i = 0; i < 120; i++) drops.update(1 / 60, null, pack);
    assert.equal(drops.snapshot()[0].y, 1); // came to rest on the floor
    // Full pack: standing on it leaves it on the ground.
    addItem(pack, 2, SLOTS * 64);
    const player = { x: 5.5, y: 1, z: 5.5 };
    assert.deepEqual(drops.update(1 / 60, player, pack), { picked: false, full: true });
    assert.equal(drops.count, 1);
    // Free a slot: walking over it picks it up.
    pack.slots[7] = null;
    assert.deepEqual(drops.update(1 / 60, player, pack), { picked: true, full: false });
    assert.equal(drops.count, 0);
    assert.deepEqual(pack.slots[7], { id: 3, count: 5, durability: 0 });
    // Thrown items can't be caught straight back; nearby ones drift in.
    const empty = createInventory();
    drops.spawn({ id: 4, count: 1, durability: 0 }, { x: 5.5, y: 1, z: 5.5 }, still, 1.5);
    for (let i = 0; i < 30; i++) drops.update(1 / 60, player, empty);
    assert.equal(countOf(empty, 4), 0);
    for (let i = 0; i < 120; i++) drops.update(1 / 60, player, empty);
    assert.equal(countOf(empty, 4), 1);
    drops.spawn({ id: 4, count: 1, durability: 0 }, { x: 8, y: 1, z: 5.5 }, still);
    for (let i = 0; i < 120; i++) drops.update(1 / 60, player, empty);
    assert.equal(countOf(empty, 4), 2);
    // Left alone for five minutes, they vanish.
    drops.spawn({ id: 4, count: 1, durability: 0 }, { x: 15.5, y: 1, z: 15.5 }, still);
    drops.update(DESPAWN + 1, null, empty);
    assert.equal(drops.count, 0);
    let disposed = 0;
    drops.group.addEventListener('removed', () => disposed++);
    drops.dispose();
    material.dispose();
});

import { BED, BED_HEAD, BED_HEIGHT, DOOR, SMELTER, STOVE, WINDOW, regrowTrees } from './world.ts';
import { COOKED_CHICKEN, toggleDoor } from './crafting.ts';
test('stations, cooking, smelting, doors, beds, windows, and regrowing trees', () => {
    // Cooking and smelting need their own station and burn a plank each time.
    const pack = createInventory();
    addItem(pack, CHICKEN_MEAT, 2); addItem(pack, SAND, 4); addItem(pack, PLANKS, 2);
    const cook = RECIPES.find(recipe => recipe.id === 'cooked-chicken')!;
    assert.equal(craftBlocker(pack, cook, [TABLE, SMELTER]), 'station');
    assert.equal(craft(pack, 'cooked-chicken', [STOVE]), true);
    assert.equal(craft(pack, 'glass', [SMELTER]), true);
    assert.deepEqual([countOf(pack, COOKED_CHICKEN), countOf(pack, GLASS), countOf(pack, PLANKS)], [1, 2, 0]);
    assert.equal(craftBlocker(pack, cook, [STOVE]), 'materials'); // out of fuel
    // Cooked food is worth three hearts, and the held food is eaten first.
    const cooked = pack.slots.findIndex(stack => stack?.id === COOKED_CHICKEN);
    assert.deepEqual(eat(pack, 3, cooked), { food: COOKED_CHICKEN, health: 6 });
    assert.deepEqual(eat(pack, 9, -1), { food: CHICKEN_MEAT, health: 10 });

    const flat = new World();
    for (let x = 0; x < SIZE_X; x++) for (let z = 0; z < SIZE_Z; z++) flat.set(x, 0, z, 3);
    const me = { x: 30.5, y: 1, z: 30.5 };
    // Doors stand two high between walls, swing open to let bodies through, and break as one.
    const walls = createInventory();
    addItem(walls, DOOR, 2); addItem(walls, BED, 1);
    for (let z = 0; z < SIZE_Z; z++) for (const y of [1, 2, 3]) if (z !== 10 || y === 3) flat.set(10, y, z, 3);
    assert.equal(place(flat, me, walls, 0, 10, 1, 10), true);
    assert.deepEqual([1, 2, 3].map(y => flat.get(10, y, 10)), [DOOR, DOOR, 3]);
    assert.equal(findPath(flat, { x: 5.5, y: 1, z: 10.5 }, { x: 15.5, y: 1, z: 10.5 }), null);
    const walker = new Player(flat);
    Object.assign(walker.position, { x: 8.5, y: 1, z: 10.5 });
    for (let i = 0; i < 120; i++) walker.step(flat, 1 / 120, 4.6, 0, false);
    assert.ok(walker.position.x <= 9.7);
    assert.equal(toggleDoor(flat, me, 10, 2, 10), true); // from the top half, both open
    assert.deepEqual([flat.get(10, 1, 10), flat.get(10, 2, 10)], [OPEN_DOOR, OPEN_DOOR]);
    assert.ok(findPath(flat, { x: 5.5, y: 1, z: 10.5 }, { x: 15.5, y: 1, z: 10.5 }));
    for (let i = 0; i < 240; i++) walker.step(flat, 1 / 120, 4.6, 0, false);
    assert.ok(walker.position.x > 11);
    assert.equal(toggleDoor(flat, { x: 10.5, y: 1, z: 10.5 }, 10, 1, 10), false); // won't shut on you
    assert.equal(harvest(flat, me, walls, 5, 10, 2, 10), DOOR);
    assert.deepEqual([flat.get(10, 1, 10), flat.get(10, 2, 10)], [0, 0]);
    flat.set(20, 2, 5, 3);
    assert.equal(place(flat, me, walls, 0, 20, 1, 5), false); // no room for the top half
    assert.equal(flat.get(20, 1, 5), 0);
    // A bed reaches one cell along your facing, you rest on its low top, and it breaks as one.
    const bedSlot = walls.slots.findIndex(stack => stack?.id === BED);
    assert.equal(place(flat, me, walls, bedSlot, 25, 1, 25, [.2, -.9]), true);
    assert.deepEqual([flat.get(25, 1, 25), flat.get(25, 1, 24)], [BED, BED_HEAD]);
    const sleeper = new Player(flat);
    Object.assign(sleeper.position, { x: 25.5, y: 3, z: 25.5 });
    for (let i = 0; i < 240; i++) sleeper.step(flat, 1 / 120, 0, 0, false);
    assert.equal(sleeper.position.y, 1 + BED_HEIGHT);
    for (let i = 0; i < 60; i++) sleeper.step(flat, 1 / 120, 0, -2, false); // walk along the top onto the head
    assert.ok(sleeper.position.z < 25 && sleeper.position.y === 1 + BED_HEIGHT);
    assert.equal(harvest(flat, me, walls, 5, 25, 1, 24), BED);
    assert.deepEqual([flat.get(25, 1, 25), flat.get(25, 1, 24)], [0, 0]);
    // Windows: you see the stone behind them, and the shaped blocks still get drawn.
    const glass = new World();
    glass.set(0, 0, 0, 3); glass.set(1, 0, 0, WINDOW); glass.set(2, 0, 0, WINDOW);
    let stoneFaces = 0, windowFaces = 0;
    visibleFaces(glass, (_x, _y, _z, id) => { if (id === 3) stoneFaces++; else windowFaces++; });
    assert.deepEqual([stoneFaces, windowFaces], [6, 9]); // stone shows through; faces against stone or another window are hidden
    glass.set(5, 0, 5, DOOR);
    assert.equal(terrainGeometry(glass).getAttribute('position').count, (6 + 9 + 6) * 4);

    // A felled tree grows back two dawns after it's first seen missing, unless its spot is covered.
    const forest = generateWorld(), [tx, tz] = TREES[0], since = TREES.map(() => -1);
    let ground = SIZE_Y - 1; while ([0, 4, 5].includes(forest.get(tx, ground, tz))) ground--;
    for (let h = 1; h <= 4; h++) forest.set(tx, ground + h, tz, 0);
    assert.equal(regrowTrees(forest, 1, since), false);
    assert.equal(since[0], 1);
    assert.equal(regrowTrees(forest, 2, since), false);
    assert.equal(regrowTrees(forest, 3, since), true);
    assert.deepEqual([1, 2, 3, 4].map(h => forest.get(tx, ground + h, tz)), [4, 4, 4, 4]);
    assert.equal(since[0], -1);
    for (let h = 1; h <= 4; h++) forest.set(tx, ground + h, tz, 0);
    forest.set(tx, ground + 1, tz, PLANKS);
    regrowTrees(forest, 4, since);
    assert.equal(regrowTrees(forest, 9, since), false);
    assert.equal(forest.get(tx, ground + 2, tz), 0);
});
