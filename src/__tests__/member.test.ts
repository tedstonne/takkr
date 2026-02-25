import { beforeAll, describe, expect, test } from "bun:test";
import "@/schema";
import * as Member from "@/member";
import * as Board from "@/board";
import * as User from "@/user";
import { db } from "@/database";

describe("member", () => {
  let boardId: number;

  beforeAll(() => {
    db.exec("DELETE FROM members");
    db.exec("DELETE FROM boards");
    db.exec("DELETE FROM users");
    User.create({ username: "mowner", credential_id: "mc1", public_key: Buffer.from([1]), counter: 0 } as User.Record);
    User.create({ username: "minvitee", credential_id: "mc2", public_key: Buffer.from([2]), counter: 0 } as User.Record);
    User.create({ username: "minvitee2", credential_id: "mc3", public_key: Buffer.from([3]), counter: 0 } as User.Record);
    const board = Board.create("member-board", "mowner");
    boardId = board.id;
  });

  test("forBoard returns empty for new board", () => {
    expect(Member.forBoard(boardId)).toEqual([]);
  });

  test("exists returns false when not a member", () => {
    expect(Member.exists(boardId, "minvitee")).toBe(false);
  });

  test("add a member", () => {
    const m = Member.add(boardId, "minvitee", "mowner");
    expect(m.username).toBe("minvitee");
    expect(m.board_id).toBe(boardId);
    expect(m.invited_by).toBe("mowner");
  });

  test("exists returns true after add", () => {
    expect(Member.exists(boardId, "minvitee")).toBe(true);
  });

  test("forBoard returns members", () => {
    Member.add(boardId, "minvitee2", "mowner");
    const members = Member.forBoard(boardId);
    expect(members.length).toBe(2);
  });

  test("remove a member", () => {
    Member.remove(boardId, "minvitee2");
    expect(Member.exists(boardId, "minvitee2")).toBe(false);
    expect(Member.forBoard(boardId).length).toBe(1);
  });

  test("remove nonexistent is a no-op", () => {
    Member.remove(boardId, "ghost");
    expect(Member.forBoard(boardId).length).toBe(1);
  });
});
