import { beforeAll, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import "@/schema";
import { api } from "@/api";
import * as Board from "@/board";
import * as Member from "@/member";
import * as Note from "@/note";
import * as User from "@/user";
import * as session from "@/session";
import { db } from "@/database";

// Create a test app with the API mounted
const app = new Hono();
app.route("/api", api);

// Helper to make authenticated requests
const authedFetch = (path: string, opts: RequestInit = {}) => {
  const token = session.create("apiuser");
  const headers = new Headers(opts.headers || {});
  headers.set("Cookie", `session=${token}`);
  return app.request(path, { ...opts, headers });
};

describe("api", () => {
  let boardSlug: string;
  let noteId: number;

  beforeAll(() => {
    db.exec("DELETE FROM attachments");
    db.exec("DELETE FROM notes");
    db.exec("DELETE FROM members");
    db.exec("DELETE FROM boards");
    db.exec("DELETE FROM users");
    User.create({ username: "apiuser", credential_id: "api-c1", public_key: Buffer.from([1]), counter: 0 } as User.Record);
    User.create({ username: "other", credential_id: "api-c2", public_key: Buffer.from([2]), counter: 0 } as User.Record);
    const board = Board.create("api-board", "apiuser");
    boardSlug = board.slug;
    const note = Note.create(board.id, "API note", "apiuser");
    noteId = note.id;
  });

  // Auth
  test("unauthenticated request returns 401", async () => {
    const res = await app.request("/api/boards");
    expect(res.status).toBe(401);
  });

  // Boards
  test("GET /boards returns boards", async () => {
    const res = await authedFetch("/api/boards");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  // Board background
  test("PUT /boards/:slug/background updates background", async () => {
    const res = await authedFetch(`/api/boards/${boardSlug}/background`, {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "background=cork",
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.background).toBe("cork");
  });

  test("PUT /boards/:slug/background rejects invalid", async () => {
    const res = await authedFetch(`/api/boards/${boardSlug}/background`, {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "background=invalid",
    });
    expect(res.status).toBe(400);
  });

  // Notes
  test("POST /boards/:slug/notes creates note", async () => {
    const res = await authedFetch(`/api/boards/${boardSlug}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "content=New+note&color=pink",
    });
    expect(res.status).toBe(200);
  });

  test("POST /boards/:slug/notes requires content", async () => {
    const res = await authedFetch(`/api/boards/${boardSlug}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "color=pink",
    });
    expect(res.status).toBe(400);
  });

  test("PUT /notes/:id updates note", async () => {
    const res = await authedFetch(`/api/notes/${noteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "content=Updated+note",
    });
    expect(res.status).toBe(200);
  });

  test("PUT /notes/:id updates tags", async () => {
    const res = await authedFetch(`/api/notes/${noteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "tags=test,api",
    });
    expect(res.status).toBe(200);
  });

  test("PUT /notes/:id updates checklist", async () => {
    const res = await authedFetch(`/api/notes/${noteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `checklist=${encodeURIComponent(JSON.stringify([{ text: "item", done: false }]))}`,
    });
    expect(res.status).toBe(200);
  });

  test("PUT /notes/:id updates assigned_to", async () => {
    const res = await authedFetch(`/api/notes/${noteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "assigned_to=testuser",
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('data-assigned="testuser"');
  });

  test("PUT /notes/:id clears assigned_to", async () => {
    // First assign
    await authedFetch(`/api/notes/${noteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "assigned_to=testuser",
    });
    // Then clear
    const res = await authedFetch(`/api/notes/${noteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "assigned_to=",
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('data-assigned=""');
  });

  test("PUT /notes/:id returns 404 for unknown", async () => {
    const res = await authedFetch("/api/notes/99999", {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "content=nope",
    });
    expect(res.status).toBe(404);
  });

  test("GET /notes/:id returns note with attachments", async () => {
    const res = await authedFetch(`/api/notes/${noteId}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.content).toBe("Updated note");
    expect(Array.isArray(data.attachments)).toBe(true);
  });

  test("GET /notes/:id returns 404 for unknown", async () => {
    const res = await authedFetch("/api/notes/99999");
    expect(res.status).toBe(404);
  });

  test("POST /notes/:id/front brings to front", async () => {
    const res = await authedFetch(`/api/notes/${noteId}/front`, { method: "POST" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.z).toBe("number");
  });

  test("POST /notes/:id/front returns 404 for unknown", async () => {
    const res = await authedFetch("/api/notes/99999/front", { method: "POST" });
    expect(res.status).toBe(404);
  });

  test("DELETE /notes/:id deletes note", async () => {
    const note = Note.create(Board.bySlug(boardSlug)!.id, "To delete", "apiuser");
    const res = await authedFetch(`/api/notes/${note.id}`, { method: "DELETE" });
    expect(res.status).toBe(200);
  });

  test("DELETE /notes/:id returns 404 for unknown", async () => {
    const res = await authedFetch("/api/notes/99999", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  // Attachments
  test("GET /notes/:id/attachments returns list", async () => {
    const res = await authedFetch(`/api/notes/${noteId}/attachments`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("POST /notes/:id/attachments requires file", async () => {
    const res = await authedFetch(`/api/notes/${noteId}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "",
    });
    expect(res.status).toBe(400);
  });

  test("POST /notes/:id/attachments with file", async () => {
    const formData = new FormData();
    formData.append("file", new File(["hello"], "test.txt", { type: "text/plain" }));
    const res = await authedFetch(`/api/notes/${noteId}/attachments`, {
      method: "POST",
      body: formData,
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.filename).toBe("test.txt");
  });

  test("GET /attachments/:id serves file", async () => {
    const atts = Note.attachments(noteId);
    if (atts.length > 0) {
      const res = await authedFetch(`/api/attachments/${atts[0].id}`);
      expect(res.status).toBe(200);
    }
  });

  test("GET /attachments/:id returns 404 for unknown", async () => {
    const res = await authedFetch("/api/attachments/99999");
    expect(res.status).toBe(404);
  });

  test("DELETE /attachments/:id deletes", async () => {
    const atts = Note.attachments(noteId);
    if (atts.length > 0) {
      const res = await authedFetch(`/api/attachments/${atts[0].id}`, { method: "DELETE" });
      expect(res.status).toBe(200);
    }
  });

  // User prefs
  test("PUT /user/font updates font", async () => {
    const res = await authedFetch("/api/user/font", {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "font=kalam",
    });
    expect(res.status).toBe(200);
  });

  test("PUT /user/font rejects invalid", async () => {
    const res = await authedFetch("/api/user/font", {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "font=comic-sans",
    });
    expect(res.status).toBe(400);
  });

  test("PUT /user/color updates color", async () => {
    const res = await authedFetch("/api/user/color", {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "color=pink",
    });
    expect(res.status).toBe(200);
  });

  test("PUT /user/background updates background", async () => {
    const res = await authedFetch("/api/user/background", {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "background=blueprint",
    });
    expect(res.status).toBe(200);
  });

  test("GET /user/prefs returns prefs", async () => {
    const res = await authedFetch("/api/user/prefs");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.font).toBe("kalam");
  });

  test("GET /user/profile returns profile", async () => {
    const res = await authedFetch("/api/user/profile");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.username).toBe("apiuser");
  });

  test("PUT /user/display-name updates name", async () => {
    const res = await authedFetch("/api/user/display-name", {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "display_name=API+User",
    });
    expect(res.status).toBe(200);
  });

  test("PUT /user/email updates email", async () => {
    const res = await authedFetch("/api/user/email", {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "email=api@test.com",
    });
    expect(res.status).toBe(200);
  });

  // Members
  test("POST /boards/:slug/members adds member", async () => {
    const res = await authedFetch(`/api/boards/${boardSlug}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "username=other",
    });
    // Redirects on success
    expect(res.status === 200 || res.status === 302).toBe(true);
  });

  test("POST /boards/:slug/members rejects missing username", async () => {
    const res = await authedFetch(`/api/boards/${boardSlug}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "",
    });
    expect(res.status).toBe(400);
  });

  test("POST /boards/:slug/members rejects nonexistent user", async () => {
    const res = await authedFetch(`/api/boards/${boardSlug}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "username=ghost",
    });
    expect(res.status).toBe(404);
  });

  test("POST /boards/:slug/members rejects duplicate", async () => {
    const res = await authedFetch(`/api/boards/${boardSlug}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "username=other",
    });
    expect(res.status).toBe(409);
  });

  test("POST /boards/:slug/members rejects owner", async () => {
    const res = await authedFetch(`/api/boards/${boardSlug}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "username=apiuser",
    });
    expect(res.status).toBe(400);
  });

  test("DELETE /boards/:slug/members/:username removes member", async () => {
    const res = await authedFetch(`/api/boards/${boardSlug}/members/other`, {
      method: "DELETE",
    });
    expect(res.status === 200 || res.status === 302).toBe(true);
  });

  // Viewport
  test("GET /boards/:slug/viewport returns defaults", async () => {
    const res = await authedFetch(`/api/boards/${boardSlug}/viewport`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.zoom).toBe(1);
    expect(data.scroll_x).toBe(0);
    expect(data.scroll_y).toBe(0);
  });

  test("PUT /boards/:slug/viewport saves state", async () => {
    const res = await authedFetch(`/api/boards/${boardSlug}/viewport`, {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "zoom=0.75&scroll_x=150&scroll_y=300",
    });
    expect(res.status).toBe(200);
  });

  test("GET /boards/:slug/viewport returns saved state", async () => {
    const res = await authedFetch(`/api/boards/${boardSlug}/viewport`);
    const data = await res.json();
    expect(data.zoom).toBe(0.75);
    expect(data.scroll_x).toBe(150);
    expect(data.scroll_y).toBe(300);
  });

  test("PUT /boards/:slug/viewport clamps zoom", async () => {
    const res = await authedFetch(`/api/boards/${boardSlug}/viewport`, {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "zoom=10&scroll_x=0&scroll_y=0",
    });
    expect(res.status).toBe(200);
    const res2 = await authedFetch(`/api/boards/${boardSlug}/viewport`);
    const data = await res2.json();
    expect(data.zoom).toBe(2); // clamped to max
  });

  test("PUT /boards/:slug/viewport clamps zoom min", async () => {
    await authedFetch(`/api/boards/${boardSlug}/viewport`, {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "zoom=0.01&scroll_x=0&scroll_y=0",
    });
    const res = await authedFetch(`/api/boards/${boardSlug}/viewport`);
    const data = await res.json();
    expect(data.zoom).toBe(0.25); // clamped to min
  });

  test("GET /boards/:slug/viewport 404 for unknown board", async () => {
    const res = await authedFetch("/api/boards/nonexistent-board-xyz/viewport");
    expect(res.status).toBe(404);
  });

  // Duplicate note
  test("POST /notes/:id/duplicate creates copy", async () => {
    // Set up the source note with extra data
    await authedFetch(`/api/notes/${noteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "description=details&tags=tag1,tag2&color=green",
    });

    const res = await authedFetch(`/api/notes/${noteId}/duplicate`, { method: "POST" });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("takkr-green"); // same color
  });

  test("POST /notes/:id/duplicate offsets position", async () => {
    const original = Note.byId(noteId)!;
    const res = await authedFetch(`/api/notes/${noteId}/duplicate`, { method: "POST" });
    expect(res.status).toBe(200);
    // The duplicated note should have offset position
    const allNotes = Note.forBoard(Board.bySlug(boardSlug)!.id);
    const dup = allNotes[allNotes.length - 1];
    expect(dup.x).toBe(original.x + 30);
    expect(dup.y).toBe(original.y + 30);
  });

  test("POST /notes/:id/duplicate copies description and tags", async () => {
    const res = await authedFetch(`/api/notes/${noteId}/duplicate`, { method: "POST" });
    expect(res.status).toBe(200);
    const allNotes = Note.forBoard(Board.bySlug(boardSlug)!.id);
    const dup = allNotes[allNotes.length - 1];
    expect(dup.description).toBe("details");
    expect(dup.tags).toBe("tag1,tag2");
  });

  test("POST /notes/:id/duplicate returns 404 for unknown", async () => {
    const res = await authedFetch("/api/notes/99999/duplicate", { method: "POST" });
    expect(res.status).toBe(404);
  });

  test("POST /notes/:id/duplicate respects access control", async () => {
    // Create a board owned by 'other' with no access for 'apiuser'
    const secret = Board.create("secret-board", "other");
    const secretNote = Note.create(secret.id, "Secret", "other");
    const res = await authedFetch(`/api/notes/${secretNote.id}/duplicate`, { method: "POST" });
    expect(res.status).toBe(403);
  });

  // Note creation with custom x/y
  test("POST /boards/:slug/notes accepts x and y", async () => {
    const res = await authedFetch(`/api/boards/${boardSlug}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "content=Positioned&x=500&y=600",
    });
    expect(res.status).toBe(200);
    const allNotes = Note.forBoard(Board.bySlug(boardSlug)!.id);
    const positioned = allNotes.find(n => n.content === "Positioned");
    expect(positioned).toBeDefined();
    expect(positioned!.x).toBe(500);
    expect(positioned!.y).toBe(600);
  });

  // Board deletion
  test("DELETE /boards/:slug deletes board", async () => {
    const b = Board.create("del-board", "apiuser");
    const res = await authedFetch(`/api/boards/${b.slug}`, { method: "DELETE" });
    expect(res.status === 200 || res.status === 302).toBe(true);
  });
});
