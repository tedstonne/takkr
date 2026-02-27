import { beforeAll, describe, expect, test } from "bun:test";
import "@/schema";
import * as Invite from "@/invite";
import * as Board from "@/board";
import * as User from "@/user";
import { db } from "@/database";

describe("invite", () => {
  let boardId: number;
  let boardId2: number;

  beforeAll(() => {
    db.exec("DELETE FROM board_invites");
    db.exec("DELETE FROM boards");
    db.exec("DELETE FROM users");
    User.create({ username: "iowner", credential_id: "ic1", public_key: Buffer.from([1]), counter: 0 } as User.Record);
    const board = Board.create("invite-board", "iowner");
    boardId = board.id;
    const board2 = Board.create("invite-board-2", "iowner");
    boardId2 = board2.id;
  });

  test("forBoard returns null when no invite exists", () => {
    expect(Invite.forBoard(boardId)).toBeNull();
  });

  test("generate creates an invite token", () => {
    const invite = Invite.generate(boardId, "iowner");
    expect(invite.board_id).toBe(boardId);
    expect(invite.token).toBeTruthy();
    expect(invite.created_by).toBe("iowner");
    expect(invite.active).toBe(1);
  });

  test("forBoard returns the active invite", () => {
    const invite = Invite.forBoard(boardId);
    expect(invite).not.toBeNull();
    expect(invite!.board_id).toBe(boardId);
  });

  test("findByToken returns invite with board info", () => {
    const existing = Invite.forBoard(boardId)!;
    const found = Invite.findByToken(existing.token);
    expect(found).not.toBeNull();
    expect(found!.board_slug).toBe("invite-board");
    expect(found!.board_name).toBe("invite board");
    expect(found!.board_owner).toBe("iowner");
  });

  test("findByToken returns null for non-existent token", () => {
    expect(Invite.findByToken("non-existent-token")).toBeNull();
  });

  test("generate replaces existing token", () => {
    const oldToken = Invite.forBoard(boardId)!.token;
    const newInvite = Invite.generate(boardId, "iowner");
    expect(newInvite.token).not.toBe(oldToken);
    // Old token should no longer work
    expect(Invite.findByToken(oldToken)).toBeNull();
    // New token works
    expect(Invite.findByToken(newInvite.token)).not.toBeNull();
  });

  test("revoke deactivates the token", () => {
    const invite = Invite.forBoard(boardId)!;
    Invite.revoke(boardId);
    expect(Invite.forBoard(boardId)).toBeNull();
    expect(Invite.findByToken(invite.token)).toBeNull();
  });

  test("generate works after revoke", () => {
    const invite = Invite.generate(boardId, "iowner");
    expect(invite.active).toBe(1);
    expect(Invite.forBoard(boardId)).not.toBeNull();
  });

  test("different boards have independent tokens", () => {
    const invite2 = Invite.generate(boardId2, "iowner");
    const invite1 = Invite.forBoard(boardId);
    expect(invite1).not.toBeNull();
    expect(invite2.token).not.toBe(invite1!.token);
  });
});
