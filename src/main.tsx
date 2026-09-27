import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createGame } from './game';
import { AXE, CHICKEN_MEAT, PICKAXE, STICKS, SWORD, HOTBAR, ITEMS, MAX_HEALTH, RECIPES, START_HEALTH, TOOL_USES, canCraft, createInventory, type Inventory } from './crafting';
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
    if (id < STICKS) return previews[id - 1] ? <img src={previews[id - 1]} alt="" /> : null;
    if (id === SWORD) return <svg viewBox="0 0 16 16" className="item-icon" aria-hidden="true" shapeRendering="crispEdges">
        <path d="M6 10L14 2" stroke="#6b482b" strokeWidth="3.5" />
        <path d="M6 10L13 3" stroke="#d2ab6d" strokeWidth="2" />
        <path d="M3 9L7 13" stroke="#6b482b" strokeWidth="2" />
        <path d="M2 14L5 11" stroke="#553923" strokeWidth="2.5" />
    </svg>;
    if (id === CHICKEN_MEAT) return <svg viewBox="0 0 16 16" className="item-icon" aria-hidden="true" shapeRendering="crispEdges">
        <path d="M10 10L14 14" stroke="#f3ead8" strokeWidth="2" />
        <path d="M3 4H8V3H10V5H11V9H10V10H8V11H4V10H3Z" fill="#f2a7a0" stroke="#9c4b4b" strokeWidth="1" />
    </svg>;
    return <svg viewBox="0 0 16 16" className="item-icon" aria-hidden="true" shapeRendering="crispEdges">
        <path d="M3 13L11 5" stroke="#553923" strokeWidth="3" />
        <path d="M3 12L10 5" stroke="#b88a4d" strokeWidth="1.5" />
        {id === PICKAXE && <path d="M3 3H10L13 6V9H11V6H9V5H3Z" fill="#d2ab6d" stroke="#6b482b" strokeWidth="1" />}
        {id === AXE && <path d="M7 2H12V7H7L5 5V3Z" fill="#d2ab6d" stroke="#6b482b" strokeWidth="1" />}
    </svg>;
}

function CraftingPanel({ inventory, table, previews, onCraft, onClose }: {
    inventory: Inventory; table: boolean; previews: string[];
    onCraft: (recipe: string) => void; onClose: () => void;
}) {
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
            <div><div className="eyebrow">GATHER · MAKE · EXPLORE</div><h2 id="crafting-title">{table ? 'At the crafting table.' : 'Made by hand.'}</h2></div>
            <button className="close-crafting" onClick={onClose} autoFocus aria-label="Close crafting">Close <kbd>ESC</kbd></button>
        </header>
        <p className="crafting-intro">{table ? 'Your table is within reach. Turn a little wood into your next tool.' : 'Start with wood. Make planks, then a table. Place it nearby to craft tools.'}</p>
        <div className="crafting-columns">
            <section aria-label="Crafting recipes"><h3>RECIPES <span>{table ? 'TABLE + HAND' : 'HAND CRAFTING'}</span></h3>
                <div className="recipes">{RECIPES.map(recipe => {
                    const enabled = canCraft(inventory, recipe, table);
                    return <article className="recipe" key={recipe.id}>
                        <div className="recipe-icon"><ItemIcon id={recipe.output} previews={previews} /></div>
                        <div className="recipe-detail"><strong>{ITEMS[recipe.output]} <small>×{recipe.count}</small></strong>
                            <div className="ingredients">{recipe.ingredients.map(([id, count]) => <span key={id} className={inventory.counts[id] >= count ? 'enough' : ''}>{count} {ITEMS[id].toLowerCase()} <small>({inventory.counts[id]} held)</small></span>)}</div>
                            {recipe.table && !table && <span className="requires-table">Place a crafting table within 5 blocks</span>}
                        </div>
                        <button className="craft-button" disabled={!enabled} onClick={() => onCraft(recipe.id)} aria-label={`Craft ${ITEMS[recipe.output]}`}>Craft <span>+</span></button>
                    </article>;
                })}</div>
            </section>
            <section className="pack" aria-label="Inventory"><h3>YOUR PACK <span>COLLECTED MATERIALS</span></h3>
                <div className="inventory-grid">{ITEMS.slice(1).map((name, index) => <div key={name} className={`inventory-item ${inventory.counts[index + 1] ? '' : 'empty'}`}>
                    <ItemIcon id={index + 1} previews={previews} /><strong>{inventory.counts[index + 1]}</strong><span>{name}</span>
                </div>)}</div>
                <div className="crafting-tip"><strong>A little know-how</strong><p>Hold left click to gather. A pickaxe mines stone; an axe cuts wood faster. Each tool lasts {TOOL_USES} uses.</p><p>Zombies roam at night. A sword hits three times harder than your fist. Press F to eat raw chicken for a heart.</p><p>Right-click a placed table to open it. E opens your pack. Drag hotbar slots to rearrange them.</p></div>
                <p className="session-note">This world and your pack reset on reload.</p>
            </section>
        </div>
    </dialog>;
}

function App() {
    const host = useRef<HTMLDivElement>(null), game = useRef<ReturnType<typeof createGame> | null>(null);
    const [locked, setLocked] = useState(false), [started, setStarted] = useState(false), [selected, setSelected] = useState(1);
    const [error, setError] = useState(''), [previews, setPreviews] = useState<string[]>([]);
    const [inventory, setInventory] = useState(createInventory);
    const [crafting, setCrafting] = useState({ open: false, table: false });
    const [mining, setMining] = useState({ progress: 0, message: '' });
    const [health, setHealth] = useState(START_HEALTH), [hurt, setHurt] = useState({ count: 0, heart: -1 });
    const [hotbar, setHotbar] = useState(HOTBAR), [dragging, setDragging] = useState(-1);
    useEffect(() => {
        try {
            game.current = createGame(host.current!, {
                locked: setLocked, selected: setSelected, error: setError, previews: setPreviews, inventory: setInventory,
                crafting: (open, table) => setCrafting({ open, table }),
                mining: (progress, message) => setMining({ progress, message }),
                health: (value, wasHurt) => { setHealth(value); if (wasHurt) setHurt(previous => ({ count: previous.count + 1, heart: value })); },
                hotbar: setHotbar,
            });
        } catch (e) {
            setError(`Unable to start 3D graphics. Please use a desktop browser with WebGL enabled. ${e instanceof Error ? e.message : ''}`);
        }
        return () => { game.current?.dispose(); game.current = null; };
    }, []);
    useEffect(() => { if (locked) setStarted(true); }, [locked]);
    return <main className={locked ? 'app playing' : 'app'}>
        <div ref={host} className="world" aria-label="Interactive voxel world" />
        <header className="topbar"><a className="brand" href="./" aria-label="Minecaves home"><span className="brand-mark">▧</span>MINECAVES<span className="edition">SANDBOX / 002</span></a><span className="world-badge"><i /> A LITTLE WORLD OF YOUR OWN</span></header>
        <div className="world-label"><span>THE OVERWORLD</span><small>32 × 32 · OPEN FOR EXPLORATION</small></div>
        {locked && <><div className="crosshair" aria-hidden="true">+</div><div className="mining-status">{mining.progress > 0 && <progress value={mining.progress} max={100} aria-label="Mining progress" />}{mining.message && <span role="status">{mining.message}</span>}</div></>}
        {!locked && !crafting.open && <section className="menu" aria-label={started ? 'Game paused' : 'Start game'}>
            <div className="eyebrow"><span /> YOUR NEXT SMALL ADVENTURE</div>
            <h1>{started ? <>Take a<br /><em>breather.</em></> : <>A world.<br />Yours to <em>make.</em></>}</h1>
            <p>{started ? 'Your little corner of the world is right where you left it.' : 'Gather a little wood. Craft your first tools.\nBuild something that feels like you.'}</p>
            <button className="play" onClick={() => game.current?.play()} disabled={!game.current && !!error}>{started ? 'Back to the world' : 'Step into the world'}<span>↗</span></button>
            <button className="open-crafting" onClick={() => game.current?.openCrafting()}>Open pack & crafting <kbd>E</kbd></button>
            <div className="menu-note"><span>◈</span> GATHER. CRAFT. MAKE IT YOURS.</div>
            <div className="controls"><div><kbd>W</kbd><span className="key-row"><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><small>Wander</small></div><div><span className="mouse-icon">↕</span><small>Look around</small></div><div><kbd className="space">SPACE</kbd><small>Jump</small></div></div>
        </section>}
        {hurt.count > 0 && <div key={hurt.count} className="hurt" aria-hidden="true" />}
        {error && <div className="error" role="alert">{error}</div>}
        <aside className="hotbar-area" aria-label="Block and tool palette">
            <div className="hearts" role="img" aria-label={`Health: ${health} of ${MAX_HEALTH} hearts`}>
                {Array.from({ length: MAX_HEALTH }, (_, i) => <PixelHeart key={i === hurt.heart ? `${i}-${hurt.count}` : i} full={i < health} lost={i === hurt.heart} />)}
            </div>
            <div className="selection-name">{ITEMS[selected]}<span> / {inventory.counts[selected]} HELD{selected >= PICKAXE && inventory.counts[selected] > 0 ? ` · ${inventory.durability[selected]} USES` : ''}</span></div>
            <div className="hotbar">{hotbar.map((id, index) => <button key={id} className={`slot ${selected === id ? 'selected' : ''} ${inventory.counts[id] ? '' : 'empty-slot'} ${dragging === index ? 'dragging' : ''}`} onClick={() => game.current?.select(id)}
                aria-label={`Select ${ITEMS[id]} (key ${(index + 1) % 10}), ${inventory.counts[id]} held. Alt+arrow keys to move.`} aria-pressed={selected === id}
                draggable onDragStart={event => { event.dataTransfer.setData('text/plain', String(index)); setDragging(index); }} onDragEnd={() => setDragging(-1)}
                onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); game.current?.swapSlots(Number(event.dataTransfer.getData('text/plain')), index); }}
                onKeyDown={event => {
                    if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
                    event.preventDefault();
                    const to = index + (event.key === 'ArrowLeft' ? -1 : 1);
                    game.current?.swapSlots(index, to);
                    (event.currentTarget.parentElement?.children[to] as HTMLElement | undefined)?.focus();
                }}>
                <span className="slot-number">{(index + 1) % 10}</span><ItemIcon id={id} previews={previews} /><span className="slot-count">{inventory.counts[id]}</span><span className="slot-name">{id === PICKAXE ? 'Pickaxe' : id === AXE ? 'Axe' : id === SWORD ? 'Sword' : id === 7 ? 'Table' : ITEMS[id]}</span>
                {id >= PICKAXE && inventory.counts[id] > 0 && <meter className="durability" min={0} max={TOOL_USES} value={inventory.durability[id]} aria-label={`${ITEMS[id]} durability`} />}
            </button>)}</div>
            <div className="build-hint"><span>HOLD LEFT <b>gather</b></span><i /><span>RIGHT <b>place / use</b></span><i /><span>1–0 <b>select</b></span><i /><span>F <b>eat</b></span><i /><span>E <b>craft</b></span></div>
        </aside>
        <footer><span>MADE OF BLOCKS. FULL OF POSSIBILITY.</span><span>{locked ? 'E TO CRAFT · ESC TO PAUSE' : 'DESKTOP EXPLORER'} <span className="footer-dot">◆</span> V 0.2</span></footer>
        {crafting.open && <CraftingPanel inventory={inventory} table={crafting.table} previews={previews} onCraft={recipe => game.current?.craft(recipe)} onClose={() => game.current?.closeCrafting()} />}
    </main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
