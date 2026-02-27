import { db } from "@/database";

export type Record = {
  id: number;
  board_id: number;
  username: string;
  invited_by: string;
  seen: number;
};

export type UnseenInvitation = {
  id: number;
  board_id: number;
  board_slug: string;
  board_name: string;
  invited_by: string;
};

export const forBoard = (boardId: number): Record[] => {
  const members = db
    .query("SELECT * FROM members WHERE board_id = ?")
    .all(boardId);

  return members as Record[];
};

export const exists = (boardId: number, username: string): boolean => {
  const member = db
    .query("SELECT 1 FROM members WHERE board_id = ? AND username = ?")
    .get(boardId, username);

  return !!member;
};

export const add = (
  boardId: number,
  username: string,
  invitedBy: string,
  seen: number = 0,
): Record => {
  const result = db
    .query(
      `INSERT INTO members (board_id, username, invited_by, seen)
       VALUES (?, ?, ?, ?)
       RETURNING *`,
    )
    .get(boardId, username, invitedBy, seen);

  return result as Record;
};

export const remove = (boardId: number, username: string): void => {
  db.query("DELETE FROM members WHERE board_id = ? AND username = ?").run(
    boardId,
    username,
  );
};

export const unseen = (username: string): UnseenInvitation[] => {
  const rows = db
    .query(
      `SELECT m.id, m.board_id, b.slug AS board_slug, b.name AS board_name, m.invited_by
       FROM members m
       JOIN boards b ON b.id = m.board_id
       WHERE m.username = ? AND m.seen = 0`,
    )
    .all(username);

  return rows as UnseenInvitation[];
};

export const unseenCount = (username: string): number => {
  const row = db
    .query(
      "SELECT COUNT(*) AS count FROM members WHERE username = ? AND seen = 0",
    )
    .get(username) as { count: number };

  return row.count;
};

export const markSeen = (username: string): void => {
  db.query("UPDATE members SET seen = 1 WHERE username = ? AND seen = 0").run(
    username,
  );
};
