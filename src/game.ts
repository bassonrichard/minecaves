import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { generateWorld } from './world.ts';
import { createAnimals } from './animals.ts';
import { Player } from './player.ts';
import { makeAtlas, terrainGeometry } from './terrain.ts';
import { createEnvironment } from './environment.ts';
import { createZombie } from './zombie.ts';
import { CHICKEN_MEAT, FEATHER, HOTBAR, MAX_HEALTH, START_HEALTH, SWORD, TABLE, attackDamage, createInventory, craft, eat, tableNearby, miningSeconds, harvest, place, wear, type Inventory } from './crafting.ts';
type Callbacks = {
    locked: (value: boolean) => void;
    selected: (value: number) => void;
    error: (message: string) => void;
    previews: (images: string[]) => void;
    inventory: (inventory: Inventory) => void;
    crafting: (open: boolean, table: boolean) => void;
    mining: (progress: number, message: string) => void;
    health: (value: number, hurt: boolean) => void;
    hotbar: (order: number[]) => void;
};
export function createGame(host: HTMLElement, callbacks: Callbacks) {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#b9d6da');
    scene.fog = new THREE.Fog('#b9d6da', 35, 75);
    const environment = createEnvironment(scene);
    const camera = new THREE.PerspectiveCamera(70, 1, .05, 120);
    const world = generateWorld(), player = new Player(world);
    camera.position.set(player.position.x, player.position.y + 1.62, player.position.z);
    camera.rotation.set(-.16, -.35, 0);
    const controls = new PointerLockControls(camera, renderer.domElement);
    const { texture, previews } = makeAtlas();
    callbacks.previews(previews);
    const material = new THREE.MeshLambertMaterial({ map: texture });
    const terrain = new THREE.Mesh(terrainGeometry(world), material);
    scene.add(terrain);
    const wildlife = createAnimals(world);
    scene.add(wildlife.group);
    const zombie = createZombie(world);
    scene.add(zombie.root);
    const outlineGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006));
    const outlineMaterial = new THREE.LineBasicMaterial({ color: '#fff3ce' });
    const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
    outline.visible = false;
    scene.add(outline);
    const raycaster = new THREE.Raycaster();
    raycaster.far = 5;
    const keys = new Set<string>();
    const inventory = createInventory();
    let craftingOpen = false, miningHeld = false, miningTarget = '', miningTime = 0;
    let lastProgress = -1, lastHint = '';
    function publishInventory() { callbacks.inventory({ counts: [...inventory.counts], durability: [...inventory.durability] }); }
    function miningStatus(progress: number, hint: string) {
        const percent = Math.floor(progress * 100);
        if (percent !== lastProgress || hint !== lastHint) {
            callbacks.mining(percent, hint); lastProgress = percent; lastHint = hint;
        }
    }
    function resetMining() { miningHeld = false; miningTarget = ''; miningTime = 0; miningStatus(0, ''); }
    let health = START_HEALTH, knockX = 0, knockZ = 0;
    const hotbar = [...HOTBAR];
    callbacks.health(health, false);
    callbacks.hotbar([...hotbar]);
    function hurt(damage: number) {
        health = Math.max(0, health - damage);
        callbacks.health(health, true);
        if (!health) {
            // Defeated: back to the start with a fresh pack.
            Object.assign(player.position, new Player(world).position);
            player.velocityY = 0; knockX = knockZ = 0;
            health = START_HEALTH;
            inventory.counts.fill(0); inventory.durability.fill(0);
            zombie.despawn();
            publishInventory(); callbacks.health(health, false);
            miningStatus(0, 'You were defeated · your pack was lost');
            return;
        }
        // Knock the player back from the zombie with a little hop and a jolt of the view.
        const dx = player.position.x - zombie.root.position.x, dz = player.position.z - zombie.root.position.z, d = Math.hypot(dx, dz) || 1;
        knockX = dx / d * 4; knockZ = dz / d * 4;
        if (player.grounded) player.velocityY = 4;
        const view = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
        view.x = Math.min(Math.PI / 2, view.x + .06);
        camera.quaternion.setFromEuler(view);
    }
    publishInventory();
    let selected = 1, disposed = false, frame = 0, previous = performance.now(), accumulator = 0;
    const listeners: (() => void)[] = [];
    function listen(target: EventTarget, name: string, callback: EventListener) {
        target.addEventListener(name, callback);
        listeners.push(() => target.removeEventListener(name, callback));
    }
    function hit() { camera.updateMatrixWorld(); raycaster.setFromCamera(new THREE.Vector2(), camera); return raycaster.intersectObject(terrain, false)[0]; }
    function select(id: number) {
        if (!HOTBAR.includes(id)) return;
        resetMining(); selected = id; callbacks.selected(id);
    }
    function pause() { keys.clear(); resetMining(); if (controls.isLocked) controls.unlock(); }
    function openCrafting() {
        craftingOpen = true; pause(); callbacks.crafting(true, tableNearby(world, player.position));
    }
    function rebuild() {
        // ponytail: rebuild the bounded world; use dirty chunk meshes for larger maps.
        const old = terrain.geometry; terrain.geometry = terrainGeometry(world); old.dispose();
    }
    controls.addEventListener('lock', () => { callbacks.locked(true); keys.clear(); accumulator = 0; });
    controls.addEventListener('unlock', () => { callbacks.locked(false); keys.clear(); resetMining(); outline.visible = false; });
    listen(document, 'pointerlockerror', () => callbacks.error('Mouse capture was blocked. Retry, or open this page in a desktop browser such as Chrome.'));
    listen(renderer.domElement, 'webglcontextlost', (event) => { event.preventDefault(); pause(); callbacks.error('The graphics context was lost. Reload this page to restart the world.'); });
    listen(window, 'blur', pause);
    listen(document, 'visibilitychange', () => { if (document.hidden)
        pause(); });
    listen(window, 'keydown', (event) => {
        const e = event as KeyboardEvent;
        if (!controls.isLocked)
            return;
        if (e.code === 'KeyE' && !e.repeat) { e.preventDefault(); openCrafting(); return; }
        if (e.code === 'KeyF' && !e.repeat) {
            const before = health;
            health = eat(inventory, health);
            if (health > before) { publishInventory(); callbacks.health(health, false); miningStatus(0, 'Ate raw chicken · +1 heart'); }
            else miningStatus(0, health >= MAX_HEALTH ? 'Already at full health' : 'No raw chicken in your pack');
            return;
        }
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'].includes(e.code))
            e.preventDefault();
        keys.add(e.code);
        // Keys 1–9 then 0 pick hotbar positions left to right.
        if (/^Digit[0-9]$/.test(e.code))
            select(hotbar[(Number(e.code.slice(-1)) + 9) % 10]);
    });
    listen(window, 'keyup', event => keys.delete((event as KeyboardEvent).code));
    listen(renderer.domElement, 'contextmenu', event => event.preventDefault());
    listen(window, 'mouseup', event => { if ((event as MouseEvent).button === 0) resetMining(); });
    listen(renderer.domElement, 'mousedown', event => {
        const e = event as MouseEvent;
        if (!controls.isLocked) return;
        if (e.button === 0) {
            const reach = hit()?.distance ?? Infinity, damage = attackDamage(inventory, selected);
            const zombieHit = zombie.root.visible ? raycaster.intersectObject(zombie.root, true)[0] : undefined;
            // Dead chickens stay in the group hidden; skip them so they don't eat clicks.
            const animalHit = raycaster.intersectObjects(wildlife.group.children.filter(animal => animal.visible), true)[0];
            if (zombieHit && zombieHit.distance < reach && (!animalHit || zombieHit.distance <= animalHit.distance)) {
                resetMining();
                const dead = zombie.hit(damage);
                if (selected === SWORD) { wear(inventory, SWORD); publishInventory(); }
                miningStatus(0, dead ? 'Zombie defeated' : 'Zombie hit');
                return;
            }
            if (animalHit && animalHit.distance < reach) {
                const result = wildlife.damage(animalHit.object, damage);
                if (result) {
                    resetMining();
                    if (selected === SWORD) wear(inventory, SWORD);
                    if (result.dead) {
                        inventory.counts[FEATHER] += result.feathers;
                        inventory.counts[CHICKEN_MEAT] += result.meat;
                        miningStatus(0, `Chicken defeated · ${result.feathers} feather${result.feathers === 1 ? '' : 's'} · ${result.meat} meat`);
                    } else miningStatus(0, 'Chicken hit');
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
        if (world.get(target.x, target.y, target.z) === TABLE) { openCrafting(); return; }
        const point = intersection.point.clone().addScaledVector(intersection.face.normal, .001).floor();
        if (place(world, player.position, inventory, selected, point.x, point.y, point.z)) {
            rebuild(); publishInventory();
        }
    });
    const resize = () => { const { width, height } = host.getBoundingClientRect(); renderer.setSize(width, height); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    const direction = new THREE.Vector3();
    function animate(now: number) {
        if (disposed)
            return;
        const elapsed = Math.min((now - previous) / 1000, .1);
        previous = now;
        environment.update(elapsed, camera);
        if (controls.isLocked) {
            wildlife.update(elapsed);
            accumulator += elapsed;
            camera.getWorldDirection(direction);
            direction.y = 0;
            direction.normalize();
            const night = environment.night();
            let forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
            let right = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
            const length = Math.hypot(forward, right) || 1;
            forward /= length;
            right /= length;
            while (accumulator >= 1 / 120) {
                player.step(world, 1 / 120, (direction.x * forward - direction.z * right) * 4.6 + knockX, (direction.z * forward + direction.x * right) * 4.6 + knockZ, keys.has('Space'));
                knockX *= .9; knockZ *= .9;
                accumulator -= 1 / 120;
                const damage = zombie.update(1 / 120, night, player.position);
                if (damage) hurt(damage);
            }
            camera.position.set(player.position.x, player.position.y + 1.62, player.position.z);
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
                    miningStatus(0, p.y === 0 ? 'The bottom layer cannot be broken' : 'Equip a wooden pickaxe to mine stone');
                } else {
                    miningTime += elapsed;
                    miningStatus(Math.min(1, miningTime / seconds), '');
                    if (miningTime >= seconds) {
                        if (harvest(world, player.position, inventory, selected, p.x, p.y, p.z)) {
                            rebuild(); publishInventory();
                        }
                        miningTime = 0; miningTarget = ''; miningStatus(0, '');
                    }
                }
            } else if (miningHeld) {
                miningTime = 0; miningTarget = ''; miningStatus(0, 'Move closer to a block');
            }
        }
        renderer.render(scene, camera);
        frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return {
        async play() {
            if (disposed) return;
            craftingOpen = false; callbacks.crafting(false, false);
            callbacks.error('');
            try {
                // The native promise lets us catch failures; controls listens for the lock event.
                await renderer.domElement.requestPointerLock();
            } catch {
                if (!disposed) callbacks.error('Mouse capture was blocked. Retry, or open this page in a desktop browser such as Chrome.');
            }
        },
        select,
        // Swap two hotbar positions (drag and drop or Alt+arrow in the UI).
        swapSlots(a: number, b: number) {
            if (!hotbar[a] || !hotbar[b] || a === b) return;
            [hotbar[a], hotbar[b]] = [hotbar[b], hotbar[a]];
            callbacks.hotbar([...hotbar]);
        },
        openCrafting,
        closeCrafting() { craftingOpen = false; callbacks.crafting(false, false); },
        craft(recipeId: string) {
            if (!craftingOpen) return;
            const table = tableNearby(world, player.position);
            if (craft(inventory, recipeId, table)) publishInventory();
            callbacks.crafting(true, table);
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
            zombie.dispose();
            environment.dispose();
            terrain.geometry.dispose();
            material.dispose();
            texture.dispose();
            outlineGeometry.dispose();
            outlineMaterial.dispose();
            renderer.dispose();
            renderer.domElement.remove();
        },
    };
}
