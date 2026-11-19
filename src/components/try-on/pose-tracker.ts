"use client";

import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import type { Landmark } from "@/lib/try-on/geometry";

/** Served by this site: the WASM from node_modules through a route, the model from public/. No third-party request. */
const WASM_BASE = "/vendor/mediapipe/wasm";
const MODEL_URL = "/vendor/mediapipe/pose_landmarker_lite.task";

export type PoseTracker = {
  /** Landmarks of the most prominent person in this frame, or undefined when nobody is found. */
  detect: (video: HTMLVideoElement, timeMs: number) => Landmark[] | undefined;
  close: () => void;
  delegate: "GPU" | "CPU";
};

/**
 * Loads MediaPipe Pose Landmarker (lite) on demand: the library chunk, its WASM and the 5.8 MB
 * model are only fetched after the visitor starts the camera. Tries the GPU delegate first and
 * falls back to the CPU, which every browser with WebAssembly can run.
 */
export async function createPoseTracker(): Promise<PoseTracker> {
  const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);

  const make = (delegate: "GPU" | "CPU") =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

  let landmarker: PoseLandmarker;
  let delegate: "GPU" | "CPU" = "GPU";
  try {
    landmarker = await make("GPU");
  } catch {
    delegate = "CPU";
    landmarker = await make("CPU");
  }

  return {
    delegate,
    detect(video, timeMs) {
      const result = landmarker.detectForVideo(video, timeMs);
      return result.landmarks[0];
    },
    close() {
      landmarker.close();
    },
  };
}
