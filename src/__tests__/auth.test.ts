import { beforeAll, describe, expect, test } from "bun:test";
import "@/schema";
import * as auth from "@/auth";
import * as User from "@/user";
import { challenges } from "@/config";
import { db } from "@/database";

describe("auth", () => {
  beforeAll(() => {
    db.exec("DELETE FROM users WHERE username IN ('authuser','newuser')");
    User.create({ username: "authuser", credential_id: "auth-c1", public_key: Buffer.from([1,2,3]), counter: 0 } as User.Record);
  });

  test("ErrorCode enum values", () => {
    expect(auth.ErrorCode.USERNAME_TAKEN).toBe(0);
    expect(auth.ErrorCode.USER_NOT_FOUND).toBe(1);
    expect(auth.ErrorCode.CHALLENGE_NOT_FOUND).toBe(2);
  });

  test("ERRORS maps error codes to messages", () => {
    expect(auth.ERRORS[auth.ErrorCode.USERNAME_TAKEN].status).toBe(409);
    expect(auth.ERRORS[auth.ErrorCode.USER_NOT_FOUND].status).toBe(404);
    expect(auth.ERRORS[auth.ErrorCode.CHALLENGE_NOT_FOUND].status).toBe(400);
  });

  test("register throws for existing username", async () => {
    try {
      await auth.register("authuser");
      expect(true).toBe(false); // should not reach
    } catch (e: any) {
      expect(e.message).toBe(String(auth.ErrorCode.USERNAME_TAKEN));
    }
  });

  test("register generates options for new user", async () => {
    const options = await auth.register("newuser");
    expect(options).toBeDefined();
    expect(options.challenge).toBeDefined();
    // Cleanup
    challenges.delete("newuser");
  });

  test("verify throws without challenge", async () => {
    try {
      await auth.verify("authuser", {} as any);
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.message).toBe(String(auth.ErrorCode.CHALLENGE_NOT_FOUND));
    }
  });

  test("challenge throws for nonexistent user", async () => {
    try {
      await auth.challenge("ghost");
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.message).toBe(String(auth.ErrorCode.USER_NOT_FOUND));
    }
  });

  test("challenge returns options for existing user", async () => {
    const options = await auth.challenge("authuser");
    expect(options).toBeDefined();
    expect(options.challenge).toBeDefined();
    // Cleanup
    challenges.delete("auth-c1");
  });

  test("authenticate throws for nonexistent user", async () => {
    try {
      await auth.authenticate("ghost", {} as any);
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.message).toBe(String(auth.ErrorCode.USER_NOT_FOUND));
    }
  });

  test("authenticate throws without challenge", async () => {
    try {
      await auth.authenticate("authuser", {} as any);
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.message).toBe(String(auth.ErrorCode.CHALLENGE_NOT_FOUND));
    }
  });

  test("discover returns options", async () => {
    const options = await auth.discover();
    expect(options).toBeDefined();
    expect(options.challenge).toBeDefined();
    // Cleanup
    challenges.delete(options.challenge);
  });

  test("identify throws for nonexistent credential", async () => {
    try {
      await auth.identify({ id: "nonexistent", response: { clientDataJSON: btoa(JSON.stringify({ challenge: "x" })) } } as any);
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.message).toBe(String(auth.ErrorCode.USER_NOT_FOUND));
    }
  });

  test("identify throws without matching challenge", async () => {
    try {
      await auth.identify({
        id: "auth-c1",
        response: { clientDataJSON: btoa(JSON.stringify({ challenge: "no-match" })) },
      } as any);
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.message).toBe(String(auth.ErrorCode.CHALLENGE_NOT_FOUND));
    }
  });
});
