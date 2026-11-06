import type { Hour, Room } from "./types";

export type Ground = "bone" | "raised" | "ink" | "lampblack" | "oxide" | "verdigris";

export type RoomMeta = {
  room: Room;
  label: string;
  /** Band title, from brief 14.2. */
  title: string;
  /** Hour shown under the title. Room III's title is already its hour. */
  hourLabel: string | null;
  hour: Hour;
  ground: Extract<Ground, "oxide" | "verdigris" | "lampblack">;
  /** The plaster colour behind the garment, used for the separation check in 9.6. */
  pigment: string;
};

export const roomMeta: Record<Room, RoomMeta> = {
  I: { room: "I", label: "Room I", title: "Outerwear", hourLabel: "Morning", hour: "morning", ground: "oxide", pigment: "#6E2C1E" },
  II: { room: "II", label: "Room II", title: "Shirts", hourLabel: "Noon", hour: "noon", ground: "verdigris", pigment: "#24504A" },
  III: { room: "III", label: "Room III", title: "Evening", hourLabel: null, hour: "evening", ground: "lampblack", pigment: "#161C29" },
};
