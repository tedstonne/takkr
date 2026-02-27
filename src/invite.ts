import { db } from "@/database";

export type Record = {
  id: number;
  board_id: number;
  token: string;
  created_by: string;
  active: number;
  created: string;
};

export type InviteWithBoard = Record & {
  board_slug: string;
  board_name: string;
  board_owner: string;
};

export const generate = (boardId: number, createdBy: string): Record => {
  const token = crypto.randomUUID();

  // Delete existing invite for this board, then insert new one
  db.query("DELETE FROM board_invites WHERE board_id = ?").run(boardId);

  const result = db
    .query(
      `INSERT INTO board_invites (board_id, token, created_by, active)
       VALUES (?, ?, ?, 1)
       RETURNING *`,
    )
    .get(boardId, token, createdBy);

  return result as Record;
};

export const revoke = (boardId: number): void => {
  db.query("UPDATE board_invites SET active = 0 WHERE board_id = ?").run(
    boardId,
  );
};

export const findByToken = (token: string): InviteWithBoard | null => {
  const result = db
    .query(
      `SELECT i.*, b.slug AS board_slug, b.name AS board_name, b.owner AS board_owner
       FROM board_invites i
       JOIN boards b ON b.id = i.board_id
       WHERE i.token = ? AND i.active = 1`,
    )
    .get(token);

  return (result as InviteWithBoard) || null;
};

export const forBoard = (boardId: number): Record | null => {
  const result = db
    .query(
      "SELECT * FROM board_invites WHERE board_id = ? AND active = 1",
    )
    .get(boardId);

  return (result as Record) || null;
};
