import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { deleteCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import * as auth from "@/auth";
import * as Board from "@/board";
import * as events from "@/events";
import * as Member from "@/member";
import { boardAccess, boardOwner, secure } from "@/middleware";
import * as Note from "@/note";
import * as User from "@/user";
import { Alert, Home, Takkr } from "@/views";
import * as S from "@/schemas";

type Variables = {
  username: string;
  board: Board.Record;
};

export const api = new OpenAPIHono<{ Variables: Variables }>();

// ============================================================
// AUTH
// ============================================================

const registerRoute = createRoute({
  method: "post",
  path: "/user/register",
  tags: ["Authentication"],
  summary: "Start passkey registration",
  description: "Returns WebAuthn creation options for a new username.",
  request: { query: S.RegisterQuery },
  responses: { 200: { description: "WebAuthn PublicKeyCredentialCreationOptions" } },
});

api.openapi(registerRoute, async (c) => {
  const username: string | undefined = c.req.query("username");
  if (!username) throw new HTTPException(400, { message: "Username required" });

  const clean = User.sanitize(username);
  const validation = User.valid(clean);
  if (!validation.ok)
    throw new HTTPException(400, { message: validation.error });

  try {
    const options = await auth.register(clean);
    return c.json(options);
  } catch (err) {
    const code = Number((err as Error).message);
    if (code === auth.ErrorCode.USERNAME_TAKEN) {
      throw new HTTPException(409, { message: "Username taken" });
    }
    throw err;
  }
});

const registerVerifyRoute = createRoute({
  method: "post",
  path: "/user/register/verify",
  tags: ["Authentication"],
  summary: "Complete registration",
  description: "Verifies the WebAuthn credential and creates the account. Sets session cookie.",
  responses: { 200: { description: "HTML redirect to home" } },
});

api.openapi(registerVerifyRoute, async (c) => {
  const body = await c.req.parseBody();
  const username = body.username as string;
  const decoded: string = atob(body.credential as string);
  const credential: RegistrationResponseJSON = JSON.parse(decoded);

  try {
    const sessionToken = await auth.verify(username, credential);
    setCookie(c, "session", sessionToken, {
      httpOnly: true, secure: true, sameSite: "Lax",
      maxAge: 30 * 24 * 60 * 60, path: "/",
    });
    const boards = Board.all(username);
    return c.html(<Home username={username} boards={boards} />) as any;
  } catch (err) {
    return c.html(<Alert message={(err as Error).message} />) as any;
  }
});

const discoverRoute = createRoute({
  method: "post",
  path: "/user/discover",
  tags: ["Authentication"],
  summary: "Start passkey discovery (sign-in)",
  description: "Returns WebAuthn request options for discoverable credentials.",
  responses: { 200: { description: "WebAuthn PublicKeyCredentialRequestOptions" } },
});

api.openapi(discoverRoute, async (c) => {
  const options = await auth.discover();
  return c.json(options);
});

const discoverVerifyRoute = createRoute({
  method: "post",
  path: "/user/discover/verify",
  tags: ["Authentication"],
  summary: "Complete sign-in",
  description: "Verifies the WebAuthn assertion and sets session cookie.",
  responses: { 200: { description: "HTML redirect to home" } },
});

api.openapi(discoverVerifyRoute, async (c) => {
  const body = await c.req.parseBody();
  const decoded: string = atob(body.credential as string);
  const credential: AuthenticationResponseJSON = JSON.parse(decoded);

  try {
    const { session, username } = await auth.identify(credential);
    setCookie(c, "session", session, {
      httpOnly: true, secure: true, sameSite: "Lax",
      maxAge: 30 * 24 * 60 * 60, path: "/",
    });
    const boards = Board.all(username);
    return c.html(<Home username={username} boards={boards} />) as any;
  } catch (_err) {
    return c.html(<Alert message="Sign-in failed. Please try again." />) as any;
  }
});

const logoutRoute = createRoute({
  method: "post",
  path: "/user/logout",
  tags: ["Authentication"],
  summary: "Sign out",
  description: "Clears the session cookie.",
  responses: { 302: { description: "Redirect to /" } },
});

api.openapi(logoutRoute, (c) => {
  deleteCookie(c, "session");
  return c.redirect("/") as any;
});

// ============================================================
// BOARDS
// ============================================================

const listBoardsRoute = createRoute({
  method: "get",
  path: "/boards",
  tags: ["Boards"],
  summary: "List boards",
  description: "List all boards the authenticated user has access to (owned + member).",
  middleware: [secure] as any,
  responses: {
    200: { description: "Array of boards", content: { "application/json": { schema: z.array(S.BoardResponse) } } },
  },
});

api.openapi(listBoardsRoute, (c) => {
  const username: string = c.get("username");
  const boards = Board.all(username);
  return c.json(boards) as any;
});

const deleteBoardRoute = createRoute({
  method: "delete",
  path: "/boards/{slug}",
  tags: ["Boards"],
  summary: "Delete a board",
  description: "Delete a board and all its notes. Owner only.",
  middleware: [secure, boardAccess, boardOwner] as any,
  request: { params: S.SlugParam },
  responses: { 302: { description: "Redirect to /" } },
});

api.openapi(deleteBoardRoute, (c) => {
  const board: Board.Record = c.get("board");
  Board.remove(board.id);
  return c.redirect("/") as any;
});

const setBgRoute = createRoute({
  method: "put",
  path: "/boards/{slug}/background",
  tags: ["Boards"],
  summary: "Change board background",
  middleware: [secure, boardAccess, boardOwner] as any,
  request: { params: S.SlugParam },
  responses: {
    200: { description: "Updated background", content: { "application/json": { schema: z.object({ ok: z.boolean(), background: z.string() }) } } },
  },
});

api.openapi(setBgRoute, async (c) => {
  const board: Board.Record = c.get("board");
  const body = await c.req.parseBody();
  const bg = body.background as Board.Background;
  if (!bg || !Board.BACKGROUNDS.includes(bg)) {
    throw new HTTPException(400, { message: "Invalid background" });
  }
  Board.setBackground(board.id, bg);
  return c.json({ ok: true, background: bg }) as any;
});

const getViewportRoute = createRoute({
  method: "get",
  path: "/boards/{slug}/viewport",
  tags: ["Boards"],
  summary: "Get viewport state",
  description: "Get the user's saved viewport state (zoom + scroll) for this board.",
  middleware: [secure, boardAccess] as any,
  request: { params: S.SlugParam },
  responses: {
    200: { description: "Viewport state", content: { "application/json": { schema: S.ViewportResponse } } },
  },
});

api.openapi(getViewportRoute, (c) => {
  const username: string = c.get("username");
  const board: Board.Record = c.get("board");
  const vp = Board.getViewport(username, board.id);
  return c.json(vp || { zoom: 1, scroll_x: 0, scroll_y: 0 }) as any;
});

const setViewportRoute = createRoute({
  method: "put",
  path: "/boards/{slug}/viewport",
  tags: ["Boards"],
  summary: "Save viewport state",
  description: "Save zoom level and scroll position. Zoom clamped to 0.25–2.0.",
  middleware: [secure, boardAccess] as any,
  request: { params: S.SlugParam },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: S.OkResponse } } },
  },
});

api.openapi(setViewportRoute, async (c) => {
  const username: string = c.get("username");
  const board: Board.Record = c.get("board");
  const body = await c.req.parseBody();
  const zoom = Math.max(0.25, Math.min(2, Number(body.zoom) || 1));
  const scrollX = Number(body.scroll_x) || 0;
  const scrollY = Number(body.scroll_y) || 0;
  Board.setViewport(username, board.id, zoom, scrollX, scrollY);
  return c.json({ ok: true }) as any;
});

// SSE events (non-OpenAPI — streaming response)
api.get("/boards/:slug/events", secure, boardAccess, (c) => {
  const HEARTBEAT_INTERVAL_MS: number = Number(process.env.SSE_HEARTBEAT_MS || 15000);
  const board: Board.Record = c.get("board");
  const encoder: TextEncoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer: WritableStreamDefaultWriter = writable.getWriter();
  const id: string = events.connect(writer, board.id);

  writer.write(encoder.encode(": heartbeat\n\n")).catch(() => {});
  const heartbeat: ReturnType<typeof setInterval> = setInterval(() => {
    writer.write(encoder.encode(": heartbeat\n\n")).catch(() => {
      clearInterval(heartbeat);
    });
  }, HEARTBEAT_INTERVAL_MS);

  c.req.raw.signal.addEventListener("abort", () => {
    clearInterval(heartbeat);
    events.disconnect(id);
    writer.close();
  });

  return c.newResponse(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

// ============================================================
// MEMBERS
// ============================================================

const addMemberRoute = createRoute({
  method: "post",
  path: "/boards/{slug}/members",
  tags: ["Members"],
  summary: "Invite a member",
  description: "Add a user to the board. Owner only.",
  middleware: [secure, boardAccess, boardOwner] as any,
  request: { params: S.SlugParam },
  responses: { 302: { description: "Redirect to board" } },
});

api.openapi(addMemberRoute, async (c) => {
  const board: Board.Record = c.get("board");
  const inviter: string = c.get("username");
  const body = await c.req.parseBody();
  const username = body.username as string;
  if (!username) throw new HTTPException(400, { message: "Username required" });
  if (!User.exists(username)) throw new HTTPException(404, { message: "User not found" });
  if (Member.exists(board.id, username)) throw new HTTPException(409, { message: "Already a member" });
  if (board.owner === username) throw new HTTPException(400, { message: "User is the owner" });
  Member.add(board.id, username, inviter);
  events.broadcast(board.id, events.Event.Member.Joined, `${username} joined the board`);
  return c.redirect(`/${board.slug}`) as any;
});

const removeMemberRoute = createRoute({
  method: "delete",
  path: "/boards/{slug}/members/{username}",
  tags: ["Members"],
  summary: "Remove a member",
  middleware: [secure, boardAccess, boardOwner] as any,
  request: { params: S.SlugParam.merge(S.UsernameParam) },
  responses: { 302: { description: "Redirect to board" } },
});

api.openapi(removeMemberRoute, (c) => {
  const board: Board.Record = c.get("board");
  const username = c.req.param("username");
  Member.remove(board.id, username);
  events.broadcast(board.id, events.Event.Member.Left, `${username} left the board`);
  return c.redirect(`/${board.slug}`) as any;
});

// ============================================================
// NOTES
// ============================================================

const createNoteRoute = createRoute({
  method: "post",
  path: "/boards/{slug}/notes",
  tags: ["Notes"],
  summary: "Create a note",
  description: "Create a new sticky note on the board. Broadcasts SSE event.",
  middleware: [secure, boardAccess] as any,
  request: { params: S.SlugParam },
  responses: { 200: { description: "HTML card element" } },
});

api.openapi(createNoteRoute, async (c) => {
  const board: Board.Record = c.get("board");
  const username: string = c.get("username");
  const body = await c.req.parseBody();
  const content = body.content as string;
  const color = (body.color as Note.Color) || "yellow";
  const x = body.x ? Number(body.x) : 100 + Math.random() * 200;
  const y = body.y ? Number(body.y) : 100 + Math.random() * 200;
  if (!content) throw new HTTPException(400, { message: "Title required" });
  const note = Note.create(board.id, content, username, x, y, color);
  const html = <Takkr note={note} />;
  events.broadcast(board.id, events.Event.Note.Created, html.toString());
  return c.html(<Takkr note={note} />) as any;
});

const getNoteRoute = createRoute({
  method: "get",
  path: "/notes/{id}",
  tags: ["Notes"],
  summary: "Get note detail",
  description: "Get a note with its attachments.",
  middleware: [secure] as any,
  request: { params: S.NoteIdParam },
  responses: {
    200: { description: "Note with attachments", content: { "application/json": { schema: S.NoteDetailResponse } } },
  },
});

api.openapi(getNoteRoute, (c) => {
  const username: string = c.get("username");
  const noteId = Number(c.req.param("id"));
  const note = Note.byId(noteId);
  if (!note) throw new HTTPException(404, { message: "Note not found" });
  const hasAccess = Board.access(note.board_id, username);
  if (!hasAccess) throw new HTTPException(403, { message: "Forbidden" });
  const atts = Note.attachments(noteId);
  return c.json({ ...note, attachments: atts }) as any;
});

const updateNoteRoute = createRoute({
  method: "put",
  path: "/notes/{id}",
  tags: ["Notes"],
  summary: "Update a note",
  description: "Update note fields. All fields optional. Pass ?silent=1 to suppress SSE broadcast.",
  middleware: [secure] as any,
  request: { params: S.NoteIdParam },
  responses: { 200: { description: "HTML updated card" } },
});

api.openapi(updateNoteRoute, async (c) => {
  const username: string = c.get("username");
  const noteId = Number(c.req.param("id"));
  const body = await c.req.parseBody();
  const note = Note.byId(noteId);
  if (!note) throw new HTTPException(404, { message: "Note not found" });
  const hasAccess = Board.access(note.board_id, username);
  if (!hasAccess) throw new HTTPException(403, { message: "Forbidden" });

  const data: Partial<Note.Record> = {};
  if (body.content) data.content = body.content as string;
  if (body.description !== undefined) data.description = body.description as string;
  if (body.tags !== undefined) data.tags = body.tags as string;
  if (body.checklist !== undefined) data.checklist = body.checklist as string;
  if (body.x) data.x = Number(body.x);
  if (body.y) data.y = Number(body.y);
  if (body.z) data.z = Number(body.z);
  if (body.color) data.color = body.color as Note.Color;

  const updated = Note.update(noteId, data);
  if (!updated) throw new HTTPException(404, { message: "Note not found" });

  const silent = c.req.query("silent") === "1";
  if (!silent) {
    const html = <Takkr note={updated} oob />;
    events.broadcast(updated.board_id, events.Event.Note.Updated, html.toString());
  }
  return c.html(<Takkr note={updated} />) as any;
});

const duplicateNoteRoute = createRoute({
  method: "post",
  path: "/notes/{id}/duplicate",
  tags: ["Notes"],
  summary: "Duplicate a note",
  description: "Copy a note with +30px position offset. Copies content, color, description, tags, checklist.",
  middleware: [secure] as any,
  request: { params: S.NoteIdParam },
  responses: { 200: { description: "HTML new card" } },
});

api.openapi(duplicateNoteRoute, async (c) => {
  const username: string = c.get("username");
  const noteId = Number(c.req.param("id"));
  const note = Note.byId(noteId);
  if (!note) throw new HTTPException(404, { message: "Note not found" });
  const hasAccess = Board.access(note.board_id, username);
  if (!hasAccess) throw new HTTPException(403, { message: "Forbidden" });

  const dup = Note.create(note.board_id, note.content, username, note.x + 30, note.y + 30, note.color as Note.Color);
  Note.update(dup.id, { description: note.description, tags: note.tags, checklist: note.checklist });
  const updated = Note.byId(dup.id)!;
  const html = <Takkr note={updated} />;
  events.broadcast(note.board_id, events.Event.Note.Created, html.toString());
  return c.html(<Takkr note={updated} />) as any;
});

const deleteNoteRoute = createRoute({
  method: "delete",
  path: "/notes/{id}",
  tags: ["Notes"],
  summary: "Delete a note",
  description: "Delete a note and its attachments. Broadcasts SSE event.",
  middleware: [secure] as any,
  request: { params: S.NoteIdParam },
  responses: { 200: { description: "OK" } },
});

api.openapi(deleteNoteRoute, async (c) => {
  const username: string = c.get("username");
  const noteId = Number(c.req.param("id"));
  const note = Note.byId(noteId);
  if (!note) throw new HTTPException(404, { message: "Note not found" });
  const hasAccess = Board.access(note.board_id, username);
  if (!hasAccess) throw new HTTPException(403, { message: "Forbidden" });
  Note.remove(noteId);
  events.broadcast(
    note.board_id,
    events.Event.Note.Deleted,
    `<script>document.querySelector('[data-id="${noteId}"]')?.remove()</script>`,
  );
  return c.text("OK") as any;
});

const bringToFrontRoute = createRoute({
  method: "post",
  path: "/notes/{id}/front",
  tags: ["Notes"],
  summary: "Bring note to front",
  description: "Set the note to the highest z-index on the board.",
  middleware: [secure] as any,
  request: { params: S.NoteIdParam },
  responses: {
    200: { description: "New z-index", content: { "application/json": { schema: z.object({ z: z.number() }) } } },
  },
});

api.openapi(bringToFrontRoute, async (c) => {
  const username: string = c.get("username");
  const noteId = Number(c.req.param("id"));
  const note = Note.byId(noteId);
  if (!note) throw new HTTPException(404, { message: "Note not found" });
  const hasAccess = Board.access(note.board_id, username);
  if (!hasAccess) throw new HTTPException(403, { message: "Forbidden" });
  const updated = Note.bringToFront(noteId, note.board_id);
  if (!updated) throw new HTTPException(404, { message: "Note not found" });
  return c.json({ z: updated.z }) as any;
});

// ============================================================
// ATTACHMENTS
// ============================================================

const uploadAttachmentRoute = createRoute({
  method: "post",
  path: "/notes/{id}/attachments",
  tags: ["Attachments"],
  summary: "Upload attachment",
  description: "Upload a file to a note. Max 5MB.",
  middleware: [secure] as any,
  request: { params: S.NoteIdParam },
  responses: {
    200: { description: "Attachment metadata", content: { "application/json": { schema: S.AttachmentResponse } } },
  },
});

api.openapi(uploadAttachmentRoute, async (c) => {
  const username: string = c.get("username");
  const noteId = Number(c.req.param("id"));
  const note = Note.byId(noteId);
  if (!note) throw new HTTPException(404, { message: "Note not found" });
  const hasAccess = Board.access(note.board_id, username);
  if (!hasAccess) throw new HTTPException(403, { message: "Forbidden" });

  const body = await c.req.parseBody();
  const file = body.file;
  if (!file || typeof file === "string") throw new HTTPException(400, { message: "File required" });
  if (file.size > 5 * 1024 * 1024) throw new HTTPException(400, { message: "File too large (max 5MB)" });

  const ext = file.name.split(".").pop() || "bin";
  const fname = `${noteId}_${Date.now()}.${ext}`;
  const dir = "./uploads";
  const { mkdirSync, writeFileSync } = await import("node:fs");
  mkdirSync(dir, { recursive: true });
  const buf = await file.arrayBuffer();
  writeFileSync(`${dir}/${fname}`, Buffer.from(buf));

  const att = Note.addAttachment(noteId, file.name, file.type || "", file.size, fname);
  return c.json(att) as any;
});

const listAttachmentsRoute = createRoute({
  method: "get",
  path: "/notes/{id}/attachments",
  tags: ["Attachments"],
  summary: "List attachments",
  description: "List all attachments for a note.",
  middleware: [secure] as any,
  request: { params: S.NoteIdParam },
  responses: {
    200: { description: "Attachment list", content: { "application/json": { schema: z.array(S.AttachmentResponse) } } },
  },
});

api.openapi(listAttachmentsRoute, (c) => {
  const username: string = c.get("username");
  const noteId = Number(c.req.param("id"));
  const note = Note.byId(noteId);
  if (!note) throw new HTTPException(404, { message: "Note not found" });
  const hasAccess = Board.access(note.board_id, username);
  if (!hasAccess) throw new HTTPException(403, { message: "Forbidden" });
  return c.json(Note.attachments(noteId)) as any;
});

const getAttachmentRoute = createRoute({
  method: "get",
  path: "/attachments/{id}",
  tags: ["Attachments"],
  summary: "Download attachment",
  description: "Serve an attachment file.",
  middleware: [secure] as any,
  request: { params: S.AttachmentIdParam },
  responses: { 200: { description: "File contents" } },
});

api.openapi(getAttachmentRoute, async (c) => {
  const username: string = c.get("username");
  const attId = Number(c.req.param("id"));
  const att = Note.attachmentById(attId);
  if (!att) throw new HTTPException(404, { message: "Attachment not found" });
  const note = Note.byId(att.note_id);
  if (!note) throw new HTTPException(404, { message: "Note not found" });
  const hasAccess = Board.access(note.board_id, username);
  if (!hasAccess) throw new HTTPException(403, { message: "Forbidden" });

  const { readFileSync } = await import("node:fs");
  const data = readFileSync(`./uploads/${att.path}`);
  return c.newResponse(data, {
    headers: {
      "Content-Type": att.mime_type || "application/octet-stream",
      "Content-Disposition": `inline; filename="${att.filename}"`,
    },
  }) as any;
});

const deleteAttachmentRoute = createRoute({
  method: "delete",
  path: "/attachments/{id}",
  tags: ["Attachments"],
  summary: "Delete attachment",
  middleware: [secure] as any,
  request: { params: S.AttachmentIdParam },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: S.OkResponse } } },
  },
});

api.openapi(deleteAttachmentRoute, async (c) => {
  const username: string = c.get("username");
  const attId = Number(c.req.param("id"));
  const att = Note.attachmentById(attId);
  if (!att) throw new HTTPException(404, { message: "Attachment not found" });
  const note = Note.byId(att.note_id);
  if (!note) throw new HTTPException(404, { message: "Note not found" });
  const hasAccess = Board.access(note.board_id, username);
  if (!hasAccess) throw new HTTPException(403, { message: "Forbidden" });

  try {
    const { unlinkSync } = await import("node:fs");
    unlinkSync(`./uploads/${att.path}`);
  } catch (_) {}

  Note.removeAttachment(attId);
  return c.json({ ok: true }) as any;
});

// ============================================================
// USER & PREFERENCES
// ============================================================

const getUserProfileRoute = createRoute({
  method: "get",
  path: "/user/profile",
  tags: ["User"],
  summary: "Get profile",
  middleware: [secure] as any,
  responses: {
    200: { description: "User profile", content: { "application/json": { schema: S.ProfileResponse } } },
  },
});

api.openapi(getUserProfileRoute, (c) => {
  const username: string = c.get("username");
  return c.json(User.getProfile(username)) as any;
});

const getUserPrefsRoute = createRoute({
  method: "get",
  path: "/user/prefs",
  tags: ["User"],
  summary: "Get preferences",
  middleware: [secure] as any,
  responses: {
    200: { description: "User preferences", content: { "application/json": { schema: S.PrefsResponse } } },
  },
});

api.openapi(getUserPrefsRoute, (c) => {
  const username: string = c.get("username");
  return c.json(User.getPrefs(username)) as any;
});

const setDisplayNameRoute = createRoute({
  method: "put",
  path: "/user/display-name",
  tags: ["User"],
  summary: "Update display name",
  middleware: [secure] as any,
  responses: {
    200: { description: "OK", content: { "application/json": { schema: S.OkResponse } } },
  },
});

api.openapi(setDisplayNameRoute, async (c) => {
  const username: string = c.get("username");
  const body = await c.req.parseBody();
  const name = body.display_name as string;
  if (name === undefined) throw new HTTPException(400, { message: "display_name required" });
  User.setDisplayName(username, name);
  return c.json({ ok: true }) as any;
});

const setEmailRoute = createRoute({
  method: "put",
  path: "/user/email",
  tags: ["User"],
  summary: "Update email",
  middleware: [secure] as any,
  responses: {
    200: { description: "OK", content: { "application/json": { schema: S.OkResponse } } },
  },
});

api.openapi(setEmailRoute, async (c) => {
  const username: string = c.get("username");
  const body = await c.req.parseBody();
  const email = body.email as string;
  if (email === undefined) throw new HTTPException(400, { message: "email required" });
  User.setEmail(username, email);
  return c.json({ ok: true }) as any;
});

const setFontRoute = createRoute({
  method: "put",
  path: "/user/font",
  tags: ["User"],
  summary: "Set handwriting font",
  middleware: [secure] as any,
  responses: {
    200: { description: "OK", content: { "application/json": { schema: z.object({ ok: z.boolean(), font: z.string() }) } } },
  },
});

api.openapi(setFontRoute, async (c) => {
  const username: string = c.get("username");
  const body = await c.req.parseBody();
  const font = body.font as string;
  if (!font || !User.FONTS[font]) throw new HTTPException(400, { message: "Invalid font" });
  User.setFont(username, font);
  return c.json({ ok: true, font }) as any;
});

const setColorRoute = createRoute({
  method: "put",
  path: "/user/color",
  tags: ["User"],
  summary: "Set default note color",
  middleware: [secure] as any,
  responses: {
    200: { description: "OK", content: { "application/json": { schema: z.object({ ok: z.boolean(), color: z.string() }) } } },
  },
});

api.openapi(setColorRoute, async (c) => {
  const username: string = c.get("username");
  const body = await c.req.parseBody();
  const color = body.color as string;
  User.setPreferredColor(username, color);
  return c.json({ ok: true, color }) as any;
});

const setBgPrefRoute = createRoute({
  method: "put",
  path: "/user/background",
  tags: ["User"],
  summary: "Set preferred background",
  middleware: [secure] as any,
  responses: {
    200: { description: "OK", content: { "application/json": { schema: z.object({ ok: z.boolean(), background: z.string() }) } } },
  },
});

api.openapi(setBgPrefRoute, async (c) => {
  const username: string = c.get("username");
  const body = await c.req.parseBody();
  const bg = body.background as string;
  User.setPreferredBackground(username, bg);
  return c.json({ ok: true, background: bg }) as any;
});

const uploadAvatarRoute = createRoute({
  method: "post",
  path: "/user/avatar",
  tags: ["User"],
  summary: "Upload avatar",
  description: "Upload an avatar image. Max 2MB, must be an image.",
  middleware: [secure] as any,
  responses: {
    200: { description: "Avatar filename", content: { "application/json": { schema: z.object({ ok: z.boolean(), avatar: z.string() }) } } },
  },
});

api.openapi(uploadAvatarRoute, async (c) => {
  const username: string = c.get("username");
  const body = await c.req.parseBody();
  const file = body.file;
  if (!file || typeof file === "string") throw new HTTPException(400, { message: "File required" });
  if (file.size > 2 * 1024 * 1024) throw new HTTPException(400, { message: "File too large (max 2MB)" });
  if (!file.type?.startsWith("image/")) throw new HTTPException(400, { message: "Must be an image" });

  const ext = file.name.split(".").pop() || "jpg";
  const fname = `avatar_${username}_${Date.now()}.${ext}`;
  const dir = "./uploads";
  const { mkdirSync, writeFileSync, unlinkSync } = await import("node:fs");
  mkdirSync(dir, { recursive: true });
  const buf = await file.arrayBuffer();
  writeFileSync(`${dir}/${fname}`, Buffer.from(buf));

  const old = User.find(username)?.avatar;
  if (old) { try { unlinkSync(`${dir}/${old}`); } catch (_) {} }

  User.setAvatar(username, fname);
  return c.json({ ok: true, avatar: fname }) as any;
});

const getAvatarRoute = createRoute({
  method: "get",
  path: "/user/avatar/{filename}",
  tags: ["User"],
  summary: "Serve avatar",
  description: "Serve an avatar image. Public, no auth required. Cached for 1 year.",
  request: { params: S.FilenameParam },
  responses: { 200: { description: "Image file" } },
});

api.openapi(getAvatarRoute, async (c) => {
  const filename = c.req.param("filename");
  try {
    const { readFileSync } = await import("node:fs");
    const data = readFileSync(`./uploads/${filename}`);
    const ext = filename.split(".").pop()?.toLowerCase();
    const mime = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/jpeg";
    return c.newResponse(data, { headers: { "Content-Type": mime, "Cache-Control": "public, max-age=31536000" } }) as any;
  } catch (_) {
    throw new HTTPException(404, { message: "Not found" });
  }
});

// ============================================================
// OpenAPI spec endpoint
// ============================================================

api.doc31("/openapi.json", {
  openapi: "3.1.0",
  info: {
    title: "takkr API",
    version: "1.0.0",
    description: "REST API for takkr — collaborative sticky note boards. Authentication is via session cookie (set after passkey login).",
  },
  tags: [
    { name: "Authentication", description: "Passkey registration and sign-in" },
    { name: "Boards", description: "Board management, backgrounds, and viewport state" },
    { name: "Members", description: "Board membership" },
    { name: "Notes", description: "Sticky note CRUD, duplicate, and z-ordering" },
    { name: "Attachments", description: "File attachments on notes" },
    { name: "User", description: "User profile and preferences" },
  ],
});
