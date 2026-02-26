import { db } from "@/database";

const MIN_LENGTH: number = 3;
const MAX_LENGTH: number = 50;
const PATTERN: RegExp = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

// Reserved slugs that can't be used for boards
const RESERVED: string[] = ["api", "www", "~", "__landing"];

export const BACKGROUNDS = [
  "plain",
  "grid",
  "cork",
  "chalkboard",
  "lined",
  "canvas",
  "blueprint",
  "doodle",
] as const;

export type Background = (typeof BACKGROUNDS)[number];

export type Record = {
  id: number;
  slug: string;
  name: string;
  owner: string;
  background: Background;
  created?: string;
};

export const setBackground = (id: number, bg: Background): void => {
  if (!BACKGROUNDS.includes(bg)) return;
  db.query("UPDATE boards SET background = ? WHERE id = ?").run(bg, id);
};

export const bySlug = (slug: string): Record | null => {
  const board = db.query("SELECT * FROM boards WHERE slug = ?").get(slug);

  return board ? (board as Record) : null;
};

export const byId = (id: number): Record | null => {
  const board = db.query("SELECT * FROM boards WHERE id = ?").get(id);

  return board ? (board as Record) : null;
};

export const owned = (username: string): Record[] => {
  const boards = db
    .query("SELECT * FROM boards WHERE owner = ? ORDER BY created DESC")
    .all(username);

  return boards as Record[];
};

export const member = (username: string): Record[] => {
  const boards = db
    .query(
      `SELECT b.* FROM boards b
       INNER JOIN members m ON m.board_id = b.id
       WHERE m.username = ?
       ORDER BY b.created DESC`,
    )
    .all(username);

  return boards as Record[];
};

export const all = (username: string): Record[] => {
  const ownedBoards = owned(username);
  const memberBoards = member(username);

  return [...ownedBoards, ...memberBoards];
};

export const access = (boardId: number, username: string): boolean => {
  const board = byId(boardId);
  if (!board) return false;

  // Owner always has access
  if (board.owner === username) return true;

  // Check if user is a member
  const membership = db
    .query("SELECT 1 FROM members WHERE board_id = ? AND username = ?")
    .get(boardId, username);

  return !!membership;
};

export const create = (slug: string, owner: string): Record => {
  const name = slug.replace(/-/g, " ");
  const result = db
    .query(
      "INSERT INTO boards (slug, name, owner) VALUES (?, ?, ?) RETURNING *",
    )
    .get(slug, name, owner);

  return result as Record;
};

// Get or create board - first visitor claims it
export const claim = (slug: string, username: string): Record => {
  const existing = bySlug(slug);
  if (existing) return existing;

  return create(slug, username);
};

export const remove = (id: number): void => {
  db.query("DELETE FROM boards WHERE id = ?").run(id);
};

export const slugify = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

// Viewport state
export type Viewport = {
  zoom: number;
  scroll_x: number;
  scroll_y: number;
};

export const getViewport = (username: string, boardId: number): Viewport | null => {
  const row = db.query(
    "SELECT zoom, scroll_x, scroll_y FROM board_viewports WHERE username = ? AND board_id = ?"
  ).get(username, boardId);
  return row ? (row as Viewport) : null;
};

export const setViewport = (username: string, boardId: number, zoom: number, scrollX: number, scrollY: number): void => {
  db.query(
    `INSERT INTO board_viewports (username, board_id, zoom, scroll_x, scroll_y)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(username, board_id) DO UPDATE SET zoom = ?, scroll_x = ?, scroll_y = ?`
  ).run(username, boardId, zoom, scrollX, scrollY, zoom, scrollX, scrollY);
};

export const valid = (slug: string): { ok: boolean; error?: string } => {
  const clean: string = slug.toLowerCase().trim();

  const rules: Array<{ test: () => boolean; error: string }> = [
    {
      test: () => clean.length >= MIN_LENGTH,
      error: `Slug must be at least ${MIN_LENGTH} characters`,
    },
    {
      test: () => clean.length <= MAX_LENGTH,
      error: `Slug must be at most ${MAX_LENGTH} characters`,
    },
    {
      test: () => !RESERVED.includes(clean),
      error: "This slug is reserved",
    },
    {
      test: () => PATTERN.test(clean),
      error:
        "Slug can only contain lowercase letters, numbers, and hyphens. Must start and end with a letter or number.",
    },
    {
      test: () => !bySlug(clean),
      error: "Slug already taken",
    },
  ];

  const error: string | undefined = rules.find((rule) => !rule.test())?.error;

  return error ? { ok: false, error } : { ok: true };
};
