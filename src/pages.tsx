import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import * as Board from "@/board";
import { Layout } from "@/layout";
import * as Member from "@/member";
import { secure } from "@/middleware";
import * as Note from "@/note";
import * as User from "@/user";
import { BoardView, Help, Home, Join, Landing, Login } from "@/views";

const resolveFont = (c: any, username?: string): string => {
  // URL param override (backdoor)
  const paramFont = c.req.query("font");
  if (paramFont && User.FONTS[paramFont]) {
    setCookie(c, "takkr-font", paramFont, { maxAge: 365 * 24 * 60 * 60, path: "/" });
    return paramFont;
  }
  // Cookie override
  const cookieFont = getCookie(c, "takkr-font");
  if (cookieFont && User.FONTS[cookieFont]) return cookieFont;
  // User preference
  if (username) return User.getFont(username);
  return "caveat";
};

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
      <Layout
        title="Collaborative sticky notes for your ideas"
        id="landing"
        scripts={["/www/landing.js"]}
        description="Free, real-time collaborative sticky note boards. Drag and drop notes, invite teammates, use vim shortcuts and a command palette. Passkey login, no passwords. Open source."
      >
        <Landing />
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

// Sign in page
pages.get("/~/login", (c) => {
  return c.html(
    <Layout title="Sign In" id="login" scripts={["/www/auth.js"]}>
      <Login />
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
  const font = resolveFont(c, username);

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
  const attachmentCounts = Note.attachmentCountsForBoard(board.id);
  const preferredColor = User.getPreferredColor(username);
  const profile = User.getProfile(username);
  const ownedBoards = Board.owned(username).map((b) => ({ board: b, role: "owner" as const }));
  const memberBoards = Board.member(username).map((b) => ({ board: b, role: "member" as const }));
  const allBoards = [...ownedBoards, ...memberBoards];

  return c.html(
    <Layout title={slug} id="board" scripts={["/www/board.js"]} font={font}>
      <BoardView
        board={board}
        notes={notes}
        members={members}
        username={username}
        isOwner={isOwner}
        font={font}
        preferredColor={preferredColor}
        displayName={profile.displayName}
        email={profile.email}
        avatar={profile.avatar}
        allBoards={allBoards}
        attachmentCounts={attachmentCounts}
      />
    </Layout>,
  );
});
