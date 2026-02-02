import { createHmac } from "node:crypto";
import { secret } from "@/config";

const SESSION_MAX_AGE_MS: number = 30 * 24 * 60 * 60 * 1000; // 30 days

const sign = (data: string): string => {
  return createHmac("sha256", secret).update(data).digest("hex");
};

export const create = (username: string): string => {
  const expiry: number = Date.now() + SESSION_MAX_AGE_MS;
  const payload: string = `${username}|${expiry}`;
  const signature: string = sign(payload);

  return `${payload}|${signature}`;
};

export const validate = (token: string | undefined): string | null => {
  if (!token) return null;

  const parts: string[] = token.split("|");
  if (parts.length !== 3) return null;

  const [username, expiryStr, signature]: string[] = parts;
  const expiry: number = Number.parseInt(expiryStr, 10);

  if (Number.isNaN(expiry)) return null;
  if (Date.now() > expiry) return null;

  const payload: string = `${username}|${expiryStr}`;
  const expected: string = sign(payload);

  if (signature !== expected) return null;

  return username;
};
