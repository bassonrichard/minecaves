import { BLOCKS, CHEST, RADIUS, SIZE_X, SIZE_Y, SIZE_Z, TREES, inside, type Vec3 } from './world.ts';
import { CHEST_SLOTS, HOTBAR_SLOTS, ITEMS, MAX_HEALTH, NOT_ITEMS, SLOTS, START_HEALTH, TOOLS, TOOL_USES, addItem, createInventory, maxStack, type Stack } from './crafting.ts';
import { DESPAWN, type DropSave } from './drops.ts';
import { ZOMBIE_HEALTH, type ZombieSave } from './zombie.ts';

const KEY = 'minecaves-session-v4', V3_KEY = 'minecaves-session-v3', V2_KEY = 'minecaves-session-v2';
// v4 added eight blocks (stove to bed head), so v3 item IDs from sticks (13) up sit eight higher now.
const V3_ITEM_SHIFT = 8, V3_FIRST_ITEM = 13;
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type Session = {
    world: Uint8Array; slots: (Stack | null)[]; health: number; selected: number; drops: DropSave[];
    position: Vec3 | null; yaw: number | null; pitch: number | null; phase: number | null; animals: boolean[]; zombies: ZombieSave[];
    day: number; spawn: Vec3 | null; chests: ChestSave[]; trees: number[];
};
export type ChestSave = { x: number; y: number; z: number; slots: (Stack | null)[] };

// Returns false when the browser blocks storage or it is full.
export function saveSession(session: Session, storage?: Store) {
    try {
        const { world, ...rest } = session;
        (storage ?? localStorage).setItem(KEY, JSON.stringify({ ...rest, world: btoa(Array.from(world, id => String.fromCharCode(id)).join('')) }));
        return true;
    } catch { return false; }
}

export function clearSession(storage?: Store) {
    // The old v2 save goes too, or a new world would migrate it straight back.
    try { for (const key of [KEY, V3_KEY, V2_KEY]) (storage ?? localStorage).removeItem(key); } catch { /* nothing saved to clear */ }
}

// Saved data is untrusted: a broken world means no save; other fields fall back to defaults one by one.
export function loadSession(storage?: Store): Session | null {
    try {
        const store = storage ?? localStorage;
        const current = store.getItem(KEY);
        const raw = current ?? store.getItem(V3_KEY) ?? store.getItem(V2_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        // Older saves: move their item IDs past the new blocks before anything reads them.
        const shift = (id: unknown) => typeof id === 'number' && id >= V3_FIRST_ITEM ? id + V3_ITEM_SHIFT : id;
        if (current === null) for (const list of [data.slots, data.drops]) if (Array.isArray(list)) list.forEach((value: any) => { if (value) value.id = shift(value.id); });
        const world = Uint8Array.from(atob(data.world), char => char.charCodeAt(0));
        if (world.length !== SIZE_X * SIZE_Y * SIZE_Z || world.some(id => id >= BLOCKS.length)) return null;
        const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
        const whole = (value: unknown) => Math.max(0, Math.floor(finite(value) ?? 0));
        const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
        const position = (value: any): Vec3 | null => {
            const [x, y, z] = ['x', 'y', 'z'].map(axis => finite(value?.[axis]));
            return x === null || y === null || z === null ? null : { x: clamp(x, RADIUS, SIZE_X - RADIUS), y: clamp(y, 0, SIZE_Y), z: clamp(z, RADIUS, SIZE_Z - RADIUS) };
        };
        const health = finite(data.health);
        const itemId = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value < ITEMS.length && !NOT_ITEMS.includes(value);
        const stack = (value: any): Stack | null => {
            if (!itemId(value?.id) || !Number.isInteger(value.count) || value.count < 1 || value.count > maxStack(value.id)) return null;
            return { id: value.id, count: value.count, durability: TOOLS.includes(value.id) ? clamp(whole(value.durability), 1, TOOL_USES) : 0 };
        };
        let slots: (Stack | null)[] = Array.from({ length: SLOTS }, (_, i) => stack(data.slots?.[i]));
        if (!Array.isArray(data.slots) && Array.isArray(data.counts)) {
            // A v2 save kept one count per item. Its item IDs from 11 up sit two higher now (cactus and ice came first).
            const migrated = createInventory();
            data.counts.forEach((count: unknown, i: number) => { const id = i < 11 ? i : shift(i + 2) as number; if (itemId(id) && whole(count)) addItem(migrated, id, whole(count)); });
            slots = migrated.slots;
        }
        const drops: DropSave[] = (Array.isArray(data.drops) ? data.drops.slice(0, 500) : []).flatMap((value: any) => {
            const item = stack(value), at = position(value);
            return item && at ? [{ ...item, ...at, age: clamp(finite(value.age) ?? 0, 0, DESPAWN) }] : [];
        });
        const zombie = (value: any): ZombieSave => {
            const zombieHealth = finite(value?.health);
            return {
                spawned: value?.spawned === true,
                health: zombieHealth !== null && Number.isInteger(zombieHealth) && zombieHealth >= 1 && zombieHealth <= ZOMBIE_HEALTH ? zombieHealth : 0,
                position: position(value?.position),
                state: typeof value?.state === 'string' ? value.state : 'wander',
                timer: finite(value?.timer) ?? 0,
                knockX: finite(value?.knockX) ?? 0, knockZ: finite(value?.knockZ) ?? 0,
            };
        };
        return {
            world,
            slots,
            drops,
            health: health !== null && Number.isInteger(health) && health >= 1 && health <= MAX_HEALTH ? health : START_HEALTH,
            selected: Number.isInteger(data.selected) && data.selected >= 0 && data.selected < HOTBAR_SLOTS ? data.selected : 0,
            position: position(data.position),
            yaw: finite(data.yaw), pitch: finite(data.pitch), phase: finite(data.phase),
            animals: Array.isArray(data.animals) ? data.animals.map((alive: unknown) => alive !== false) : [],
            zombies: Array.isArray(data.zombies) ? data.zombies.map(zombie) : [],
            day: whole(data.day),
            spawn: position(data.spawn),
            // A chest entry only counts where the world still has a chest.
            chests: (Array.isArray(data.chests) ? data.chests : []).flatMap((value: any) => {
                const { x, y, z } = value ?? {};
                if (!inside(x, y, z) || world[x + SIZE_X * (z + SIZE_Z * y)] !== CHEST) return [];
                return [{ x, y, z, slots: Array.from({ length: CHEST_SLOTS }, (_, i) => stack(value.slots?.[i])) }];
            }),
            trees: TREES.map((_, i) => { const day = finite(data.trees?.[i]); return day !== null && day >= 0 ? Math.floor(day) : -1; }),
        };
    } catch { return null; }
}
