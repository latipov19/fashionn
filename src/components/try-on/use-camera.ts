"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CameraState = "idle" | "starting" | "live" | "denied" | "unavailable" | "busy" | "insecure" | "error";
export type Facing = "user" | "environment";

/** Maps getUserMedia's failures to what the visitor can act on. */
function stateFor(error: unknown): CameraState {
  const name = error instanceof DOMException || error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") return "unavailable";
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return "busy";
  return "error";
}

/**
 * The browser camera. Nothing starts until `start()` is called from a click. One stream at a
 * time: starting again (for example to switch cameras) stops the old tracks first. Tracks stop
 * on `stop()`, when the component unmounts, and when the page is hidden or left.
 */
export function useCamera() {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<CameraState>("idle");
  const [facing, setFacing] = useState<Facing>("user");
  const [cameras, setCameras] = useState(0);
  const stream = useRef<MediaStream | null>(null);
  const attempt = useRef(0);

  const release = useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }, []);

  const stop = useCallback(() => {
    attempt.current += 1;
    release();
    setState("idle");
  }, [release]);

  const start = useCallback(
    async (wanted: Facing = facing) => {
      if (typeof window === "undefined") return;
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setState("insecure");
        return;
      }
      const id = ++attempt.current;
      release();
      setState("starting");
      try {
        const next = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: wanted }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        // A later start or a stop won the race: drop this stream at once.
        if (id !== attempt.current) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        stream.current = next;
        const [track] = next.getVideoTracks();
        track?.addEventListener("ended", () => {
          if (stream.current === next) {
            release();
            setState("unavailable");
          }
        });
        const element = video.current;
        if (element) {
          element.srcObject = next;
          await element.play().catch(() => undefined);
        }
        setFacing(wanted);
        setState("live");
        // Labels and counts are only reliable after permission is granted.
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        setCameras(devices.filter((device) => device.kind === "videoinput").length);
      } catch (error) {
        if (id === attempt.current) setState(stateFor(error));
      }
    },
    [facing, release],
  );

  const switchCamera = useCallback(() => start(facing === "user" ? "environment" : "user"), [facing, start]);

  // Leaving the page or hiding the tab releases the camera; the visitor starts it again by hand.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && stream.current) stop();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", stop);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", stop);
      attempt.current += 1;
      release();
    };
  }, [release, stop]);

  return { video, state, facing, cameras, start, stop, switchCamera };
}
