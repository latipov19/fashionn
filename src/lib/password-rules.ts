/**
 * Registration limits, shared by the server schema (`validation.ts`) and the form's instant
 * check. Kept free of imports so the form does not pull the server's validation into the browser.
 *
 * A new password is judged by length alone: no rules about digits or symbols, so a long
 * passphrase or a password manager's output always passes. The ceiling only keeps hashing cheap.
 */
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 256;
export const NAME_MAX = 80;

/** A password made of one character repeated, such as `aaaaaaaaaa`. */
export const isRepeatedCharacter = (password: string) => /^(.)\1*$/su.test(password);
