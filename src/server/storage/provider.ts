import { localStorage } from "./local";

/** Storage seam for uploads. An S3 implementation slots in here later. */
export interface StorageProvider {
  /** Stores bytes under a generated name and returns the public URL. */
  put(name: string, bytes: Buffer, contentType: string): Promise<{ url: string }>;
  /** Deletes a stored file by its public URL. A missing file is not an error. */
  remove(url: string): Promise<void>;
}

let active: StorageProvider = localStorage;

export function getStorage(): StorageProvider {
  return active;
}

/** Swaps the provider, for tests. */
export function setStorage(provider: StorageProvider): void {
  active = provider;
}
