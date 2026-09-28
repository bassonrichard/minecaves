import { HEIGHT, RADIUS, SIZE_X, SIZE_Y, SIZE_Z, ICE, LAVA, QUICKSAND, VINE, WATER, World, type Vec3 } from './world.ts';
export class Player {
    // Spawn in the middle of the plains.
    position: Vec3 = { x: 48.5, y: 20, z: 48.5 };
    velocityY = 0;
    grounded = false;
    // Horizontal velocity only lags behind input on ice.
    vx = 0;
    vz = 0;
    // Highest point since leaving the ground, for fall damage.
    fallFrom: number | null = null;
    constructor(world: World) {
        for (let y = SIZE_Y - 1; y >= 0; y--)
            if (world.solid(48, y, 48)) {
                this.position.y = y + 1;
                break;
            }
    }
    // Advances one physics step; returns hearts of fall damage taken on landing.
    step(world: World, dt: number, dx: number, dz: number, jump: boolean) {
        const p = this.position;
        const at = (dy: number) => world.get(Math.floor(p.x), Math.floor(p.y + dy), Math.floor(p.z));
        const wet = at(.1) === WATER || at(.1) === LAVA;
        // Quicksand drags at your legs; a vine in reach is something to climb.
        const sinking = at(.1) === QUICKSAND, climbing = !wet && [.1, .9, 1.6].some(dy => at(dy) === VINE);
        if (sinking) { dx *= .25; dz *= .25; }
        if (this.grounded && world.get(Math.floor(p.x), Math.floor(p.y - .05), Math.floor(p.z)) === ICE) {
            // Slippery: ease toward the wanted velocity instead of snapping to it.
            const k = Math.min(1, dt * 1.5);
            this.vx += (dx - this.vx) * k; this.vz += (dz - this.vz) * k;
        } else { this.vx = dx; this.vz = dz; }
        if (wet) {
            // Swimming: sink slowly, hold jump to rise; enough to hop out onto a shore at water level.
            this.velocityY = jump ? 4 : Math.max(-2, Math.min(4, this.velocityY - 6 * dt));
        } else if (sinking) {
            // Sink slowly; holding jump claws back up, and once your chest is out, one good hop frees you.
            this.velocityY = !jump ? -.6 : at(.9) === QUICKSAND ? 1.5 : 6;
        } else if (climbing) {
            this.velocityY = jump ? 3 : Math.max(-1.5, this.velocityY - 24 * dt);
        } else {
            if (jump && this.grounded) {
                this.velocityY = 8;
                this.grounded = false;
            }
            this.velocityY -= 24 * dt;
        }
        this.move(world, 'x', this.vx * dt);
        this.move(world, 'z', this.vz * dt);
        this.grounded = false;
        this.move(world, 'y', this.velocityY * dt);
        // Falls over three blocks hurt; water, quicksand, and vines break the fall.
        if (wet || sinking || climbing) this.fallFrom = null;
        else if (!this.grounded) this.fallFrom = Math.max(this.fallFrom ?? p.y, p.y);
        else if (this.fallFrom !== null) {
            const distance = this.fallFrom - p.y;
            this.fallFrom = null;
            return Math.max(0, Math.ceil(distance - 3));
        }
        return 0;
    }
    private move(world: World, axis: keyof Vec3, amount: number) {
        const p = this.position;
        p[axis] += amount;
        if (axis !== 'y')
            p[axis] = Math.max(RADIUS, Math.min((axis === 'x' ? SIZE_X : SIZE_Z) - RADIUS, p[axis]));
        const min = { x: p.x - RADIUS, y: p.y, z: p.z - RADIUS };
        const max = { x: p.x + RADIUS, y: p.y + HEIGHT, z: p.z + RADIUS };
        for (let x = Math.floor(min.x + 1e-8); x <= Math.floor(max.x - 1e-8); x++)
            for (let y = Math.floor(min.y + 1e-8); y <= Math.floor(max.y - 1e-8); y++)
                for (let z = Math.floor(min.z + 1e-8); z <= Math.floor(max.z - 1e-8); z++) {
                    if (!world.blocking(x, y, z))
                        continue;
                    // Low blocks (beds): a top below your feet doesn't touch you, so you walk and jump on them.
                    const height = world.height(x, y, z);
                    if (min.y >= y + height - 1e-8)
                        continue;
                    const cell = { x, y, z }[axis];
                    const offset = axis === 'y' ? (amount > 0 ? HEIGHT : 0) : RADIUS;
                    p[axis] = amount > 0 ? Math.min(p[axis], cell - offset) : Math.max(p[axis], cell + (axis === 'y' ? height : 1) + offset);
                    if (axis === 'y') {
                        this.grounded = amount < 0;
                        this.velocityY = 0;
                    }
                }
    }
}
