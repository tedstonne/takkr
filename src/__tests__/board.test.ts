import { beforeAll, describe, expect, test } from "bun:test";
import "@/schema";
import * as Board from "@/board";
import { db } from "@/database";
import * as User from "@/user";

describe("board", () => {
  beforeAll(() => {
    db.exec("DELETE FROM members");
    db.exec("DELETE FROM notes");
    db.exec("DELETE FROM boards");
    db.exec("DELETE FROM users");
    User.create({
      username: "owner1",
      credential_id: "bc1",
      public_key: Buffer.from([1]),
      counter: 0,
    } as User.Record);
    User.create({
      username: "member1",
      credential_id: "bc2",
      public_key: Buffer.from([2]),
      counter: 0,
    } as User.Record);
  });

  test("BACKGROUNDS has expected entries", () => {
    expect(Board.BACKGROUNDS).toContain("grid");
    expect(Board.BACKGROUNDS).toContain("cork");
    expect(Board.BACKGROUNDS).toContain("blueprint");
    expect(Board.BACKGROUNDS.length).toBe(8);
  });

  test("create a board", () => {
    const board = Board.create("my-board", "owner1");
    expect(board.slug).toBe("my-board");
    expect(board.owner).toBe("owner1");
    expect(board.name).toBe("my board");
    expect(board.background).toBe("grid");
  });

  test("bySlug finds board", () => {
    expect(Board.bySlug("my-board")).not.toBeNull();
    expect(Board.bySlug("my-board")!.slug).toBe("my-board");
  });

  test("bySlug returns null for unknown", () => {
    expect(Board.bySlug("nope")).toBeNull();
  });

  test("byId finds board", () => {
    const board = Board.bySlug("my-board")!;
    expect(Board.byId(board.id)).not.toBeNull();
  });

  test("byId returns null for unknown", () => {
    expect(Board.byId(99999)).toBeNull();
  });

  test("claim returns existing board", () => {
    const board = Board.claim("my-board", "owner1");
    expect(board.slug).toBe("my-board");
  });

  test("claim creates new board", () => {
    const board = Board.claim("new-board", "owner1");
    expect(board.slug).toBe("new-board");
    expect(board.owner).toBe("owner1");
  });

  test("owned returns boards owned by user", () => {
    const boards = Board.owned("owner1");
    expect(boards.length).toBeGreaterThanOrEqual(2);
    expect(boards.every((b) => b.owner === "owner1")).toBe(true);
  });

  test("member returns boards user is member of", () => {
    const board = Board.bySlug("my-board")!;
    db.exec(
      `INSERT INTO members (board_id, username, invited_by) VALUES (${board.id}, 'member1', 'owner1')`,
    );
    const boards = Board.member("member1");
    expect(boards.length).toBe(1);
  });

  test("all returns owned + member boards", () => {
    expect(Board.all("member1").length).toBeGreaterThanOrEqual(1);
  });

  test("access returns true for owner", () => {
    const board = Board.bySlug("my-board")!;
    expect(Board.access(board.id, "owner1")).toBe(true);
  });

  test("access returns true for member", () => {
    const board = Board.bySlug("my-board")!;
    expect(Board.access(board.id, "member1")).toBe(true);
  });

  test("access returns false for stranger", () => {
    const board = Board.bySlug("my-board")!;
    expect(Board.access(board.id, "stranger")).toBe(false);
  });

  test("access returns false for nonexistent board", () => {
    expect(Board.access(99999, "owner1")).toBe(false);
  });

  test("setBackground changes background", () => {
    const board = Board.bySlug("my-board")!;
    Board.setBackground(board.id, "cork");
    expect(Board.bySlug("my-board")!.background).toBe("cork");
  });

  test("setBackground ignores invalid", () => {
    const board = Board.bySlug("my-board")!;
    Board.setBackground(board.id, "nope" as any);
    expect(Board.bySlug("my-board")!.background).toBe("cork");
  });

  test("remove deletes board", () => {
    const board = Board.create("to-delete", "owner1");
    Board.remove(board.id);
    expect(Board.bySlug("to-delete")).toBeNull();
  });

  test("slugify converts name to slug", () => {
    expect(Board.slugify("My Board Name")).toBe("my-board-name");
    expect(Board.slugify("  Hello World  ")).toBe("hello-world");
    expect(Board.slugify("special!@#chars")).toBe("special-chars");
  });

  test("valid rejects short slugs", () => {
    expect(Board.valid("ab").ok).toBe(false);
  });

  test("valid rejects long slugs", () => {
    expect(Board.valid("a".repeat(51)).ok).toBe(false);
  });

  test("valid rejects reserved slugs", () => {
    expect(Board.valid("api").ok).toBe(false);
    expect(Board.valid("www").ok).toBe(false);
  });

  test("valid rejects invalid pattern", () => {
    expect(Board.valid("-bad").ok).toBe(false);
    expect(Board.valid("has spaces").ok).toBe(false);
  });

  test("valid rejects existing slug", () => {
    expect(Board.valid("my-board").ok).toBe(false);
  });

  test("valid accepts good slug", () => {
    expect(Board.valid("fresh-board").ok).toBe(true);
  });

  // Viewport
  test("getViewport returns null when none set", () => {
    const board = Board.bySlug("my-board")!;
    expect(Board.getViewport("owner1", board.id)).toBeNull();
  });

  test("setViewport stores viewport state", () => {
    const board = Board.bySlug("my-board")!;
    Board.setViewport("owner1", board.id, 0.75, 100, 200);
    const vp = Board.getViewport("owner1", board.id);
    expect(vp).not.toBeNull();
    expect(vp!.zoom).toBe(0.75);
    expect(vp!.scroll_x).toBe(100);
    expect(vp!.scroll_y).toBe(200);
  });

  test("setViewport upserts on conflict", () => {
    const board = Board.bySlug("my-board")!;
    Board.setViewport("owner1", board.id, 1.5, 300, 400);
    const vp = Board.getViewport("owner1", board.id);
    expect(vp!.zoom).toBe(1.5);
    expect(vp!.scroll_x).toBe(300);
    expect(vp!.scroll_y).toBe(400);
  });

  test("viewport is per-user per-board", () => {
    const board = Board.bySlug("my-board")!;
    Board.setViewport("member1", board.id, 0.5, 10, 20);
    const vp1 = Board.getViewport("owner1", board.id);
    const vp2 = Board.getViewport("member1", board.id);
    expect(vp1!.zoom).toBe(1.5);
    expect(vp2!.zoom).toBe(0.5);
  });
});
