import { describe, expect, test } from "bun:test";
import { Hono, type Context } from "hono";

type Variables = { username: string };
import "@/schema";
import { secure, boardAccess, boardOwner } from "@/middleware";
import * as session from "@/session";
import * as Board from "@/board";
import * as User from "@/user";
import { db } from "@/database";

// Setup
db.exec("DELETE FROM users WHERE username IN ('mwuser','mwother')");
User.create({ username: "mwuser", credential_id: "mw1", public_key: Buffer.from([1]), counter: 0 } as User.Record);
User.create({ username: "mwother", credential_id: "mw2", public_key: Buffer.from([2]), counter: 0 } as User.Record);
const mwBoard = Board.create(`mw-board-${Date.now()}`, "mwuser");

describe("middleware", () => {
  test("secure rejects unauthenticated", async () => {
    const app = new Hono<{ Variables: Variables }>();
    app.get("/test", secure, (c) => c.text("ok"));
    const res = await app.request("/test");
    expect(res.status).toBe(401);
  });

  test("secure allows authenticated", async () => {
    const app = new Hono<{ Variables: Variables }>();
    app.get("/test", secure, (c) => c.text(`ok:${c.get("username")}`));
    const token = session.create("mwuser");
    const res = await app.request("/test", { headers: { Cookie: `session=${token}` } });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok:mwuser");
  });

  test("secure.optional passes without auth", async () => {
    const app = new Hono<{ Variables: Variables }>();
    app.get("/test", secure.optional, (c) => c.text(`user:${c.get("username") || "none"}`));
    const res = await app.request("/test");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("user:none");
  });

  test("secure.optional sets username when authed", async () => {
    const app = new Hono<{ Variables: Variables }>();
    app.get("/test", secure.optional, (c) => c.text(`user:${c.get("username") || "none"}`));
    const token = session.create("mwuser");
    const res = await app.request("/test", { headers: { Cookie: `session=${token}` } });
    expect(await res.text()).toBe("user:mwuser");
  });

  test("boardAccess rejects nonexistent board", async () => {
    const app = new Hono<{ Variables: Variables }>();
    app.get("/:slug", secure, boardAccess, (c) => c.text("ok"));
    const token = session.create("mwuser");
    const res = await app.request("/nonexistent-board-xyz", { headers: { Cookie: `session=${token}` } });
    expect(res.status).toBe(404);
  });

  test("boardAccess rejects unauthorized user", async () => {
    const app = new Hono<{ Variables: Variables }>();
    app.get("/:slug", secure, boardAccess, (c) => c.text("ok"));
    const token = session.create("mwother");
    const res = await app.request(`/${mwBoard.slug}`, { headers: { Cookie: `session=${token}` } });
    expect(res.status).toBe(403);
  });

  test("boardAccess allows owner", async () => {
    const app = new Hono<{ Variables: Variables }>();
    app.get("/:slug", secure, boardAccess, (c) => c.text("ok"));
    const token = session.create("mwuser");
    const res = await app.request(`/${mwBoard.slug}`, { headers: { Cookie: `session=${token}` } });
    expect(res.status).toBe(200);
  });

  test("boardOwner rejects non-owner", async () => {
    const app = new Hono<{ Variables: Variables }>();
    // Add mwother as member first
    db.exec(`INSERT OR IGNORE INTO members (board_id, username, invited_by) VALUES (${mwBoard.id}, 'mwother', 'mwuser')`);
    app.get("/:slug", secure, boardAccess, boardOwner, (c) => c.text("ok"));
    const token = session.create("mwother");
    const res = await app.request(`/${mwBoard.slug}`, { headers: { Cookie: `session=${token}` } });
    expect(res.status).toBe(403);
  });

  test("boardOwner allows owner", async () => {
    const app = new Hono<{ Variables: Variables }>();
    app.get("/:slug", secure, boardAccess, boardOwner, (c) => c.text("ok"));
    const token = session.create("mwuser");
    const res = await app.request(`/${mwBoard.slug}`, { headers: { Cookie: `session=${token}` } });
    expect(res.status).toBe(200);
  });
});
