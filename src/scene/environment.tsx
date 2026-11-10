"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/**
 * Reflections come from three's RoomEnvironment: a box of procedural light panels, prefiltered
 * once with PMREM. No HDRI is downloaded. Shared by every scene in src/scene. A scene scales it
 * through its materials' envMapIntensity or the Canvas `scene` prop's environmentIntensity.
 */
export function ProceduralEnvironment() {
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
