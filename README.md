# Minecaves

A small, playable voxel sandbox built for learning with React, Three.js, TypeScript, and Vite. Original pixel textures are generated locally; no downloaded game assets.

## Run

Use Node.js 22.18+ (or Node.js 24+).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite in a desktop browser with WebGL and a mouse. Click **Step into the world** to capture your pointer. Use WASD to move, the mouse to look, Space to jump, hold left-click to gather, right-click to place/use, 1–9 then 0 to choose a hotbar slot (left to right), and F to eat raw chicken. Press E while playing to open your pack and crafting. You can also open it from the pause menu. Escape pauses and releases the pointer. Clicking a hotbar slot while paused also selects it; drag slots (or Alt+←/→ on a focused slot) to rearrange them. Blocks have a five-unit reach.

```sh
npm test
npm run typecheck
npm run build
npm run preview
```

The world is 32 × 32 × 32. You start with an empty pack: gathering adds blocks and placement consumes them. Your session (world edits, pack, health, hotbar order and selection, position and view, time of day, defeated chickens, and tonight's zombie: its position, health, and what it was doing, so a wind-up still lands and a stagger still slides; or that it was already killed) is saved to this browser's `localStorage` every 5 seconds while playing, on pause, after crafting or rearranging the hotbar, and when the page is closed or reloaded. **Start a new world** on the pause menu erases it. The bottom layer cannot be broken, and horizontal borders are solid boundaries. Caves, hunger, infinite terrain, and multiplayer are not implemented.

## Your first tools

1. Hold left-click on tree trunks to collect wood. Leaves can be cleared by hand too; you do not need an equipped item to gather.
2. Open crafting with **E**. One wood makes **4 planks**; two planks make **4 sticks**; four planks make **1 crafting table**.
3. Close crafting, resume, choose the table with **7**, and right-click the ground to place it.
4. Right-click the table, or press E within five blocks of its center. Each wooden pickaxe or axe costs **3 planks + 2 sticks**. Four logs provide enough material for a table, sticks, and both tools.
5. Equip the pickaxe with **8** to mine stone, or the axe with **9** to cut wood, planks, and tables faster. Each tool lasts **32 successfully harvested blocks**; a spare automatically replaces it when it breaks.

Crafting uses a recipe list rather than a drag-and-drop grid. Disabled buttons show missing materials or a missing nearby table. Holding a table in your pack does not unlock tool recipes: place it first. Breaking a table returns it to your pack. Opening crafting pauses movement and mining; Escape or E closes it to the pause menu.

Default hotbar: **1** grass, **2** dirt, **3** stone, **4** wood, **5** leaves, **6** planks, **7** table, **8** pickaxe, **9** axe, **0** sword. Sticks stay in your pack for crafting. An empty hotbar slot mines with bare hands; bare hands cannot harvest stone. All gathered blocks return their own block type.

## Wildlife

The world starts with four chickens, three geckos, and a friendly snake named Garry Da Snake. They are built from small Three.js box meshes, so they keep the same blocky style as the terrain. Chickens peck, flap their wings, and wander slowly; the geckos now have low bodies, long tapering tails, splayed feet, narrow snouts, big side-set eyes, pupils, and rosy cheek spots; Garry wiggles and flicks his tongue. Animals only walk on clear, level patches and relocate if building or digging removes the ground beneath them.

Click a chicken to hit it. Chickens have three hearts and drop feathers and chicken meat when defeated. Loot goes into your pack and is shown in the crafting inventory. Geckos and Garry are friendly and cannot be damaged.

## Health and zombies

You start with 3 of 10 hearts, shown as pixel hearts above the hotbar. Press F to eat one raw chicken for +1 heart (up to 10). Craft a wooden sword at a table (2 planks + 1 stick): it deals 3 damage instead of 1 and wears like other tools.

One zombie spawns each night at least 12 blocks away and despawns at sunrise. It wanders until you come within 10 blocks, then paths to you (BFS over walkable cells: climbs one block, drops up to three) and gives up if you get more than 16 blocks away or it can't find a route for 4 seconds. Up close it raises its arms before slamming down for 1 heart, backs off, and staggers back when hit. It has 6 health: two sword hits. Kill it and it stays gone until the next night, even across reloads. At 0 hearts you respawn at the start with 3 hearts and an empty pack.

`src/animals.ts` owns their meshes, health, loot, idle animations, movement, safe-ground checks, and cleanup. Wildlife is added as one scene group and disposed together with the game so React remounts do not leave duplicate animals or GPU resources behind.

## Sky and time

`src/environment.ts` provides the skybox and time of day. It uses a large procedural sky sphere, soft low-poly cloud puffs, 220 deterministic stars, a sun, and a moon with a small crater. One in-game day lasts three minutes. The sun and moon travel across the sky, sunlight and moonlight change with their elevation, stars fade in after sunset, and clouds drift slowly. The cycle continues while the game is paused so returning to the world feels like returning to a living place.

## How it works

1. **React and the game.** `src/main.tsx` owns the menu, palette, and messages. Its effect creates the game once per mount and disposes it on cleanup. Only UI events cross back into React; positions and animation frames do not trigger React renders. This also supports development Strict Mode's mount/cleanup/remount cycle.
2. **Voxel coordinates.** `src/world.ts` stores one byte per cell using `x + 32 * (z + 32 * y)`. Y points upward. A block at `(x,y,z)` occupies that corner through `(x+1,y+1,z+1)`. Zero means air. Trigonometric height functions create repeatable hills, then fixed tree positions add wood and leaves. Read/write functions reject out-of-bounds cells; `editBlock` enforces gameplay editing rules.
3. **Rendering and textures.** `src/terrain.ts` creates a seeded 16-pixel texture atlas with separate grass sides and wood end grain. Nearest-neighbor sampling preserves pixels. Each solid block contributes only faces with air next to them; all faces share a single indexed geometry and material. `src/environment.ts` adds the sky sphere, clouds, stars, celestial bodies, and dynamic lights. A whole-world rebuild is deliberately simple for this bounded map. For larger worlds, split into chunks and rebuild only edited chunks and affected neighbors.
4. **Movement and collision.** `src/player.ts` treats the player as a 0.6 × 1.8 × 0.6 box, with the position at the bottom center. Each 1/120-second step moves and resolves X, Z, then Y against nearby occupied cells. Gravity changes vertical velocity, floor contact permits jumping, and ceiling contact stops upward velocity. Camera height is 1.62. The game caps elapsed time at 0.1 seconds to avoid runaway catch-up after a stall.
5. **Interaction and lifecycle.** `src/game.ts` uses PointerLockControls for mouse look, with a center-screen ray to identify the targeted terrain face. A tiny offset toward/away from the face selects the cell to break/place. Placement cannot intersect the player. Escape, blur, and hidden tabs clear movement. ResizeObserver updates the camera and renderer. Cleanup cancels animation, removes listeners, disconnects controls/observer, and disposes GPU resources.

6. **Crafting and resources.** `src/crafting.ts` owns item IDs, recipes, inventory counts, tool durability, and the resource-aware harvest/place operations. Successful operations consume/add items atomically; rejected edits leave inventory unchanged. Tool recipes recheck a placed table within five units of the player's eye on every craft. `src/game.ts` tracks a held mining target and elapsed time, resets progress on target changes or pause, and sends UI snapshots only when inventory or mining progress changes. React renders a native modal dialog, with keyboard focus trapping and disabled recipe buttons. The original low-level `editBlock` remains responsible for world edit constraints.

## Add a block

Append its name to `BLOCKS`, add a texture tile and preview in `makeAtlas`, and update atlas tile selection/UV width in `terrainGeometry`. Keep block IDs aligned with `ITEMS` and item constants in `src/crafting.ts`, and update `HOTBAR` if it should be selectable. The game derives number-key selection from that hotbar. Existing nonzero block IDs are solid; transparent or non-cube blocks would require additional rendering and collision rules.

## Checks

The small Node test covers bounds, deterministic generation, exposed face counts, falling/jumping, walls, ceilings, world borders, and block placement/removal rules. A second end-to-end logic check covers gathering, recipe costs, table proximity, tools, durability, failed transactions, and atlas UVs for new blocks. Wildlife tests cover eight spawns, safe terrain, movement, recovery after terrain edits, chicken damage/loot, and resource disposal. Zombie tests cover the sword recipe, eating, pathfinding around walls and up steps, night-only spawning, sight/give-up ranges, wind-up before damage, sword kills, and next-night respawn. Environment tests cover day-to-night transition, stars, and cleanup. Browser checks should cover pointer capture, mouse look, edits and target outline, hotbar changes, Escape/re-entry, focus loss, resizing, and React remount cleanup.

Fonts use Google Fonts with local sans-serif fallbacks. All terrain textures work offline.
