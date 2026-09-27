# Minecaves

A small, playable voxel sandbox built for learning with React, Three.js, TypeScript, and Vite. Original pixel textures are generated locally; no downloaded game assets.

## Run

Use Node.js 22.18+ (or Node.js 24+).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite in a desktop browser with WebGL and a mouse. Click **Step into the world** to capture your pointer. Use WASD to move, the mouse to look, Space to jump, hold left-click to gather, right-click to place/use, 1–9 then 0 or the mouse wheel to choose a hotbar slot, Q to drop one of what you hold, and F to eat. Press E while playing to open your pack and crafting. You can also open it from the pause menu. Escape pauses and releases the pointer. Clicking a hotbar slot while paused also selects it; drag slots (or Alt+arrow keys on a focused slot) to move items. Blocks have a five-unit reach.

```sh
npm test
npm run typecheck
npm run build
npm run preview
```

The world is 96 × 64 and 32 blocks tall, laid out as six 32 × 32 biomes for testing:

| | x 0–31 | x 32–63 | x 64–95 |
|---|---|---|---|
| **z 0–31** | Snow | Mountain (snowy peak) | Forest |
| **z 32–63** | Ocean with a beach | Plains (spawn) | Desert |

Borders are smoothed into slopes. Ocean water is see-through and swimmable: you sink slowly, and holding Space swims up and lets you hop out onto the shore. Water can't be mined and blocks can be placed into it. When you dig out a block, water pours into the gap from above, or from beside it at or below sea level. Sand falls when nothing holds it up. The desert has cacti (touching one costs a heart every half second), and the snow biome has a frozen pond: ice is slippery, and breaking it leaves water. Falls of more than three blocks hurt, unless you land in water.

## Inventory and dropped items

You start with an empty hotbar. There are 10 hotbar slots plus a 6 × 6 pack. Stacks hold up to 64; tools and swords take a slot each. Mined blocks and chicken loot pop out as items and are pulled in when you walk near them: they top up matching stacks first, then fill the hotbar, then the pack. When everything is full, items stay on the ground and you pick them up once you have room. Items left on the ground vanish after five minutes. Press E to see your pack, drag items between any slots, or drag them to **Drop** to throw them out. Crafting is disabled when there's no room for what it makes. When you die, everything you carried drops where you fell. Your held item shows in first person and swings when you attack, mine, place, or throw; an empty hand shows your arm.

Your session (world edits, pack slots, dropped items, health, hotbar selection, position and view, time of day and day count, defeated animals, chest contents, your bed, felled trees, and tonight's zombies: their position, health, and what it was doing, so a wind-up still lands and a stagger still slides; or that it was already killed) is saved to this browser's `localStorage` every 5 seconds while playing, on pause, after crafting or moving items, and when the page is closed or reloaded. Saves from earlier versions keep their world, and their items are moved into slots with their new IDs. **Start a new world** on the pause menu erases it. The bottom layer cannot be broken, and horizontal borders are solid boundaries. Caves, hunger, infinite terrain, and multiplayer are not implemented.

## Your first tools

1. Hold left-click on tree trunks to collect wood. Leaves can be cleared by hand too; you do not need an equipped item to gather.
2. Open crafting with **E**. One wood makes **4 planks**; two planks make **4 sticks**; four planks make **1 crafting table**.
3. Close crafting, resume, choose the table's hotbar slot, and right-click the ground to place it.
4. Right-click the table, or press E within five blocks of its center. Each wooden pickaxe or axe costs **3 planks + 2 sticks**. Four logs provide enough material for a table, sticks, and both tools.
5. Select the pickaxe to mine stone, or the axe to cut wood, planks, and tables faster. Each tool lasts **32 successfully harvested blocks**, then breaks.

## Home and hearth

Once you have a pickaxe, the table makes more stations and furnishings:

| Makes | From | At |
|---|---|---|
| Stove | 6 stone + 2 planks | table |
| Smelter | 8 stone | table |
| Chest | 8 planks | table |
| 3 doors | 6 planks | table |
| 4 windows | 4 glass + 2 sticks | table |
| Bed | 3 wool + 3 planks | table |
| Cooked chicken / cooked mutton | 1 raw meat + 1 plank (fuel) | stove |
| 2 glass | 2 sand + 1 plank (fuel) | smelter |

Right-click a stove or smelter (or stand within five blocks of it) to use its recipes. Raw meat restores 1 heart and cooked meat 3; F eats the food you hold, or the best food in your pack. Windows are see-through. Doors stand two blocks high; right-click to open or close them. Zombies walk through open doors but not closed ones. Beds take two cells along the way you face. Right-click one to make it your respawn point, and at night to sleep until morning, unless a zombie is within 8 blocks. A chest holds 18 slots: right-click it and drag between the chest and your pack. Breaking a chest spills what it held.

Every sunrise, all friendly animals come back to their homes with full health, including the ones you defeated. At dusk they leave. Each of the original trees regrows two days after it's first found missing, as long as its spot is bare grass, dirt, or snow.

Crafting uses a recipe list rather than a drag-and-drop grid. Disabled buttons show missing materials or a missing nearby table. Holding a table in your pack does not unlock tool recipes: place it first. Breaking a table returns it to your pack. Opening crafting pauses movement and mining; Escape or E closes it to the pause menu.

An empty hotbar slot mines with bare hands; bare hands cannot harvest stone. All gathered blocks drop their own block type, except ice.

## Wildlife

Each animal spawns in, and stays within, its home biome: four chickens and a cat in the plains, three sheep on the mountain, three geckos in the desert, a friendly snake named Garry Da Snake in the forest, and three fish swimming in the ocean. They are built from small Three.js box meshes, so they keep the same blocky style as the terrain. Chickens peck, flap their wings, and wander slowly; the geckos now have low bodies, long tapering tails, splayed feet, narrow snouts, big side-set eyes, pupils, and rosy cheek spots; Garry wiggles and flicks his tongue. Animals only walk on clear, level patches and relocate if building or digging removes the ground beneath them.

Click a chicken or sheep to hit it. Both have three hearts. Chickens drop feathers and raw chicken; sheep drop wool and raw mutton. Loot pops out on the ground for you to pick up. Geckos, the cat, fish, and Garry are friendly and cannot be damaged.

## Health and zombies

You start with 3 of 10 hearts, shown as pixel hearts above the hotbar. Press F to eat (up to 10 hearts). Craft a wooden sword at a table (2 planks + 1 stick): it deals 3 damage instead of 1 and wears like other tools.

Each night one themed zombie spawns inside each biome, at least 12 blocks away, and despawns at sunrise: the classic zombie (plains), frost zombie (snow), husk (desert), drowned (ocean, on the sea floor), mossy zombie (forest), and miner zombie (mountain). It wanders until you come within 10 blocks, then paths to you (BFS over walkable cells: climbs one block, drops up to three) and gives up if you get more than 16 blocks away or it can't find a route for 4 seconds. Up close it raises its arms before slamming down for 1 heart, backs off, and staggers back when hit. It has 6 health: two sword hits. Kill it and it stays gone until the next night, even across reloads. At 0 hearts you respawn at your bed (or the start) with 3 hearts; your items stay where you died.

`src/animals.ts` owns their meshes, health, loot, idle animations, movement, safe-ground checks, and cleanup. Wildlife is added as one scene group and disposed together with the game so React remounts do not leave duplicate animals or GPU resources behind.

## Sky and time

`src/environment.ts` provides the skybox and time of day. It uses a large procedural sky sphere, soft low-poly cloud puffs, 220 deterministic stars, a sun, and a moon with a small crater. One in-game day lasts five minutes, and days are counted at each sunrise. The sun and moon travel across the sky, sunlight and moonlight change with their elevation, stars fade in after sunset, and clouds drift slowly. The cycle continues while the game is paused so returning to the world feels like returning to a living place.

## How it works

1. **React and the game.** `src/main.tsx` owns the menu, palette, and messages. Its effect creates the game once per mount and disposes it on cleanup. Only UI events cross back into React; positions and animation frames do not trigger React renders. This also supports development Strict Mode's mount/cleanup/remount cycle.
2. **Voxel coordinates.** `src/world.ts` stores one byte per cell using `x + 96 * (z + 64 * y)`. Y points upward. A block at `(x,y,z)` occupies that corner through `(x+1,y+1,z+1)`. Zero means air. Each biome has its own trigonometric height function; a 7 × 7 average blends the borders, then fixed per-biome tree positions add wood and leaves. `biomeAt(x, z)` tells animals and zombies where they are. Read/write functions reject out-of-bounds cells; `editBlock` enforces gameplay editing rules.
3. **Rendering and textures.** `src/terrain.ts` creates a seeded 16-pixel texture atlas with separate grass sides and wood end grain. Nearest-neighbor sampling preserves pixels. Each solid block contributes only faces with air next to them; all faces share a single indexed geometry and material. `src/environment.ts` adds the sky sphere, clouds, stars, celestial bodies, and dynamic lights. A whole-world rebuild is deliberately simple for this bounded map. For larger worlds, split into chunks and rebuild only edited chunks and affected neighbors.
4. **Movement and collision.** `src/player.ts` treats the player as a 0.6 × 1.8 × 0.6 box, with the position at the bottom center. Each 1/120-second step moves and resolves X, Z, then Y against nearby occupied cells. Gravity changes vertical velocity, floor contact permits jumping, and ceiling contact stops upward velocity. Camera height is 1.62. The game caps elapsed time at 0.1 seconds to avoid runaway catch-up after a stall.
5. **Interaction and lifecycle.** `src/game.ts` uses PointerLockControls for mouse look, with a center-screen ray to identify the targeted terrain face. A tiny offset toward/away from the face selects the cell to break/place. Placement cannot intersect the player. Escape, blur, and hidden tabs clear movement. ResizeObserver updates the camera and renderer. Cleanup cancels animation, removes listeners, disconnects controls/observer, and disposes GPU resources.

6. **Crafting and resources.** `src/crafting.ts` owns item IDs, recipes, inventory counts, tool durability, and the resource-aware harvest/place operations. Successful operations consume/add items atomically; rejected edits leave inventory unchanged. Tool recipes recheck a placed table within five units of the player's eye on every craft. `src/game.ts` tracks a held mining target and elapsed time, resets progress on target changes or pause, and sends UI snapshots only when inventory or mining progress changes. React renders a native modal dialog, with keyboard focus trapping and disabled recipe buttons. The original low-level `editBlock` remains responsible for world edit constraints.

## Add a block

Append its name to `BLOCKS`, add a palette colour and texture tile in `makeAtlas`, and pick its tiles in `tileFor`. Item IDs in `src/crafting.ts` follow `BLOCKS.length`, so they move up automatically: bump the save key and add an ID shift for the previous version in `src/save.ts`, as v4 does for v3. World-only IDs (water, open doors, bed heads) go in `NOT_ITEMS`. Held and dropped blocks reuse `tileFor` through `blockGeometry`. Non-block items get 16 × 16 pixel art in `src/items.ts`, which draws both the UI icon and the extruded 3D model. Nonzero block IDs other than water are solid. `opaque` decides which neighbours hide faces (windows and shaped blocks don't), `blocking` which cells stop bodies (open doors don't), and `World.height` how tall a cell is for collision (beds are 9/16). Doors and beds are listed in `SHAPED` and drawn from `shapeBoxes` in `src/terrain.ts`. Window panes are transparent texture pixels that the terrain material's `alphaTest` cuts out.

## Checks

The small Node test covers bounds, deterministic generation, exposed face counts, falling/jumping, walls, ceilings, world borders, and block placement/removal rules. A second end-to-end logic check covers gathering, recipe costs, table proximity, tools, durability, failed transactions, and atlas UVs for new blocks. Wildlife tests cover eight spawns, safe terrain, movement, recovery after terrain edits, chicken damage/loot, and resource disposal. Zombie tests cover the sword recipe, eating, pathfinding around walls and up steps, night-only spawning, sight/give-up ranges, wind-up before damage, sword kills, and next-night respawn. Environment tests cover day-to-night transition, stars, and cleanup. Browser checks should cover pointer capture, mouse look, edits and target outline, hotbar changes, Escape/re-entry, focus loss, resizing, and React remount cleanup.

Fonts use Google Fonts with local sans-serif fallbacks. All terrain textures work offline.
