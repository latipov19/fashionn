/** State for useActionState with customerRegisterAction. A "use server" file can only export functions. */

export type CustomerRegisterField = "name" | "email" | "password" | "confirm";

export type CustomerRegisterState = {
  /** A form-level message: email taken, too many attempts, or the service being down. */
  message: string | null;
  fieldErrors: Partial<Record<CustomerRegisterField, string>>;
  /** The name and email as typed, so they survive an error. Passwords are never sent back. */
  name: string;
  email: string;
};

export const initialCustomerRegisterState: CustomerRegisterState = { message: null, fieldErrors: {}, name: "", email: "" };
