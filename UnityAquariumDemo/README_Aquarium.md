# Unity Aquarium Demo Scene

This document outlines how to recreate a tranquil aquarium experience in **Unity 2022.3 LTS or newer**. It covers project setup, scene construction, prefabs, scripts, controls, and play test guidance.

---
## 1. Project Setup
1. Open Unity Hub and create a new 3D (URP optional) project using Unity 2022.3 or newer.
2. Name the project `AquariumDemo` and choose a suitable location.
3. Once Unity opens, create the following folders in the `Project` window:
   - `Art/Models`
   - `Art/Materials`
   - `Audio`
   - `Prefabs`
   - `Scenes`
   - `Scripts`
   - `VFX`
4. Import or create assets:
   - Stylized or low-poly fish models with idle swim animations (Unity Asset Store packages like "Stylized Fish Pack" work well).
   - Basic bubble ambient audio loop (optional).
   - Glass material (PBR or simple Transparent shader).
   - Water caustics texture for projected light (optional but recommended).
5. Copy the scripts from `UnityAquariumDemo/Scripts` into your Unity `Scripts` folder.
6. If you are using URP or HDRP, ensure the materials and lighting settings are configured for transparency and volumetric effects.

---
## 2. Scene Construction
Create a new scene named `AquariumScene` and save it in the `Scenes` folder. Build the hierarchy exactly as listed below:

```
AquariumScene (Scene)
└── Environment
    ├── TankRoot
    │   ├── TankGlass (MeshRenderer: glass material)
    │   ├── WaterVolume (Cube scaled to fill interior, material with subtle fog + BoxCollider trigger for swim bounds)
    │   └── SandBottom (Plane with sand material)
    ├── Lighting
    │   ├── DirectionalLight (soft angle, shadows disabled or very soft)
    │   ├── CausticsProjector (optional spot light with caustics texture)
    │   └── AmbientLightProbe (Reflection Probe or Global Volume)
    ├── BubbleEmitter (Particle System for rising bubbles)
    └── AudioSource (looped ambient bubble track, optional)
└── Managers
    ├── AquariumManager (script: **AquariumManager.cs**)
    ├── FoodPool (empty parent for spawned food)
    └── InputSystem (optional if using new input system)
└── FishGroup
    ├── Fish_A (Prefab: FishController.cs + Animator)
    ├── Fish_B
    └── Fish_C
└── CameraRig
    ├── CameraPivot (empty GameObject at tank center, script: **CameraOrbit.cs**)
    │   └── MainCamera (Camera component)
```

### Prefabs
1. **Fish Prefab**
   - Root object with `FishController` script.
   - Child mesh/SkinnedMeshRenderer with animation controller.
   - Optional small `LookTarget` empty child in front of fish to aid directional alignment.
   - Animator with simple swim loop (can be the default animation from imported model).
2. **Food Pellet Prefab**
   - Sphere or capsule mesh scaled to ~0.05 units.
   - `FoodController` script.
   - Rigidbody (use gravity) + Sphere Collider (trigger) for detection.
   - Optional simple particle effect for tiny bubbles trailing the pellet.
3. **Bubble Particle Prefab** (optional) placed on `BubbleEmitter` for ambience.

---
## 3. Lighting and Atmosphere
- **Global Illumination**: Use a slightly bluish ambient color in the Environment lighting settings.
- **Directional Light**: Aim it downward at ~45° with color `(180, 200, 255)`.
- **Fog**: Enable exponential fog in `Lighting > Environment` for subtle underwater attenuation.
- **Caustics**: Project a caustics texture using a spotlight gobo or a simple animated material on the sand floor.
- **Post-Processing (optional)**: Add a `Volume` with Bloom (low intensity), Color Adjustments (cool tint), and Depth of Field for cinematic blur.

---
## 4. Script Configuration
Assign scripts and tune parameters in the Inspector:

### AquariumManager
- `Food Pellet Prefab`: Drag the food prefab.
- `Food Spawn Parent`: Assign `FoodPool` transform.
- `Swim Bounds`: Assign the `WaterVolume` BoxCollider (set to `Is Trigger`).
- `Spawn Height`: e.g., `1.2` (slightly below water surface).
- `Max Active Food`: e.g., `5` to limit clutter.

### FishController
- `Swim Speed`: 0.7 – 1.2
- `Turn Speed`: 60 – 90 degrees per second
- `Wander Radius`: 1.5 – 2.5
- `Wander Jitter`: 0.3 – 0.5
- `Food Detection Radius`: 1.5 – 2.0
- `Food Consume Distance`: 0.15 – 0.2
- `Idle Animation Speed Multiplier`: 0.8 – 1.1 (optional Animator parameter)
- `Bob Amplitude`: 0.08 – 0.15
- `Bob Speed`: 0.3 – 0.6
- `Pursuit Acceleration`: 1.3 – 2.0

### FoodController
- `Sink Speed`: 0.2 – 0.4
- `Lifetime`: 15 seconds
- `Consume FX` (optional): Particle system or sound triggered on consumption.

### CameraOrbit
- `Orbit Speed`: 10 – 15
- `Vertical Sway`: amplitude 0.2, speed 0.1
- `Distance`: 3.5 – 4.5
- `Height Offset`: 0.5

---
## 5. Input Controls
- **Space**: Spawn food pellet (handled by `AquariumManager`).
- **Esc**: Quits play mode in Editor (optional) or exits application in build.

---
## 6. Play Test Steps
1. Press **Play** in Unity.
2. Observe fish swimming in smooth arcs, occasionally changing heading.
3. Press **Space** to drop a food pellet from the top of the tank.
4. Nearby fish detect the pellet, swim toward it, and consume it when close.
5. After eating, fish resume wandering.
6. Press **Esc** to stop the experience (Editor) or quit the build if implemented.

---
## 7. Tips & Extensions
- Add additional fish species by duplicating the prefab and tweaking colors.
- Use subtle scale or shader animations on the fish for breathing effect.
- Introduce gentle water surface caustics using a projected texture or animated material.
- Expand with VR support or UI for feeding timer/score.

Enjoy crafting a serene underwater world!
