import { Database } from "bun:sqlite";

const dbPath: string = process.env.DATA_PATH
  ? `${process.env.DATA_PATH}/postit.db`
  : "postit.db";

export const db: Database = new Database(dbPath, { create: true });

// Wait 5s during checkpoint locks instead of erroring immediately
db.exec("PRAGMA busy_timeout = 5000");
// Enable WAL mode for better concurrency
db.exec("PRAGMA journal_mode = WAL");
// Faster commits in WAL mode without sacrificing durability
db.exec("PRAGMA synchronous = NORMAL");
