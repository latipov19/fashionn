"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { RefObject } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { WorldSlug } from "@/content/types";
import { worlds } from "@/content/worlds";
import { bladeLayout, RING } from "@/lib/portal";

/*
 * The Sunray Portal, docs/DESIGN-SYSTEM.md section 6. One instanced mesh, so one draw call for
 * every blade. Rendering is on demand: a frame is drawn only while a wave, a pointer lift or the
 * tilt is still settling, and the scene is idle otherwise.
 */

export type PortalPointer = { x: number; y: number; active: boolean };

export type PortalSceneProps = {
  world: WorldSlug;
  count: number;
  pointer: RefObject<PortalPointer>;
  /** Receives the scene's invalidate, so pointer events outside the canvas can request a frame. */
  bindInvalidate: (invalidate: (() => void) | null) => void;
  onReady: () => void;
  onFail: () => void;
};

const FOV = 30;
/** At this distance the plane z = 0 spans exactly -1..1, the same units as the SVG poster. */
const CAMERA_Z = 1 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const MAX_TILT = THREE.MathUtils.degToRad(6);
const WAVE_MS = 900;
const THICKNESS = 0.014;
const SETTLE = 1e-3;

const smoothstep = (t: number) => t * t * (3 - 2 * t);
const dummy = new THREE.Object3D();
const scratch = { color: new THREE.Color(), to: new THREE.Color(), keyColor: new THREE.Color(), fromKey: new THREE.Color() };
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** A thin plate from x = 0 (inner edge) to x = 1 (outer edge), tapering towards the centre. */
function bladeGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(1, 1, THICKNESS);
  geometry.translate(0.5, 0, 0);
  const taper = RING.inner / RING.outer;
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    position.setY(i, position.getY(i) * (taper + (1 - taper) * x));
  }
  geometry.computeVertexNormals();
  return geometry;
}

type BladeState = {
  angle: Float32Array;
  /** Wave order, 0..1, clockwise from twelve o'clock. */
  order: Float32Array;
  lean: Float32Array;
  outer: Float32Array;
  color: Float32Array;
  fromLean: Float32Array;
  fromOuter: Float32Array;
  fromColor: Float32Array;
  toLean: Float32Array;
  toOuter: Float32Array;
  lift: Float32Array;
  halfWidth: number;
};

function createState(count: number, world: WorldSlug): BladeState {
  const layout = bladeLayout(count, worlds[world].portal);
  const color = new THREE.Color(worlds[world].portal.blade);
  const state: BladeState = {
    angle: new Float32Array(count),
    order: new Float32Array(count),
    lean: new Float32Array(count),
    outer: new Float32Array(count),
    color: new Float32Array(count * 3),
    fromLean: new Float32Array(count),
    fromOuter: new Float32Array(count),
    fromColor: new Float32Array(count * 3),
    toLean: new Float32Array(count),
    toOuter: new Float32Array(count),
    lift: new Float32Array(count),
    halfWidth: layout[0]?.halfWidth ?? 0,
  };
  layout.forEach((blade, i) => {
    state.angle[i] = blade.angle;
    state.order[i] = (((Math.PI / 2 - blade.angle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2);
    state.lean[i] = state.toLean[i] = blade.lean;
    state.outer[i] = state.toOuter[i] = blade.outer;
    color.toArray(state.color, i * 3);
  });
  return state;
}

function Blades({ world, count, pointer, bindInvalidate, onReady }: Omit<PortalSceneProps, "onFail">) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const group = useRef<THREE.Group>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const ambient = useRef<THREE.AmbientLight>(null);
  const { invalidate } = useThree();

  const geometry = useMemo(() => bladeGeometry(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  /** Per-blade animation state. Mutated every frame, so it lives in a ref, not in React state. */
  const blades = useRef<BladeState | null>(null);

  const wave = useRef<{ start: number; from: WorldSlug; to: WorldSlug } | null>(null);
  const shown = useRef<WorldSlug>(world);
  const ready = useRef(false);

  useEffect(() => {
    bindInvalidate(invalidate);
    return () => bindInvalidate(null);
  }, [bindInvalidate, invalidate]);

  // A world change starts a wave from wherever every blade is now, even mid-wave.
  useEffect(() => {
    const state = blades.current;
    if (!state || (world === shown.current && !wave.current)) return;
    const layout = bladeLayout(count, worlds[world].portal);
    state.fromLean.set(state.lean);
    state.fromOuter.set(state.outer);
    state.fromColor.set(state.color);
    layout.forEach((blade, i) => {
      state.toLean[i] = blade.lean;
      state.toOuter[i] = blade.outer;
    });
    wave.current = { start: performance.now(), from: shown.current, to: world };
    shown.current = world;
    invalidate();
  }, [world, count, invalidate]);

  // Material and lights start at the current world, without a wave.
  useLayoutEffect(() => {
    const look = worlds[shown.current].portal;
    if (material.current) {
      material.current.metalness = look.metalness;
      material.current.roughness = look.roughness;
      material.current.envMapIntensity = look.environment;
    }
    if (key.current) {
      key.current.color.set(look.key.color);
      key.current.intensity = look.key.intensity;
      key.current.position.set(...look.key.position);
    }
    if (ambient.current) ambient.current.intensity = look.ambient;
  }, []);

  useFrame((frame, delta) => {
    const instanced = mesh.current;
    const state = blades.current;
    if (!instanced || !state) return;
    const now = performance.now();
    const dt = Math.min(delta, 0.05);
    let moving = false;

    // Wave progress, global and per blade.
    let global = 1;
    const active = wave.current;
    if (active) {
      global = clamp01((now - active.start) / WAVE_MS);
      const from = worlds[active.from].portal;
      const to = worlds[active.to].portal;
      const g = smoothstep(global);
      if (material.current) {
        material.current.metalness = THREE.MathUtils.lerp(from.metalness, to.metalness, g);
        material.current.roughness = THREE.MathUtils.lerp(from.roughness, to.roughness, g);
        material.current.envMapIntensity = THREE.MathUtils.lerp(from.environment, to.environment, g);
      }
      if (key.current) {
        scratch.fromKey.set(from.key.color);
        scratch.keyColor.set(to.key.color);
        key.current.color.copy(scratch.fromKey).lerp(scratch.keyColor, g);
        key.current.intensity = THREE.MathUtils.lerp(from.key.intensity, to.key.intensity, g);
        key.current.position.set(
          THREE.MathUtils.lerp(from.key.position[0], to.key.position[0], g),
          THREE.MathUtils.lerp(from.key.position[1], to.key.position[1], g),
          THREE.MathUtils.lerp(from.key.position[2], to.key.position[2], g),
        );
      }
      if (ambient.current) ambient.current.intensity = THREE.MathUtils.lerp(from.ambient, to.ambient, g);
      scratch.to.set(to.blade);
      if (global >= 1) wave.current = null;
      else moving = true;
    }

    // Pointer in ring coordinates: angle and how close it is to the ring band.
    const p = pointer.current;
    const pointerAngle = Math.atan2(p.y, p.x);
    const pointerRadius = Math.hypot(p.x, p.y);
    const band = p.active ? Math.exp(-((pointerRadius - 0.72) ** 2) / (2 * 0.22 ** 2)) : 0;
    const follow = 1 - Math.exp(-dt * 9);

    // Tilt follows the pointer, capped at six degrees.
    if (group.current) {
      const tx = p.active ? -p.y * MAX_TILT : 0;
      const ty = p.active ? p.x * MAX_TILT : 0;
      group.current.rotation.x += (tx - group.current.rotation.x) * follow;
      group.current.rotation.y += (ty - group.current.rotation.y) * follow;
      if (Math.abs(tx - group.current.rotation.x) > SETTLE || Math.abs(ty - group.current.rotation.y) > SETTLE) moving = true;
    }

    const elapsed = active ? (now - active.start) / WAVE_MS : 1;
    for (let i = 0; i < count; i++) {
      const angle = state.angle[i]!;

      // Pointer lift: blades near the pointer rise, like a hand passing over pleats.
      let delta = Math.abs(angle - pointerAngle);
      if (delta > Math.PI) delta = Math.PI * 2 - delta;
      const target = band * Math.exp(-(delta * delta) / (2 * 0.24 * 0.24));
      const lift = state.lift[i]! + (target - state.lift[i]!) * follow;
      state.lift[i] = lift;
      if (Math.abs(target - lift) > SETTLE) moving = true;

      // Wave: each blade folds over as the wave passes it, then settles into the new world.
      let fold = 0;
      if (active) {
        const local = clamp01((elapsed - state.order[i]! * 0.45) / 0.55);
        const s = smoothstep(local);
        fold = Math.sin(Math.PI * local);
        state.lean[i] = THREE.MathUtils.lerp(state.fromLean[i]!, state.toLean[i]!, s);
        state.outer[i] = THREE.MathUtils.lerp(state.fromOuter[i]!, state.toOuter[i]!, s);
        scratch.color.fromArray(state.fromColor, i * 3).lerp(scratch.to, s);
        scratch.color.toArray(state.color, i * 3);
        instanced.setColorAt(i, scratch.color);
      }

      const lean = state.lean[i]! + fold * 0.85 * Math.sign(state.toLean[i]! || 1);
      dummy.position.set(Math.cos(angle) * RING.inner, Math.sin(angle) * RING.inner, lift * 0.08 + fold * 0.1);
      dummy.rotation.set(lean, -(lift * 0.45 + fold * 0.35), angle, "ZXY");
      dummy.scale.set(state.outer[i]! - RING.inner, 2 * state.outer[i]! * Math.sin(state.halfWidth), 1);
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
    }
    instanced.instanceMatrix.needsUpdate = true;
    if (active && instanced.instanceColor) instanced.instanceColor.needsUpdate = true;

    if (moving) frame.invalidate();
    if (!ready.current) {
      ready.current = true;
      // After this frame is on screen, the poster can fade out.
      setTimeout(onReady, 0);
    }
  });

  // Colours must exist before the first frame, so instanceColor is created up front.
  useLayoutEffect(() => {
    const state = createState(count, shown.current);
    blades.current = state;
    const instanced = mesh.current;
    if (!instanced) return;
    for (let i = 0; i < count; i++) instanced.setColorAt(i, scratch.color.fromArray(state.color, i * 3));
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
    invalidate();
  }, [count, invalidate]);

  return (
    <>
      <ambientLight ref={ambient} />
      <directionalLight ref={key} />
      <group ref={group}>
        <instancedMesh ref={mesh} args={[geometry, undefined, count]} frustumCulled={false}>
          <meshStandardMaterial ref={material} color="#ffffff" />
        </instancedMesh>
      </group>
      <ProceduralEnvironment />
    </>
  );
}

/**
 * Reflections come from three's RoomEnvironment: a box of procedural light panels, prefiltered
 * once with PMREM. No HDRI is downloaded. Each world scales it through envMapIntensity.
 */
function ProceduralEnvironment() {
  const gl = useThree((state) => state.gl);
  const target = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const result = pmrem.fromScene(room, 0.04);
    room.dispose();
    pmrem.dispose();
    return result;
  }, [gl]);
  useEffect(() => () => target.dispose(), [target]);
  return <primitive object={target.texture} attach="environment" />;
}

export default function PortalScene({ onFail, ...props }: PortalSceneProps) {
  return (
    <Canvas
      className="portal-canvas"
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      frameloop="demand"
      dpr={[1, 1.75]}
      camera={{ fov: FOV, position: [0, 0, CAMERA_Z], near: 0.1, far: 20 }}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.domElement.addEventListener("webglcontextlost", (event) => {
          event.preventDefault();
          onFail();
        });
      }}
    >
      <Blades {...props} />
    </Canvas>
  );
}
