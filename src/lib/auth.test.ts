// @vitest-environment node
import { describe, expect, it } from "vitest";
import { roleFromClaim } from "@/lib/auth";

// The role claim comes from the token — untrusted input. Deny by default.
describe("roleFromClaim", () => {
  it("accepts a valid role in an array", () => {
    expect(roleFromClaim(["QUALITY_COMPLIANCE"])).toBe("QUALITY_COMPLIANCE");
  });
  it("accepts a bare string role", () => {
    expect(roleFromClaim("ADMIN")).toBe("ADMIN");
  });
  it("picks the first valid role, ignoring unknowns", () => {
    expect(roleFromClaim(["superuser", "SALES"])).toBe("SALES");
  });
  it("rejects unknown / wrong-case values", () => {
    expect(roleFromClaim(["admin"])).toBeNull();
    expect(roleFromClaim(["ROOT"])).toBeNull();
  });
  it("rejects missing / empty claims", () => {
    expect(roleFromClaim(undefined)).toBeNull();
    expect(roleFromClaim(null)).toBeNull();
    expect(roleFromClaim([])).toBeNull();
  });
});
