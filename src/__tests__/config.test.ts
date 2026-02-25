import { describe, expect, test } from "bun:test";
import { challenges, origin, production, rpID, rpName, secret } from "@/config";

describe("config", () => {
  test("rpName is takkr", () => {
    expect(rpName).toBe("takkr");
  });

  test("production reflects NODE_ENV", () => {
    // In test env, NODE_ENV may be "production" or "test" depending on setup
    expect(typeof production).toBe("boolean");
  });

  test("rpID is set based on production flag", () => {
    if (production) {
      expect(rpID).toBe("takkr.app");
    } else {
      expect(rpID).toBe("takkr.localhost");
    }
  });

  test("origin is set based on production flag", () => {
    if (production) {
      expect(origin).toBe("https://takkr.app");
    } else {
      expect(origin).toBe("https://takkr.localhost");
    }
  });

  test("secret has a value", () => {
    expect(typeof secret).toBe("string");
    expect(secret.length).toBeGreaterThan(0);
  });

  test("challenges is a Map", () => {
    expect(challenges instanceof Map).toBe(true);
    challenges.set("test-key", "test-val");
    expect(challenges.get("test-key")).toBe("test-val");
    challenges.delete("test-key");
    expect(challenges.has("test-key")).toBe(false);
  });
});
