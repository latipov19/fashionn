/** State for useActionState with customerLoginAction. A "use server" file can only export functions. */

export type CustomerLoginField = "email" | "password";

export type CustomerLoginState = {
  /** A form-level message: wrong credentials, too many attempts, or the service being down. */
  message: string | null;
  fieldErrors: Partial<Record<CustomerLoginField, string>>;
  /** The email as typed, so it survives an error. The password is never sent back. */
  email: string;
};

export const initialCustomerLoginState: CustomerLoginState = { message: null, fieldErrors: {}, email: "" };
