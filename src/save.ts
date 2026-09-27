import { BLOCKS, RADIUS, SIZE, type Vec3 } from './world.ts';
import { HOTBAR, ITEMS, MAX_HEALTH, START_HEALTH } from './crafting.ts';
import { ZOMBIE_HEALTH, type ZombieSave } from './zombie.ts';

const KEY = 'minecaves-session-v1';
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type Session = {
    world: Uint8Array; counts: number[]; durability: number[]; health: number; hotbar: number[]; selected: number;
    position: Vec3 | null; yaw: number | null; pitch: number | null; phase: number | null; animals: boolean[]; zombie: ZombieSave;
};

// Returns false when the browser blocks storage or it is full.
export function saveSession(session: Session, storage?: Store) {
    try {
        const { world, ...rest } = session;
        (storage ?? localStorage).setItem(KEY, JSON.stringify({ ...rest, world: btoa(Array.from(world, id => String.fromCharCode(id)).join('')) }));
        return true;
    } catch { return false; }
}

export function clearSession(storage?: Store) {
    try { (storage ?? localStorage).removeItem(KEY); } catch { /* nothing saved to clear */ }
}

// Saved data is untrusted: a broken world means no save; other fields fall back to defaults one by one.
export function loadSession(storage?: Store): Session | null {
    try {
        const raw = (storage ?? localStorage).getItem(KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        const world = Uint8Array.from(atob(data.world), char => char.charCodeAt(0));
        if (world.length !== SIZE ** 3 || world.some(id => id >= BLOCKS.length)) return null;
        const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
        const whole = (value: unknown) => Math.max(0, Math.floor(finite(value) ?? 0));
        const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
        const saved: unknown[] = Array.isArray(data.hotbar) ? data.hotbar : [];
        const order = saved.filter((id, i): id is number => HOTBAR.includes(id as number) && saved.indexOf(id) === i);
        const position = (value: any): Vec3 | null => {
            const [x, y, z] = ['x', 'y', 'z'].map(axis => finite(value?.[axis]));
            return x === null || y === null || z === null ? null : { x: clamp(x, RADIUS, SIZE - RADIUS), y: clamp(y, 0, SIZE), z: clamp(z, RADIUS, SIZE - RADIUS) };
        };
        const health = finite(data.health), zombieHealth = finite(data.zombie?.health);
        return {
            world,
            counts: ITEMS.map((_, i) => whole(data.counts?.[i])),
            durability: ITEMS.map((_, i) => whole(data.durability?.[i])),
            health: health !== null && Number.isInteger(health) && health >= 1 && health <= MAX_HEALTH ? health : START_HEALTH,
            // Keep the player's order; items added to the hotbar since the save go on the end.
            hotbar: [...order, ...HOTBAR.filter(id => !order.includes(id))],
            selected: HOTBAR.includes(data.selected) ? data.selected : 1,
            position: position(data.position),
            yaw: finite(data.yaw), pitch: finite(data.pitch), phase: finite(data.phase),
            animals: Array.isArray(data.animals) ? data.animals.map((alive: unknown) => alive !== false) : [],
            zombie: {
                spawned: data.zombie?.spawned === true,
                health: zombieHealth !== null && Number.isInteger(zombieHealth) && zombieHealth >= 1 && zombieHealth <= ZOMBIE_HEALTH ? zombieHealth : 0,
                position: position(data.zombie?.position),
                state: typeof data.zombie?.state === 'string' ? data.zombie.state : 'wander',
                timer: finite(data.zombie?.timer) ?? 0,
                knockX: finite(data.zombie?.knockX) ?? 0, knockZ: finite(data.zombie?.knockZ) ?? 0,
            },
        };
    } catch { return null; }
}
