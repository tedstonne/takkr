import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import * as Board from "@/board";
import * as session from "@/session";

const unauthorized = (): HTTPException => {
  return new HTTPException(401, { message: "Unauthorized" });
};

const forbidden = (): HTTPException => {
  return new HTTPException(403, { message: "Forbidden" });
};

const authenticate = (c: Context): string | null => {
  const sessionToken: string | undefined = getCookie(c, "session");
  const sessionUser: string | null = session.validate(sessionToken);

  return sessionUser;
};

const required = createMiddleware(async (c, next) => {
  const username: string | null = authenticate(c);
  if (!username) throw unauthorized();

  c.set("username", username);
  await next();
});

const optional = createMiddleware(async (c, next) => {
  const username: string | null = authenticate(c);
  if (username) c.set("username", username);

  await next();
});

export const secure = Object.assign(required, { optional });

// Board access middleware - checks user can access the board
export const boardAccess = createMiddleware(async (c, next) => {
  const username: string = c.get("username");
  const slug: string = c.req.param("slug");

  const board = Board.bySlug(slug);
  if (!board) throw new HTTPException(404, { message: "Board not found" });

  const hasAccess = Board.access(board.id, username);
  if (!hasAccess) throw forbidden();

  c.set("board", board);
  await next();
});

// Board owner middleware - checks user is the owner
export const boardOwner = createMiddleware(async (c, next) => {
  const username: string = c.get("username");
  const board: Board.Record = c.get("board");

  if (board.owner !== username) throw forbidden();

  await next();
});
