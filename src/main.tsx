import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createGame } from './game';
import { AXE, CHEST_SLOTS, HOTBAR_SLOTS, ITEMS, MAX_HEALTH, PICKAXE, RECIPES, SLOTS, START_HEALTH, STICKS, SWORD, TABLE, TOOLS, TOOL_USES, countOf, craftBlocker, createInventory, type Inventory, type Stack } from './crafting';
import { itemArt } from './items';
import './style.css';

// 9×8 pixel heart: o outline, h highlight, r red, d shade.
const HEART = ['.oo...oo.', 'ohro.orro', 'ohrrorrro', 'orrrrrrdo', '.orrrrdo.', '..orrdo..', '...odo...', '....o....'];
const heartPixels = (colors: string) => HEART.flatMap((row, y) => [...row].map((pixel, x) => colors.includes(pixel) ? `M${x} ${y}h1v1h-1z` : '')).join('');
const HEART_PATHS = { o: heartPixels('o'), h: heartPixels('h'), r: heartPixels('r'), d: heartPixels('d'), inside: heartPixels('hrd') };
function PixelHeart({ full, lost }: { full: boolean; lost: boolean }) {
    return <svg viewBox="0 0 9 8" className={`heart ${lost ? 'lost' : ''}`} shapeRendering="crispEdges" aria-hidden="true">
        <path d={HEART_PATHS.o} fill="#1b0b0e" />
        {full ? <><path d={HEART_PATHS.r} fill="#e3263a" /><path d={HEART_PATHS.h} fill="#ffd0d0" /><path d={HEART_PATHS.d} fill="#9c1426" /></>
            : <path d={HEART_PATHS.inside} fill="#3b2d30" />}
    </svg>;
}

function ItemIcon({ id, previews }: { id: number; previews: string[] }) {
    if (!id) return null;
    if (id < STICKS) return previews[id - 1] ? <img src={previews[id - 1]} alt="" /> : null;
    // Items share their pixels with the 3D held/dropped model; one path per colour keeps the SVG small.
    const paths = new Map<string, string>();
    itemArt(id)?.forEach((row, y) => row.forEach((color, x) => { if (color) paths.set(color, (paths.get(color) ?? '') + `M${x} ${y}h1v1h-1z`); }));
    return <svg viewBox="0 0 16 16" className="item-icon" aria-hidden="true" shapeRendering="crispEdges">
        {[...paths].map(([color, d]) => <path key={color} d={d} fill={color} />)}
    </svg>;
}

const shortName = (id: number) => id === PICKAXE ? 'Pickaxe' : id === AXE ? 'Axe' : id === SWORD ? 'Sword' : id === TABLE ? 'Table' : ITEMS[id];

// One inventory slot: drag it onto another slot to move or merge, Alt+arrows to move by keyboard, Q to drop it.
function Slot({ index, stack, previews, className = '', selected = false, number, onSelect, game }: {
    index: number; stack: Stack | null; previews: string[]; className?: string; selected?: boolean; number?: number;
    onSelect?: () => void; game: ReturnType<typeof createGame> | null;
}) {
    const [dragging, setDragging] = useState(false);
    const name = stack ? `${ITEMS[stack.id]}${stack.count > 1 ? ` ×${stack.count}` : ''}${TOOLS.includes(stack.id) ? `, ${stack.durability} uses left` : ''}` : 'Empty';
    return <button className={`slot ${className} ${selected ? 'selected' : ''} ${stack ? '' : 'empty-slot'} ${dragging ? 'dragging' : ''}`} title={stack ? ITEMS[stack.id] : undefined}
        aria-label={`${number !== undefined ? `Slot ${number}: ` : ''}${name}. Alt+arrow keys to move, Q to drop.`} aria-pressed={onSelect ? selected : undefined}
        onClick={onSelect} draggable={!!stack}
        onDragStart={event => { event.dataTransfer.setData('text/plain', String(index)); setDragging(true); }} onDragEnd={() => setDragging(false)}
        onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); game?.moveSlot(Number(event.dataTransfer.getData('text/plain')), index); }}
        onKeyDown={event => {
            if (event.code === 'KeyQ' && stack) { event.preventDefault(); game?.dropSlot(index); return; }
            if (!event.altKey) return;
            // Pack slots sit six to a row after the hotbar's ten; an open chest's six-wide rows come after the pack.
            const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: index >= HOTBAR_SLOTS ? -6 : 0, ArrowDown: index >= HOTBAR_SLOTS ? 6 : 0 }[event.key];
            if (!step) return;
            event.preventDefault();
            const to = index + step;
            const [lo, hi] = index < HOTBAR_SLOTS ? [0, HOTBAR_SLOTS] : index < SLOTS ? [HOTBAR_SLOTS, SLOTS] : [SLOTS, SLOTS + CHEST_SLOTS];
            if (to >= lo && to < hi) game?.moveSlot(index, to);
        }}>
        {number !== undefined && <span className="slot-number">{number}</span>}
        {stack && <><ItemIcon id={stack.id} previews={previews} />{stack.count > 1 && <span className="slot-count">{stack.count}</span>}<span className="slot-name">{shortName(stack.id)}</span></>}
        {stack && TOOLS.includes(stack.id) && <meter className="durability" min={0} max={TOOL_USES} value={stack.durability} aria-label={`${ITEMS[stack.id]} durability`} />}
    </button>;
}

function CraftingPanel({ inventory, near, chest, previews, onCraft, onClose, game }: {
    inventory: Inventory; near: number[]; chest: (Stack | null)[] | null; previews: string[];
    onCraft: (recipe: string) => void; onClose: () => void; game: ReturnType<typeof createGame> | null;
}) {
    const used = inventory.slots.slice(HOTBAR_SLOTS).filter(Boolean).length;
    const stations = near.map(id => ITEMS[id].toLowerCase()).join(' and ');
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const element = dialog.current!;
        element.showModal();
        return () => element.close();
    }, []);
    return <dialog ref={dialog} className="crafting-dialog" aria-labelledby="crafting-title"
        onCancel={event => { event.preventDefault(); onClose(); }}
        onKeyDown={event => { if (event.code === 'KeyE' && !event.repeat) { event.preventDefault(); onClose(); } }}>
        <header className="crafting-header">
            <div><div className="eyebrow">GATHER · MAKE · EXPLORE</div><h2 id="crafting-title">{chest ? 'In your chest.' : near.length ? `At the ${stations}.` : 'Made by hand.'}</h2></div>
            <button className="close-crafting" onClick={onClose} autoFocus aria-label="Close crafting">Close <kbd>ESC</kbd></button>
        </header>
        <p className="crafting-intro">{chest ? 'Drag things between your chest and your pack. The chest keeps them safe here.'
            : near.length ? 'Within reach. Stoves cook and smelters make glass, each burning a plank.' : 'Start with wood. Make planks, then a table. Place it nearby to craft tools.'}</p>
        <div className="crafting-columns">
            {chest ? <section className="pack" aria-label="Chest"><h3>CHEST <span>{chest.filter(Boolean).length} / {chest.length} SLOTS USED</span></h3>
                <div className="pack-grid">{chest.map((stack, i) =>
                    <Slot key={i} index={SLOTS + i} stack={stack} previews={previews} className="pack-slot" game={game} />)}</div>
            </section>
            : <section aria-label="Crafting recipes"><h3>RECIPES <span>{near.length ? `${near.map(id => shortName(id).toUpperCase()).join(' + ')} + HAND` : 'HAND CRAFTING'}</span></h3>
                <div className="recipes">{RECIPES.map(recipe => {
                    const blocker = craftBlocker(inventory, recipe, near);
                    return <article className="recipe" key={recipe.id}>
                        <div className="recipe-icon"><ItemIcon id={recipe.output} previews={previews} /></div>
                        <div className="recipe-detail"><strong>{ITEMS[recipe.output]} <small>×{recipe.count}</small></strong>
                            <div className="ingredients">{recipe.ingredients.map(([id, count]) => <span key={id} className={countOf(inventory, id) >= count ? 'enough' : ''}>{count} {ITEMS[id].toLowerCase()} <small>({countOf(inventory, id)} held)</small></span>)}</div>
                            {blocker === 'station' && <span className="requires-table">Place a {ITEMS[recipe.station].toLowerCase()} within 5 blocks</span>}
                            {blocker === 'room' && <span className="requires-table">No room in your pack</span>}
                        </div>
                        <button className="craft-button" disabled={!!blocker} onClick={() => onCraft(recipe.id)} aria-label={`Craft ${ITEMS[recipe.output]}`}>Craft <span>+</span></button>
                    </article>;
                })}</div>
            </section>}
            <section className="pack" aria-label="Inventory"><h3>YOUR PACK <span>{used} / 36 SLOTS USED</span></h3>
                <div className="pack-grid">{inventory.slots.slice(HOTBAR_SLOTS).map((stack, i) =>
                    <Slot key={i} index={i + HOTBAR_SLOTS} stack={stack} previews={previews} className="pack-slot" game={game} />)}</div>
                <h3 className="hotbar-heading">HOTBAR <span>DRAG ITEMS BETWEEN ROWS</span></h3>
                <div className="pack-grid hotbar-row">{inventory.slots.slice(0, HOTBAR_SLOTS).map((stack, i) =>
                    <Slot key={i} index={i} stack={stack} previews={previews} className="pack-slot" number={(i + 1) % 10} game={game} />)}</div>
                <div className="drop-zone" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); game?.dropSlot(Number(event.dataTransfer.getData('text/plain'))); }}>
                    Drag here to drop on the ground</div>
                <div className="crafting-tip"><strong>A little know-how</strong><p>Hold left click to gather: blocks pop out, and you pick them up by walking over them. When your pack is full, items wait on the ground. A pickaxe mines stone; an axe cuts wood faster. Each tool lasts {TOOL_USES} uses.</p><p>Zombies roam at night. A sword hits three times harder than your fist. Press F to eat: raw meat gives a heart, cooked gives three. Mind cacti and long falls.</p><p>Right-click a table, stove, smelter, or chest to use it, a door to open it, and a bed to sleep through the night. Q drops what you hold. If you die, your things stay where you fell, and you wake at your bed.</p></div>
                <p className="session-note">Your world and pack are saved in this browser.</p>
            </section>
        </div>
    </dialog>;
}

function App() {
    const host = useRef<HTMLDivElement>(null), game = useRef<ReturnType<typeof createGame> | null>(null);
    const [locked, setLocked] = useState(false), [started, setStarted] = useState(false), [hasSave, setHasSave] = useState(false), [selected, setSelected] = useState(0);
    const [error, setError] = useState(''), [previews, setPreviews] = useState<string[]>([]);
    const [inventory, setInventory] = useState(createInventory);
    const [crafting, setCrafting] = useState<{ open: boolean; near: number[]; chest: (Stack | null)[] | null }>({ open: false, near: [], chest: null });
    const [mining, setMining] = useState({ progress: 0, message: '' });
    const [health, setHealth] = useState(START_HEALTH), [hurt, setHurt] = useState({ count: 0, heart: -1 });
    useEffect(() => {
        try {
            game.current = createGame(host.current!, {
                locked: setLocked, selected: setSelected, error: setError, previews: setPreviews, inventory: setInventory,
                crafting: (open, near, chest) => setCrafting({ open, near, chest }),
                mining: (progress, message) => setMining({ progress, message }),
                health: (value, wasHurt) => { setHealth(value); if (wasHurt) setHurt(previous => ({ count: previous.count + 1, heart: value })); },
            });
            setHasSave(game.current.hasSave);
        } catch (e) {
            setError(`Unable to start 3D graphics. Please use a desktop browser with WebGL enabled. ${e instanceof Error ? e.message : ''}`);
        }
        return () => { game.current?.dispose(); game.current = null; };
    }, []);
    useEffect(() => { if (locked) setStarted(true); }, [locked]);
    const held = inventory.slots[selected];
    return <main className={locked ? 'app playing' : 'app'}>
        <div ref={host} className="world" aria-label="Interactive voxel world" />
        <header className="topbar"><a className="brand" href="./" aria-label="Minecaves home"><span className="brand-mark">▧</span>MINECAVES<span className="edition">SANDBOX / 002</span></a><span className="world-badge"><i /> A LITTLE WORLD OF YOUR OWN</span></header>
        <div className="world-label"><span>THE OVERWORLD</span><small>96 × 64 · SIX BIOMES TO EXPLORE</small></div>
        {locked && <><div className="crosshair" aria-hidden="true">+</div><div className="mining-status">{mining.progress > 0 && <progress value={mining.progress} max={100} aria-label="Mining progress" />}{mining.message && <span role="status">{mining.message}</span>}</div></>}
        {!locked && !crafting.open && <section className="menu" aria-label={started ? 'Game paused' : 'Start game'}>
            <div className="eyebrow"><span /> YOUR NEXT SMALL ADVENTURE</div>
            <h1>{started ? <>Take a<br /><em>breather.</em></> : hasSave ? <>Welcome<br /><em>back.</em></> : <>A world.<br />Yours to <em>make.</em></>}</h1>
            <p>{started || hasSave ? 'Your little corner of the world is right where you left it.' : 'Gather a little wood. Craft your first tools.\nBuild something that feels like you.'}</p>
            <button className="play" onClick={() => game.current?.play()} disabled={!game.current && !!error}>{started ? 'Back to the world' : hasSave ? 'Continue your world' : 'Step into the world'}<span>↗</span></button>
            {/* Start menu with a save: starting over is a first-class choice, not a footnote. */}
            {!started && hasSave && <button className="open-crafting" onClick={() => { if (confirm('Start a new world? Your current world, pack, and hotbar will be erased.')) game.current?.newWorld(); }}>Start a new world <span aria-hidden="true">↺</span></button>}
            <button className="open-crafting" onClick={() => game.current?.openCrafting()}>Open pack & crafting <kbd>E</kbd></button>
            {started && <button className="new-world" onClick={() => { if (confirm('Start a new world? Your current world, pack, and hotbar will be erased.')) game.current?.newWorld(); }}>Start a new world</button>}
            <div className="menu-note"><span>◈</span> GATHER. CRAFT. MAKE IT YOURS.</div>
            <div className="controls"><div><kbd>W</kbd><span className="key-row"><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><small>Wander</small></div><div><span className="mouse-icon">↕</span><small>Look around</small></div><div><kbd className="space">SPACE</kbd><small>Jump</small></div></div>
        </section>}
        {hurt.count > 0 && <div key={hurt.count} className="hurt" aria-hidden="true" />}
        {error && <div className="error" role="alert">{error}</div>}
        <aside className="hotbar-area" aria-label="Block and tool palette">
            <div className="hearts" role="img" aria-label={`Health: ${health} of ${MAX_HEALTH} hearts`}>
                {Array.from({ length: MAX_HEALTH }, (_, i) => <PixelHeart key={i === hurt.heart ? `${i}-${hurt.count}` : i} full={i < health} lost={i === hurt.heart} />)}
            </div>
            <div className="selection-name">{held ? <>{ITEMS[held.id]}<span> / {held.count} HELD{TOOLS.includes(held.id) ? ` · ${held.durability} USES` : ''}</span></> : <>Empty hand<span> / PICK SOMETHING UP</span></>}</div>
            <div className="hotbar">{inventory.slots.slice(0, HOTBAR_SLOTS).map((stack, index) =>
                <Slot key={index} index={index} stack={stack} previews={previews} number={(index + 1) % 10} selected={selected === index} onSelect={() => game.current?.select(index)} game={game.current} />)}</div>
            <div className="build-hint"><span>HOLD LEFT <b>gather</b></span><i /><span>RIGHT <b>place / use</b></span><i /><span>1–0 / SCROLL <b>select</b></span><i /><span>Q <b>drop</b></span><i /><span>F <b>eat</b></span><i /><span>E <b>craft</b></span></div>
        </aside>
        <footer><span>MADE OF BLOCKS. FULL OF POSSIBILITY.</span><span>{locked ? 'E TO CRAFT · ESC TO PAUSE' : 'DESKTOP EXPLORER'} <span className="footer-dot">◆</span> V 0.2</span></footer>
        {crafting.open && <CraftingPanel inventory={inventory} near={crafting.near} chest={crafting.chest} previews={previews} onCraft={recipe => game.current?.craft(recipe)} onClose={() => game.current?.closeCrafting()} game={game.current} />}
    </main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
