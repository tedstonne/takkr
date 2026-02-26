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
  description: "Initiates WebAuthn passkey registration for a new user. Pass the desired username as a query parameter. Returns PublicKeyCredentialCreationOptions that your client passes to navigator.credentials.create(). Username must be 3-30 chars, lowercase alphanumeric + hyphens. Returns 409 if the username is already taken.",
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
  description: "Verifies the WebAuthn attestation response from the browser. On success, creates the user account, sets an HTTP-only session cookie (30-day expiry), and returns the user's home page HTML. The credential should be base64-encoded JSON from navigator.credentials.create().",
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
  description: "Initiates WebAuthn discoverable credential authentication. Returns PublicKeyCredentialRequestOptions for navigator.credentials.get(). No username needed — the browser presents all registered passkeys for this origin.",
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
  description: "Verifies the WebAuthn assertion response from the browser. On success, identifies the user from the credential, sets an HTTP-only session cookie (30-day expiry), and returns the home page. Returns an error alert HTML if verification fails.",
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
  description: "Clears the session cookie and redirects to the landing page. The session token is invalidated server-side.",
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
  description: "Returns all boards the authenticated user can access, including boards they own and boards they've been invited to as a member. Each board includes its slug, name, owner, background, and creation date.",
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
  description: "Permanently delete a board and all its notes, attachments, and member associations. This action cannot be undone. Only the board owner can delete it. Redirects to the home page after deletion.",
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
  description: "Set the visual background style for a board. Available backgrounds: plain (white), grid (dotted), cork (corkboard texture), chalkboard (green chalk), lined (notebook), canvas (linen texture), blueprint (blue grid), doodle (playful sketches). Owner only.",
  middleware: [secure, boardAccess, boardOwner] as any,
  request: { params: S.SlugParam },
  responses: {
    200: { description: "Updated background", content: { "application/json": { schema: z.object({ ok: z.boolean(), background: z.string() }) } } },
  },
});

// @ts-expect-error — Hono OpenAPI handler return type
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
  description: "Retrieve the authenticated user's saved viewport for this board. The viewport stores the zoom level and scroll position so the user returns to exactly where they left off. Each user has their own independent viewport per board. Returns defaults (zoom: 1, scroll: 0,0) if no viewport has been saved yet.",
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
  description: "Persist the user's current viewport for this board. The client debounces this call (1s after last change) to avoid excessive saves during scroll/zoom. Zoom is clamped to 0.25 (25%) minimum and 2.0 (200%) maximum. Scroll values are stored as pixel offsets.",
  middleware: [secure, boardAccess] as any,
  request: { params: S.SlugParam },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: S.OkResponse } } },
  },
});

// @ts-expect-error — Hono OpenAPI handler return type
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
  description: "Add an existing user to the board as a collaborator. The invited user will be able to view, create, edit, and delete notes on the board. Owner only. Returns 404 if the user doesn't exist, 409 if they're already a member, 400 if you try to invite the owner. Broadcasts a member:joined SSE event.",
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
  description: "Remove a collaborator from the board. They will lose access immediately. Owner only. Broadcasts a member:left SSE event.",
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
  description: "Create a new sticky note on the board. The note appears as a draggable card with the given title and color. If x/y are omitted, the note is placed at a random position near the top-left. The z-index is automatically set to be above all existing notes. Returns the rendered HTML card element. Broadcasts a note:created SSE event to all connected clients so the note appears in real-time for collaborators.",
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
  description: "Retrieve a note's full data including content, description, position, color, tags, checklist, and all file attachments. Used by the card detail overlay to show the back of the card with rich content. Requires access to the note's board.",
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
  description: "Update any combination of note fields. Only provided fields are changed — omitted fields remain untouched. Use this for title edits, position updates (drag), color changes, description edits, tag management, and checklist updates. Pass ?silent=1 as a query parameter to suppress the SSE broadcast (used during drag operations to avoid flooding collaborators with intermediate positions). Broadcasts note:updated SSE event with OOB swap HTML unless silent.",
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
  if (body.assigned_to !== undefined) data.assigned_to = body.assigned_to as string;
  if (body.due_date !== undefined) data.due_date = (body.due_date as string) || null;
  if (body.priority !== undefined) data.priority = (body.priority as string) || null;
  if (body.status !== undefined) data.status = body.status as string;

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
  description: "Create an exact copy of a note with a 30px offset in both x and y directions so the duplicate doesn't stack exactly on top. Copies the title, color, description, tags, and checklist. The duplicate gets a new ID and the authenticated user as its creator. File attachments are NOT copied. Broadcasts note:created SSE event. Keyboard shortcut: 'd' in the board view.",
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
  Note.update(dup.id, { description: note.description, tags: note.tags, checklist: note.checklist, due_date: note.due_date, priority: note.priority, status: note.status });
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
  description: "Permanently delete a note and all its file attachments from disk. Broadcasts a note:deleted SSE event that triggers client-side removal of the card element. Keyboard shortcut: 'x' or Delete/Backspace in the board view. This action cannot be undone.",
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
  description: "Move a note to the top of the visual stack by setting its z-index to one higher than the current maximum on the board. Used when clicking/dragging a note to ensure it renders above all others. Returns the new z-index value.",
  middleware: [secure] as any,
  request: { params: S.NoteIdParam },
  responses: {
    200: { description: "New z-index", content: { "application/json": { schema: z.object({ z: z.number() }) } } },
  },
});

// @ts-expect-error — Hono OpenAPI handler return type
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
  description: "Upload a file attachment to a note. Accepts any file type up to 5MB via multipart form data. Files are stored on disk in the uploads/ directory with a generated filename (noteId_timestamp.ext). The original filename, MIME type, and size are stored in the database. Drag files onto a card in the board view to trigger this endpoint.",
  middleware: [secure] as any,
  request: { params: S.NoteIdParam },
  responses: {
    200: { description: "Attachment metadata", content: { "application/json": { schema: S.AttachmentResponse } } },
  },
});

// @ts-expect-error — Hono OpenAPI handler return type
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
  description: "List all file attachments for a note. Returns an array of attachment metadata including filename, MIME type, size in bytes, and storage path. Used by the card detail overlay to show the attachment list with download links.",
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
  description: "Serve an attachment file with its original MIME type. The file is returned inline (Content-Disposition: inline) so images and PDFs can be previewed in the browser. Requires access to the note's board.",
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
  description: "Delete a file attachment. Removes the file from disk and the metadata from the database. Requires access to the note's board. This action cannot be undone.",
  middleware: [secure] as any,
  request: { params: S.AttachmentIdParam },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: S.OkResponse } } },
  },
});

// @ts-expect-error — Hono OpenAPI handler return type
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
  description: "Returns the authenticated user's profile including username, display name, email, avatar filename, preferred font, and preferred note color. Used by the settings modal to populate profile fields.",
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
  description: "Returns the user's visual preferences: handwriting font, preferred note color, and preferred board background. These are applied when creating new notes or boards.",
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
  description: "Set the user's display name shown to collaborators. This appears in the board header and member list. Whitespace is trimmed. Can be empty to clear the display name (falls back to username).",
  middleware: [secure] as any,
  responses: {
    200: { description: "OK", content: { "application/json": { schema: S.OkResponse } } },
  },
});

// @ts-expect-error — Hono OpenAPI handler return type
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
  description: "Set the user's email address. Used for Gravatar avatar fallback and contact purposes. Not validated for format — any string is accepted. Whitespace is trimmed.",
  middleware: [secure] as any,
  responses: {
    200: { description: "OK", content: { "application/json": { schema: S.OkResponse } } },
  },
});

// @ts-expect-error — Hono OpenAPI handler return type
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
  description: "Set the handwriting font used for note titles across all boards. Available fonts: caveat (default), indie-flower, kalam, parisienne, cookie, handlee, sofia, gochi-hand, grand-hotel. The font is loaded from Google Fonts. Returns 400 for invalid font names.",
  middleware: [secure] as any,
  responses: {
    200: { description: "OK", content: { "application/json": { schema: z.object({ ok: z.boolean(), font: z.string() }) } } },
  },
});

// @ts-expect-error — Hono OpenAPI handler return type
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
  description: "Set the default color for new notes. Available colors: yellow, pink, green, blue, orange. This color is pre-selected in the new note dialog. Individual notes can still be changed to any color after creation.",
  middleware: [secure] as any,
  responses: {
    200: { description: "OK", content: { "application/json": { schema: z.object({ ok: z.boolean(), color: z.string() }) } } },
  },
});

// @ts-expect-error — Hono OpenAPI handler return type
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
  description: "Set the user's preferred board background. This background is used as the default when creating new boards. Existing boards keep their own background setting.",
  middleware: [secure] as any,
  responses: {
    200: { description: "OK", content: { "application/json": { schema: z.object({ ok: z.boolean(), background: z.string() }) } } },
  },
});

// @ts-expect-error — Hono OpenAPI handler return type
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
  description: "Upload a profile avatar image. Accepts JPEG, PNG, GIF, or WebP up to 2MB via multipart form data. The previous avatar file is automatically deleted from disk. The avatar is displayed in the board header, settings modal, and member lists.",
  middleware: [secure] as any,
  responses: {
    200: { description: "Avatar filename", content: { "application/json": { schema: z.object({ ok: z.boolean(), avatar: z.string() }) } } },
  },
});

// @ts-expect-error — Hono OpenAPI handler return type
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
  description: "Serve a user's avatar image file. This is a public endpoint — no authentication required — so avatars can be displayed to anyone viewing a board. Response is cached for 1 year (Cache-Control: public, max-age=31536000). Returns 404 if the file doesn't exist.",
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
    description: `REST API for **takkr** — free, real-time collaborative sticky note boards.

## Authentication
All endpoints (except avatar serving and the auth flow itself) require a valid session cookie. Sessions are created via WebAuthn passkey authentication — no passwords. Session cookies are HTTP-only, secure, SameSite=Lax, with a 30-day expiry.

## Real-time Updates
Board changes are broadcast via Server-Sent Events (SSE). Connect to \`/api/boards/{slug}/events\` to receive live updates. Events include note creation, updates, deletion, and member changes.

## Content Types
Most write endpoints accept \`application/x-www-form-urlencoded\` bodies. File uploads use \`multipart/form-data\`. Read endpoints return JSON unless noted (some return HTML for HTMX integration).

## Error Handling
All errors return appropriate HTTP status codes with a JSON or text error message: 400 (bad request), 401 (unauthorized), 403 (forbidden), 404 (not found), 409 (conflict).`,
  },
  tags: [
    { name: "Authentication", description: "WebAuthn passkey registration and discoverable credential sign-in. No passwords — authentication uses biometrics or security keys via the Web Authentication API." },
    { name: "Boards", description: "Create, manage, and configure boards. Each board is an infinite canvas for sticky notes. Boards are claimed by visiting any URL (first visitor owns it). Includes background customization and per-user viewport persistence." },
    { name: "Members", description: "Invite and manage board collaborators. Members can view, create, edit, and delete notes. Only the board owner can manage membership." },
    { name: "Notes", description: "CRUD operations for sticky notes. Notes have a title, color, position (x/y), z-index (stacking), description (rich text back-of-card), tags, and checklists. All changes are broadcast in real-time via SSE." },
    { name: "Attachments", description: "File attachments on notes. Upload files up to 5MB per attachment. Files are stored on disk and served with their original MIME type. Drag files onto cards in the UI to attach them." },
    { name: "User", description: "User profile and visual preferences. Customize your display name, email, avatar, handwriting font, default note color, and preferred board background." },
  ],
});
