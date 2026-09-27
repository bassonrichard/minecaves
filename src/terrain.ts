import * as THREE from 'three';
import { BED, BED_HEAD, BED_HEIGHT, BLOCKS, CACTUS, CHEST, DOOR, FACES, ICE, OPEN_DOOR, SAND, SHAPED, SIZE_X, SIZE_Y, SIZE_Z, SMELTER, SNOW, STOVE, WATER, WINDOW, visibleFaces, type World } from './world.ts';
// Tiles 17+: stove top/front, smelter front/top, chest side/top, window, door bottom/top, bed foot/head/side.
const palettes = ['#78a442', '#896044', '#92918a', '#805431', '#507f3b', '#6b943b', '#ad8350', '#b58a51', '#ac7e43', '#885d33', '#dcc68a', '#eef4f7', '#896044', '#3f76c9', '#4f8a3a', '#6aa24a', '#a9d4f2',
    '#2d2f33', '#cfcac0', '#7f7e78', '#7f7e78', '#a8763c', '#a8763c', '#8a5a2b', '#9a6a38', '#9a6a38', '#b8323a', '#b8323a', '#b8323a'];
export function makeAtlas() {
    const canvas = document.createElement('canvas');
    canvas.width = 16 * palettes.length;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;
    let seed = 721;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    palettes.forEach((color, tile) => {
        ctx.fillStyle = color;
        ctx.fillRect(tile * 16, 0, 16, 16);
        for (let y = 0; y < 16; y++)
            for (let x = 0; x < 16; x++) {
                ctx.fillStyle = random() > .5 ? `rgba(255,255,225,${random() * .16})` : `rgba(30,25,12,${random() * .2})`;
                ctx.fillRect(tile * 16 + x, y, 1, 1);
            }
        if (tile === 3) {
            ctx.fillStyle = '#573c27';
            for (let x = 2; x < 16; x += 4)
                ctx.fillRect(tile * 16 + x, 0, 1, 16);
        }
        // Grass side (5) and snow side (12): dirt under a ragged fringe.
        if (tile === 5 || tile === 12) {
            ctx.fillStyle = '#896044';
            ctx.fillRect(tile * 16, 5, 16, 11);
            for (let x = 0; x < 16; x++) {
                ctx.fillStyle = tile === 5 ? '#6b943b' : '#eef4f7';
                ctx.fillRect(tile * 16 + x, 4, 1, 1 + Math.floor(random() * 3));
            }
            for (let i = 0; i < 35; i++) {
                ctx.fillStyle = '#73513b';
                ctx.fillRect(tile * 16 + Math.floor(random() * 16), 8 + Math.floor(random() * 8), 1, 1);
            }
        }
        if (tile === 6) {
            ctx.strokeStyle = '#795a36';
            ctx.lineWidth = 1;
            for (let inset = 2; inset < 8; inset += 3)
                ctx.strokeRect(tile * 16 + inset + .5, inset + .5, 15 - 2 * inset, 15 - 2 * inset);
        }
        if (tile === 13) {
            ctx.fillStyle = 'rgba(200,230,255,.35)';
            for (const [x, y] of [[2, 3], [9, 6], [4, 11], [11, 13]]) ctx.fillRect(tile * 16 + x, y, 4, 1);
        }
        // Cactus side: ridges and spines; top: a ring.
        if (tile === 14) {
            ctx.fillStyle = '#3d6e2c';
            for (const x of [1, 5, 10, 14]) ctx.fillRect(tile * 16 + x, 0, 1, 16);
            ctx.fillStyle = '#e8e2b0';
            for (const [x, y] of [[3, 2], [8, 5], [12, 3], [3, 9], [7, 12], [12, 10]]) ctx.fillRect(tile * 16 + x, y, 1, 1);
        }
        if (tile === 15) {
            ctx.strokeStyle = '#3d6e2c';
            ctx.strokeRect(tile * 16 + 2.5, 2.5, 11, 11);
        }
        if (tile === 16) {
            ctx.fillStyle = 'rgba(255,255,255,.45)';
            for (const [x, y, w] of [[2, 2, 5], [9, 5, 4], [3, 10, 6], [11, 12, 3]]) ctx.fillRect(tile * 16 + x, y, w, 1);
        }
        // Paints the pixels of this tile whose centres pass `inside`.
        const px = (color: string, inside: (x: number, y: number) => boolean) => {
            ctx.fillStyle = color;
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (inside(x + .5, y + .5)) ctx.fillRect(tile * 16 + x, y, 1, 1);
        };
        const rect = (x0: number, y0: number, x1: number, y1: number) => (x: number, y: number) => x > x0 && x < x1 && y > y0 && y < y1;
        const clear = (inside: (x: number, y: number) => boolean) => {
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (inside(x + .5, y + .5)) ctx.clearRect(tile * 16 + x, y, 1, 1);
        };
        const border = (x: number, y: number) => x < 1 || y < 1 || x > 15 || y > 15;
        if (tile === 17) {
            // Stove top: an iron plate with four burner rings.
            for (const [cx, cy] of [[4.5, 4.5], [11.5, 4.5], [4.5, 11.5], [11.5, 11.5]]) {
                px('#6b7078', (x, y) => Math.abs(Math.hypot(x - cx, y - cy) - 2.6) < .6);
                px('#1a1b1e', (x, y) => Math.hypot(x - cx, y - cy) < 1.4);
            }
            px('#45484e', border);
        }
        if (tile === 18) {
            // Stove front: control strip with knobs over an oven door with a dark window and handle.
            px('#3a3b3f', rect(0, 0, 16, 3));
            px('#d9d9d9', (x, y) => y > 1 && y < 2 && [3, 6, 9, 12].some(k => x > k && x < k + 1));
            px('#3a3b3f', rect(2, 5, 14, 15));
            px('#1c1c20', rect(4, 8, 12, 13));
            px('#b0b0b0', rect(4, 6, 12, 7));
        }
        if (tile === 19) {
            // Smelter front: stone bricks around a glowing mouth.
            px('#6a6964', (x, y) => y % 5 < 1 || (x + (Math.floor(y / 5) % 2) * 4) % 8 < 1);
            px('#241a14', rect(4, 8, 12, 15));
            px('#ff8a2a', rect(5, 11, 11, 15));
            px('#ffcf5a', (x, y) => y > 13 && y < 15 && x > 5 && x < 11 && Math.floor(x) % 2 === 0);
        }
        if (tile === 20) {
            px('#6a6964', border);
            px('#2a2724', rect(5, 5, 11, 11));
        }
        if (tile === 21 || tile === 22) {
            // Chest: planks in a dark frame; the side has a band and a brass latch.
            px('#8a5d2c', (x, y) => y % 4 < 1);
            px('#5a3a1c', border);
            if (tile === 21) { px('#5a3a1c', rect(0, 5, 16, 7)); px('#d8c070', rect(7, 5, 9, 9)); }
        }
        if (tile === 23) {
            // Window: a wooden cross frame; the panes are cut out (the material's alphaTest discards them).
            clear(() => true);
            px('#8a5a2b', (x, y) => border(x, y) || (x > 7 && x < 9) || (y > 7 && y < 9));
            px('#dff3fb', (x, y) => [[3, 5], [4, 4], [11, 13], [12, 12]].some(([gx, gy]) => x > gx && x < gx + 1 && y > gy && y < gy + 1));
        }
        if (tile === 24 || tile === 25) {
            // Door: vertical boards in a frame. The top half has two little windows, the bottom a handle.
            px('#7a5028', (x, y) => Math.floor(x) % 4 === 3);
            px('#5e3d1e', border);
            if (tile === 25) clear((x, y) => (rect(2, 3, 7, 9)(x, y) || rect(9, 3, 14, 9)(x, y)));
            else px('#2b2b2b', rect(11, 1, 13, 3));
        }
        if (tile === 26 || tile === 27) {
            // Bed top: a red blanket with a fold; the head end has a pillow.
            px('#8e2229', (x, y) => y > 2 && y < 3);
            if (tile === 27) { px('#f1eee6', rect(2, 1, 14, 7)); px('#d3cec2', rect(2, 6, 14, 7)); }
        }
        if (tile === 28) px('#a57b45', (x, y) => y > 10);
        if (tile >= 7 && tile <= 9) {
            ctx.strokeStyle = '#624323';
            ctx.lineWidth = 1;
            for (let y = 3; y < 16; y += 4) {
                ctx.beginPath(); ctx.moveTo(tile * 16, y + .5); ctx.lineTo(tile * 16 + 16, y + .5); ctx.stroke();
            }
            if (tile === 8) {
                ctx.fillStyle = '#624323';
                ctx.strokeRect(tile * 16 + 1.5, 1.5, 13, 13);
                for (const x of [5, 10]) ctx.fillRect(tile * 16 + x, 2, 1, 12);
            }
            if (tile === 9) {
                ctx.fillStyle = '#513a25';
                ctx.fillRect(tile * 16 + 1, 5, 3, 11); ctx.fillRect(tile * 16 + 12, 5, 3, 11);
                ctx.fillRect(tile * 16 + 5, 5, 6, 3);
            }
        }
    });
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    // One preview per block ID from 1 (grass): the top for grass, tables and snow, a side for the rest.
    // Doors show their windowed top half, beds their pillow end.
    const previews = BLOCKS.slice(1).map((_, i) => i + 1).map(id => id === DOOR ? 25 : id === BED ? 27 : tileFor(id, [1, 7, SNOW].includes(id) ? 2 : 4)).map(tile => {
        const c = document.createElement('canvas');
        c.width = c.height = 16;
        c.getContext('2d')!.drawImage(canvas, tile * 16, 0, 16, 16, 0, 0, 16, 16);
        return c.toDataURL();
    });
    return { texture, previews };
}
// Builds the solid terrain, or with `water` only the see-through water surface.
export function terrainGeometry(world: World, water = false) {
    const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
    visibleFaces(world, (x, y, z, id, face) => {
        if ((id === WATER) !== water) return;
        const { n, c } = FACES[face];
        const start = positions.length / 3;
        const tile = tileFor(id, face);
        c.forEach((corner, i) => {
            positions.push(x + corner[0], y + corner[1], z + corner[2]);
            normals.push(...n);
            uvs.push((tile + ([0, 1, 1, 0][i] ? .999 : .001)) / palettes.length, [0, 0, 1, 1][i] ? .999 : .001);
        });
        indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    });
    if (!water)
        for (let y = 0; y < SIZE_Y; y++) for (let z = 0; z < SIZE_Z; z++) for (let x = 0; x < SIZE_X; x++) {
            const id = world.get(x, y, z);
            if (!SHAPED.includes(id)) continue;
            // The whole tile is stretched over each face of the shape; fine at these sizes.
            for (const [min, max] of shapeBoxes(world, x, y, z, id)) FACES.forEach(({ n, c }, face) => {
                const start = positions.length / 3;
                const tile = (id === DOOR || id === OPEN_DOOR) && world.get(x, y - 1, z) === id ? 25 : tileFor(id, face);
                c.forEach((corner, i) => {
                    positions.push(x + min[0] + corner[0] * (max[0] - min[0]), y + min[1] + corner[1] * (max[1] - min[1]), z + min[2] + corner[2] * (max[2] - min[2]));
                    normals.push(...n);
                    uvs.push((tile + ([0, 1, 1, 0][i] ? .999 : .001)) / palettes.length, [0, 0, 1, 1][i] ? .999 : .001);
                });
                indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
            });
        }
    return buildGeometry(positions, normals, uvs, indices);
}
type Box = [[number, number, number], [number, number, number]];
// Boxes (in cell coordinates) drawn for a door or bed in place of a cube.
export function shapeBoxes(world: World, x: number, y: number, z: number, id: number): Box[] {
    if (id === BED || id === BED_HEAD) return [[[0, 0, 0], [1, BED_HEIGHT, 1]]];
    // A door spans the gap between its walls: along x when there's a wall beside it on x, else along z.
    // Both halves decide from the bottom half, so they always agree. Open, it turns 90° against the hinge edge.
    const base = world.get(x, y - 1, z) === id ? y - 1 : y;
    const alongX = world.solid(x - 1, base, z) || world.solid(x + 1, base, z);
    const t = 3 / 16, mid: [number, number] = [.5 - t / 2, .5 + t / 2];
    if (id === DOOR) return [alongX ? [[0, 0, mid[0]], [1, 1, mid[1]]] : [[mid[0], 0, 0], [mid[1], 1, 1]]];
    return [alongX ? [[0, 0, 0], [t, 1, 1]] : [[0, 0, 0], [1, 1, t]]];
}
// Atlas tile for one face of a block (face 2 is the top, 3 the bottom).
function tileFor(id: number, face: number) {
    const cap = face === 2 || face === 3;
    if (id === STOVE) return face === 2 ? 17 : face === 3 ? 2 : 18;
    if (id === SMELTER) return cap ? 20 : 19;
    if (id === CHEST) return cap ? 22 : 21;
    if (id === WINDOW) return 23;
    if (id === DOOR || id === OPEN_DOOR) return 24;
    if (id === BED || id === BED_HEAD) return face === 2 ? (id === BED ? 26 : 27) : face === 3 ? 7 : 28;
    if (id === SAND) return 10;
    if (id === WATER) return 13;
    if (id === ICE) return 16;
    if (id === CACTUS) return cap ? 15 : 14;
    if (id === SNOW) return face === 2 ? 11 : face === 3 ? 1 : 12;
    if (id === 6) return 7;
    if (id === 7) return face === 2 ? 8 : face === 3 ? 7 : 9;
    if (id === 1) return face === 2 ? 0 : face === 3 ? 1 : 5;
    if (id === 4 && cap) return 6;
    return id - 1;
}
// A single textured block centred on the origin, for held and dropped blocks.
export function blockGeometry(id: number) {
    const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
    FACES.forEach(({ n, c }, face) => {
        const start = positions.length / 3, tile = tileFor(id, face);
        c.forEach((corner, i) => {
            positions.push(corner[0] - .5, corner[1] - .5, corner[2] - .5);
            normals.push(...n);
            uvs.push((tile + ([0, 1, 1, 0][i] ? .999 : .001)) / palettes.length, [0, 0, 1, 1][i] ? .999 : .001);
        });
        indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    });
    return buildGeometry(positions, normals, uvs, indices);
}
function buildGeometry(positions: number[], normals: number[], uvs: number[], indices: number[]) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    return geometry;
}
