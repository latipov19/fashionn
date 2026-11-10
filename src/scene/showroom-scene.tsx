"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import type { ErrorInfo, ReactNode, RefObject } from "react";
import { Component, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { WorldSlug } from "@/content/types";
import { worlds } from "@/content/worlds";
import { wrapOffset } from "@/lib/showroom";
import { ProceduralEnvironment } from "./environment";

/*
 * The 3D Showroom, docs/DESIGN-SYSTEM.md section 6, scene 3. Products stand on an arc that turns
 * to the chosen one. A product with a GLB shows the model, which turns on its own axis; any other
 * product shows its packshot on a card. Rendering is on demand: frames are drawn while the arc
 * moves, while a model turns on screen, and during a drag. Off screen nothing is drawn.
 */

export type ShowroomSceneItem = { key: string; texture: string | null; model: string | null; tint: string };

/** Written by the DOM around the canvas, only read by the scene. */
export type ShowroomInput = {
  /** Total radians of turn from dragging, ever. The scene turns by the change since its last frame. */
  spin: number;
  dragging: boolean;
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
  onReady: () => void;
  onFail: () => void;
};

const FOV = 30;
const CAMERA_Z = 5;
/** Radians between neighbours on the arc. */
const STEP = 0.5;
/** Turn speed of the chosen model when nobody drags it, radians per second. About 18 s a turn. */
const AUTO_SPIN = 0.35;
/** A card has no back, so it only tilts this far. */
const CARD_TILT = 0.4;
const SETTLE = 1e-3;
const TAU = Math.PI * 2;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const mod = (value: number, n: number) => ((value % n) + n) % n;

type Layout = { slotW: number; slotH: number; radius: number };

/**
 * Item size and arc radius from the visible area at z = 0. The CSS fallback uses the same
 * fractions (`.showroom-slide`), so the poster and the scene frame products alike.
 */
function useLayout(): Layout {
  const viewport = useThree((state) => state.viewport);
  return useMemo(() => {
    const { width, height } = viewport;
    const slotW = Math.min(height * 0.528, width * 0.62);
    const neighbour = Math.max(width * 0.3, slotW * 0.95);
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

function Card({ item, layout }: { item: ShowroomSceneItem; layout: Layout }) {
  if (item.texture) return <CardImage url={item.texture} layout={layout} />;
  return (
    <mesh>
      <planeGeometry args={[layout.slotW, layout.slotH]} />
      <meshBasicMaterial color={item.tint} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
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
  // The loader caches one scene per URL. A clone shares geometry and materials, so it is cheap.
  const object = useMemo(() => gltf.scene.clone(true), [gltf]);
  const bounds = useMemo(() => {
    const box = new THREE.Box3().setFromObject(object);
    return { size: box.getSize(new THREE.Vector3()), center: box.getCenter(new THREE.Vector3()) };
  }, [object]);
  const fit = useMemo(() => {
    const { size, center } = bounds;
    const scale = Math.min((layout.slotW * 1.2) / Math.max(Math.hypot(size.x, size.z), 1e-6), (layout.slotH * 0.9) / Math.max(size.y, 1e-6));
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

function Carousel({ world, items, target, input, onStep, bindInvalidate, onReady }: Omit<ShowroomSceneProps, "onFail">) {
  const layout = useLayout();
  const invalidate = useThree((state) => state.invalidate);
  const canvas = useThree((state) => state.gl.domElement);

  const slots = useRef<(THREE.Group | null)[]>([]);
  const spinners = useRef<(THREE.Group | null)[]>([]);
  /** Turn of each item, radians. Mutated every frame, so it lives in a ref. */
  const spins = useRef<number[]>([]);
  const velocity = useRef(0);
  /** The drag total at the last frame. */
  const seenSpin = useRef(input.current.spin);
  /** Where the arc is now, as a fractional index. It chases `target`. */
  const current = useRef(target);
  /** Items whose model is on screen, rather than its stand-in card. */
  const loaded = useRef(new Set<string>());
  const ready = useRef(false);

  const signature = items.map((item) => item.key).join("|");
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

  useFrame((state, delta) => {
    const n = items.length;
    if (n === 0) return;
    const io = input.current;
    const dt = Math.min(delta, 0.05);
    const follow = 1 - Math.exp(-dt * 7);
    let moving = false;

    current.current += (target - current.current) * follow;
    if (Math.abs(target - current.current) > SETTLE) moving = true;
    else current.current = target;

    const active = mod(target, n);
    const chosen = items[active]!;
    const turns = chosen.model !== null && loaded.current.has(chosen.key);
    const spin = spins.current;
    for (let i = 0; i < n; i++) spin[i] ??= 0;
    const dragged = io.spin - seenSpin.current;
    seenSpin.current = io.spin;

    // The chosen item: a model turns freely with inertia, a card tilts and springs back.
    if (io.dragging) {
      spin[active] = spin[active]! + dragged;
      velocity.current = THREE.MathUtils.lerp(velocity.current, dt > 0 ? dragged / dt : 0, 0.5);
      moving = true;
    } else if (turns) {
      velocity.current *= Math.exp(-dt * 2.5);
      spin[active] = spin[active]! + (velocity.current + (io.visible ? AUTO_SPIN : 0)) * dt;
      moving = true;
    } else {
      velocity.current = 0;
      spin[active] = spin[active]! * (1 - follow);
      if (Math.abs(spin[active]!) > SETTLE) moving = true;
      else spin[active] = 0;
    }
    if (!turns) spin[active] = THREE.MathUtils.clamp(spin[active]!, -CARD_TILT, CARD_TILT);

    // Everything else settles facing front, by the shortest way round.
    for (let i = 0; i < n; i++) {
      if (i === active) continue;
      const rest = Math.round(spin[i]! / TAU) * TAU;
      const gap = rest - spin[i]!;
      if (Math.abs(gap) > SETTLE) {
        spin[i] = spin[i]! + gap * follow;
        moving = true;
      } else spin[i] = rest;
    }

    for (let i = 0; i < n; i++) {
      const slot = slots.current[i];
      if (!slot) continue;
      const offset = wrapOffset(i - current.current, n);
      const angle = offset * STEP;
      const fade = clamp01((2.6 - Math.abs(offset)) / 0.6);
      slot.position.set(Math.sin(angle) * layout.radius, 0, (Math.cos(angle) - 1) * layout.radius);
      slot.rotation.y = angle;
      slot.scale.setScalar(Math.max(fade, 1e-3));
      slot.visible = fade > 0.001;
      const spinner = spinners.current[i];
      if (spinner) spinner.rotation.y = spin[i]!;
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
      const offset = Math.round(wrapOffset(index - target, items.length));
      if (offset === 0) return;
      event.stopPropagation();
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
      <directionalLight color={look.key.color} intensity={Math.min(look.key.intensity, 4) * 0.6} position={look.key.position} />
      <ProceduralEnvironment />
      {items.map((item, i) => (
        <group
          key={item.key}
          ref={(node) => {
            slots.current[i] = node;
          }}
        >
          {/* Hit area for choosing a neighbour. Raycasting a plane is cheaper than the model. */}
          <mesh position={[0, 0, 0.3]} onClick={select(i)} onPointerOver={hover(i, true)} onPointerOut={hover(i, false)}>
            <planeGeometry args={[layout.slotW, layout.slotH]} />
            <meshBasicMaterial visible={false} />
          </mesh>
          <group
            ref={(node) => {
              spinners.current[i] = node;
            }}
          >
            {item.model ? (
              <ModelBoundary fallback={<Card item={item} layout={layout} />}>
                <Suspense fallback={<Card item={item} layout={layout} />}>
                  <Model url={item.model} layout={layout} onLoaded={loadedCallbacks.get(item.key)!} />
                </Suspense>
              </ModelBoundary>
            ) : (
              <Card item={item} layout={layout} />
            )}
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
