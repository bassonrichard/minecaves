import * as THREE from 'three';
import { itemGeometry } from './items.ts';
import { blockGeometry } from './terrain.ts';
import { BLOCKS } from './world.ts';

// First-person held item, drawn in its own scene over the world so it never clips into walls.
export const SWING = .3;

export function createHand(blockMaterial: THREE.Material) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, 1, .01, 10);
    const hemi = new THREE.HemisphereLight('#fff8e4', '#677051', 2);
    const sun = new THREE.DirectionalLight('#fff1cf', 1.4);
    sun.position.set(.4, 1, .6);
    scene.add(hemi, sun);
    // The pivot sits at the wrist, bottom right of the view; swings rotate around it.
    const pivot = new THREE.Group();
    pivot.position.set(.38, -.5, -.72);
    scene.add(pivot);
    const skin = new THREE.MeshLambertMaterial({ color: '#c99a6e' }), sleeve = new THREE.MeshLambertMaterial({ color: '#3d6b8c' });
    const itemMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
    const box = new THREE.BoxGeometry(1, 1, 1);
    const arm = new THREE.Group();
    const forearm = new THREE.Mesh(box, skin); forearm.scale.set(.17, .17, .5); forearm.position.set(0, 0, .12);
    const cuff = new THREE.Mesh(box, sleeve); cuff.scale.set(.18, .18, .16); cuff.position.set(0, 0, .38);
    arm.add(forearm, cuff);
    arm.position.set(.02, .2, 0);
    arm.rotation.set(.45, -.3, 0);
    let model: THREE.Object3D = arm, current = -1, swingLeft = 0, time = 0;
    pivot.add(arm);
    const geometries = new Map<number, THREE.BufferGeometry>();

    return {
        scene,
        camera,
        // Shows the item with this ID (0 for an empty hand).
        setItem(id: number) {
            if (id === current) return;
            current = id;
            pivot.remove(model);
            if (!id) model = arm;
            else {
                const block = id < BLOCKS.length;
                if (!geometries.has(id)) geometries.set(id, block ? blockGeometry(id) : itemGeometry(id));
                const mesh = new THREE.Mesh(geometries.get(id), block ? blockMaterial : itemMaterial);
                if (block) { mesh.scale.setScalar(.32); mesh.rotation.set(.1, Math.PI / 4, 0); mesh.position.set(-.04, .12, 0); }
                // Tools and items: upright, turned to show their profile, tip leaning forward.
                else { mesh.scale.setScalar(.62); mesh.rotation.set(-.2, -1.25, .15); mesh.position.set(-.1, .24, -.06); }
                model = mesh;
            }
            pivot.add(model);
        },
        swing() { if (swingLeft < SWING * .4) swingLeft = SWING; },
        get swinging() { return swingLeft > 0; },
        update(dt: number, walking: boolean, daylight: number, aspect: number) {
            time += dt;
            swingLeft = Math.max(0, swingLeft - dt);
            const t = 1 - swingLeft / SWING, arc = swingLeft > 0 ? Math.sin(t * Math.PI) : 0;
            const bob = walking ? Math.sin(time * 9) : 0;
            pivot.rotation.set(-arc * 1.1, arc * .5, -arc * .25);
            pivot.position.set(.38 - arc * .12 + bob * .012, -.5 + Math.abs(bob) * .018 - arc * .05, -.72 - arc * .1);
            hemi.intensity = .15 + daylight * 1.6;
            sun.intensity = .3 + daylight * 1.1;
            if (camera.aspect !== aspect) { camera.aspect = aspect; camera.updateProjectionMatrix(); }
        },
        dispose() {
            box.dispose(); skin.dispose(); sleeve.dispose(); itemMaterial.dispose();
            geometries.forEach(g => g.dispose());
        },
    };
}
