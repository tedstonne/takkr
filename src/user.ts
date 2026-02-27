import { db } from "@/database";

const MIN_LENGTH: number = 3;
const MAX_LENGTH: number = 30;
const PATTERN: RegExp = /^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/;

export type Record = {
  username: string;
  credential_id: string;
  public_key: Buffer;
  counter: number;
  font: string;
  preferred_color: string;
  preferred_background: string;
  display_name: string;
  email: string;
  avatar: string;
  login?: string | null;
  created?: string;
};

import { FONTS } from "@/shared";
export { FONTS };

export const getFont = (username: string): string => {
  const user = find(username);
  return user?.font || "caveat";
};

export const setFont = (username: string, font: string): void => {
  if (!FONTS[font]) return;
  db.query("UPDATE users SET font = ? WHERE username = ?").run(font, username);
};

import { COLORS } from "@/shared";
export { COLORS };

export const getPreferredColor = (username: string): string => {
  const user = find(username);
  return user?.preferred_color || "yellow";
};

export const setPreferredColor = (username: string, color: string): void => {
  if (!COLORS.includes(color as any)) return;
  db.query("UPDATE users SET preferred_color = ? WHERE username = ?").run(
    color,
    username,
  );
};

export const getPreferredBackground = (username: string): string => {
  const user = find(username);
  return user?.preferred_background || "grid";
};

export const setPreferredBackground = (username: string, bg: string): void => {
  db.query("UPDATE users SET preferred_background = ? WHERE username = ?").run(
    bg,
    username,
  );
};

export const getPrefs = (
  username: string,
): { font: string; color: string; background: string } => {
  const user = find(username);
  return {
    font: user?.font || "caveat",
    color: user?.preferred_color || "yellow",
    background: user?.preferred_background || "grid",
  };
};

export const setDisplayName = (username: string, name: string): void => {
  db.query("UPDATE users SET display_name = ? WHERE username = ?").run(
    name.trim(),
    username,
  );
};

export const setEmail = (username: string, email: string): void => {
  db.query("UPDATE users SET email = ? WHERE username = ?").run(
    email.trim(),
    username,
  );
};

export const setAvatar = (username: string, avatar: string): void => {
  db.query("UPDATE users SET avatar = ? WHERE username = ?").run(
    avatar,
    username,
  );
};

export const getProfile = (
  username: string,
): { username: string; displayName: string; email: string; avatar: string } => {
  const user = find(username);
  return {
    username,
    displayName: user?.display_name || "",
    email: user?.email || "",
    avatar: user?.avatar || "",
  };
};

export const exists = (username: string): boolean => {
  const user = db.query("SELECT 1 FROM users WHERE username = ?").get(username);

  return !!user;
};

export const find = (username: string): Record | null => {
  const user = db.query("SELECT * FROM users WHERE username = ?").get(username);

  return user ? (user as Record) : null;
};

// Lookup user by passkey credential for discoverable login
export const identify = (credentialId: string): Record | null => {
  const user = db
    .query("SELECT * FROM users WHERE credential_id = ?")
    .get(credentialId);

  return user ? (user as Record) : null;
};

export const credential = (username: string): string | null => {
  const user = db
    .query("SELECT credential_id FROM users WHERE username = ?")
    .get(username) as { credential_id: string } | undefined;

  return user?.credential_id || null;
};

export const create = (user: Record): void => {
  db.query(
    `INSERT INTO users (username, credential_id, public_key, counter)
     VALUES (?, ?, ?, ?)`,
  ).run(user.username, user.credential_id, user.public_key, user.counter);
};

export const touch = (username: string, counter: number): void => {
  db.query(
    "UPDATE users SET counter = ?, login = CURRENT_TIMESTAMP WHERE username = ?",
  ).run(counter, username);
};

export const sanitize = (username: string): string => {
  return username.toLowerCase().trim();
};

export const valid = (username: string): { ok: boolean; error?: string } => {
  const clean: string = sanitize(username);

  const rules: Array<{ test: () => boolean; error: string }> = [
    {
      test: () => clean.length >= MIN_LENGTH,
      error: `Username must be at least ${MIN_LENGTH} characters`,
    },
    {
      test: () => clean.length <= MAX_LENGTH,
      error: `Username must be at most ${MAX_LENGTH} characters`,
    },
    {
      test: () => !clean.includes("/"),
      error: "Username cannot contain slashes",
    },
    {
      test: () => PATTERN.test(clean),
      error:
        "Username can only contain lowercase letters, numbers, hyphens, and underscores. Must start and end with a letter or number.",
    },
  ];

  const error: string | undefined = rules.find((rule) => !rule.test())?.error;

  return error ? { ok: false, error } : { ok: true };
};
