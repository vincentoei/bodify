import * as v from "valibot";

export const signInSchema = v.object({
  email: v.pipe(
    v.string("Email is required"),
    v.nonEmpty("Email is required"),
    v.email("Please enter a valid email address")
  ),
  password: v.pipe(
    v.string("Password is required"),
    v.nonEmpty("Password is required")
  ),
});

export type SignInInput = v.InferInput<typeof signInSchema>;

export const signUpSchema = v.pipe(
  v.object({
    fullName: v.pipe(
      v.string("Full name is required"),
      v.nonEmpty("Full name is required"),
      v.minLength(2, "Full name must be at least 2 characters")
    ),
    email: v.pipe(
      v.string("Email is required"),
      v.nonEmpty("Email is required"),
      v.email("Please enter a valid email address")
    ),
    password: v.pipe(
      v.string("Password is required"),
      v.nonEmpty("Password is required"),
      v.minLength(8, "Password must be at least 8 characters"),
      v.regex(/[A-Z]/, "Password must contain at least one uppercase letter"),
      v.regex(/[0-9]/, "Password must contain at least one number"),
      v.regex(/[^A-Za-z0-9]/, "Password must contain at least one special character")
    ),
    confirmPassword: v.pipe(
      v.string("Please confirm your password"),
      v.nonEmpty("Please confirm your password")
    ),
  }),
  v.forward(
    v.partialCheck(
      [["password"], ["confirmPassword"]],
      (input) => input.password === input.confirmPassword,
      "Passwords do not match"
    ),
    ["confirmPassword"]
  )
);

export type SignUpInput = v.InferInput<typeof signUpSchema>;

export type FieldErrors = Record<string, string | undefined>;

export function getFieldErrors(issues: v.BaseIssue<unknown>[]): FieldErrors {
  const flat = v.flatten(issues as [v.BaseIssue<unknown>, ...v.BaseIssue<unknown>[]]);
  const errors: FieldErrors = {};
  for (const [key, messages] of Object.entries(flat.nested ?? {})) {
    if (messages && messages.length > 0) {
      errors[key] = messages[0];
    }
  }
  if (flat.root?.length && !Object.keys(errors).length) {
    errors.form = flat.root[0];
  }
  return errors;
}

export const passwordRequirements = [
  { label: "At least 8 characters", test: (password: string) => password.length >= 8 },
  { label: "At least 1 uppercase letter", test: (password: string) => /[A-Z]/.test(password) },
  { label: "At least 1 number", test: (password: string) => /[0-9]/.test(password) },
  { label: "At least 1 special character", test: (password: string) => /[^A-Za-z0-9]/.test(password) },
];

export function getAuthErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/rate limit/i.test(message)) {
    return "Too many attempts. Please wait a few minutes before trying again.";
  }
  return message || "Something went wrong. Please try again.";
}
