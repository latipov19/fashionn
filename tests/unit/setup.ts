import { beforeEach, vi } from "vitest";

/** Next's request APIs do not exist in unit tests. This jar stands in for the cookie store. */
export type Jar = Map<string, { value: string; options?: Record<string, unknown> }>;

const shared = globalThis as typeof globalThis & { __jar: Jar; __ip: string };
shared.__jar = new Map();
shared.__ip = "10.0.0.1";

process.env.ADMIN_EMAIL = "owner@example.com";
process.env.ADMIN_PASSWORD = "unit-test-password";
delete process.env.DATABASE_URL;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const entry = shared.__jar.get(name);
      return entry ? { name, value: entry.value } : undefined;
    },
    has: (name: string) => shared.__jar.has(name),
    set: (name: string, value: string, options?: Record<string, unknown>) => void shared.__jar.set(name, { value, options }),
    delete: (name: string) => void shared.__jar.delete(name),
  }),
  headers: async () => new Headers({ "x-forwarded-for": shared.__ip }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
  // Lets the framework's own signals through a catch, as the real one does.
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
  },
}));

beforeEach(() => {
  shared.__jar.clear();
  shared.__ip = "10.0.0.1";
});
