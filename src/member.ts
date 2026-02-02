import { db } from "@/database";

export type Record = {
  id: number;
  board_id: number;
  username: string;
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
): Record => {
  const result = db
    .query(
      `INSERT INTO members (board_id, username, invited_by)
       VALUES (?, ?, ?)
       RETURNING *`,
    )
    .get(boardId, username, invitedBy);

  return result as Record;
};

export const remove = (boardId: number, username: string): void => {
  db.query("DELETE FROM members WHERE board_id = ? AND username = ?").run(
    boardId,
    username,
  );
};
