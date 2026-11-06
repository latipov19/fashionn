/** What every admin server action returns. Actions never throw across the boundary. */
export type ActionFailureCode =
  | "unauthorized"
  | "validation"
  | "not_found"
  | "conflict"
  | "invalid_transition"
  | "error";

export type ActionFailure = {
  ok: false;
  code: ActionFailureCode;
  message: string;
  fieldErrors?: Record<string, string>;
};

export type ActionResult<T = void> = { ok: true; data: T } | ActionFailure;
