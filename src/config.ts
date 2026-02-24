// In-memory challenge storage for passkey authentication
export const challenges = new Map<string, string>();

// RP (Relying Party) configuration
export const rpName = "takkr";
export const production = process.env.NODE_ENV === "production";
export const rpID = production ? "takkr.app" : "takkr.localhost";
export const origin = production
  ? "https://takkr.app"
  : "https://takkr.localhost";

// Session secret for signing tokens
export const secret: string =
  process.env.SESSION_SECRET || "dev-secret-change-in-production";
