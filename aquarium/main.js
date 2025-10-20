import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js';

// --- Tunable constants ----------------------------------------------------
const CONFIG = {
  tankSize: new THREE.Vector3(18, 10, 10),
  fishSpeed: 1.6,
  fishTurnRate: 1.8,
  wanderJitter: 0.6,
  detectionRadius: 4.5,
  eatDistance: 0.6,
  pelletSinkSpeed: 0.35,
  pelletDrift: 0.15,
  pelletLifetime: 18,
  pelletsPerDrop: 5,
  bubbleRiseSpeed: 0.7,
  bubbleSpread: 4,
  bubbleRate: 24,
  cameraOrbitSpeed: 0.12,
  cameraDriftAmplitude: 0.25,
  cameraDistance: 20,
  cameraHeight: 6,
};

const QUALITY_LEVELS = [
  {
    label: 'High',
    fishCount: 12,
    bubbleCount: 120,
    pelletPool: 60,
  },
  {
    label: 'Calm',
    fishCount: 7,
    bubbleCount: 60,
    pelletPool: 40,
  },
];

const PALETTES = [
  { body: 0xffc857, fins: 0xff6b6b, stripes: 0x2d1e2f },
  { body: 0x6be5ff, fins: 0x1ea896, stripes: 0xffffff },
  { body: 0xff9a8b, fins: 0xff6a88, stripes: 0x173753 },
  { body: 0xc3f584, fins: 0x7bd389, stripes: 0x2b3a67 },
];

// Utility helpers
const tmpVec3 = new THREE.Vector3();
function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// --- Orbit camera ---------------------------------------------------------
class OrbitCamera {
  constructor(radius, height) {
    this.radius = radius;
    this.height = height;
    this.angle = Math.PI * 0.15;
    this.speed = CONFIG.cameraOrbitSpeed;
    this.driftAmplitude = CONFIG.cameraDriftAmplitude;
    this.paused = false;
    this.clock = 0;
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 120);
    this.target = new THREE.Vector3(0, 2.5, 0);
    this.updateCamera(0);
  }

  reset() {
    this.angle = Math.PI * 0.15;
    this.clock = 0;
    this.paused = false;
    this.updateCamera(0);
  }

  togglePause() {
    this.paused = !this.paused;
  }

  updateCamera(delta) {
    if (!this.paused) {
      this.angle += this.speed * delta;
      this.clock += delta;
    }
    const drift = Math.sin(this.clock * 0.4) * this.driftAmplitude;
    const x = Math.cos(this.angle) * this.radius;
    const z = Math.sin(this.angle) * this.radius;
    this.camera.position.set(x, this.height + drift, z);
    this.camera.lookAt(this.target);
  }
}

// --- Fish -----------------------------------------------------------------
class Fish {
  constructor(scene, palette, bounds, params) {
    this.params = params;
    this.bounds = bounds;
    this.state = 'wander';
    this.velocity = new THREE.Vector3(randomInRange(-1, 1), randomInRange(-0.2, 0.2), randomInRange(-1, 1)).normalize().multiplyScalar(params.speed);
    this.desired = this.velocity.clone().normalize();
    this.wanderTimer = 0;
    this.targetPellet = null;
    this.mesh = this.createFishMesh(palette);
    scene.add(this.mesh);

    const initPos = new THREE.Vector3(
      randomInRange(-bounds.x * 0.3, bounds.x * 0.3),
      randomInRange(1, bounds.y * 0.4),
      randomInRange(-bounds.z * 0.3, bounds.z * 0.3)
    );
    this.mesh.position.copy(initPos);
  }

  createFishMesh(palette) {
    const group = new THREE.Group();
    const bodyGeo = new THREE.SphereGeometry(0.6, 24, 16);
    bodyGeo.scale(1.6, 1, 0.8);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: palette.body,
      roughness: 0.4,
      metalness: 0.1,
      emissive: new THREE.Color(palette.stripes).multiplyScalar(0.05),
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    const tailGeo = new THREE.ConeGeometry(0.45, 0.9, 12);
    const tailMat = new THREE.MeshStandardMaterial({ color: palette.fins, roughness: 0.5, metalness: 0.05 });
    const tail = new THREE.Mesh(tailGeo, tailMat);
    tail.rotation.z = Math.PI;
    tail.position.x = -1.3;
    group.add(tail);

    const finGeo = new THREE.ConeGeometry(0.25, 0.5, 10);
    const finMat = new THREE.MeshStandardMaterial({ color: palette.fins, roughness: 0.6 });
    const topFin = new THREE.Mesh(finGeo, finMat);
    topFin.position.set(0.1, 0.5, 0);
    topFin.rotation.z = Math.PI;
    group.add(topFin);

    const sideFinL = new THREE.Mesh(finGeo, finMat);
    sideFinL.scale.set(1, 1, 0.6);
    sideFinL.rotation.set(0, 0, Math.PI * 0.5);
    sideFinL.position.set(0.2, 0, 0.55);
    group.add(sideFinL);

    const sideFinR = sideFinL.clone();
    sideFinR.position.z *= -1;
    sideFinR.scale.z *= -1;
    group.add(sideFinR);

    group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = false;
      }
    });

    return group;
  }

  findClosestPellet(pellets) {
    let closest = null;
    let minDistSq = Infinity;
    pellets.forEach((pellet) => {
      if (!pellet.active) return;
      const distSq = pellet.position.distanceToSquared(this.mesh.position);
      if (distSq < this.params.detectionRadius ** 2 && distSq < minDistSq) {
        minDistSq = distSq;
        closest = pellet;
      }
    });
    return closest;
  }

  update(delta, pellets) {
    // Handle state switching
    if (this.state === 'seek') {
      if (!this.targetPellet || !this.targetPellet.active) {
        this.state = 'wander';
      }
    }
    if (this.state === 'wander') {
      const pellet = this.findClosestPellet(pellets);
      if (pellet) {
        this.state = 'seek';
        this.targetPellet = pellet;
      }
    }

    // Determine desired direction
    if (this.state === 'seek' && this.targetPellet && this.targetPellet.active) {
      this.desired.subVectors(this.targetPellet.position, this.mesh.position).normalize();
    } else {
      this.wanderTimer += delta;
      if (this.wanderTimer > 0.5) {
        this.wanderTimer = 0;
        const jitter = new THREE.Vector3(
          randomInRange(-1, 1),
          randomInRange(-0.4, 0.4),
          randomInRange(-1, 1)
        ).multiplyScalar(this.params.wanderJitter);
        this.desired.add(jitter).normalize();
      }
      // Smoothly drift upward/downward with a sinusoid so fish bob gently
      const time = performance.now() * 0.0003;
      this.desired.y += Math.sin(time + this.mesh.id) * 0.05;
      this.desired.normalize();
    }

    // Wall avoidance by pushing back when near tank limits
    const buffer = 1.5;
    const pos = this.mesh.position;
    if (pos.x > this.bounds.x - buffer) this.desired.x = -Math.abs(this.desired.x);
    if (pos.x < -this.bounds.x + buffer) this.desired.x = Math.abs(this.desired.x);
    if (pos.y > this.bounds.y - buffer) this.desired.y = -Math.abs(this.desired.y);
    if (pos.y < 0.8) this.desired.y = Math.abs(this.desired.y) * 0.5;
    if (pos.z > this.bounds.z - buffer) this.desired.z = -Math.abs(this.desired.z);
    if (pos.z < -this.bounds.z + buffer) this.desired.z = Math.abs(this.desired.z);

    const desiredVelocity = this.desired.clone().normalize().multiplyScalar(this.params.speed);
    const steering = desiredVelocity.sub(this.velocity);
    const maxSteer = this.params.turnRate * delta;
    steering.clampLength(0, maxSteer);
    this.velocity.add(steering);
    this.velocity.clampLength(this.params.speed * 0.6, this.params.speed * 1.1);

    const move = this.velocity.clone().multiplyScalar(delta);
    pos.add(move);

    // Orient the fish toward its velocity
    tmpVec3.copy(this.velocity).normalize();
    const yaw = Math.atan2(tmpVec3.z, tmpVec3.x);
    const pitch = Math.asin(clamp(tmpVec3.y, -0.99, 0.99));
    this.mesh.rotation.set(0, 0, 0);
    this.mesh.rotation.y = -yaw;
    this.mesh.rotation.z = pitch * 0.5;

    // Tail swish for subtle motion
    this.mesh.children.forEach((child, index) => {
      if (index === 1) {
        child.rotation.y = Math.sin(performance.now() * 0.006 + this.mesh.id) * 0.6;
      }
    });

    if (this.state === 'seek' && this.targetPellet && this.targetPellet.active) {
      const dist = pos.distanceTo(this.targetPellet.position);
      if (dist < this.params.eatDistance) {
        this.targetPellet.consume();
        this.state = 'wander';
        this.targetPellet = null;
      }
    }
  }
}

// --- Pellet system --------------------------------------------------------
class Pellet {
  constructor(position, velocity, lifetime, handleConsume) {
    this.position = position.clone();
    this.velocity = velocity.clone();
    this.life = lifetime;
    this.active = true;
    this.handleConsume = handleConsume;
  }

  consume() {
    if (!this.active) return;
    this.active = false;
    this.handleConsume?.();
  }
}

class PelletManager {
  constructor(scene, capacity) {
    this.capacity = capacity;
    this.activePellets = [];
    const geometry = new THREE.SphereGeometry(0.12, 8, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0xf5e6c8, roughness: 0.9 });
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
    this.matrix = new THREE.Matrix4();
    this.scaleVec = new THREE.Vector3();
  }

  spawnBurst(origin) {
    for (let i = 0; i < CONFIG.pelletsPerDrop; i++) {
      if (this.activePellets.length >= this.capacity) break;
      const offset = new THREE.Vector3(randomInRange(-0.4, 0.4), 0, randomInRange(-0.4, 0.4));
      const pos = origin.clone().add(offset);
      const vel = new THREE.Vector3(randomInRange(-CONFIG.pelletDrift, CONFIG.pelletDrift), -CONFIG.pelletSinkSpeed, randomInRange(-CONFIG.pelletDrift, CONFIG.pelletDrift));
      const pellet = new Pellet(pos, vel, CONFIG.pelletLifetime, () => {
        pellet.life = 0;
      });
      this.activePellets.push(pellet);
    }
  }

  update(delta) {
    let instanceIndex = 0;
    for (let i = this.activePellets.length - 1; i >= 0; i--) {
      const pellet = this.activePellets[i];
      if (!pellet.active) {
        this.activePellets.splice(i, 1);
        continue;
      }
      pellet.life -= delta;
      if (pellet.life <= 0) {
        this.activePellets.splice(i, 1);
        continue;
      }
      pellet.velocity.y = -CONFIG.pelletSinkSpeed;
      pellet.position.addScaledVector(pellet.velocity, delta);
      pellet.position.y = Math.max(0.6, pellet.position.y);
      const scale = 1.0 + Math.sin((CONFIG.pelletLifetime - pellet.life) * 3) * 0.05;
      this.matrix.identity();
      this.matrix.setPosition(pellet.position);
      this.scaleVec.set(scale, scale, scale);
      this.matrix.scale(this.scaleVec);
      this.mesh.setMatrixAt(instanceIndex++, this.matrix);
    }
    this.mesh.count = instanceIndex;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// --- Bubble system --------------------------------------------------------
class BubbleSystem {
  constructor(scene, capacity) {
    this.capacity = capacity;
    this.instances = [];
    this.spawnAccumulator = 0;
    const geometry = new THREE.SphereGeometry(0.1, 6, 6);
    const material = new THREE.MeshBasicMaterial({ color: 0x8ec5ff, transparent: true, opacity: 0.4 });
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
  }

  spawnBubble() {
    if (this.instances.length >= this.capacity) return;
    const baseX = randomInRange(-CONFIG.bubbleSpread, CONFIG.bubbleSpread);
    const baseZ = randomInRange(-CONFIG.bubbleSpread, CONFIG.bubbleSpread);
    const bubble = {
      position: new THREE.Vector3(baseX, randomInRange(0.3, 1.5), baseZ),
      velocity: new THREE.Vector3(randomInRange(-0.05, 0.05), CONFIG.bubbleRiseSpeed, randomInRange(-0.05, 0.05)),
      life: randomInRange(3, 7),
      age: 0,
    };
    this.instances.push(bubble);
  }

  update(delta) {
    this.spawnAccumulator += CONFIG.bubbleRate * delta;
    while (this.spawnAccumulator >= 1) {
      this.spawnBubble();
      this.spawnAccumulator -= 1;
    }

    let idx = 0;
    const matrix = new THREE.Matrix4();
    const scaleVec = new THREE.Vector3();
    for (let i = this.instances.length - 1; i >= 0; i--) {
      const bubble = this.instances[i];
      bubble.age += delta;
      if (bubble.age > bubble.life) {
        this.instances.splice(i, 1);
        continue;
      }
      bubble.position.addScaledVector(bubble.velocity, delta);
      if (bubble.position.y > CONFIG.tankSize.y - 0.5) {
        this.instances.splice(i, 1);
        continue;
      }
      const scale = 0.5 + Math.sin(bubble.age * 5) * 0.1;
      matrix.identity();
      matrix.setPosition(bubble.position);
      scaleVec.setScalar(scale);
      matrix.scale(scaleVec);
      this.mesh.setMatrixAt(idx++, matrix);
    }
    this.mesh.count = idx;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// --- Aquarium orchestrator ------------------------------------------------
class Aquarium {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030711);
    this.scene.fog = new THREE.FogExp2(0x0b1832, 0.08);

    this.clock = new THREE.Clock();
    this.qualityIndex = 0;
    this.currentConfig = QUALITY_LEVELS[this.qualityIndex];

    this.orbit = new OrbitCamera(CONFIG.cameraDistance, CONFIG.cameraHeight);
    this.camera = this.orbit.camera;

    this.setupLights();
    this.createEnvironment();
    this.createBackdrop();

    this.pellets = new PelletManager(this.scene, this.currentConfig.pelletPool);
    this.bubbles = new BubbleSystem(this.scene, this.currentConfig.bubbleCount);

    this.fish = [];
    this.populateFish();

    this.audio = document.getElementById('ambience');
    this.audioMuted = true;

    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('keydown', (ev) => this.onKey(ev));

    this.animate();
  }

  setupLights() {
    const key = new THREE.SpotLight(0xf9d29d, 2.1, 60, Math.PI / 6, 0.5, 1);
    key.position.set(8, 15, 6);
    key.castShadow = true;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x6db7ff, 0.5);
    fill.position.set(-6, 6, -4);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0x7cf2ff, 0.7);
    rim.position.set(0, 4, 8);
    this.scene.add(rim);

    const ambient = new THREE.AmbientLight(0x2a3356, 0.4);
    this.scene.add(ambient);
  }

  createEnvironment() {
    const { x: width, y: height, z: depth } = CONFIG.tankSize;
    const glassGeo = new THREE.BoxGeometry(width, height, depth);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x1b293d,
      roughness: 0.05,
      transmission: 0.9,
      thickness: 0.3,
      transparent: true,
      opacity: 0.3,
      envMapIntensity: 1.5,
    });
    const tank = new THREE.Mesh(glassGeo, glassMat);
    tank.position.y = height / 2;
    tank.receiveShadow = true;
    this.scene.add(tank);

    const floorGeo = new THREE.PlaneGeometry(width * 2, depth * 2);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0a101b, roughness: 0.8, metalness: 0.1 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const waterGeo = new THREE.BoxGeometry(width - 1.6, height - 1.2, depth - 1.6);
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x245d93,
      roughness: 0.9,
      transmission: 0.85,
      opacity: 0.45,
      transparent: true,
      clearcoat: 0.1,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.y = height / 2;
    this.scene.add(water);
  }

  createBackdrop() {
    const gradient = new THREE.ShaderMaterial({
      uniforms: {
        colorA: { value: new THREE.Color(0x102341) },
        colorB: { value: new THREE.Color(0x1f4063) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform vec3 colorA;
        uniform vec3 colorB;
        void main() {
          float g = smoothstep(0.0, 1.0, vUv.y);
          vec3 color = mix(colorB, colorA, g);
          gl_FragColor = vec4(color, 0.7);
        }
      `,
      transparent: true,
    });
    const plane = new THREE.PlaneGeometry(60, 30);
    const mesh = new THREE.Mesh(plane, gradient);
    mesh.position.set(0, 12, -18);
    this.scene.add(mesh);
  }

  populateFish() {
    this.fish.forEach((f) => this.scene.remove(f.mesh));
    this.fish = [];
    const { fishCount } = this.currentConfig;
    for (let i = 0; i < fishCount; i++) {
      const palette = PALETTES[i % PALETTES.length];
      const fish = new Fish(this.scene, palette, CONFIG.tankSize.clone().multiplyScalar(0.5), {
        speed: CONFIG.fishSpeed * randomInRange(0.75, 1.25),
        turnRate: CONFIG.fishTurnRate,
        wanderJitter: CONFIG.wanderJitter,
        detectionRadius: CONFIG.detectionRadius,
        eatDistance: CONFIG.eatDistance,
      });
      const scale = randomInRange(0.8, 1.3);
      fish.mesh.scale.setScalar(scale);
      this.fish.push(fish);
    }
  }

  spawnPellets() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const origin = this.camera.position.clone().add(dir.multiplyScalar(6));
    origin.y = Math.min(origin.y, CONFIG.tankSize.y - 1);
    origin.x = clamp(origin.x, -CONFIG.tankSize.x * 0.45, CONFIG.tankSize.x * 0.45);
    origin.z = clamp(origin.z, -CONFIG.tankSize.z * 0.45, CONFIG.tankSize.z * 0.45);
    this.pellets.spawnBurst(origin);
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  onKey(ev) {
    switch (ev.code) {
      case 'Space':
        ev.preventDefault();
        this.spawnPellets();
        this.tryPlayAudio();
        break;
      case 'KeyM':
        this.toggleAudio();
        break;
      case 'KeyP':
        this.orbit.togglePause();
        break;
      case 'KeyR':
        this.orbit.reset();
        break;
      case 'Digit1':
        this.setQuality(0);
        break;
      case 'Digit2':
        this.setQuality(1);
        break;
      default:
        break;
    }
  }

  setQuality(index) {
    if (this.qualityIndex === index || index < 0 || index >= QUALITY_LEVELS.length) return;
    this.qualityIndex = index;
    this.currentConfig = QUALITY_LEVELS[index];
    this.scene.remove(this.pellets.mesh);
    this.scene.remove(this.bubbles.mesh);
    this.pellets = new PelletManager(this.scene, this.currentConfig.pelletPool);
    this.bubbles = new BubbleSystem(this.scene, this.currentConfig.bubbleCount);
    this.populateFish();
  }

  toggleAudio() {
    if (!this.audio) return;
    this.audioMuted = !this.audioMuted;
    this.audio.muted = this.audioMuted;
    if (!this.audioMuted) {
      this.tryPlayAudio();
    }
  }

  tryPlayAudio() {
    if (!this.audio || this.audioMuted) return;
    this.audio.muted = false;
    this.audio.play().catch(() => {
      this.audioMuted = true;
      this.audio.muted = true;
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const delta = clamp(this.clock.getDelta(), 0.0001, 0.05);
    this.orbit.updateCamera(delta);

    this.pellets.update(delta);
    this.bubbles.update(delta);
    this.fish.forEach((fish) => fish.update(delta, this.pellets.activePellets));

    this.renderer.render(this.scene, this.camera);
  }
}

// --- Entry point ----------------------------------------------------------
(function init() {
  const canvas = document.getElementById('aquarium');
  if (!canvas) {
    console.error('Canvas element not found.');
    return;
  }
  new Aquarium(canvas);
})();

/*
README
======
Setup: Open `index.html` in a modern desktop browser. All dependencies stream from CDNs and no build step is required.
Controls:
  - Space: Drop a handful of food pellets in front of the camera.
  - M: Toggle the optional ambient audio bed.
  - P: Pause/resume the gentle camera drift.
  - R: Reset the camera to its initial orbit.
  - 1 / 2: Switch between quality presets (High / Calm) to balance visuals and performance.
Notes: Fish steer using wander and seek behaviors with configurable speed, turn rate, wander jitter, detection radius, and eating distance. Pellets and bubbles use instancing for performance and clean up automatically when consumed or expired.
*/
