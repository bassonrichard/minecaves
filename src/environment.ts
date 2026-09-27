import * as THREE from 'three';

// Seconds for a full day/night loop. Tuning knob: raise for slower days.
export const DAY_LENGTH = 300;
const CLOUD_HEIGHT = 40, CLOUD_CELL = 4, CLOUD_TEXELS = 64;

function smoothstep(edge0: number, edge1: number, value: number) {
    const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

const skyVertex = /* glsl */`
varying vec3 vDir;
void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;

const skyFragment = /* glsl */`
uniform vec3 uZenith, uHorizon, uGlow, uSunColor, uSunDir, uMoonDir;
uniform float uSunAlpha, uMoonAlpha;
varying vec3 vDir;
void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;
    vec3 col = mix(uHorizon, uZenith, pow(smoothstep(0., 1., max(h, 0.)), .55));
    col = mix(col, uHorizon * .55, smoothstep(0., -.3, h));
    float sd = dot(dir, uSunDir), s = max(sd, 0.);
    col += uGlow * (pow(s, 5.) * (.3 + .7 * (1. - smoothstep(0., .45, abs(h)))) + pow(s, 60.) * .7);
    col += uSunColor * pow(s, 500.) * .5 * uSunAlpha;
    col = mix(col, uSunColor, smoothstep(.9985, .99885, sd) * uSunAlpha);
    float md = dot(dir, uMoonDir);
    col += vec3(.2, .26, .42) * pow(max(md, 0.), 250.) * uMoonAlpha * .8;
    if (md > .998) {
        vec3 right = normalize(cross(vec3(0., 1., 0.), uMoonDir)), up = cross(uMoonDir, right);
        vec2 p = vec2(dot(dir, right), dot(dir, up)) / .05;
        float r = length(p);
        float crater = 1. - smoothstep(.2, .27, length(p - vec2(-.32, .28)));
        crater += 1. - smoothstep(.12, .17, length(p - vec2(.36, -.12)));
        crater += 1. - smoothstep(.16, .22, length(p - vec2(-.05, -.45)));
        crater += 1. - smoothstep(.07, .1, length(p - vec2(.2, .5)));
        vec3 moon = vec3(.95, .96, 1.) * (1. - crater * .2) * (.72 + .28 * sqrt(max(0., 1. - r * r)));
        col = mix(col, moon, (1. - smoothstep(.94, 1., r)) * uMoonAlpha);
    }
    col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - .5) / 255.;
    gl_FragColor = vec4(col, 1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`;

const cloudVertex = /* glsl */`
varying vec3 vWorld;
void main() { vec4 w = modelMatrix * vec4(position, 1.); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;

const cloudFragment = /* glsl */`
uniform sampler2D uMap;
uniform vec3 uColor;
uniform vec2 uDrift;
uniform float uScale, uOpacity;
varying vec3 vWorld;
void main() {
    float c = texture2D(uMap, (vWorld.xz + uDrift) * uScale).r;
    if (c < .5) discard;
    float fade = 1. - smoothstep(55., 95., distance(vWorld.xz, cameraPosition.xz));
    gl_FragColor = vec4(uColor * (.88 + .12 * c), uOpacity * fade);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`;

// Tileable blocky cloud cover: two octaves of wrapped value noise, thresholded.
function cloudTexture(random: () => number) {
    const lattice = (period: number) => Array.from({ length: period * period }, random);
    const octaves = [[8, lattice(8), .7], [16, lattice(16), .3]] as const;
    const data = new Uint8Array(CLOUD_TEXELS * CLOUD_TEXELS);
    for (let y = 0; y < CLOUD_TEXELS; y++)
        for (let x = 0; x < CLOUD_TEXELS; x++) {
            let n = 0;
            for (const [period, grid, weight] of octaves) {
                const fx = x * period / CLOUD_TEXELS, fy = y * period / CLOUD_TEXELS;
                const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = smoothstep(0, 1, fx - x0), ty = smoothstep(0, 1, fy - y0);
                const at = (gx: number, gy: number) => grid[(gx % period) + period * (gy % period)];
                n += weight * THREE.MathUtils.lerp(
                    THREE.MathUtils.lerp(at(x0, y0), at(x0 + 1, y0), tx),
                    THREE.MathUtils.lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), tx), ty);
            }
            data[x + y * CLOUD_TEXELS] = n > .56 ? 160 + Math.floor(random() * 95) : 0;
        }
    const texture = new THREE.DataTexture(data, CLOUD_TEXELS, CLOUD_TEXELS, THREE.RedFormat);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = texture.minFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    return texture;
}

export function createEnvironment(scene: THREE.Scene) {
    let seed = 9281;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

    // Palette keyed by sun elevation: night -> twilight -> day.
    const zenith = { night: new THREE.Color('#040817'), twilight: new THREE.Color('#34467e'), day: new THREE.Color('#4f93dc') };
    const horizon = { night: new THREE.Color('#0e1834'), twilight: new THREE.Color('#c98f7c'), day: new THREE.Color('#cfe6f2') };
    const cloudTint = { night: new THREE.Color('#161c30'), twilight: new THREE.Color('#f2b394'), day: new THREE.Color('#ffffff') };
    const sunsetGlow = new THREE.Color('#ff7a33'), dayGlow = new THREE.Color('#fff0c4');
    const lowSun = new THREE.Color('#ffb27a'), highSun = new THREE.Color('#fffbea');
    const nightHemi = new THREE.Color('#5a6f9e'), dayHemi = new THREE.Color('#fff8e4');
    const blend = (target: THREE.Color, keys: typeof zenith, e: number) =>
        target.copy(keys.night).lerp(keys.twilight, smoothstep(-.3, 0, e)).lerp(keys.day, smoothstep(0, .4, e));

    const skyUniforms = {
        uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() },
        uSunColor: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3() }, uMoonDir: { value: new THREE.Vector3() },
        uSunAlpha: { value: 1 }, uMoonAlpha: { value: 0 },
    };
    const skyMaterial = new THREE.ShaderMaterial({
        uniforms: skyUniforms, vertexShader: skyVertex, fragmentShader: skyFragment, side: THREE.BackSide, depthWrite: false, fog: false,
    });
    // Everything on the dome sits well inside camera.far (120) and outside fog so it never washes out.
    const sky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 20), skyMaterial);
    sky.name = 'Sky dome';
    sky.renderOrder = -10;
    sky.frustumCulled = false;

    const starPositions: number[] = [], starColors: number[] = [];
    for (let i = 0; i < 700; i++) {
        const theta = random() * Math.PI * 2, phi = Math.acos(random() * 2 - 1), b = .35 + random() ** 3 * .65;
        starPositions.push(95 * Math.sin(phi) * Math.cos(theta), 95 * Math.cos(phi), 95 * Math.sin(phi) * Math.sin(theta));
        starColors.push(b, b, b * (.85 + random() * .2));
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
    const starMaterial = new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false });
    const stars = new THREE.Points(starGeometry, starMaterial);
    stars.name = 'Night sky stars';
    stars.renderOrder = -9;
    stars.frustumCulled = false;

    const cloudMap = cloudTexture(random);
    const cloudUniforms = {
        uMap: { value: cloudMap }, uColor: { value: new THREE.Color() }, uDrift: { value: new THREE.Vector2() },
        uScale: { value: 1 / (CLOUD_CELL * CLOUD_TEXELS) }, uOpacity: { value: .85 },
    };
    const cloudMaterial = new THREE.ShaderMaterial({
        uniforms: cloudUniforms, vertexShader: cloudVertex, fragmentShader: cloudFragment,
        transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    });
    const clouds = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), cloudMaterial);
    clouds.name = 'Cloud layer';
    clouds.renderOrder = -8;
    clouds.frustumCulled = false;
    scene.add(sky, stars, clouds);

    const sunLight = new THREE.DirectionalLight('#fff1cf', 2.1);
    const moonLight = new THREE.DirectionalLight('#9bb7e7', 0);
    const hemiLight = new THREE.HemisphereLight('#fff8e4', '#677051', 2.3);
    scene.add(sunLight, moonLight, hemiLight);

    const sunDir = skyUniforms.uSunDir.value, moonDir = skyUniforms.uMoonDir.value;
    let phase = Math.PI / 3; // mid-morning
    const update = (dt: number, camera?: THREE.Camera) => {
        phase = (phase + dt * Math.PI * 2 / DAY_LENGTH) % (Math.PI * 2);
        sunDir.set(Math.cos(phase), Math.sin(phase), .25).normalize();
        moonDir.copy(sunDir).negate();
        const e = sunDir.y;
        const daylight = smoothstep(-.12, .2, e);
        const twilight = (1 - smoothstep(0, .35, Math.abs(e))) * smoothstep(-.3, -.05, e);

        blend(skyUniforms.uZenith.value, zenith, e);
        blend(skyUniforms.uHorizon.value, horizon, e);
        blend(cloudUniforms.uColor.value, cloudTint, e);
        skyUniforms.uGlow.value.copy(dayGlow).multiplyScalar(.35 * daylight).lerp(sunsetGlow, twilight * .9);
        skyUniforms.uSunColor.value.copy(lowSun).lerp(highSun, smoothstep(0, .3, e));
        skyUniforms.uSunAlpha.value = smoothstep(-.08, .02, e);
        skyUniforms.uMoonAlpha.value = smoothstep(-.08, .02, -e);
        if (scene.fog) scene.fog.color.copy(skyUniforms.uHorizon.value);
        if (scene.background instanceof THREE.Color) scene.background.copy(skyUniforms.uHorizon.value);
        starMaterial.opacity = (1 - smoothstep(-.25, .05, e)) * .95;
        stars.rotation.z = phase;
        cloudUniforms.uOpacity.value = .5 + daylight * .35;
        cloudUniforms.uDrift.value.x += dt * 1.2;

        sunLight.position.copy(sunDir);
        sunLight.color.copy(lowSun).lerp(highSun, smoothstep(0, .4, e));
        sunLight.intensity = daylight * 2.1;
        moonLight.position.copy(moonDir);
        moonLight.intensity = (1 - daylight) * .35;
        hemiLight.color.copy(nightHemi).lerp(dayHemi, daylight);
        hemiLight.intensity = .35 + daylight * 1.95;

        if (camera) {
            sky.position.copy(camera.position); stars.position.copy(camera.position);
            clouds.position.set(camera.position.x, CLOUD_HEIGHT, camera.position.z);
        }
    };
    update(0);

    return {
        update,
        night: () => sunDir.y < 0,
        dispose() {
            scene.remove(sky, stars, clouds, sunLight, moonLight, hemiLight);
            sky.geometry.dispose(); skyMaterial.dispose();
            starGeometry.dispose(); starMaterial.dispose();
            clouds.geometry.dispose(); cloudMaterial.dispose(); cloudMap.dispose();
        },
    };
}
