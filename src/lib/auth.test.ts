// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isStaff, sessionRole } from "@/lib/auth";

// The role is stamped onto the session from the DB — but the session is still
// untrusted input at read time, so deny by default.
describe("sessionRole", () => {
  it("accepts a valid stamped role", () => {
    expect(sessionRole({ role: "QUALITY_COMPLIANCE" })).toBe("QUALITY_COMPLIANCE");
  });
  it("rejects a deactivated account even with a role", () => {
    expect(sessionRole({ role: "ADMIN", active: false })).toBeNull();
  });
  it("rejects unknown / wrong-case values", () => {
    expect(sessionRole({ role: "admin" })).toBeNull();
    expect(sessionRole({ role: "ROOT" })).toBeNull();
  });
  it("rejects missing role / user", () => {
    expect(sessionRole({})).toBeNull();
    expect(sessionRole(null)).toBeNull();
    expect(sessionRole(undefined)).toBeNull();
  });
});

describe("isStaff", () => {
  it("admits internal staff roles", () => {
    expect(isStaff("ADMIN")).toBe(true);
    expect(isStaff("FINANCE")).toBe(true);
  });
  it("keeps external portal roles out of the console", () => {
    expect(isStaff("MINER")).toBe(false);
    expect(isStaff("BUYER")).toBe(false);
  });
});
