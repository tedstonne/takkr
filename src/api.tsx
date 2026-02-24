import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { Hono } from "hono";
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

type Variables = {
  username: string;
  board: Board.Record;
};

export const api = new Hono<{ Variables: Variables }>();

// Auth routes
api.post("/user/register", async (c) => {
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

api.post("/user/register/verify", async (c) => {
  const body = await c.req.parseBody();
  const username = body.username as string;
  const decoded: string = atob(body.credential as string);
  const credential: RegistrationResponseJSON = JSON.parse(decoded);

  try {
    const sessionToken = await auth.verify(username, credential);

    setCookie(c, "session", sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    const boards = Board.all(username);

    return c.html(<Home username={username} boards={boards} />);
  } catch (err) {
    return c.html(<Alert message={(err as Error).message} />);
  }
});

api.post("/user/discover", async (c) => {
  const options = await auth.discover();

  return c.json(options);
});

api.post("/user/discover/verify", async (c) => {
  const body = await c.req.parseBody();
  const decoded: string = atob(body.credential as string);
  const credential: AuthenticationResponseJSON = JSON.parse(decoded);

  try {
    const { session, username } = await auth.identify(credential);

    setCookie(c, "session", session, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    const boards = Board.all(username);

    return c.html(<Home username={username} boards={boards} />);
  } catch (_err) {
    return c.html(<Alert message="Sign-in failed. Please try again." />);
  }
});

api.post("/user/logout", (c) => {
  deleteCookie(c, "session");

  return c.redirect("/");
});

// Board routes
api.get("/boards", secure, (c) => {
  const username: string = c.get("username");
  const boards = Board.all(username);

  return c.json(boards);
});

api.delete("/boards/:slug", secure, boardAccess, boardOwner, (c) => {
  const board: Board.Record = c.get("board");

  Board.remove(board.id);

  return c.redirect("/");
});

// SSE events for board
api.get("/boards/:slug/events", secure, boardAccess, (c) => {
  const HEARTBEAT_INTERVAL_MS: number = Number(
    process.env.SSE_HEARTBEAT_MS || 15000,
  );
  const board: Board.Record = c.get("board");

  const encoder: TextEncoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer: WritableStreamDefaultWriter = writable.getWriter();
  const id: string = events.connect(writer, board.id);

  // Send initial heartbeat immediately
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

// Note routes
api.post("/boards/:slug/notes", secure, boardAccess, async (c) => {
  const board: Board.Record = c.get("board");
  const username: string = c.get("username");
  const body = await c.req.parseBody();

  const content = body.content as string;
  const color = (body.color as Note.Color) || "yellow";
  const x = body.x ? Number(body.x) : 100 + Math.random() * 200;
  const y = body.y ? Number(body.y) : 100 + Math.random() * 200;

  if (!content) throw new HTTPException(400, { message: "Content required" });

  const note = Note.create(board.id, content, username, x, y, color);

  // Broadcast to other clients
  const html = <Takkr note={note} />;
  const htmlString = html.toString();
  events.broadcast(board.id, events.Event.Note.Created, htmlString);

  return c.html(<Takkr note={note} />);
});

api.put("/notes/:id", secure, async (c) => {
  const username: string = c.get("username");
  const noteId = Number(c.req.param("id"));
  const body = await c.req.parseBody();

  const note = Note.byId(noteId);
  if (!note) throw new HTTPException(404, { message: "Note not found" });

  // Check access to board
  const hasAccess = Board.access(note.board_id, username);
  if (!hasAccess) throw new HTTPException(403, { message: "Forbidden" });

  const data: Partial<Note.Record> = {};
  if (body.content) data.content = body.content as string;
  if (body.x) data.x = Number(body.x);
  if (body.y) data.y = Number(body.y);
  if (body.z) data.z = Number(body.z);
  if (body.color) data.color = body.color as Note.Color;

  const updated = Note.update(noteId, data);
  if (!updated) throw new HTTPException(404, { message: "Note not found" });

  // Only broadcast if not a silent update (position-only updates during drag)
  const silent = c.req.query("silent") === "1";
  if (!silent) {
    const html = <Takkr note={updated} oob />;
    const htmlString = html.toString();
    events.broadcast(updated.board_id, events.Event.Note.Updated, htmlString);
  }

  return c.html(<Takkr note={updated} />);
});

api.delete("/notes/:id", secure, async (c) => {
  const username: string = c.get("username");
  const noteId = Number(c.req.param("id"));

  const note = Note.byId(noteId);
  if (!note) throw new HTTPException(404, { message: "Note not found" });

  // Check access to board
  const hasAccess = Board.access(note.board_id, username);
  if (!hasAccess) throw new HTTPException(403, { message: "Forbidden" });

  Note.remove(noteId);

  // Broadcast deletion
  events.broadcast(
    note.board_id,
    events.Event.Note.Deleted,
    `<script>document.querySelector('[data-id="${noteId}"]')?.remove()</script>`,
  );

  return c.text("OK");
});

// Bring note to front
api.post("/notes/:id/front", secure, async (c) => {
  const username: string = c.get("username");
  const noteId = Number(c.req.param("id"));

  const note = Note.byId(noteId);
  if (!note) throw new HTTPException(404, { message: "Note not found" });

  const hasAccess = Board.access(note.board_id, username);
  if (!hasAccess) throw new HTTPException(403, { message: "Forbidden" });

  const updated = Note.bringToFront(noteId, note.board_id);
  if (!updated) throw new HTTPException(404, { message: "Note not found" });

  return c.json({ z: updated.z });
});

// Member routes
api.post(
  "/boards/:slug/members",
  secure,
  boardAccess,
  boardOwner,
  async (c) => {
    const board: Board.Record = c.get("board");
    const inviter: string = c.get("username");
    const body = await c.req.parseBody();
    const username = body.username as string;

    if (!username)
      throw new HTTPException(400, { message: "Username required" });

    // Check user exists
    if (!User.exists(username))
      throw new HTTPException(404, { message: "User not found" });

    // Check not already a member
    if (Member.exists(board.id, username))
      throw new HTTPException(409, { message: "Already a member" });

    // Check not the owner
    if (board.owner === username)
      throw new HTTPException(400, { message: "User is the owner" });

    Member.add(board.id, username, inviter);

    // Broadcast member joined
    events.broadcast(
      board.id,
      events.Event.Member.Joined,
      `${username} joined the board`,
    );

    return c.redirect(`/${board.slug}`);
  },
);

api.delete(
  "/boards/:slug/members/:username",
  secure,
  boardAccess,
  boardOwner,
  (c) => {
    const board: Board.Record = c.get("board");
    const username = c.req.param("username");

    Member.remove(board.id, username);

    // Broadcast member left
    events.broadcast(
      board.id,
      events.Event.Member.Left,
      `${username} left the board`,
    );

    return c.redirect(`/${board.slug}`);
  },
);
