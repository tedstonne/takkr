import { describe, expect, test } from "bun:test";
import * as session from "@/session";

describe("session", () => {
  test("create returns a token with 3 parts", () => {
    const token = session.create("alice");
    const parts = token.split("|");
    expect(parts.length).toBe(3);
    expect(parts[0]).toBe("alice");
    expect(Number(parts[1])).toBeGreaterThan(Date.now());
  });

  test("validate returns username for valid token", () => {
    const token = session.create("bob");
    expect(session.validate(token)).toBe("bob");
  });

  test("validate returns null for undefined", () => {
    expect(session.validate(undefined)).toBeNull();
  });

  test("validate returns null for empty string", () => {
    expect(session.validate("")).toBeNull();
  });

  test("validate returns null for malformed token", () => {
    expect(session.validate("bad")).toBeNull();
    expect(session.validate("a|b")).toBeNull();
    expect(session.validate("a|b|c|d")).toBeNull();
  });

  test("validate returns null for invalid expiry", () => {
    expect(session.validate("user|notanumber|sig")).toBeNull();
  });

  test("validate returns null for expired token", () => {
    // Create a token with past expiry
    const expired = `user|${Date.now() - 1000}|fakesig`;
    expect(session.validate(expired)).toBeNull();
  });

  test("validate returns null for tampered signature", () => {
    const token = session.create("alice");
    const parts = token.split("|");
    const tampered = `${parts[0]}|${parts[1]}|badsignature`;
    expect(session.validate(tampered)).toBeNull();
  });

  test("validate returns null for tampered username", () => {
    const token = session.create("alice");
    const parts = token.split("|");
    const tampered = `eve|${parts[1]}|${parts[2]}`;
    expect(session.validate(tampered)).toBeNull();
  });
});
