import { BED, BED_HEAD, BLOCKS, CHEST, DOOR, ICE, OPEN_DOOR, SAND, SMELTER, STOVE, WATER, WINDOW, canPlace, editBlock, overlaps, type Vec3, type World } from './world.ts';

// Items follow the blocks, so their IDs start at BLOCKS.length.
const FIRST_ITEM = BLOCKS.length;
export const PLANKS = 6, TABLE = 7, STICKS = FIRST_ITEM, PICKAXE = FIRST_ITEM + 1, AXE = FIRST_ITEM + 2, FEATHER = FIRST_ITEM + 3, CHICKEN_MEAT = FIRST_ITEM + 4, SWORD = FIRST_ITEM + 5;
export const WOOL = FIRST_ITEM + 6, MUTTON = FIRST_ITEM + 7, COOKED_CHICKEN = FIRST_ITEM + 8, COOKED_MUTTON = FIRST_ITEM + 9, GLASS = FIRST_ITEM + 10;
export const ITEMS = [...BLOCKS, 'Sticks', 'Wooden pickaxe', 'Wooden axe', 'Feathers', 'Raw chicken', 'Wooden sword', 'Wool', 'Raw mutton', 'Cooked chicken', 'Cooked mutton', 'Glass'];
// Block IDs that only exist in the world, never as something you carry.
export const NOT_ITEMS = [WATER, OPEN_DOOR, BED_HEAD];
// Hearts each food restores, best first.
export const FOODS = new Map([[COOKED_CHICKEN, 3], [COOKED_MUTTON, 3], [CHICKEN_MEAT, 1], [MUTTON, 1]]);
// Blocks that unlock recipes when placed nearby.
export const STATIONS = [TABLE, STOVE, SMELTER];
export const TOOLS = [PICKAXE, AXE, SWORD];
export const TOOL_USES = 32, MAX_STACK = 64;
// Slots 0–9 are the hotbar, 10–45 the 6×6 pack. A chest holds 6×3.
export const HOTBAR_SLOTS = 10, SLOTS = 46, CHEST_SLOTS = 18;
export const MAX_HEALTH = 10, START_HEALTH = 3;
// `station` 0 is by hand. Cooking and smelting burn one plank as fuel.
export const RECIPES = [
    { id: 'planks', output: PLANKS, count: 4, ingredients: [[4, 1]], station: 0 },
    { id: 'sticks', output: STICKS, count: 4, ingredients: [[PLANKS, 2]], station: 0 },
    { id: 'table', output: TABLE, count: 1, ingredients: [[PLANKS, 4]], station: 0 },
    { id: 'pickaxe', output: PICKAXE, count: 1, ingredients: [[PLANKS, 3], [STICKS, 2]], station: TABLE },
    { id: 'axe', output: AXE, count: 1, ingredients: [[PLANKS, 3], [STICKS, 2]], station: TABLE },
    { id: 'sword', output: SWORD, count: 1, ingredients: [[PLANKS, 2], [STICKS, 1]], station: TABLE },
    { id: 'stove', output: STOVE, count: 1, ingredients: [[3, 6], [PLANKS, 2]], station: TABLE },
    { id: 'smelter', output: SMELTER, count: 1, ingredients: [[3, 8]], station: TABLE },
    { id: 'chest', output: CHEST, count: 1, ingredients: [[PLANKS, 8]], station: TABLE },
    { id: 'door', output: DOOR, count: 3, ingredients: [[PLANKS, 6]], station: TABLE },
    { id: 'window', output: WINDOW, count: 4, ingredients: [[GLASS, 4], [STICKS, 2]], station: TABLE },
    { id: 'bed', output: BED, count: 1, ingredients: [[WOOL, 3], [PLANKS, 3]], station: TABLE },
    { id: 'cooked-chicken', output: COOKED_CHICKEN, count: 1, ingredients: [[CHICKEN_MEAT, 1], [PLANKS, 1]], station: STOVE },
    { id: 'cooked-mutton', output: COOKED_MUTTON, count: 1, ingredients: [[MUTTON, 1], [PLANKS, 1]], station: STOVE },
    { id: 'glass', output: GLASS, count: 2, ingredients: [[SAND, 2], [PLANKS, 1]], station: SMELTER },
] as const;
export type Recipe = typeof RECIPES[number];
export type Stack = { id: number; count: number; durability: number };
export type Inventory = { slots: (Stack | null)[] };
export function createInventory(): Inventory {
    return { slots: Array(SLOTS).fill(null) };
}
export const maxStack = (id: number) => TOOLS.includes(id) ? 1 : MAX_STACK;
export const held = (inventory: Inventory, slot: number) => inventory.slots[slot]?.id ?? 0;
export const countOf = (inventory: Inventory, id: number) => inventory.slots.reduce((n, stack) => n + (stack?.id === id ? stack.count : 0), 0);
export const hasRoom = (inventory: Inventory, id: number) => inventory.slots.some(stack => !stack || (stack.id === id && stack.count < maxStack(id)));
// Tops up matching stacks first, then fills the first empty slot (hotbar before pack). Returns what didn't fit.
export function addItem(inventory: Inventory, id: number, count: number, durability = TOOLS.includes(id) ? TOOL_USES : 0) {
    const limit = maxStack(id);
    for (const stack of inventory.slots) {
        if (!count) break;
        if (stack?.id !== id || stack.count >= limit) continue;
        const moved = Math.min(count, limit - stack.count);
        stack.count += moved; count -= moved;
    }
    for (let i = 0; i < SLOTS && count; i++) {
        if (inventory.slots[i]) continue;
        const moved = Math.min(count, limit);
        inventory.slots[i] = { id, count: moved, durability };
        count -= moved;
    }
    return count;
}
// Takes from the pack end first so the hotbar keeps what you hold. All or nothing.
export function removeItem(inventory: Inventory, id: number, count: number) {
    if (countOf(inventory, id) < count) return false;
    for (let i = SLOTS - 1; i >= 0 && count; i--) {
        const stack = inventory.slots[i];
        if (stack?.id !== id) continue;
        const taken = Math.min(count, stack.count);
        stack.count -= taken; count -= taken;
        if (!stack.count) inventory.slots[i] = null;
    }
    return true;
}
// Drag and drop: merge onto a matching stack, otherwise swap.
export function moveSlot(inventory: Inventory, from: number, to: number) {
    const valid = (i: number) => Number.isInteger(i) && i >= 0 && i < inventory.slots.length;
    const source = inventory.slots[from];
    if (!valid(from) || !valid(to) || from === to || !source) return false;
    const target = inventory.slots[to];
    if (target && target.id === source.id && target.count < maxStack(target.id)) {
        const moved = Math.min(source.count, maxStack(target.id) - target.count);
        target.count += moved; source.count -= moved;
        if (!source.count) inventory.slots[from] = null;
    } else [inventory.slots[from], inventory.slots[to]] = [target, source];
    return true;
}
// The inventory after crafting, or null when the output wouldn't fit.
function afterCraft(inventory: Inventory, recipe: Recipe) {
    const next = structuredClone(inventory);
    for (const [id, count] of recipe.ingredients) removeItem(next, id, count);
    return addItem(next, recipe.output, recipe.count) ? null : next;
}
// Why a recipe can't be made right now, or null when it can. `near` lists the stations in reach.
export function craftBlocker(inventory: Inventory, recipe: Recipe, near: readonly number[]) {
    if (recipe.station && !near.includes(recipe.station)) return 'station';
    if (!recipe.ingredients.every(([id, count]) => countOf(inventory, id) >= count)) return 'materials';
    return afterCraft(inventory, recipe) ? null : 'room';
}
export function craft(inventory: Inventory, recipeId: string, near: readonly number[]) {
    const recipe = RECIPES.find(recipe => recipe.id === recipeId);
    if (!recipe || craftBlocker(inventory, recipe, near)) return false;
    inventory.slots = afterCraft(inventory, recipe)!.slots;
    return true;
}
// Placed stations within five blocks of the player's eye.
export function stationsNearby(world: World, player: Vec3) {
    const eye = { x: player.x, y: player.y + 1.62, z: player.z }, near = new Set<number>();
    for (let x = Math.floor(eye.x) - 5; x <= Math.floor(eye.x) + 5; x++)
        for (let y = Math.floor(eye.y) - 5; y <= Math.floor(eye.y) + 5; y++)
            for (let z = Math.floor(eye.z) - 5; z <= Math.floor(eye.z) + 5; z++) {
                const id = world.get(x, y, z);
                if (STATIONS.includes(id) && Math.hypot(x + .5 - eye.x, y + .5 - eye.y, z + .5 - eye.z) <= 5) near.add(id);
            }
    return STATIONS.filter(id => near.has(id));
}
export function miningSeconds(inventory: Inventory, slot: number, block: number) {
    const tool = held(inventory, slot);
    if (block === 3 || block === STOVE || block === SMELTER) return tool === PICKAXE ? .55 : null;
    if ([4, PLANKS, TABLE, CHEST, DOOR, OPEN_DOOR, BED, BED_HEAD].includes(block)) return tool === AXE ? .25 : 1.2;
    if (block === WINDOW) return .3;
    return block === 5 ? .15 : .35;
}
// The other cell of a two-cell door or bed, if it's still there.
export function partner(world: World, x: number, y: number, z: number): Vec3 | null {
    const id = world.get(x, y, z);
    if (id === DOOR || id === OPEN_DOOR) {
        for (const dy of [1, -1]) if (world.get(x, y + dy, z) === id) return { x, y: y + dy, z };
    } else if (id === BED || id === BED_HEAD) {
        const other = id === BED ? BED_HEAD : BED;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (world.get(x + dx, y, z + dz) === other) return { x: x + dx, y, z: z + dz };
    }
    return null;
}
// Breaks the block. Returns the item it drops (0 for none), or null when nothing was broken.
export function harvest(world: World, player: Vec3, inventory: Inventory, slot: number, x: number, y: number, z: number) {
    const block = world.get(x, y, z), tool = held(inventory, slot), other = partner(world, x, y, z);
    if (!block || miningSeconds(inventory, slot, block) === null) return null;
    // Like Minecraft, broken ice melts into water and drops nothing.
    if (block === ICE ? y === 0 || !world.set(x, y, z, WATER) : !editBlock(world, player, x, y, z, 0)) return null;
    // Doors and beds come away whole.
    if (other) world.set(other.x, other.y, other.z, 0);
    if (tool === PICKAXE || tool === AXE) wear(inventory, slot);
    return block === ICE ? 0 : block === OPEN_DOOR ? DOOR : block === BED_HEAD ? BED : block;
}
// Swings both halves of a door. It won't shut on the player. Returns whether it moved.
export function toggleDoor(world: World, player: Vec3, x: number, y: number, z: number) {
    const id = world.get(x, y, z), other = partner(world, x, y, z);
    if (id !== DOOR && id !== OPEN_DOOR) return false;
    const cells = other ? [{ x, y, z }, other] : [{ x, y, z }];
    if (id === OPEN_DOOR && cells.some(c => overlaps(player, c.x, c.y, c.z))) return false;
    for (const c of cells) world.set(c.x, c.y, c.z, id === DOOR ? OPEN_DOOR : DOOR);
    return true;
}
// One use off the tool in this slot; it breaks at zero.
export function wear(inventory: Inventory, slot: number) {
    const stack = inventory.slots[slot];
    if (!stack || !TOOLS.includes(stack.id)) return;
    if (--stack.durability <= 0) inventory.slots[slot] = null;
}
export function attackDamage(inventory: Inventory, slot: number) {
    return held(inventory, slot) === SWORD ? 3 : 1;
}
// Eats the held food, or else the best food in the pack. Returns the food eaten (0 for none) and the new health.
export function eat(inventory: Inventory, health: number, slot = -1) {
    const heldFood = held(inventory, slot);
    const food = FOODS.has(heldFood) ? heldFood : [...FOODS.keys()].find(id => countOf(inventory, id) > 0) ?? 0;
    if (!food || health >= MAX_HEALTH) return { food: 0, health };
    const stack = FOODS.has(heldFood) ? inventory.slots[slot]! : null;
    if (stack) { if (!--stack.count) inventory.slots[slot] = null; } else removeItem(inventory, food, 1);
    return { food, health: Math.min(MAX_HEALTH, health + FOODS.get(food)!) };
}
// Places the held block. Doors take the cell above too; beds reach one cell further along `facing` ([dx, dz]).
export function place(world: World, player: Vec3, inventory: Inventory, slot: number, x: number, y: number, z: number, facing: [number, number] = [0, 1]) {
    const stack = inventory.slots[slot];
    if (!stack || stack.id < 1 || stack.id >= BLOCKS.length || NOT_ITEMS.includes(stack.id)) return false;
    if (stack.id === DOOR) {
        if (!canPlace(world, player, x, y + 1, z) || !editBlock(world, player, x, y, z, DOOR)) return false;
        world.set(x, y + 1, z, DOOR);
    } else if (stack.id === BED) {
        const [dx, dz] = Math.abs(facing[0]) > Math.abs(facing[1]) ? [Math.sign(facing[0]), 0] : [0, Math.sign(facing[1]) || 1];
        const hx = x + dx, hz = z + dz;
        if (!world.blocking(x, y - 1, z) || !world.blocking(hx, y - 1, hz) || !canPlace(world, player, hx, y, hz) || !editBlock(world, player, x, y, z, BED)) return false;
        world.set(hx, y, hz, BED_HEAD);
    } else if (!editBlock(world, player, x, y, z, stack.id)) return false;
    if (!--stack.count) inventory.slots[slot] = null;
    return true;
}
