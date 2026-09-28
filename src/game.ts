import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { BED, BED_HEAD, BIOMES, BRIGHTNESS, CACTUS, CHEST, DOOR, ICE_CRYSTAL, LAVA, OPEN_DOOR, QUICKSAND, SIZE_X, SIZE_Z, TREES, WATER, biomeAt, computeLight, generateWorld, inside, regrowTrees, settle, type Vec3 } from './world.ts';
import { createDrops } from './drops.ts';
import { createHand } from './hand.ts';
import { createAnimals } from './animals.ts';
import { Player } from './player.ts';
import { makeAtlas, terrainGeometry } from './terrain.ts';
import { createEnvironment } from './environment.ts';
import { createZombie } from './zombie.ts';
import { createCaveCreatures } from './cave.ts';
import { clearSession, loadSession, saveSession } from './save.ts';
import { CHEST_SLOTS, HOTBAR_SLOTS, ITEMS, MAX_HEALTH, SLOTS, STATIONS, START_HEALTH, SWORDS, attackDamage, createInventory, craft, eat, held, stationsNearby, miningSeconds, harvest, moveSlot, place, toggleDoor, wear, type Inventory, type Stack } from './crafting.ts';
type Callbacks = {
    locked: (value: boolean) => void;
    selected: (value: number) => void;
    error: (message: string) => void;
    previews: (images: string[]) => void;
    inventory: (inventory: Inventory) => void;
    // `near` lists the stations in reach; `chest` holds the open chest's slots, or null at a station.
    crafting: (open: boolean, near: number[], chest: (Stack | null)[] | null) => void;
    mining: (progress: number, message: string) => void;
    health: (value: number, hurt: boolean) => void;
    // How frozen you are (0–1, in tenths) and whether you're on fire.
    status: (frost: number, burning: boolean) => void;
};
// Lights terrain by its baked (sky, block) brightness: sky light scales the sun and moon, block light glows on its own.
// Block light only adds what daylight doesn't already give, so torches don't wash out the day.
function caveLit(material: THREE.MeshLambertMaterial, daylight: { value: number }) {
    material.onBeforeCompile = shader => {
        shader.uniforms.daylight = daylight;
        shader.vertexShader = 'attribute vec4 cellLight;\nvarying vec4 vCellLight;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCellLight = cellLight;');
        shader.fragmentShader = 'uniform float daylight;\nvarying vec4 vCellLight;\n' + shader.fragmentShader.replace('#include <emissivemap_fragment>',
            '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * max(vCellLight.yzw - vCellLight.x * daylight, 0.);\ndiffuseColor.rgb *= max(vCellLight.x, .004);');
    };
}
export function createGame(host: HTMLElement, callbacks: Callbacks) {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#b9d6da');
    scene.fog = new THREE.Fog('#b9d6da', 35, 75);
    const saved = loadSession();
    const environment = createEnvironment(scene, saved?.phase ?? undefined, saved?.day ?? 0);
    const camera = new THREE.PerspectiveCamera(70, 1, .05, 120);
    const world = generateWorld();
    if (saved) world.data.set(saved.world);
    const player = new Player(world);
    if (saved?.position) Object.assign(player.position, saved.position);
    camera.position.set(player.position.x, player.position.y + 1.62, player.position.z);
    if (saved?.yaw != null && saved.pitch != null) camera.quaternion.setFromEuler(new THREE.Euler(saved.pitch, saved.yaw, 0, 'YXZ'));
    else camera.rotation.set(-.16, -.35, 0);
    const controls = new PointerLockControls(camera, renderer.domElement);
    const { texture, previews } = makeAtlas();
    callbacks.previews(previews);
    // alphaTest cuts out window panes without any transparency sorting.
    const material = new THREE.MeshLambertMaterial({ map: texture, alphaTest: .5 });
    const daylight = { value: 1 };
    let light = computeLight(world);
    const terrain = new THREE.Mesh(terrainGeometry(world, false, light), material);
    // Water is a separate see-through mesh; the raycaster ignores it, so you aim and build through it.
    // Double-sided so that, from underwater, the surface closes over you like a ceiling.
    const waterMaterial = new THREE.MeshLambertMaterial({ map: texture, transparent: true, opacity: .7, depthWrite: false, side: THREE.DoubleSide });
    const water = new THREE.Mesh(terrainGeometry(world, true, light), waterMaterial);
    caveLit(material, daylight); caveLit(waterMaterial, daylight);
    scene.add(terrain, water);
    const wildlife = createAnimals(world);
    // Chickens killed before the reload stay gone.
    saved?.animals.forEach((alive, i) => { if (!alive && wildlife.group.children[i]) wildlife.group.children[i].visible = false; });
    scene.add(wildlife.group);
    // Bats, spiders, and cave snakes, down in the dark.
    const cave = createCaveCreatures(world);
    scene.add(cave.group);
    // One themed zombie per biome each night.
    const zombies = BIOMES.map(biome => createZombie(world, biome));
    zombies.forEach((zombie, i) => { scene.add(zombie.root); if (saved?.zombies[i]) zombie.restore(saved.zombies[i]); });
    const outlineGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006));
    const outlineMaterial = new THREE.LineBasicMaterial({ color: '#fff3ce' });
    const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
    outline.visible = false;
    scene.add(outline);
    const drops = createDrops(world, material);
    scene.add(drops.group);
    if (saved) drops.restore(saved.drops);
    const hand = createHand(material);
    const raycaster = new THREE.Raycaster();
    raycaster.far = 5;
    const keys = new Set<string>();
    const inventory = createInventory();
    let craftingOpen = false, miningHeld = false, miningTarget = '', miningTime = 0;
    // Chest contents by "x,y,z"; created the first time a chest is opened. `openChest` is the one on screen.
    const chests = new Map<string, (Stack | null)[]>(saved?.chests.map(chest => [`${chest.x},${chest.y},${chest.z}`, chest.slots]));
    let openChest: (Stack | null)[] | null = null;
    // Where you wake after dying: your bed, while it stands.
    let spawn: Vec3 | null = saved?.spawn ?? null;
    let day = environment.day();
    const treesMissingSince = saved?.trees ?? TREES.map(() => -1);
    let lastProgress = -1, lastHint = '';
    // Every inventory change goes through here, so the held item always matches the selected slot.
    function publishInventory() {
        callbacks.inventory({ slots: inventory.slots.map(stack => stack && { ...stack }) });
        hand.setItem(held(inventory, selected));
    }
    function miningStatus(progress: number, hint: string) {
        const percent = Math.floor(progress * 100);
        if (percent !== lastProgress || hint !== lastHint) {
            callbacks.mining(percent, hint); lastProgress = percent; lastHint = hint;
        }
    }
    function resetMining() { miningHeld = false; miningTarget = ''; miningTime = 0; miningStatus(0, ''); }
    if (saved) inventory.slots = saved.slots;
    let health = saved?.health ?? START_HEALTH, knockX = 0, knockZ = 0, cactusCooldown = 0, wasFull = false;
    // Cave hazards: frost builds from 0 to 1, `burning` counts down the seconds you stay on fire.
    let frost = 0, burning = 0, frostCooldown = 0, burnCooldown = 0, sandCooldown = 0, lastStatus = '';
    const bedAt = (at: Vec3) => [BED, BED_HEAD].includes(world.get(Math.floor(at.x), Math.floor(at.y), Math.floor(at.z)));
    // Spills a stack list out at a spot, like a defeat or a broken chest.
    function spill(stacks: (Stack | null)[], at: Vec3) {
        for (const stack of stacks) if (stack) drops.spawn(stack, at, { x: (Math.random() - .5) * 4, y: 3 + Math.random() * 2, z: (Math.random() - .5) * 4 });
    }
    let selected = saved?.selected ?? 0;
    callbacks.health(health, false);
    // Knockback only when something hit you (a zombie or cactus), not for falls.
    function hurt(damage: number, from?: Vec3) {
        health = Math.max(0, health - damage);
        callbacks.health(health, true);
        if (!health) {
            // Defeated: everything you carried spills where you fell; you wake at the start.
            spill(inventory.slots, { ...player.position, y: player.position.y + .8 });
            inventory.slots.fill(null);
            // Wake on your bed if it's still there, otherwise back at the start.
            if (spawn && bedAt(spawn)) Object.assign(player.position, { x: spawn.x, y: Math.floor(spawn.y) + 1, z: spawn.z });
            else Object.assign(player.position, new Player(world).position);
            player.velocityY = 0; player.fallFrom = null; knockX = knockZ = 0;
            health = START_HEALTH; frost = burning = 0;
            zombies.forEach(zombie => zombie.despawn());
            publishInventory(); callbacks.health(health, false);
            miningStatus(0, 'You died · your items are where you fell');
            return;
        }
        if (!from) return;
        // Knock the player back from the zombie with a little hop and a jolt of the view.
        const dx = player.position.x - from.x, dz = player.position.z - from.z, d = Math.hypot(dx, dz) || 1;
        knockX = dx / d * 4; knockZ = dz / d * 4;
        if (player.grounded) player.velocityY = 4;
        const view = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
        view.x = Math.min(Math.PI / 2, view.x + .06);
        camera.quaternion.setFromEuler(view);
    }
    publishInventory();
    // Nothing is saved until the player has stepped into the world, so the start menu only offers Continue for a real save.
    let played = !!saved;
    let disposed = false, resetting = false, saveFailed = false, sinceSave = 0, frame = 0, previous = performance.now(), accumulator = 0;
    const listeners: (() => void)[] = [];
    function listen(target: EventTarget, name: string, callback: EventListener) {
        target.addEventListener(name, callback);
        listeners.push(() => target.removeEventListener(name, callback));
    }
    callbacks.selected(selected);
    function save() {
        if (resetting || !played) return;
        const view = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
        const stored = saveSession({
            world: world.data, slots: inventory.slots, health, selected, drops: drops.snapshot(),
            position: player.position, yaw: view.y, pitch: view.x, phase: environment.phase(),
            animals: wildlife.group.children.map(animal => animal.visible), zombies: zombies.map(zombie => zombie.snapshot()),
            day: environment.day(), spawn, trees: treesMissingSince,
            chests: [...chests].map(([key, slots]) => { const [x, y, z] = key.split(',').map(Number); return { x, y, z, slots }; }),
        });
        if (!stored && !saveFailed) { saveFailed = true; callbacks.error('This browser is blocking storage, so your world will not be saved across reloads.'); }
    }
    function hit() { camera.updateMatrixWorld(); raycaster.setFromCamera(new THREE.Vector2(), camera); return raycaster.intersectObject(terrain, false)[0]; }
    function select(slot: number) {
        if (!Number.isInteger(slot) || slot < 0 || slot >= HOTBAR_SLOTS) return;
        resetMining(); selected = slot; callbacks.selected(slot); hand.setItem(held(inventory, slot));
    }
    // Tosses a stack (or one of it) forward; you can't catch it again straight away.
    // Slots past the pack (SLOTS and up) belong to the open chest.
    function slotList(slot: number): [(Stack | null)[], number] {
        return slot >= SLOTS && openChest ? [openChest, slot - SLOTS] : [inventory.slots, slot];
    }
    function toss(slot: number, all: boolean) {
        const [list, i] = slotList(slot), stack = list[i];
        if (!stack) return;
        const thrown: Stack = { ...stack, count: all ? stack.count : 1 };
        stack.count -= thrown.count;
        if (!stack.count) list[i] = null;
        camera.getWorldDirection(direction);
        drops.spawn(thrown, { x: camera.position.x + direction.x * .4, y: camera.position.y - .35, z: camera.position.z + direction.z * .4 },
            { x: direction.x * 5, y: direction.y * 5 + 1.5, z: direction.z * 5 }, 1.5);
        hand.swing();
        publishInventory();
    }
    // The first cell of this block the player's body is in or brushing against, if any.
    function touching(id: number) {
        const p = player.position;
        for (let x = Math.floor(p.x - .36); x <= Math.floor(p.x + .36); x++)
            for (let y = Math.floor(p.y - .05); y <= Math.floor(p.y + 1.8); y++)
                for (let z = Math.floor(p.z - .36); z <= Math.floor(p.z + .36); z++)
                    if (world.get(x, y, z) === id) return { x: x + .5, y, z: z + .5 };
        return null;
    }
    const bodyAt = (dy: number) => world.get(Math.floor(player.position.x), Math.floor(player.position.y + dy), Math.floor(player.position.z));
    // One physics step of cave hazards: ice crystals and icy water freeze you, lava sets you alight, quicksand smothers.
    function hazards(dt: number) {
        const p = player.position, swimming = bodyAt(.1) === WATER, inLava = bodyAt(.1) === LAVA || bodyAt(.9) === LAVA;
        const chilled = !!touching(ICE_CRYSTAL) || (swimming && biomeAt(p.x, p.z) === 'snow');
        frost = Math.min(1, Math.max(0, frost + (chilled ? dt / 3 : -dt / 2)));
        frostCooldown -= dt; burnCooldown -= dt; sandCooldown -= dt;
        if (frost >= 1 && frostCooldown <= 0) { frostCooldown = 2; hurt(1); miningStatus(0, "You're freezing · get away from the ice"); }
        if (inLava && !burning) miningStatus(0, "You're on fire · jump in water");
        burning = inLava ? 4 : swimming ? 0 : Math.max(0, burning - dt);
        if (burning && burnCooldown <= 0) { burnCooldown = inLava ? .5 : 1; hurt(1); }
        if (bodyAt(1.62) === QUICKSAND && sandCooldown <= 0) { sandCooldown = 1; hurt(1); miningStatus(0, 'Sinking in quicksand · hold Space to climb out'); }
        const status = `${Math.round(frost * 10) / 10},${burning > 0}`;
        if (status !== lastStatus) { lastStatus = status; callbacks.status(Math.round(frost * 10) / 10, burning > 0); }
    }
    // Brightness at the eye: how open to the sky it is, and the glow of anything nearby.
    function lightAt(eye: Vec3) {
        const x = Math.floor(eye.x), y = Math.floor(eye.y), z = Math.floor(eye.z);
        if (!inside(x, y, z)) return { sky: 1, block: 0 };
        const i = x + SIZE_X * (z + SIZE_Z * y);
        return { sky: BRIGHTNESS[light.sky[i]], block: BRIGHTNESS[light.block[i]] };
    }
    function pause() { keys.clear(); resetMining(); if (controls.isLocked) controls.unlock(); }
    function publishPanel() { callbacks.crafting(craftingOpen, craftingOpen ? stationsNearby(world, player.position) : [], openChest && openChest.map(stack => stack && { ...stack })); }
    function openCrafting(chest: (Stack | null)[] | null = null) {
        // Opened mid-game (E, a station, or a chest): closing goes straight back to the world, not the pause menu.
        resumeAfterCrafting = controls.isLocked;
        openChest = chest;
        craftingOpen = true; pause(); publishPanel();
    }
    function sleep(x: number, y: number, z: number) {
        spawn = { x: x + .5, y, z: z + .5 };
        if (!environment.night()) { miningStatus(0, 'Bed set as your respawn point'); return; }
        const monster = zombies.some(zombie => zombie.root.visible && zombie.root.position.distanceTo(new THREE.Vector3(x + .5, y, z + .5)) < 8);
        if (monster) { miningStatus(0, "You can't sleep with monsters nearby"); return; }
        environment.skipToMorning();
        miningStatus(0, 'You slept until morning');
    }
    // Sunrise: animals come back fresh, and trees gone for two days grow back.
    function dawn() {
        wildlife.respawn();
        cave.respawn();
        if (regrowTrees(world, environment.day(), treesMissingSince, player.position)) rebuild();
    }
    function rebuild() {
        // ponytail: rebuild the bounded world; use dirty chunk meshes for larger maps.
        light = computeLight(world);
        for (const [mesh, isWater] of [[terrain, false], [water, true]] as const) {
            const old = mesh.geometry; mesh.geometry = terrainGeometry(world, isWater, light); old.dispose();
        }
    }
    controls.addEventListener('lock', () => { played = true; callbacks.locked(true); keys.clear(); accumulator = 0; });
    controls.addEventListener('unlock', () => { callbacks.locked(false); keys.clear(); resetMining(); outline.visible = false; save(); });
    listen(window, 'pagehide', save);
    listen(document, 'pointerlockerror', () => {
        callbacks.locked(controls.isLocked);
        if (!quietLock) callbacks.error('Mouse capture was blocked. Retry, or open this page in a desktop browser such as Chrome.');
    });
    listen(renderer.domElement, 'webglcontextlost', (event) => { event.preventDefault(); pause(); callbacks.error('The graphics context was lost. Reload this page to restart the world.'); });
    listen(window, 'blur', pause);
    listen(document, 'visibilitychange', () => { if (document.hidden)
        pause(); });
    listen(window, 'keydown', (event) => {
        const e = event as KeyboardEvent;
        if (!controls.isLocked)
            return;
        if (e.code === 'KeyE' && !e.repeat) { e.preventDefault(); openCrafting(); return; }
        if (e.code === 'KeyQ' && !e.repeat) { toss(selected, false); return; }
        if (e.code === 'KeyF' && !e.repeat) {
            const before = health, meal = eat(inventory, health, selected);
            health = meal.health;
            if (meal.food) { publishInventory(); callbacks.health(health, false); miningStatus(0, `Ate ${ITEMS[meal.food].toLowerCase()} · +${health - before} heart${health - before === 1 ? '' : 's'}`); }
            else miningStatus(0, before >= MAX_HEALTH ? 'Already at full health' : 'No food in your pack');
            return;
        }
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'].includes(e.code))
            e.preventDefault();
        keys.add(e.code);
        // Keys 1–9 then 0 pick hotbar positions left to right.
        if (/^Digit[0-9]$/.test(e.code))
            select((Number(e.code.slice(-1)) + 9) % 10);
    });
    listen(window, 'wheel', event => {
        const { deltaY } = event as WheelEvent;
        if (controls.isLocked && deltaY) select((selected + Math.sign(deltaY) + HOTBAR_SLOTS) % HOTBAR_SLOTS);
    });
    listen(window, 'keyup', event => keys.delete((event as KeyboardEvent).code));
    listen(renderer.domElement, 'contextmenu', event => event.preventDefault());
    listen(window, 'mouseup', event => { if ((event as MouseEvent).button === 0) resetMining(); });
    listen(renderer.domElement, 'mousedown', event => {
        const e = event as MouseEvent;
        if (!controls.isLocked) return;
        hand.swing();
        if (e.button === 0) {
            const reach = hit()?.distance ?? Infinity, damage = attackDamage(inventory, selected);
            let zombie = zombies[0], zombieHit: THREE.Intersection | undefined;
            for (const candidate of zombies) {
                const found = candidate.root.visible ? raycaster.intersectObject(candidate.root, true)[0] : undefined;
                if (found && (!zombieHit || found.distance < zombieHit.distance)) { zombie = candidate; zombieHit = found; }
            }
            // Dead chickens stay in the group hidden; skip them so they don't eat clicks.
            const animalHit = wildlife.group.visible ? raycaster.intersectObjects(wildlife.group.children.filter(animal => animal.visible), true)[0] : undefined;
            const caveHit = raycaster.intersectObjects(cave.group.children.filter(creature => creature.visible), true)[0];
            if (caveHit && caveHit.distance < reach && (!zombieHit || caveHit.distance <= zombieHit.distance) && (!animalHit || caveHit.distance <= animalHit.distance)) {
                resetMining();
                const result = cave.hit(caveHit.object, damage, player.position);
                if (result) {
                    if (SWORDS.includes(held(inventory, selected))) { wear(inventory, selected); publishInventory(); }
                    miningStatus(0, `${result.name} ${result.dead ? 'defeated' : 'hit'}`);
                }
                return;
            }
            if (zombieHit && zombieHit.distance < reach && (!animalHit || zombieHit.distance <= animalHit.distance)) {
                resetMining();
                const dead = zombie.hit(damage);
                if (SWORDS.includes(held(inventory, selected))) { wear(inventory, selected); publishInventory(); }
                miningStatus(0, `${zombie.root.name} ${dead ? 'defeated' : 'hit'}`);
                return;
            }
            if (animalHit && animalHit.distance < reach) {
                const result = wildlife.damage(animalHit.object, damage);
                if (result) {
                    resetMining();
                    if (SWORDS.includes(held(inventory, selected))) wear(inventory, selected);
                    const name = wildlife.group.children.find(animal => animal.getObjectById(animalHit.object.id))?.name ?? 'Animal';
                    if (result.dead) {
                        // Loot pops out where the animal stood, for you to walk over.
                        const at = { x: animalHit.point.x, y: animalHit.point.y, z: animalHit.point.z };
                        for (const stack of result.drops) drops.spawn(stack, at);
                        miningStatus(0, `${name} defeated · ${result.drops.map(stack => `${stack.count} ${ITEMS[stack.id].toLowerCase()}`).join(' · ')}`);
                    } else miningStatus(0, `${name} hit`);
                    publishInventory();
                }
                return;
            }
            miningHeld = true; return;
        }
        if (e.button !== 2) return;
        const intersection = hit();
        if (!intersection?.face) return;
        const target = intersection.point.clone().addScaledVector(intersection.face.normal, -.001).floor();
        const used = world.get(target.x, target.y, target.z);
        if (STATIONS.includes(used)) { openCrafting(); return; }
        if (used === CHEST) {
            const key = `${target.x},${target.y},${target.z}`;
            if (!chests.has(key)) chests.set(key, Array(CHEST_SLOTS).fill(null));
            openCrafting(chests.get(key)!); return;
        }
        if (used === DOOR || used === OPEN_DOOR) { if (toggleDoor(world, player.position, target.x, target.y, target.z)) rebuild(); return; }
        if (used === BED || used === BED_HEAD) { sleep(target.x, target.y, target.z); return; }
        const point = intersection.point.clone().addScaledVector(intersection.face.normal, .001).floor();
        camera.getWorldDirection(direction);
        const normal = intersection.face.normal;
        if (place(world, player.position, inventory, selected, point.x, point.y, point.z, [direction.x, direction.z], [Math.round(normal.x), Math.round(normal.y), Math.round(normal.z)])) {
            settle(world, point.x, point.y, point.z);
            rebuild(); publishInventory();
        }
    });
    let resumeAfterCrafting = false, quietLock = false;
    async function play(quiet = false) {
        if (disposed) return;
        craftingOpen = false; openChest = null; publishPanel();
        callbacks.error('');
        // Returning from crafting: show the world right away; the pause menu appears only if the browser refuses the lock.
        quietLock = quiet;
        if (quiet) callbacks.locked(true);
        try {
            // The native promise lets us catch failures; controls listens for the lock event.
            await renderer.domElement.requestPointerLock();
        } catch {
            if (disposed) return;
            callbacks.locked(controls.isLocked);
            if (!quiet) callbacks.error('Mouse capture was blocked. Retry, or open this page in a desktop browser such as Chrome.');
        }
    }
    const resize = () => { const { width, height } = host.getBoundingClientRect(); renderer.setSize(width, height); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    const direction = new THREE.Vector3(), caveGlow = new THREE.Color();
    function animate(now: number) {
        if (disposed)
            return;
        const elapsed = Math.min((now - previous) / 1000, .1);
        previous = now;
        environment.update(elapsed, camera);
        daylight.value = environment.daylight();
        if (environment.day() !== day) { day = environment.day(); dawn(); }
        // Friendly animals head off at dusk; dawn() brings them back.
        wildlife.group.visible = !environment.night();
        if (controls.isLocked) {
            if (wildlife.group.visible) wildlife.update(elapsed);
            accumulator += elapsed;
            // Autosave while playing; pausing and leaving the page save too.
            sinceSave += elapsed;
            if (sinceSave > 5) { sinceSave = 0; save(); }
            camera.getWorldDirection(direction);
            direction.y = 0;
            direction.normalize();
            const night = environment.night();
            let forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
            let right = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
            // Freezing slows you down, to half speed when frozen through.
            const length = (Math.hypot(forward, right) || 1) / (1 - frost * .5);
            forward /= length;
            right /= length;
            while (accumulator >= 1 / 120) {
                const fall = player.step(world, 1 / 120, (direction.x * forward - direction.z * right) * 4.6 + knockX, (direction.z * forward + direction.x * right) * 4.6 + knockZ, keys.has('Space'));
                if (fall) { hurt(fall); miningStatus(0, `Ouch · fell ${fall + 3}+ blocks`); }
                knockX *= .9; knockZ *= .9;
                accumulator -= 1 / 120;
                cactusCooldown -= 1 / 120;
                const cactus = cactusCooldown <= 0 ? touching(CACTUS) : null;
                if (cactus) { cactusCooldown = .5; hurt(1, cactus); }
                hazards(1 / 120);
                for (const zombie of zombies) {
                    const damage = zombie.update(1 / 120, night, player.position);
                    if (damage) hurt(damage, zombie.root.position);
                }
            }
            for (const bite of cave.update(elapsed, player.position)) { hurt(bite.damage, bite.from); miningStatus(0, `Bitten by a ${bite.name.toLowerCase()}`); }
            camera.position.set(player.position.x, player.position.y + 1.62, player.position.z);
            const { picked, full } = drops.update(elapsed, player.position, inventory);
            if (picked) publishInventory();
            if (full && !wasFull) miningStatus(0, 'Inventory full');
            wasFull = full;
            // The hand is lit like the spot you stand in: dark deep in a cave, glowing by a torch.
            const here = lightAt(camera.position);
            hand.update(elapsed, (forward !== 0 || right !== 0) && player.grounded, Math.max(here.sky * Math.max(.2, environment.daylight()), here.block), camera.aspect);
            const intersection = hit();
            outline.visible = !!intersection;
            if (intersection?.face) {
                const p = intersection.point.clone().addScaledVector(intersection.face.normal, -.001);
                outline.position.set(Math.floor(p.x) + .5, Math.floor(p.y) + .5, Math.floor(p.z) + .5);
            }
            if (miningHeld && intersection?.face) {
                const p = intersection.point.clone().addScaledVector(intersection.face.normal, -.001).floor();
                const target = `${p.x},${p.y},${p.z}`;
                if (target !== miningTarget) { miningTarget = target; miningTime = 0; }
                const seconds = miningSeconds(inventory, selected, world.get(p.x, p.y, p.z));
                if (p.y === 0 || seconds === null) {
                    miningTime = 0;
                    miningStatus(0, p.y === 0 ? 'The bottom layer cannot be broken' : world.get(p.x, p.y, p.z) === LAVA ? "Lava can't be mined" : 'Equip a pickaxe to mine this');
                } else {
                    miningTime += elapsed;
                    hand.swing();
                    miningStatus(Math.min(1, miningTime / seconds), '');
                    if (miningTime >= seconds) {
                        const drop = harvest(world, player.position, inventory, selected, p.x, p.y, p.z);
                        if (drop === CHEST) {
                            // A broken chest spills what it held.
                            const key = `${p.x},${p.y},${p.z}`;
                            spill(chests.get(key) ?? [], { x: p.x + .5, y: p.y + .3, z: p.z + .5 });
                            chests.delete(key);
                        }
                        if (drop !== null) {
                            // The block pops out as an item; loose sand falls and water pours into the gap.
                            if (drop) drops.spawn({ id: drop, count: 1, durability: 0 }, { x: p.x + .5, y: p.y + .3, z: p.z + .5 });
                            settle(world, p.x, p.y, p.z);
                            rebuild(); publishInventory();
                        }
                        miningTime = 0; miningTarget = ''; miningStatus(0, '');
                    }
                }
            } else if (miningHeld) {
                miningTime = 0; miningTarget = ''; miningStatus(0, 'Move closer to a block');
            }
        }
        // Underwater: close, blue fog; in lava, orange. Underground, the fog closes in and fades to black.
        // environment.update restores the colour each frame; restore the range here.
        const fog = scene.fog as THREE.Fog, background = scene.background as THREE.Color;
        const eye = world.get(Math.floor(camera.position.x), Math.floor(camera.position.y), Math.floor(camera.position.z)), open = lightAt(camera.position).sky;
        fog.color.multiplyScalar(open); background.multiplyScalar(open);
        // Underwater is blue, fading toward deep teal-black in the sea caves.
        if (eye === WATER) { fog.color.set('#1d4f86').multiplyScalar(Math.max(open, .3)); background.copy(fog.color); }
        if (eye === LAVA) { fog.color.set('#c2410c'); background.set('#c2410c'); }
        fog.near = eye === WATER ? .1 : eye === LAVA ? 0 : 4 + 31 * open; fog.far = eye === WATER ? 14 : eye === LAVA ? 2 : 28 + 47 * open;
        cave.shade(at => { const here = lightAt({ x: at.x, y: at.y + .3, z: at.z }); return { lit: here.sky, glow: caveGlow.setScalar(Math.max(here.block, .03)) }; });
        renderer.render(scene, camera);
        if (controls.isLocked) {
            // The held item draws on top of the world, with its own depth.
            renderer.autoClear = false;
            renderer.clearDepth();
            renderer.render(hand.scene, hand.camera);
            renderer.autoClear = true;
        }
        frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return {
        hasSave: !!saved,
        play: () => play(),
        select,
        // Drag and drop between any two slots, pack or open chest: merge or swap.
        moveSlot(from: number, to: number) {
            const combined = { slots: [...inventory.slots, ...(openChest ?? [])] };
            if (!moveSlot(combined, from, to)) return;
            inventory.slots = combined.slots.slice(0, SLOTS);
            if (openChest) openChest.splice(0, CHEST_SLOTS, ...combined.slots.slice(SLOTS));
            publishInventory(); publishPanel(); save();
        },
        // Throw a whole stack out of the inventory screen.
        dropSlot(slot: number) { toss(slot, true); publishPanel(); save(); },
        newWorld() {
            resetting = true;
            clearSession();
            location.reload();
        },
        openCrafting,
        closeCrafting() {
            if (resumeAfterCrafting) { resumeAfterCrafting = false; play(true); return; }
            craftingOpen = false; openChest = null; publishPanel();
        },
        craft(recipeId: string) {
            if (!craftingOpen) return;
            if (craft(inventory, recipeId, stationsNearby(world, player.position))) { publishInventory(); save(); }
            publishPanel();
        },
        dispose() {
            disposed = true;
            cancelAnimationFrame(frame);
            observer.disconnect();
            listeners.forEach(remove => remove());
            if (controls.isLocked)
                controls.unlock();
            controls.dispose();
            wildlife.dispose();
            cave.dispose();
            drops.dispose();
            hand.dispose();
            zombies.forEach(zombie => zombie.dispose());
            environment.dispose();
            terrain.geometry.dispose();
            water.geometry.dispose();
            material.dispose();
            waterMaterial.dispose();
            texture.dispose();
            outlineGeometry.dispose();
            outlineMaterial.dispose();
            renderer.dispose();
            renderer.domElement.remove();
        },
    };
}
