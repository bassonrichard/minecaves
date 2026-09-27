import * as THREE from 'three';
import { FACES, visibleFaces, type World } from './world.ts';
const palettes = ['#78a442', '#896044', '#92918a', '#805431', '#507f3b', '#6b943b', '#ad8350', '#b58a51', '#ac7e43', '#885d33'];
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
        if (tile === 5) {
            ctx.fillStyle = '#896044';
            ctx.fillRect(tile * 16, 5, 16, 11);
            for (let x = 0; x < 16; x++) {
                ctx.fillStyle = '#6b943b';
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
        if (tile >= 7) {
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
    const previews = [0, 1, 2, 3, 4, 7, 8].map(tile => {
        const c = document.createElement('canvas');
        c.width = c.height = 16;
        c.getContext('2d')!.drawImage(canvas, tile * 16, 0, 16, 16, 0, 0, 16, 16);
        return c.toDataURL();
    });
    return { texture, previews };
}
export function terrainGeometry(world: World) {
    const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
    visibleFaces(world, (x, y, z, id, face) => {
        const { n, c } = FACES[face];
        const start = positions.length / 3;
        const tile = id === 6 ? 7 : id === 7 ? (face === 2 ? 8 : face === 3 ? 7 : 9) : id === 1 ? (face === 2 ? 0 : face === 3 ? 1 : 5) : id === 4 && (face === 2 || face === 3) ? 6 : id - 1;
        c.forEach((corner, i) => {
            positions.push(x + corner[0], y + corner[1], z + corner[2]);
            normals.push(...n);
            uvs.push((tile + ([0, 1, 1, 0][i] ? .999 : .001)) / palettes.length, [0, 0, 1, 1][i] ? .999 : .001);
        });
        indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    return geometry;
}
