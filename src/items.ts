import * as THREE from 'three';
import { AXE, CHICKEN_MEAT, COOKED_CHICKEN, COOKED_MUTTON, FEATHER, GLASS, MUTTON, PICKAXE, STICKS, SWORD, WOOL } from './crafting.ts';
import { FACES } from './world.ts';

// 16×16 pixel art for non-block items, painted from simple shapes and outlined automatically.
// The same pixels draw the UI icon and extrude into the held/dropped 3D model.
type Art = (string | null)[][];
const WOOD = '#8a5a2b', LIGHT_WOOD = '#c49254', PLANK = '#d2ab6d', PLANK_SHADE = '#a57b45';

function paint(draw: (fill: (color: string, inside: (x: number, y: number) => boolean) => void) => void, outline = '#2b1d12'): Art {
    const art: Art = Array.from({ length: 16 }, () => Array(16).fill(null));
    draw((color, inside) => {
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (inside(x + .5, y + .5)) art[y][x] = color;
    });
    const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < 16 && y < 16 && art[y][x] !== null && art[y][x] !== outline;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++)
        if (!art[y][x] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => filled(x + dx, y + dy))) art[y][x] = outline;
    return art;
}
// Distance from (x, y) to the segment a→b.
function segment(ax: number, ay: number, bx: number, by: number) {
    return (x: number, y: number) => {
        const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
        return Math.hypot(x - ax - t * dx, y - ay - t * dy);
    };
}
const line = (ax: number, ay: number, bx: number, by: number, width: number) => {
    const d = segment(ax, ay, bx, by);
    return (x: number, y: number) => d(x, y) <= width / 2;
};
const handle = (bx: number, by: number) => (fill: (c: string, f: (x: number, y: number) => boolean) => void) => {
    fill(WOOD, line(3, 13, bx, by, 2.2));
    fill(LIGHT_WOOD, line(3.5, 12.5, bx + .5, by - .5, .8));
};

const ART: Record<number, Art> = {
    [STICKS]: paint(fill => handle(12.5, 3.5)(fill)),
    [PICKAXE]: paint(fill => {
        handle(10, 6)(fill);
        // A curved head: a band around the handle's base, capped to the upper right.
        const band = (lo: number, hi: number) => (x: number, y: number) => { const r = Math.hypot(x - 3, y - 13); return r >= lo && r <= hi && x - 3 > -.5 && 13 - y > -.5; };
        fill(PLANK, band(9.3, 11.6));
        fill(PLANK_SHADE, band(9.3, 10));
    }),
    [AXE]: paint(fill => {
        handle(11.5, 4.5)(fill);
        const blade = segment(7.5, 2.5, 10.5, 5.5);
        fill(PLANK, (x, y) => blade(x, y) <= 2.3 && x + y <= 14.5);
        fill(PLANK_SHADE, (x, y) => blade(x, y) <= 2.3 && x + y <= 14.5 && x + y > 13);
    }),
    [SWORD]: paint(fill => {
        fill(PLANK, line(6, 10, 13, 3, 2.6));
        fill('#e6c68c', line(6.5, 9.5, 12.5, 3.5, .7));
        fill(WOOD, line(3.5, 8.5, 7.5, 12.5, 1.8));
        fill(LIGHT_WOOD, line(2.5, 13.5, 5.5, 10.5, 1.6));
    }),
    [FEATHER]: paint(fill => {
        const vane = segment(5, 11, 11.5, 3);
        fill('#f4f1e8', (x, y) => vane(x, y) <= 2.2);
        fill('#d8d2c2', (x, y) => vane(x, y) <= 2.2 && x - y > -3);
        fill('#9c9484', line(3, 13, 11.5, 3, .8));
    }, '#5b554b'),
    [CHICKEN_MEAT]: paint(fill => {
        fill('#f3ead8', line(9, 10, 12.5, 13.5, 1.6));
        fill('#f3ead8', (x, y) => Math.hypot(x - 13, y - 13.5) <= 1.4);
        fill('#f2a7a0', (x, y) => ((x - 6.5) / 4.6) ** 2 + ((y - 7) / 3.8) ** 2 <= 1);
        fill('#d8766f', (x, y) => ((x - 6.5) / 4.6) ** 2 + ((y - 7) / 3.8) ** 2 <= 1 && y > 8.5);
    }, '#7c3b36'),
    [COOKED_CHICKEN]: paint(fill => {
        fill('#f3ead8', line(9, 10, 12.5, 13.5, 1.6));
        fill('#f3ead8', (x, y) => Math.hypot(x - 13, y - 13.5) <= 1.4);
        fill('#c07a36', (x, y) => ((x - 6.5) / 4.6) ** 2 + ((y - 7) / 3.8) ** 2 <= 1);
        fill('#8e4f1f', (x, y) => ((x - 6.5) / 4.6) ** 2 + ((y - 7) / 3.8) ** 2 <= 1 && y > 8.5);
        fill('#e6a55a', (x, y) => Math.hypot(x - 5, y - 5.5) <= 1.2);
    }, '#4a2a12'),
    // A chop: meat around a round bone.
    [MUTTON]: paint(fill => {
        fill('#d9505a', (x, y) => ((x - 8) / 6) ** 2 + ((y - 8.5) / 4.5) ** 2 <= 1);
        fill('#f0d6c8', (x, y) => ((x - 8) / 6) ** 2 + ((y - 8.5) / 4.5) ** 2 <= 1 && ((x - 8) / 4.6) ** 2 + ((y - 8.5) / 3.1) ** 2 > 1);
        fill('#f7efe0', (x, y) => Math.hypot(x - 10.5, y - 8) <= 1.4);
    }, '#6b2228'),
    [COOKED_MUTTON]: paint(fill => {
        fill('#8e4a2a', (x, y) => ((x - 8) / 6) ** 2 + ((y - 8.5) / 4.5) ** 2 <= 1);
        fill('#c98a50', (x, y) => ((x - 8) / 6) ** 2 + ((y - 8.5) / 4.5) ** 2 <= 1 && ((x - 8) / 4.6) ** 2 + ((y - 8.5) / 3.1) ** 2 > 1);
        fill('#f7efe0', (x, y) => Math.hypot(x - 10.5, y - 8) <= 1.4);
    }, '#3c1d10'),
    // A fluffy ball of wool.
    [WOOL]: paint(fill => {
        for (const [cx, cy, r] of [[6, 9, 3.6], [10, 9, 3.6], [8, 6, 3.4], [8, 11, 3]]) fill('#f1eee6', (x, y) => Math.hypot(x - cx, y - cy) <= r);
        for (const [cx, cy] of [[6, 10], [10, 11], [8, 7.5]]) fill('#d3cec2', (x, y) => Math.hypot(x - cx, y - cy) <= 1);
    }, '#7d7669'),
    [GLASS]: paint(fill => {
        fill('#bfe3f2', (x, y) => x > 3 && x < 13 && y > 3 && y < 13);
        fill('#f4fbff', (x, y) => x > 4 && x < 12 && y > 4 && y < 12 && Math.abs(x - y + 1) < 1.2);
    }, '#5a8aa0'),
};
export const itemArt = (id: number): Art | null => ART[id] ?? null;

// Extrudes the pixels into a one-pixel-thick model, centred on the origin and 1 unit wide.
export function itemGeometry(id: number) {
    const art = ART[id], positions: number[] = [], normals: number[] = [], colors: number[] = [], indices: number[] = [];
    const color = new THREE.Color();
    const at = (x: number, y: number) => x >= 0 && y >= 0 && x < 16 && y < 16 ? art[y][x] : null;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const pixel = art?.[y][x];
        if (!pixel) continue;
        color.set(pixel); // three converts hex from sRGB to linear itself
        FACES.forEach(({ n, c }) => {
            // Skip side faces hidden by a neighbouring pixel (art rows run downward, so y flips).
            if ((n[0] || n[1]) && at(x + n[0], y - n[1])) return;
            const start = positions.length / 3;
            for (const corner of c) {
                positions.push((x + corner[0] - 8) / 16, (8 - y - 1 + corner[1]) / 16, (corner[2] - .5) / 16);
                normals.push(...n);
                colors.push(color.r, color.g, color.b);
            }
            indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
        });
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    return geometry;
}
