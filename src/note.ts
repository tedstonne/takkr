import { db } from "@/database";
import { COLORS, type Color } from "@/shared";

export { COLORS, type Color };

export type Record = {
  id: number;
  board_id: number;
  content: string;
  description: string;
  tags: string;
  checklist: string;
  x: number;
  y: number;
  z: number;
  color: Color;
  created_by: string;
  assigned_to: string;
  completed: string;
  deleted_at: string;
  created?: string;
};

export type Attachment = {
  id: number;
  note_id: number;
  filename: string;
  mime_type: string;
  size: number;
  path: string;
  created?: string;
};

export const byId = (id: number): Record | null => {
  const note = db.query("SELECT * FROM notes WHERE id = ?").get(id);

  return note ? (note as Record) : null;
};

export const forBoard = (boardId: number): Record[] => {
  const notes = db
    .query("SELECT * FROM notes WHERE board_id = ? AND (deleted_at IS NULL OR deleted_at = '') AND (completed IS NULL OR completed = '') ORDER BY z ASC, id ASC")
    .all(boardId);

  return notes as Record[];
};

export const completedForBoard = (boardId: number): Record[] => {
  return db
    .query("SELECT * FROM notes WHERE board_id = ? AND (deleted_at IS NULL OR deleted_at = '') AND completed != '' ORDER BY z ASC, id ASC")
    .all(boardId) as Record[];
};

export const deletedForBoard = (boardId: number): Record[] => {
  return db
    .query("SELECT * FROM notes WHERE board_id = ? AND deleted_at != '' ORDER BY z ASC, id ASC")
    .all(boardId) as Record[];
};

export const softDelete = (id: number): Record | null => {
  const result = db
    .query("UPDATE notes SET deleted_at = ? WHERE id = ? RETURNING *")
    .get(new Date().toISOString(), id);
  return result ? (result as Record) : null;
};

export const restore = (id: number): Record | null => {
  const result = db
    .query("UPDATE notes SET deleted_at = '' WHERE id = ? RETURNING *")
    .get(id);
  return result ? (result as Record) : null;
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
  data: Partial<Pick<Record, "content" | "description" | "tags" | "checklist" | "x" | "y" | "z" | "color" | "assigned_to" | "completed">>,
): Record | null => {
  const note = byId(id);
  if (!note) return null;

  const content = data.content ?? note.content;
  const description = data.description ?? note.description;
  const tags = data.tags ?? note.tags;
  const checklist = data.checklist ?? note.checklist;
  const x = data.x ?? note.x;
  const y = data.y ?? note.y;
  const z = data.z ?? note.z;
  const color = data.color ?? note.color;
  const assigned_to = data.assigned_to ?? note.assigned_to ?? "";
  const completed = data.completed ?? note.completed ?? "";

  const result = db
    .query(
      `UPDATE notes SET content = ?, description = ?, tags = ?, checklist = ?, x = ?, y = ?, z = ?, color = ?, assigned_to = ?, completed = ?
       WHERE id = ?
       RETURNING *`,
    )
    .get(content, description, tags, checklist, x, y, z, color, assigned_to, completed, id);

  return result as Record;
};

export const remove = (id: number): void => {
  db.query("DELETE FROM notes WHERE id = ?").run(id);
};

// Attachment helpers
export const attachments = (noteId: number): Attachment[] => {
  return db.query("SELECT * FROM attachments WHERE note_id = ? ORDER BY id ASC").all(noteId) as Attachment[];
};

export const attachmentById = (id: number): Attachment | null => {
  const a = db.query("SELECT * FROM attachments WHERE id = ?").get(id);
  return a ? (a as Attachment) : null;
};

export const addAttachment = (noteId: number, filename: string, mimeType: string, size: number, path: string): Attachment => {
  const result = db.query(
    `INSERT INTO attachments (note_id, filename, mime_type, size, path) VALUES (?, ?, ?, ?, ?) RETURNING *`
  ).get(noteId, filename, mimeType, size, path);
  return result as Attachment;
};

export const removeAttachment = (id: number): void => {
  db.query("DELETE FROM attachments WHERE id = ?").run(id);
};

export const attachmentCount = (noteId: number): number => {
  const r = db.query("SELECT COUNT(*) as cnt FROM attachments WHERE note_id = ?").get(noteId) as { cnt: number };
  return r.cnt;
};

export const attachmentCountsForBoard = (boardId: number): Map<number, number> => {
  const rows = db.query(
    "SELECT a.note_id, COUNT(*) as cnt FROM attachments a JOIN notes n ON a.note_id = n.id WHERE n.board_id = ? GROUP BY a.note_id"
  ).all(boardId) as { note_id: number; cnt: number }[];
  const map = new Map<number, number>();
  for (const r of rows) map.set(r.note_id, r.cnt);
  return map;
};

export const bringToFront = (id: number, boardId: number): Record | null => {
  const maxZ = db
    .query("SELECT MAX(z) as max FROM notes WHERE board_id = ?")
    .get(boardId) as { max: number | null } | null;
  const z = (maxZ?.max ?? 0) + 1;

  return update(id, { z });
};
