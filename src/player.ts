import { HEIGHT, RADIUS, SIZE, World, type Vec3 } from './world.ts';
export class Player {
    position: Vec3 = { x: 16.5, y: 20, z: 27.5 };
    velocityY = 0;
    grounded = false;
    constructor(world: World) {
        for (let y = SIZE - 1; y >= 0; y--)
            if (world.get(16, y, 27)) {
                this.position.y = y + 1;
                break;
            }
    }
    step(world: World, dt: number, dx: number, dz: number, jump: boolean) {
        if (jump && this.grounded) {
            this.velocityY = 8;
            this.grounded = false;
        }
        this.velocityY -= 24 * dt;
        this.move(world, 'x', dx * dt);
        this.move(world, 'z', dz * dt);
        this.grounded = false;
        this.move(world, 'y', this.velocityY * dt);
    }
    private move(world: World, axis: keyof Vec3, amount: number) {
        const p = this.position;
        p[axis] += amount;
        if (axis !== 'y')
            p[axis] = Math.max(RADIUS, Math.min(SIZE - RADIUS, p[axis]));
        const min = { x: p.x - RADIUS, y: p.y, z: p.z - RADIUS };
        const max = { x: p.x + RADIUS, y: p.y + HEIGHT, z: p.z + RADIUS };
        for (let x = Math.floor(min.x + 1e-8); x <= Math.floor(max.x - 1e-8); x++)
            for (let y = Math.floor(min.y + 1e-8); y <= Math.floor(max.y - 1e-8); y++)
                for (let z = Math.floor(min.z + 1e-8); z <= Math.floor(max.z - 1e-8); z++) {
                    if (!world.get(x, y, z))
                        continue;
                    const cell = { x, y, z }[axis];
                    const offset = axis === 'y' ? (amount > 0 ? HEIGHT : 0) : RADIUS;
                    p[axis] = amount > 0 ? Math.min(p[axis], cell - offset) : Math.max(p[axis], cell + 1 + offset);
                    if (axis === 'y') {
                        this.grounded = amount < 0;
                        this.velocityY = 0;
                    }
                }
    }
}
