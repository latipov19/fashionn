/** Admin limits shared by the server schemas and the panel's forms. No imports, so forms stay light. */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const STOCK_REASONS = ["received", "count", "damaged", "returned", "correction", "manual"] as const;
export type StockReason = (typeof STOCK_REASONS)[number];
