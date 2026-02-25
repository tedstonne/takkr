// Shared test setup — must be imported before any @/ modules
import { mkdirSync } from "node:fs";

const testDir = `/tmp/takkr-test-${process.pid}`;
mkdirSync(testDir, { recursive: true });
process.env.DATA_PATH = testDir;

// Force non-production for config
process.env.NODE_ENV = "test";
