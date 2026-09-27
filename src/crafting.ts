import { BLOCKS, editBlock, type Vec3, type World } from './world.ts';

export const PLANKS = 6, TABLE = 7, STICKS = 8, PICKAXE = 9, AXE = 10, FEATHER = 11, CHICKEN_MEAT = 12, SWORD = 13;
export const ITEMS = [...BLOCKS, 'Sticks', 'Wooden pickaxe', 'Wooden axe', 'Feathers', 'Raw chicken', 'Wooden sword'];
export const HOTBAR = [1, 2, 3, 4, 5, PLANKS, TABLE, PICKAXE, AXE, SWORD];
export const TOOL_USES = 32;
export const MAX_HEALTH = 10, START_HEALTH = 3;
export const RECIPES = [
    { id: 'planks', output: PLANKS, count: 4, ingredients: [[4, 1]], table: false },
    { id: 'sticks', output: STICKS, count: 4, ingredients: [[PLANKS, 2]], table: false },
    { id: 'table', output: TABLE, count: 1, ingredients: [[PLANKS, 4]], table: false },
    { id: 'pickaxe', output: PICKAXE, count: 1, ingredients: [[PLANKS, 3], [STICKS, 2]], table: true },
    { id: 'axe', output: AXE, count: 1, ingredients: [[PLANKS, 3], [STICKS, 2]], table: true },
    { id: 'sword', output: SWORD, count: 1, ingredients: [[PLANKS, 2], [STICKS, 1]], table: true },
] as const;
export type Recipe = typeof RECIPES[number];
export type Inventory = { counts: number[]; durability: number[] };
export function createInventory(): Inventory {
    return { counts: Array(ITEMS.length).fill(0), durability: Array(ITEMS.length).fill(0) };
}
export function canCraft(inventory: Inventory, recipe: Recipe, table: boolean) {
    return (!recipe.table || table) && recipe.ingredients.every(([id, count]) => inventory.counts[id] >= count);
}
export function craft(inventory: Inventory, recipeId: string, table: boolean) {
    const recipe = RECIPES.find(recipe => recipe.id === recipeId);
    if (!recipe || !canCraft(inventory, recipe, table)) return false;
    for (const [id, count] of recipe.ingredients) inventory.counts[id] -= count;
    if (recipe.output >= PICKAXE && !inventory.counts[recipe.output]) inventory.durability[recipe.output] = TOOL_USES;
    inventory.counts[recipe.output] += recipe.count;
    return true;
}
export function tableNearby(world: World, player: Vec3) {
    const eye = { x: player.x, y: player.y + 1.62, z: player.z };
    for (let x = Math.floor(eye.x) - 5; x <= Math.floor(eye.x) + 5; x++)
        for (let y = Math.floor(eye.y) - 5; y <= Math.floor(eye.y) + 5; y++)
            for (let z = Math.floor(eye.z) - 5; z <= Math.floor(eye.z) + 5; z++)
                if (world.get(x, y, z) === TABLE && Math.hypot(x + .5 - eye.x, y + .5 - eye.y, z + .5 - eye.z) <= 5) return true;
    return false;
}
export function miningSeconds(inventory: Inventory, selected: number, block: number) {
    const tool = inventory.counts[selected] > 0 ? selected : 0;
    if (block === 3) return tool === PICKAXE ? .55 : null;
    if ([4, PLANKS, TABLE].includes(block)) return tool === AXE ? .25 : 1.2;
    return block === 5 ? .15 : .35;
}
export function harvest(world: World, player: Vec3, inventory: Inventory, selected: number, x: number, y: number, z: number) {
    const block = world.get(x, y, z);
    if (!block || miningSeconds(inventory, selected, block) === null || !editBlock(world, player, x, y, z, 0)) return false;
    inventory.counts[block]++;
    if (selected === PICKAXE || selected === AXE) wear(inventory, selected);
    return true;
}
export function wear(inventory: Inventory, tool: number) {
    if (!inventory.counts[tool]) return;
    inventory.durability[tool]--;
    if (!inventory.durability[tool]) {
        inventory.counts[tool]--;
        inventory.durability[tool] = inventory.counts[tool] ? TOOL_USES : 0;
    }
}
export function attackDamage(inventory: Inventory, selected: number) {
    return selected === SWORD && inventory.counts[SWORD] > 0 ? 3 : 1;
}
// Raw chicken restores one heart. Poison comes later.
export function eat(inventory: Inventory, health: number) {
    if (health >= MAX_HEALTH || !inventory.counts[CHICKEN_MEAT]) return health;
    inventory.counts[CHICKEN_MEAT]--;
    return health + 1;
}
export function place(world: World, player: Vec3, inventory: Inventory, selected: number, x: number, y: number, z: number) {
    if (selected < 1 || selected >= BLOCKS.length || !inventory.counts[selected] || !editBlock(world, player, x, y, z, selected)) return false;
    inventory.counts[selected]--;
    return true;
}
