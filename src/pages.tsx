import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import * as Board from "@/board";
import { Layout } from "@/layout";
import * as Member from "@/member";
import { secure } from "@/middleware";
import * as Note from "@/note";
import { BoardView, Help, Home, Join, Login } from "@/views";

type Variables = {
  username: string;
  board: Board.Record;
};

export const pages = new Hono<{ Variables: Variables }>();

// Home - login or list recent boards
pages.get("/", secure.optional, (c) => {
  const username: string | undefined = c.get("username");

  if (!username) {
    return c.html(
      <Layout title="Welcome" id="login" scripts={["/www/auth.js"]}>
        <Login />
      </Layout>,
    );
  }

  const boards = Board.all(username);

  return c.html(
    <Layout title="Home" id="home" scripts={["/www/home.js"]}>
      <Home username={username} boards={boards} />
    </Layout>,
  );
});

// Join / Register page
pages.get("/~/join", (c) => {
  return c.html(
    <Layout title="Join" id="join" scripts={["/www/auth.js"]}>
      <Join />
    </Layout>,
  );
});

// Help page
pages.get("/~/help", (c) => {
  return c.html(
    <Layout title="Help" id="help">
      <Help />
    </Layout>,
  );
});

// Board view - auto-create on first visit (first-come claims it)
pages.get("/:slug", secure, (c) => {
  const username: string = c.get("username");
  const slug: string = c.req.param("slug");

  // Validate slug
  if (slug.startsWith("~") || slug.startsWith("api")) {
    throw new HTTPException(404, { message: "Not found" });
  }

  // Get or create board
  const board = Board.claim(slug, username);

  // Check access
  const hasAccess = Board.access(board.id, username);
  if (!hasAccess) {
    throw new HTTPException(403, { message: "This board is private" });
  }

  const notes = Note.forBoard(board.id);
  const members = Member.forBoard(board.id);
  const isOwner = board.owner === username;

  return c.html(
    <Layout title={slug} id="board" scripts={["/www/board.js"]}>
      <BoardView
        board={board}
        notes={notes}
        members={members}
        username={username}
        isOwner={isOwner}
      />
    </Layout>,
  );
});
