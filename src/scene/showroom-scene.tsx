"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import type { ErrorInfo, ReactNode, RefObject } from "react";
import { Component, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { WorldSlug } from "@/content/types";
import { worlds } from "@/content/worlds";
import { clampPitch, frontOf, withinReach, wrapOffset } from "@/lib/showroom";
import { ProceduralEnvironment } from "./environment";

/*
 * The 3D Showroom, docs/DESIGN-SYSTEM.md section 6, scene 3. Products stand on an arc that turns
 * to the chosen one. A product with a GLB shows the model, which the visitor turns all the way
 * round and tilts a little; any other product shows its packshot on a still card. Rendering is on
 * demand: frames are drawn while the arc moves, while a model turns on screen, and during a drag.
 * Off screen nothing is drawn.
 */

export type ShowroomSceneItem = { key: string; texture: string | null; model: string | null; tint: string };

/** Written by the DOM around the canvas, only read by the scene. */
export type ShowroomInput = {
  /** Total radians of turn from horizontal dragging, ever. The scene turns by the change since its last frame. */
  spin: number;
  /** Total radians of tilt from vertical dragging, ever. Read the same way, then held within limits. */
  tilt: number;
  dragging: boolean;
  /** Counts presses of the reset button. A change brings the chosen model back to its front. */
  resets: number;
  /** True while the stage is on screen. */
  visible: boolean;
};

export type ShowroomSceneProps = {
  world: WorldSlug;
  items: ShowroomSceneItem[];
  /** Unbounded index of the chosen item. It wraps around the list. */
  target: number;
  input: RefObject<ShowroomInput>;
  /** Moves the selection by this many places. */
  onStep: (delta: number) => void;
  bindInvalidate: (invalidate: (() => void) | null) => void;
  /** Reduced motion: the arc jumps, nothing turns on its own and a fling has no inertia. Dragging still turns. */
  calm: boolean;
  onReady: () => void;
  onFail: () => void;
};

const FOV = 30;
const CAMERA_Z = 5;
/** Radians between neighbours on the arc. */
const STEP = 0.5;
/**
 * The arc is an ellipse this much shallower than a circle. On a wide stage a circle sends the
 * outer pair so far back that perspective draws them on top of the inner pair.
 */
const ARC_DEPTH = 0.5;
/** Turn speed of the chosen model when nobody drags it, radians per second. About 18 s a turn. */
const AUTO_SPIN = 0.35;
/** Seconds the model holds the visitor's view after a drag or a reset before it turns on its own again. */
const RESUME_AFTER = 2.5;
/** Places either side of the chosen item whose GLB loads. Further items keep their card until they come near. */
const MODEL_REACH = 2;
/** Each place away from the chosen item shrinks it by this much, on top of the depth of the arc. */
const NEIGHBOUR_SHRINK = 0.2;
/** And fades it this far toward the page, so the chosen product leads while the others stay recognisable. */
const NEIGHBOUR_FADE = 0.3;
const SETTLE = 1e-3;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const mod = (value: number, n: number) => ((value % n) + n) % n;

type Layout = { slotW: number; slotH: number; radius: number };

/* Fading. A lit material is not made transparent: that would change its shader and let any alpha
   in its texture through. Its colour dims and its emission rises toward the page colour instead,
   which reads as fading into the page on a dark world and a light one. Unlit cards and shadows,
   which are transparent already, fade by opacity. */

type Fadeable = THREE.Material & { color?: THREE.Color; emissive?: THREE.Color };
type Base = { color: THREE.Color | null; emissive: THREE.Color | null; opacity: number };
const bases = new WeakMap<THREE.Material, Base>();
const mixed = new THREE.Color();

function fadeMaterial(material: Fadeable, amount: number, page: THREE.Color) {
  if (!material.visible || material.userData.solid) return;
  let base = bases.get(material);
  if (!base) {
    base = { color: material.color?.clone() ?? null, emissive: material.emissive?.clone() ?? null, opacity: material.opacity };
    bases.set(material, base);
  }
  if (material.color && material.emissive && base.color && base.emissive) {
    material.color.copy(base.color).multiplyScalar(1 - amount);
    material.emissive.copy(base.emissive).multiplyScalar(1 - amount).add(mixed.copy(page).multiplyScalar(amount));
  } else {
    material.opacity = base.opacity * (1 - amount);
  }
}

function fadeSlot(slot: THREE.Object3D, amount: number, page: THREE.Color) {
  slot.traverse((node) => {
    const material = (node as THREE.Mesh).material as Fadeable | Fadeable[] | undefined;
    if (!material) return;
    if (Array.isArray(material)) for (const entry of material) fadeMaterial(entry, amount, page);
    else fadeMaterial(material, amount, page);
  });
}

/**
 * Item size and arc radius from the visible area at z = 0. The CSS fallback uses the same
 * fractions (`.showroom-slide`), so the poster and the scene frame products alike. A slot is 80%
 * of the stage height. Neighbours stand 30% of the width away, but never under 0.95 or over 1.6
 * slots, so a very wide stage cannot push them so deep that they stack behind one another.
 */
function useLayout(): Layout {
  const viewport = useThree((state) => state.viewport);
  return useMemo(() => {
    const { width, height } = viewport;
    const slotW = Math.min(height * 0.64, width * 0.62);
    const neighbour = Math.max(Math.min(width * 0.3, slotW * 1.6), slotW * 0.95);
    return { slotW, slotH: slotW / 0.8, radius: neighbour / Math.sin(STEP) };
  }, [viewport]);
}

/* Shadow: one small radial gradient, shared by every item and every mount. */

let shadowTexture: THREE.CanvasTexture | null = null;
function getShadowTexture(): THREE.CanvasTexture {
  if (shadowTexture) return shadowTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(0,0,0,0.5)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
  }
  shadowTexture = new THREE.CanvasTexture(canvas);
  return shadowTexture;
}

function Shadow({ layout }: { layout: Layout }) {
  const texture = useMemo(() => getShadowTexture(), []);
  return (
    <mesh position={[0, -layout.slotH / 2, -0.05]} scale={[layout.slotW * 0.95, layout.slotW * 0.16, 1]} renderOrder={-1}>
      <planeGeometry />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/* Cards */

/**
 * An opaque plane of the page colour just behind a card. A faded card then shows the page through
 * it, as a model fades toward the page, and never the wordmark or a neighbour behind.
 */
function Backing({ layout, page }: { layout: Layout; page: THREE.Color }) {
  return (
    <mesh position={[0, 0, -0.01]}>
      <planeGeometry args={[layout.slotW, layout.slotH]} />
      <meshBasicMaterial color={page} toneMapped={false} userData={{ solid: true }} />
    </mesh>
  );
}

function CardImage({ url, layout }: { url: string; layout: Layout }) {
  const loaded = useLoader(THREE.TextureLoader, url);
  const gl = useThree((state) => state.gl);
  // The loader's texture is cached and shared, so this card configures its own copy of it.
  const texture = useMemo(() => {
    const copy = loaded.clone();
    copy.colorSpace = THREE.SRGBColorSpace;
    copy.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    copy.needsUpdate = true;
    return copy;
  }, [loaded, gl]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh>
      <planeGeometry args={[layout.slotW, layout.slotH]} />
      {/* Not tone mapped, so the card matches the same image in the page. Two sided, for a model's stand-in that turns. */}
      <meshBasicMaterial map={texture} toneMapped={false} transparent side={THREE.DoubleSide} />
    </mesh>
  );
}

function Card({ item, layout, page }: { item: ShowroomSceneItem; layout: Layout; page: THREE.Color }) {
  return (
    <>
      <Backing layout={layout} page={page} />
      {item.texture ? (
        <CardImage url={item.texture} layout={layout} />
      ) : (
        <mesh>
          <planeGeometry args={[layout.slotW, layout.slotH]} />
          {/* Transparent, so it can fade like a picture card. */}
          <meshBasicMaterial color={item.tint} toneMapped={false} transparent side={THREE.DoubleSide} />
        </mesh>
      )}
    </>
  );
}

/* Models */

const withMeshopt = (loader: GLTFLoader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
};

/**
 * The GLB, scaled to fit the slot whatever units it was made in, and stood on the floor. The
 * width test uses the footprint diagonal, so a long model does not reach a neighbour as it turns.
 */
function Model({ url, layout, onLoaded }: { url: string; layout: Layout; onLoaded: () => void }) {
  const gltf = useLoader(GLTFLoader, url, withMeshopt);
  // The loader caches one scene per URL. A clone shares its geometry, so it is cheap. Materials
  // are copied, so this item can fade on the arc without touching the cached original. A copy
  // shares its textures, so freeing it frees no texture.
  const object = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) mesh.material = Array.isArray(mesh.material) ? mesh.material.map((material) => material.clone()) : mesh.material.clone();
    });
    return clone;
  }, [gltf]);
  useEffect(
    () => () =>
      object.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh) return;
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
      }),
    [object],
  );
  const bounds = useMemo(() => {
    const box = new THREE.Box3().setFromObject(object);
    return { size: box.getSize(new THREE.Vector3()), center: box.getCenter(new THREE.Vector3()) };
  }, [object]);
  const fit = useMemo(() => {
    const { size, center } = bounds;
    const scale = Math.min((layout.slotW * 1.2) / Math.max(Math.hypot(size.x, size.z), 1e-6), (layout.slotH * 0.95) / Math.max(size.y, 1e-6));
    const floor = -layout.slotH / 2;
    return { scale, position: [-center.x * scale, floor + (size.y / 2 - center.y) * scale, -center.z * scale] as const };
  }, [bounds, layout]);

  useLayoutEffect(onLoaded, [onLoaded]);

  return (
    <group position={fit.position} scale={fit.scale}>
      <primitive object={object} />
    </group>
  );
}

/** A model that fails to load shows its card instead. The rest of the scene keeps running. */
class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("Showroom model failed, showing the card", error, info.componentStack);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/* The arc */

function Carousel({ world, items, target, input, onStep, bindInvalidate, calm, onReady }: Omit<ShowroomSceneProps, "onFail">) {
  const layout = useLayout();
  const invalidate = useThree((state) => state.invalidate);
  const canvas = useThree((state) => state.gl.domElement);

  const slots = useRef<(THREE.Group | null)[]>([]);
  const tilters = useRef<(THREE.Group | null)[]>([]);
  const spinners = useRef<(THREE.Group | null)[]>([]);
  /** Turn and tilt of each item, radians. Mutated every frame, so they live in refs. */
  const spins = useRef<number[]>([]);
  const pitches = useRef<number[]>([]);
  const velocity = useRef(0);
  /** The drag totals and reset count at the last frame. */
  const seenSpin = useRef(input.current.spin);
  const seenTilt = useRef(input.current.tilt);
  const seenResets = useRef(input.current.resets);
  /** True while the chosen model eases back to its front after a reset. */
  const resetting = useRef(false);
  /** Time, seconds, before which the chosen model does not turn on its own. */
  const holdUntil = useRef(0);
  const lastActive = useRef(-1);
  /** Where the arc is now, as a fractional index. It chases `target`. */
  const current = useRef(target);
  /** Items whose model is on screen, rather than its stand-in card. */
  const loaded = useRef(new Set<string>());
  const ready = useRef(false);

  const signature = items.map((item) => item.key).join("|");
  const page = useMemo(() => new THREE.Color(worlds[world].theme.bg), [world]);
  const shown = useRef(signature);

  useEffect(() => {
    bindInvalidate(invalidate);
    return () => bindInvalidate(null);
  }, [bindInvalidate, invalidate]);

  // Another world's list starts on its chosen item, without a turn from the old one.
  useLayoutEffect(() => {
    if (shown.current !== signature) {
      shown.current = signature;
      current.current = target;
      spins.current = [];
      velocity.current = 0;
    }
    invalidate();
  }, [signature, target, invalidate]);

  const markLoaded = useCallback(
    (key: string) => {
      loaded.current.add(key);
      invalidate();
    },
    [invalidate],
  );
  const loadedCallbacks = useMemo(() => new Map(items.map((item) => [item.key, () => markLoaded(item.key)])), [items, markLoaded]);

  // Which GLBs to mount: the chosen item and two either side, plus any already asked for. Kept
  // up to date during render, as React advises for state that follows props.
  const [fetched, setFetched] = useState<ReadonlySet<string>>(() => new Set());
  const arriving = items.filter((item, i) => item.model !== null && !fetched.has(item.key) && withinReach(i, target, items.length, MODEL_REACH));
  if (arriving.length) setFetched(new Set([...fetched, ...arriving.map((item) => item.key)]));
  const wanted = items.map((item, i) => item.model !== null && (fetched.has(item.key) || withinReach(i, target, items.length, MODEL_REACH)));

  useFrame((state, delta) => {
    const n = items.length;
    if (n === 0) return;
    const io = input.current;
    const dt = Math.min(delta, 0.05);
    const now = performance.now() / 1000;
    // Reduced motion: every change lands at once.
    const follow = calm ? 1 : 1 - Math.exp(-dt * 7);
    let moving = false;

    current.current += (target - current.current) * follow;
    if (Math.abs(target - current.current) > SETTLE) moving = true;
    else current.current = target;

    const active = mod(target, n);
    const chosen = items[active]!;
    const turns = chosen.model !== null && loaded.current.has(chosen.key);
    const spin = spins.current;
    const pitch = pitches.current;
    for (let i = 0; i < n; i++) {
      spin[i] ??= 0;
      pitch[i] ??= 0;
    }
    const dragged = io.spin - seenSpin.current;
    const tilted = io.tilt - seenTilt.current;
    seenSpin.current = io.spin;
    seenTilt.current = io.tilt;

    // A new choice starts still: a fling at the last product does not carry over to this one.
    if (active !== lastActive.current) {
      lastActive.current = active;
      velocity.current = 0;
      resetting.current = false;
      holdUntil.current = 0;
    }
    if (io.resets !== seenResets.current) {
      seenResets.current = io.resets;
      resetting.current = turns;
      velocity.current = 0;
      holdUntil.current = now + RESUME_AFTER;
    }

    // The chosen item. A model turns freely and tilts within limits; a card never moves, it has no back.
    if (turns && io.dragging) {
      resetting.current = false;
      spin[active] = spin[active]! + dragged;
      pitch[active] = clampPitch(pitch[active]! + tilted);
      velocity.current = calm ? 0 : THREE.MathUtils.lerp(velocity.current, dt > 0 ? dragged / dt : 0, 0.5);
      holdUntil.current = now + RESUME_AFTER;
      moving = true;
    } else if (turns && resetting.current) {
      const front = frontOf(spin[active]!);
      spin[active] = spin[active]! + (front - spin[active]!) * follow;
      pitch[active] = pitch[active]! * (1 - follow);
      if (Math.abs(front - spin[active]!) < SETTLE && Math.abs(pitch[active]!) < SETTLE) {
        spin[active] = front;
        pitch[active] = 0;
        resetting.current = false;
      }
      moving = true;
    } else if (turns && !calm) {
      // Inertia from a fling, then, once the visitor has let it be, a slow turn on its own.
      velocity.current *= Math.exp(-dt * 2.5);
      const auto = io.visible && now >= holdUntil.current;
      spin[active] = spin[active]! + (velocity.current + (auto ? AUTO_SPIN : 0)) * dt;
      // Turning on its own, it also comes back level.
      if (auto) pitch[active] = pitch[active]! * Math.exp(-dt * 1.5);
      moving = true;
    } else {
      // Reduced motion, a card, or a model still loading: it holds still where it was left.
      velocity.current = 0;
    }

    // Everything else settles facing front and level, by the shortest way round.
    for (let i = 0; i < n; i++) {
      if (i === active) continue;
      const rest = frontOf(spin[i]!);
      const gap = rest - spin[i]!;
      if (Math.abs(gap) > SETTLE || Math.abs(pitch[i]!) > SETTLE) {
        spin[i] = spin[i]! + gap * follow;
        pitch[i] = pitch[i]! * (1 - follow);
        moving = true;
      } else {
        spin[i] = rest;
        pitch[i] = 0;
      }
    }

    for (let i = 0; i < n; i++) {
      const slot = slots.current[i];
      if (!slot) continue;
      const offset = wrapOffset(i - current.current, n);
      const angle = offset * STEP;
      const fade = clamp01((2.6 - Math.abs(offset)) / 0.6);
      const size = 1 - Math.min(Math.abs(offset), 2) * NEIGHBOUR_SHRINK;
      slot.position.set(Math.sin(angle) * layout.radius, 0, (Math.cos(angle) - 1) * layout.radius * ARC_DEPTH);
      // Facing out from the ellipse, as the items on a circle face out from its centre.
      slot.rotation.y = Math.atan2(ARC_DEPTH * Math.sin(angle), Math.cos(angle));
      slot.scale.setScalar(Math.max(fade * size, 1e-3));
      slot.visible = fade > 0.001;
      // Every frame drawn, not only on change: a model that has just loaded brings fresh materials.
      if (slot.visible) fadeSlot(slot, Math.min(Math.abs(offset), 2) * NEIGHBOUR_FADE, page);
      const spinner = spinners.current[i];
      if (spinner) spinner.rotation.y = spin[i]!;
      // Tilted about the slot's middle, which is about the middle of a fitted model, so it stays framed.
      const tilter = tilters.current[i];
      if (tilter) tilter.rotation.x = pitch[i]!;
    }

    if (moving && io.visible) state.invalidate();
    if (!ready.current) {
      ready.current = true;
      // After this frame is on screen, the poster can fade out.
      setTimeout(onReady, 0);
    }
  });

  function select(index: number) {
    return (event: ThreeEvent<MouseEvent>) => {
      // A drag that ends over a neighbour is a turn, not a choice.
      if (event.delta > 8) return;
      // The nearest hit decides. The chosen item keeps its click, so it never reaches a neighbour behind it.
      event.stopPropagation();
      const offset = Math.round(wrapOffset(index - target, items.length));
      if (offset === 0) return;
      // The arc now moves under a still pointer, which sends no new over or out event.
      canvas.style.cursor = "";
      onStep(offset);
    };
  }
  function hover(index: number, over: boolean) {
    return (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      const chosen = mod(target, items.length) === index;
      canvas.style.cursor = over && !chosen ? "pointer" : "";
    };
  }

  const look = worlds[world].portal;

  return (
    <>
      <ambientLight intensity={0.35} />
      {/* White, not the world's tinted key: the world sets the angle, never the product's colour. */}
      <directionalLight color="#ffffff" intensity={Math.min(look.key.intensity, 4) * 0.6} position={look.key.position} />
      {/* A rim from behind, so a black garment keeps its outline on a dark page. */}
      <directionalLight color="#ffffff" intensity={1.4} position={[0, 2.5, -6]} />
      <ProceduralEnvironment />
      {items.map((item, i) => (
        <group
          key={item.key}
          ref={(node) => {
            slots.current[i] = node;
          }}
        >
          {/* Hit area for choosing a neighbour. Raycasting a plane is cheaper than the model. As wide
              as a model may stand (`Model` fits its footprint to 1.2 slots), so a long shoe answers at the toe. */}
          <mesh position={[0, 0, 0.3]} onClick={select(i)} onPointerOver={hover(i, true)} onPointerOut={hover(i, false)}>
            <planeGeometry args={[layout.slotW * 1.2, layout.slotH]} />
            <meshBasicMaterial visible={false} />
          </mesh>
          <group
            ref={(node) => {
              tilters.current[i] = node;
            }}
          >
            <group
              ref={(node) => {
                spinners.current[i] = node;
              }}
            >
              {item.model && wanted[i] ? (
                <ModelBoundary fallback={<Card item={item} layout={layout} page={page} />}>
                  <Suspense fallback={<Card item={item} layout={layout} page={page} />}>
                    <Model url={item.model} layout={layout} onLoaded={loadedCallbacks.get(item.key)!} />
                  </Suspense>
                </ModelBoundary>
              ) : (
                <Card item={item} layout={layout} page={page} />
              )}
            </group>
          </group>
          <Shadow layout={layout} />
        </group>
      ))}
    </>
  );
}

export default function ShowroomScene({ onFail, ...props }: ShowroomSceneProps) {
  return (
    <Canvas
      className="showroom-canvas"
      style={{ position: "absolute", inset: 0, touchAction: "pan-y" }}
      frameloop="demand"
      dpr={[1, 1.75]}
      camera={{ fov: FOV, position: [0, 0, CAMERA_Z], near: 0.1, far: 40 }}
      scene={{ environmentIntensity: 0.9 }}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        // Khronos PBR Neutral keeps a product's base colour close to its packshot. ACES, the
        // default, warms and darkens light fabrics, so a milk tee would read as khaki.
        gl.toneMapping = THREE.NeutralToneMapping;
        // Neutral has no built-in lift (three's ACES multiplies by 1 / 0.6), so dark fabrics need a little.
        gl.toneMappingExposure = 1.3;
        gl.domElement.addEventListener("webglcontextlost", (event) => {
          event.preventDefault();
          onFail();
        });
      }}
    >
      {/* Cards load together, so the poster gives way to a complete arc, never a half-empty one. */}
      <Suspense fallback={null}>
        <Carousel {...props} />
      </Suspense>
    </Canvas>
  );
}
