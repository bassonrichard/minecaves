import * as THREE from 'three';
import { Player } from './player.ts';
import { SIZE, type Vec3, type World } from './world.ts';

const SIGHT = 10, GIVE_UP = 16, LOST_SECONDS = 4, WINDUP = .45, STRIKE = .2, RECOVER = .9, STAGGER = .25;
const REST_ARMS = -Math.PI / 2, RAISED_ARMS = -2.4, SLAMMED_ARMS = -.6;

// Feet cell with solid ground below and room for a 1.8-tall body.
const standable = (world: World, x: number, y: number, z: number) =>
    y > 0 && !!world.get(x, y - 1, z) && !world.get(x, y, z) && !world.get(x, y + 1, z);

function groundCell(world: World, p: Vec3) {
    const x = Math.floor(p.x), z = Math.floor(p.z);
    for (let y = Math.floor(p.y + .01); y >= Math.floor(p.y) - 4; y--) if (standable(world, x, y, z)) return { x, y, z };
    return null;
}

// Where a walker ends up stepping from (x, y, z) into column (nx, nz): same level, one block up, or a drop of up to three.
function stepInto(world: World, x: number, y: number, z: number, nx: number, nz: number) {
    if (standable(world, nx, y, nz)) return y;
    if (world.get(nx, y, nz)) return standable(world, nx, y + 1, nz) && !world.get(x, y + 2, z) ? y + 1 : null;
    if (world.get(nx, y + 1, nz)) return null;
    for (let ny = y - 1; ny >= y - 3; ny--) if (standable(world, nx, ny, nz)) return ny;
    return null;
}

// ponytail: BFS over the whole 32³ world is instant; switch to A* if the world grows.
export function findPath(world: World, from: Vec3, to: Vec3): Vec3[] | null {
    const start = groundCell(world, from), goal = groundCell(world, to);
    if (!start || !goal) return null;
    const key = (x: number, y: number, z: number) => x + SIZE * (z + SIZE * y);
    const parent = new Int32Array(SIZE ** 3).fill(-1);
    const startKey = key(start.x, start.y, start.z), goalKey = key(goal.x, goal.y, goal.z);
    parent[startKey] = startKey;
    const queue = [startKey];
    for (let i = 0; i < queue.length && parent[goalKey] < 0; i++) {
        const k = queue[i], x = k % SIZE, z = Math.floor(k / SIZE) % SIZE, y = Math.floor(k / SIZE ** 2);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, nz = z + dz;
            if (nx < 0 || nz < 0 || nx >= SIZE || nz >= SIZE) continue;
            const ny = stepInto(world, x, y, z, nx, nz);
            if (ny === null || parent[key(nx, ny, nz)] >= 0) continue;
            parent[key(nx, ny, nz)] = k;
            queue.push(key(nx, ny, nz));
        }
    }
    if (parent[goalKey] < 0) return null;
    const path: Vec3[] = [];
    for (let k = goalKey; k !== startKey; k = parent[k])
        path.unshift({ x: k % SIZE + .5, y: Math.floor(k / SIZE ** 2), z: Math.floor(k / SIZE) % SIZE + .5 });
    return path;
}

type State = 'gone' | 'wander' | 'chase' | 'windup' | 'strike' | 'recover' | 'stagger';

export function createZombie(world: World) {
    const root = new THREE.Group();
    root.name = 'Zombie';
    root.visible = false;
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const colors = ['#3c5566', '#2a3d4a', '#2a1414', '#d9cfae', '#5b5148', '#3a332d', '#1f2a44', '#5d6a2e', '#16181f'];
    const materials = [...colors.map(color => new THREE.MeshLambertMaterial({ color })), new THREE.MeshBasicMaterial({ color: '#ff2a1a' })];
    const SKIN = 0, SHADE = 1, MOUTH = 2, TEETH = 3, SHIRT = 4, TORN = 5, PANTS = 6, PATCH = 7, SHOES = 8, EYE = 9;
    function box(parent: THREE.Object3D, material: number, x: number, y: number, z: number, w: number, h: number, d: number) {
        const mesh = new THREE.Mesh(geometry, materials[material]);
        mesh.position.set(x, y, z); mesh.scale.set(w, h, d); parent.add(mesh);
        return mesh;
    }
    const model = new THREE.Group(); root.add(model);
    const legs = [-1, 1].map(side => {
        const leg = new THREE.Group(); leg.position.set(side * .125, .72, 0); model.add(leg);
        box(leg, PANTS, 0, -.33, 0, .24, .66, .24);
        box(leg, SHOES, 0, -.68, .01, .25, .08, .26);
        if (side > 0) box(leg, PATCH, 0, -.2, .125, .13, .18, .02);
        else box(leg, PATCH, -.12, -.45, 0, .02, .14, .1);
        return leg;
    });
    const upper = new THREE.Group(); upper.position.y = .72; model.add(upper);
    box(upper, SHIRT, 0, .34, 0, .5, .68, .26);
    box(upper, SKIN, -.1, .1, .131, .18, .14, .02);
    box(upper, TORN, .12, .06, .131, .1, .1, .02);
    box(upper, TORN, -.05, .52, .131, .14, .06, .02);
    const head = new THREE.Group(); head.position.y = .68; upper.add(head);
    box(head, SKIN, 0, .22, 0, .44, .44, .44);
    box(head, SHADE, 0, .34, .222, .44, .05, .02);
    for (const side of [-1, 1]) {
        box(head, EYE, side * .1, .27, .226, .11, .08, .02).name = 'Zombie eye';
        box(head, TEETH, side * .06, .13, .226, .05, .05, .02);
    }
    box(head, MOUTH, 0, .085, .224, .22, .07, .02);
    box(head, TEETH, 0, .1, .228, .04, .04, .02);
    const arms = [-1, 1].map(side => {
        const arm = new THREE.Group(); arm.position.set(side * .36, .6, 0); upper.add(arm);
        box(arm, SHIRT, 0, -.12, 0, .22, .24, .22);
        box(arm, SKIN, 0, -.43, 0, .2, .4, .2);
        box(arm, SHADE, 0, -.6, 0, .21, .06, .21);
        return arm;
    });

    const body = new Player(world);
    let state: State = 'gone', spawned = false, health = 0, timer = 0, repath = 0, lost = 0, time = 0;
    let path: Vec3[] = [], blocked = false, knockX = 0, knockZ = 0;
    const last: Vec3 = { x: 0, y: 0, z: 0 };
    const p = body.position;

    function despawn() { state = 'gone'; root.visible = false; path = []; }
    function spawn(target: Vec3) {
        for (let tries = 0; tries < 200; tries++) {
            const x = Math.floor(Math.random() * SIZE), z = Math.floor(Math.random() * SIZE);
            let y = SIZE - 1;
            while (y > 0 && !world.get(x, y, z)) y--;
            if (![1, 2, 3].includes(world.get(x, y, z)) || !standable(world, x, y + 1, z) || Math.hypot(x + .5 - target.x, z + .5 - target.z) < 12) continue;
            Object.assign(p, { x: x + .5, y: y + 1, z: z + .5 });
            body.velocityY = 0;
            health = 6; spawned = true; state = 'wander'; timer = 0; root.visible = true;
            root.position.set(p.x, p.y, p.z);
            return;
        }
    }
    function wanderGoal() {
        const x = Math.floor(p.x + Math.random() * 12 - 6), z = Math.floor(p.z + Math.random() * 12 - 6);
        for (let y = Math.floor(p.y) + 2; y >= Math.floor(p.y) - 3; y--)
            if (standable(world, x, y, z)) return findPath(world, p, { x: x + .5, y, z: z + .5 });
        return null;
    }
    // Returns the horizontal velocity that follows the path, dropping waypoints as they're reached.
    function follow(speed: number) {
        while (path.length && Math.hypot(path[0].x - p.x, path[0].z - p.z) < .15) path.shift();
        if (!path.length) return [0, 0, false] as const;
        const dx = path[0].x - p.x, dz = path[0].z - p.z, d = Math.hypot(dx, dz) || 1;
        return [dx / d * speed, dz / d * speed, path[0].y > p.y + .5] as const;
    }
    function pose(dt: number, moving: boolean, facing: number) {
        time += dt;
        root.position.set(p.x, p.y, p.z);
        root.rotation.y = facing;
        const stride = moving ? Math.sin(time * 8) * .5 : 0;
        legs[0].rotation.x = stride; legs[1].rotation.x = -stride;
        let armPitch = REST_ARMS + Math.sin(time * 2) * .06, lean = 0, lunge = 0;
        if (state === 'windup') { const t = 1 - timer / WINDUP; armPitch = REST_ARMS + (RAISED_ARMS - REST_ARMS) * t; lean = -.12 * t; }
        else if (state === 'strike') { const t = 1 - timer / STRIKE; armPitch = RAISED_ARMS + (SLAMMED_ARMS - RAISED_ARMS) * t; lean = .25 * t; lunge = .3 * t; }
        else if (state === 'recover') { const t = Math.min(1, (RECOVER - timer) / .3); armPitch = SLAMMED_ARMS + (REST_ARMS - SLAMMED_ARMS) * t; lean = .25 * (1 - t); lunge = .3 * (1 - t); }
        else if (state === 'stagger') { armPitch = REST_ARMS + .8; lean = -.2; }
        arms.forEach((arm, i) => { arm.rotation.x = armPitch + (state === 'wander' || state === 'chase' ? stride * .15 * (i ? 1 : -1) : 0); });
        upper.rotation.x = lean;
        model.position.z = lunge;
    }

    return {
        root,
        get health() { return health; },
        get state() { return state; },
        // Advances one physics step; returns hearts of damage dealt to the player at `target`.
        update(dt: number, night: boolean, target: Vec3) {
            if (!night) { if (state !== 'gone') despawn(); spawned = false; return 0; }
            if (state === 'gone') { if (!spawned) spawn(target); return 0; }
            Object.assign(last, target);
            const dx = target.x - p.x, dz = target.z - p.z, dy = target.y - p.y;
            const flat = Math.hypot(dx, dz), distance = Math.hypot(dx, dy, dz), toPlayer = Math.atan2(dx, dz);
            let damage = 0, vx = 0, vz = 0, jump = false, facing = root.rotation.y;
            timer -= dt;
            if (state === 'wander') {
                if (distance < SIGHT) { state = 'chase'; repath = 0; lost = 0; }
                else {
                    if (!path.length && timer <= 0) { path = wanderGoal() ?? []; timer = 2 + Math.random() * 2; }
                    [vx, vz, jump] = follow(1.2);
                }
            }
            if (state === 'chase') {
                lost += dt; repath -= dt;
                if (repath <= 0) {
                    repath = .5;
                    const found = findPath(world, p, target);
                    if (found) { path = found; lost = 0; }
                }
                if (distance > GIVE_UP || lost > LOST_SECONDS) { state = 'wander'; path = []; timer = 1; }
                else if (flat < 1.6 && Math.abs(dy) < 1.5) { state = 'windup'; timer = WINDUP; }
                else {
                    [vx, vz, jump] = follow(2.4);
                    // Same cell as the player but not yet in reach: walk straight at them.
                    if (!path.length && flat > .1) { vx = dx / flat * 2.4; vz = dz / flat * 2.4; }
                    facing = toPlayer;
                }
            } else if (state === 'windup') {
                facing = toPlayer;
                if (timer <= 0) {
                    state = 'strike'; timer = STRIKE;
                    if (flat < 1.8 && Math.abs(dy) < 1.5) damage = 1;
                }
            } else if (state === 'strike') {
                facing = toPlayer;
                if (timer <= 0) { state = 'recover'; timer = RECOVER; }
            } else if (state === 'recover') {
                facing = toPlayer;
                if (timer > RECOVER - .4 && flat > .01) { vx = -dx / flat; vz = -dz / flat; }
                if (timer <= 0) { state = 'chase'; repath = 0; }
            } else if (state === 'stagger') {
                vx = knockX; vz = knockZ;
                if (timer <= 0) { state = 'chase'; repath = 0; lost = 0; }
            }
            if (vx || vz) facing = state === 'chase' || state === 'wander' ? Math.atan2(vx, vz) : facing;
            const before = { x: p.x, z: p.z };
            body.step(world, dt, vx, vz, body.grounded && (jump || blocked));
            const expected = Math.hypot(vx, vz) * dt;
            blocked = expected > 0 && Math.hypot(p.x - before.x, p.z - before.z) < expected * .3;
            pose(dt, expected > 0, facing);
            return damage;
        },
        // Returns true when the blow is fatal, null if there is no zombie to hit.
        hit(amount: number) {
            if (state === 'gone') return null;
            health -= amount;
            if (health <= 0) { despawn(); return true; }
            const dx = p.x - last.x, dz = p.z - last.z, d = Math.hypot(dx, dz) || 1;
            knockX = dx / d * 6; knockZ = dz / d * 6;
            if (body.grounded) body.velocityY = 4;
            state = 'stagger'; timer = STAGGER; path = [];
            return false;
        },
        despawn,
        dispose() { root.removeFromParent(); geometry.dispose(); materials.forEach(material => material.dispose()); },
    };
}
