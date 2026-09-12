import { describe, expect, it } from "vitest";
import { isEmailConfirmationError } from "../client/src/lib/authRecovery";

describe("email confirmation recovery", () => {
  it("recognizes Supabase's unconfirmed-email sign-in response", () => {
    expect(isEmailConfirmationError("Email not confirmed")).toBe(true);
  });

  it("does not show the resend path for unrelated sign-in errors", () => {
    expect(isEmailConfirmationError("Invalid login credentials")).toBe(false);
  });
});
