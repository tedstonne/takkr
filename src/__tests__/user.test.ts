import { beforeAll, describe, expect, test } from "bun:test";
import "@/schema";
import * as User from "@/user";
import { db } from "@/database";

describe("user", () => {
  beforeAll(() => {
    db.exec("DELETE FROM users");
  });

  test("sanitize lowercases and trims", () => {
    expect(User.sanitize("  Alice  ")).toBe("alice");
    expect(User.sanitize("BOB")).toBe("bob");
  });

  test("valid rejects short usernames", () => {
    const r = User.valid("ab");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("at least");
  });

  test("valid rejects long usernames", () => {
    const r = User.valid("a".repeat(31));
    expect(r.ok).toBe(false);
    expect(r.error).toContain("at most");
  });

  test("valid rejects slashes", () => {
    const r = User.valid("user/name");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("slashes");
  });

  test("valid rejects invalid characters", () => {
    expect(User.valid("user name").ok).toBe(false);
  });

  test("valid rejects starting with hyphen", () => {
    expect(User.valid("-user").ok).toBe(false);
  });

  test("valid accepts good usernames", () => {
    expect(User.valid("alice").ok).toBe(true);
    expect(User.valid("user-name").ok).toBe(true);
    expect(User.valid("user_name").ok).toBe(true);
    expect(User.valid("user123").ok).toBe(true);
  });

  test("create and find user", () => {
    User.create({
      username: "testuser",
      credential_id: "cred-1",
      public_key: Buffer.from([1, 2, 3]),
      counter: 0,
    } as User.Record);

    const found = User.find("testuser");
    expect(found).not.toBeNull();
    expect(found!.username).toBe("testuser");
    expect(found!.credential_id).toBe("cred-1");
  });

  test("exists returns true for existing user", () => {
    expect(User.exists("testuser")).toBe(true);
  });

  test("exists returns false for nonexistent user", () => {
    expect(User.exists("ghost")).toBe(false);
  });

  test("find returns null for nonexistent user", () => {
    expect(User.find("ghost")).toBeNull();
  });

  test("identify by credential_id", () => {
    const user = User.identify("cred-1");
    expect(user).not.toBeNull();
    expect(user!.username).toBe("testuser");
  });

  test("identify returns null for unknown credential", () => {
    expect(User.identify("unknown")).toBeNull();
  });

  test("credential returns credential_id", () => {
    expect(User.credential("testuser")).toBe("cred-1");
  });

  test("credential returns null for unknown user", () => {
    expect(User.credential("ghost")).toBeNull();
  });

  test("touch updates counter and login", () => {
    User.touch("testuser", 5);
    const user = User.find("testuser");
    expect(user!.counter).toBe(5);
    expect(user!.login).not.toBeNull();
  });

  test("FONTS contains expected fonts", () => {
    expect(User.FONTS.caveat).toBe("Caveat");
    expect(User.FONTS.kalam).toBe("Kalam");
    expect(Object.keys(User.FONTS).length).toBeGreaterThan(5);
  });

  test("getFont returns default for new user", () => {
    expect(User.getFont("testuser")).toBe("caveat");
  });

  test("setFont and getFont", () => {
    User.setFont("testuser", "kalam");
    expect(User.getFont("testuser")).toBe("kalam");
  });

  test("setFont ignores invalid font", () => {
    User.setFont("testuser", "comic-sans");
    expect(User.getFont("testuser")).toBe("kalam");
  });

  test("COLORS has 5 entries", () => {
    expect(User.COLORS.length).toBe(5);
  });

  test("setPreferredColor and getPreferredColor", () => {
    User.setPreferredColor("testuser", "pink");
    expect(User.getPreferredColor("testuser")).toBe("pink");
  });

  test("setPreferredColor ignores invalid", () => {
    User.setPreferredColor("testuser", "rainbow");
    expect(User.getPreferredColor("testuser")).toBe("pink");
  });

  test("setPreferredBackground and getPreferredBackground", () => {
    User.setPreferredBackground("testuser", "cork");
    expect(User.getPreferredBackground("testuser")).toBe("cork");
  });

  test("getPrefs returns all prefs", () => {
    const prefs = User.getPrefs("testuser");
    expect(prefs.font).toBe("kalam");
    expect(prefs.color).toBe("pink");
    expect(prefs.background).toBe("cork");
  });

  test("getPrefs returns defaults for unknown user", () => {
    const prefs = User.getPrefs("ghost");
    expect(prefs.font).toBe("caveat");
    expect(prefs.color).toBe("yellow");
    expect(prefs.background).toBe("grid");
  });

  test("setDisplayName and getProfile", () => {
    User.setDisplayName("testuser", "Test User");
    const profile = User.getProfile("testuser");
    expect(profile.displayName).toBe("Test User");
  });

  test("setEmail", () => {
    User.setEmail("testuser", "test@example.com");
    const profile = User.getProfile("testuser");
    expect(profile.email).toBe("test@example.com");
  });

  test("setAvatar", () => {
    User.setAvatar("testuser", "avatar_test.jpg");
    const profile = User.getProfile("testuser");
    expect(profile.avatar).toBe("avatar_test.jpg");
  });

  test("getProfile returns empty strings for unknown user", () => {
    const profile = User.getProfile("ghost");
    expect(profile.displayName).toBe("");
    expect(profile.email).toBe("");
    expect(profile.avatar).toBe("");
  });

  test("getFont returns default for unknown user", () => {
    expect(User.getFont("ghost")).toBe("caveat");
  });

  test("getPreferredColor returns default for unknown user", () => {
    expect(User.getPreferredColor("ghost")).toBe("yellow");
  });

  test("getPreferredBackground returns default for unknown user", () => {
    expect(User.getPreferredBackground("ghost")).toBe("grid");
  });

  test("setDisplayName trims whitespace", () => {
    User.setDisplayName("testuser", "  Trimmed  ");
    expect(User.getProfile("testuser").displayName).toBe("Trimmed");
  });

  test("setEmail trims whitespace", () => {
    User.setEmail("testuser", "  trim@test.com  ");
    expect(User.getProfile("testuser").email).toBe("trim@test.com");
  });
});
