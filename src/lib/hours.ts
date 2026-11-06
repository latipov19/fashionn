/**
 * The hours table and sun geometry from brief section 8.5.
 * Shared by the runtime scene and the build renderer. Angles are degrees, units are metres.
 */
import type { Hour, Room } from "@/content/types";

export type HourSpec = {
  hour: Hour;
  clock: string;
  /** Azimuth measured from the screen plane. */
  azimuth: number;
  /** Elevation measured from the horizon. */
  elevation: number;
  sunColour: string;
  roomDefault: Room;
};

export const HOUR_TABLE: Record<Hour, HourSpec> = {
  morning: { hour: "morning", clock: "08:30", azimuth: 35, elevation: 14, sunColour: "#FFC48A", roomDefault: "I" },
  noon: { hour: "noon", clock: "13:00", azimuth: 40, elevation: 34, sunColour: "#FFF1DC", roomDefault: "II" },
  evening: { hour: "evening", clock: "19:00", azimuth: 24, elevation: 6, sunColour: "#FF8A4A", roomDefault: "III" },
};

/** Half the room width. The window sits in the left wall at x = -3.6. */
export const ROOM_HALF_WIDTH = 3.6;
export const WINDOW_WIDTH = 0.7;
export const WINDOW_TOP = 5.5;
export const WINDOW_BOTTOM = 0.9;

/** Room I crossing: azimuth runs from 58 at p = 0.14 to 35 at p = 0.43. */
export const CROSSING = { startP: 0.14, endP: 0.43, startAzimuth: 58, endAzimuth: 35, landingX: 0.1 } as const;

const rad = (degrees: number) => (degrees * Math.PI) / 180;

export type Vec3 = [number, number, number];

/** `L = normalize(-cos(e)*cos(a), sin(e), cos(e)*sin(a))`, the direction toward the sun. */
export function sunDirection(azimuth: number, elevation: number): Vec3 {
  const a = rad(azimuth);
  const e = rad(elevation);
  const x = -Math.cos(e) * Math.cos(a);
  const y = Math.sin(e);
  const z = Math.cos(e) * Math.sin(a);
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
}

/** `windowZ = screenZ + (landingX + 3.6) * tan(a)` */
export function solveWindowZ(screenZ: number, landingX: number, azimuth: number): number {
  return screenZ + (landingX + ROOM_HALF_WIDTH) * Math.tan(rad(azimuth));
}

/** Blade width on the screen: `windowW / tan(a)`. */
export function bladeWidth(azimuth: number, windowWidth = WINDOW_WIDTH): number {
  return windowWidth / Math.tan(rad(azimuth));
}

/** Top of the lit area on the screen: `5.5 - (3.6 / cos(a)) * tan(e)`. */
export function litTop(azimuth: number, elevation: number): number {
  return WINDOW_TOP - (ROOM_HALF_WIDTH / Math.cos(rad(azimuth))) * Math.tan(rad(elevation));
}

/** Azimuth during the Crossing. Clamped outside the 0.14 to 0.43 range. */
export function crossingAzimuth(p: number): number {
  const t = Math.min(1, Math.max(0, (p - CROSSING.startP) / (CROSSING.endP - CROSSING.startP)));
  return CROSSING.startAzimuth + (CROSSING.endAzimuth - CROSSING.startAzimuth) * t;
}
