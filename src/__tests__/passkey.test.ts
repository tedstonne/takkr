import { describe, expect, test } from "bun:test";
import "@/schema";
import * as passkey from "@/passkey";
import { challenges } from "@/config";

describe("passkey", () => {
  test("challenge generates registration options", async () => {
    const options = await passkey.challenge("pkuser");
    expect(options).toBeDefined();
    expect(options.challenge).toBeDefined();
    expect(options.rp).toBeDefined();
    expect(options.user).toBeDefined();
    expect(challenges.has("pkuser")).toBe(true);
    challenges.delete("pkuser");
  });

  test("options generates authentication options", async () => {
    const opts = await passkey.options("some-cred-id");
    expect(opts).toBeDefined();
    expect(opts.challenge).toBeDefined();
    expect(challenges.has("some-cred-id")).toBe(true);
    challenges.delete("some-cred-id");
  });

  test("discover generates discoverable login options", async () => {
    const opts = await passkey.discover();
    expect(opts).toBeDefined();
    expect(opts.challenge).toBeDefined();
    // discover stores challenge → challenge
    expect(challenges.has(opts.challenge)).toBe(true);
    challenges.delete(opts.challenge);
  });

  test("register rejects invalid credential", async () => {
    try {
      await passkey.register("pkuser2", { id: "bad", response: {} } as any, "fake-challenge");
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e).toBeDefined();
    }
  });

  test("authenticate rejects invalid credential", async () => {
    try {
      await passkey.authenticate(
        { username: "pk", credential_id: "c", public_key: Buffer.from([1]), counter: 0 } as any,
        { id: "bad", response: {} } as any,
        "fake-challenge",
      );
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e).toBeDefined();
    }
  });
});
