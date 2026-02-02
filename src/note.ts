import { db } from "@/database";

export type Color = "yellow" | "pink" | "green" | "blue" | "orange";

export const COLORS: Color[] = ["yellow", "pink", "green", "blue", "orange"];

export type Record = {
  id: number;
  board_id: number;
  content: string;
  x: number;
  y: number;
  z: number;
  color: Color;
  created_by: string;
  created?: string;
};

export const byId = (id: number): Record | null => {
  const note = db.query("SELECT * FROM notes WHERE id = ?").get(id);

  return note ? (note as Record) : null;
};

export const forBoard = (boardId: number): Record[] => {
  const notes = db
    .query("SELECT * FROM notes WHERE board_id = ? ORDER BY z ASC, id ASC")
    .all(boardId);

  return notes as Record[];
};

export const create = (
  boardId: number,
  content: string,
  createdBy: string,
  x = 100,
  y = 100,
  color: Color = "yellow",
): Record => {
  // Get the highest z-index for this board
  const maxZ = db
    .query("SELECT MAX(z) as max FROM notes WHERE board_id = ?")
    .get(boardId) as { max: number | null } | null;
  const z = (maxZ?.max ?? 0) + 1;

  const result = db
    .query(
      `INSERT INTO notes (board_id, content, x, y, z, color, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .get(boardId, content, x, y, z, color, createdBy);

  return result as Record;
};

export const update = (
  id: number,
  data: Partial<Pick<Record, "content" | "x" | "y" | "z" | "color">>,
): Record | null => {
  const note = byId(id);
  if (!note) return null;

  const content = data.content ?? note.content;
  const x = data.x ?? note.x;
  const y = data.y ?? note.y;
  const z = data.z ?? note.z;
  const color = data.color ?? note.color;

  const result = db
    .query(
      `UPDATE notes SET content = ?, x = ?, y = ?, z = ?, color = ?
       WHERE id = ?
       RETURNING *`,
    )
    .get(content, x, y, z, color, id);

  return result as Record;
};

export const remove = (id: number): void => {
  db.query("DELETE FROM notes WHERE id = ?").run(id);
};

export const bringToFront = (id: number, boardId: number): Record | null => {
  const maxZ = db
    .query("SELECT MAX(z) as max FROM notes WHERE board_id = ?")
    .get(boardId) as { max: number | null } | null;
  const z = (maxZ?.max ?? 0) + 1;

  return update(id, { z });
};
