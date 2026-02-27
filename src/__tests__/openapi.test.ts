import { beforeAll, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import "@/schema";
import { api } from "@/api";
import * as Board from "@/board";
import { db } from "@/database";
import * as session from "@/session";
import * as User from "@/user";

const app = new Hono();
app.route("/api", api);

const authedFetch = (path: string, opts: RequestInit = {}) => {
  const token = session.create("specuser");
  const headers = new Headers(opts.headers || {});
  headers.set("Cookie", `session=${token}`);
  return app.request(path, { ...opts, headers });
};

describe("openapi spec", () => {
  let spec: any;

  beforeAll(async () => {
    db.exec("DELETE FROM board_viewports");
    db.exec("DELETE FROM attachments");
    db.exec("DELETE FROM notes");
    db.exec("DELETE FROM members");
    db.exec("DELETE FROM boards");
    db.exec("DELETE FROM users");
    User.create({
      username: "specuser",
      credential_id: "spec-c1",
      public_key: Buffer.from([1]),
      counter: 0,
    } as User.Record);
    Board.create("spec-board", "specuser");

    const res = await app.request("/api/openapi.json");
    spec = await res.json();
  });

  test("GET /api/openapi.json returns 200", async () => {
    const res = await app.request("/api/openapi.json");
    expect(res.status).toBe(200);
  });

  test("spec has correct openapi version", () => {
    expect(spec.openapi).toBe("3.1.0");
  });

  test("spec has info with title and version", () => {
    expect(spec.info.title).toBe("takkr API");
    expect(spec.info.version).toBe("1.0.0");
    expect(spec.info.description).toContain("takkr");
  });

  test("spec has all 6 tags", () => {
    expect(spec.tags.length).toBe(6);
    const tagNames = spec.tags.map((t: any) => t.name);
    expect(tagNames).toContain("Authentication");
    expect(tagNames).toContain("Boards");
    expect(tagNames).toContain("Members");
    expect(tagNames).toContain("Notes");
    expect(tagNames).toContain("Attachments");
    expect(tagNames).toContain("User");
  });

  test("all tags have descriptions", () => {
    for (const tag of spec.tags) {
      expect(tag.description).toBeTruthy();
      expect(tag.description.length).toBeGreaterThan(20);
    }
  });

  test("spec has paths", () => {
    const paths = Object.keys(spec.paths);
    expect(paths.length).toBeGreaterThanOrEqual(25);
  });

  // Auth endpoints
  test("has POST /user/register", () => {
    expect(spec.paths["/user/register"]?.post).toBeDefined();
    expect(spec.paths["/user/register"].post.summary).toBe(
      "Start passkey registration",
    );
    expect(spec.paths["/user/register"].post.description).toContain("WebAuthn");
  });

  test("has POST /user/register/verify", () => {
    expect(spec.paths["/user/register/verify"]?.post).toBeDefined();
  });

  test("has POST /user/discover", () => {
    expect(spec.paths["/user/discover"]?.post).toBeDefined();
    expect(spec.paths["/user/discover"].post.description).toContain(
      "discoverable",
    );
  });

  test("has POST /user/discover/verify", () => {
    expect(spec.paths["/user/discover/verify"]?.post).toBeDefined();
  });

  test("has POST /user/logout", () => {
    expect(spec.paths["/user/logout"]?.post).toBeDefined();
  });

  // Board endpoints
  test("has GET /boards", () => {
    expect(spec.paths["/boards"]?.get).toBeDefined();
  });

  test("has DELETE /boards/{slug}", () => {
    expect(spec.paths["/boards/{slug}"]?.delete).toBeDefined();
  });

  test("has PUT /boards/{slug}/background", () => {
    expect(spec.paths["/boards/{slug}/background"]?.put).toBeDefined();
    expect(spec.paths["/boards/{slug}/background"].put.description).toContain(
      "plain",
    );
    expect(spec.paths["/boards/{slug}/background"].put.description).toContain(
      "cork",
    );
  });

  test("has GET and PUT /boards/{slug}/viewport", () => {
    expect(spec.paths["/boards/{slug}/viewport"]?.get).toBeDefined();
    expect(spec.paths["/boards/{slug}/viewport"]?.put).toBeDefined();
    expect(spec.paths["/boards/{slug}/viewport"].put.description).toContain(
      "0.25",
    );
    expect(spec.paths["/boards/{slug}/viewport"].put.description).toContain(
      "2.0",
    );
  });

  // Member endpoints
  test("has POST /boards/{slug}/members", () => {
    expect(spec.paths["/boards/{slug}/members"]?.post).toBeDefined();
    expect(spec.paths["/boards/{slug}/members"].post.description).toContain(
      "collaborator",
    );
  });

  test("has DELETE /boards/{slug}/members/{username}", () => {
    expect(
      spec.paths["/boards/{slug}/members/{username}"]?.delete,
    ).toBeDefined();
  });

  // Note endpoints
  test("has POST /boards/{slug}/notes", () => {
    expect(spec.paths["/boards/{slug}/notes"]?.post).toBeDefined();
    expect(spec.paths["/boards/{slug}/notes"].post.description).toContain(
      "SSE",
    );
  });

  test("has GET /notes/{id}", () => {
    expect(spec.paths["/notes/{id}"]?.get).toBeDefined();
    expect(spec.paths["/notes/{id}"].get.description).toContain("attachments");
  });

  test("has PUT /notes/{id}", () => {
    expect(spec.paths["/notes/{id}"]?.put).toBeDefined();
    expect(spec.paths["/notes/{id}"].put.description).toContain("silent");
  });

  test("has POST /notes/{id}/duplicate", () => {
    expect(spec.paths["/notes/{id}/duplicate"]?.post).toBeDefined();
    expect(spec.paths["/notes/{id}/duplicate"].post.description).toContain(
      "30px",
    );
  });

  test("has DELETE /notes/{id}", () => {
    expect(spec.paths["/notes/{id}"]?.delete).toBeDefined();
  });

  test("has POST /notes/{id}/front", () => {
    expect(spec.paths["/notes/{id}/front"]?.post).toBeDefined();
    expect(spec.paths["/notes/{id}/front"].post.description).toContain(
      "z-index",
    );
  });

  // Attachment endpoints
  test("has POST /notes/{id}/attachments", () => {
    expect(spec.paths["/notes/{id}/attachments"]?.post).toBeDefined();
    expect(spec.paths["/notes/{id}/attachments"].post.description).toContain(
      "5MB",
    );
  });

  test("has GET /notes/{id}/attachments", () => {
    expect(spec.paths["/notes/{id}/attachments"]?.get).toBeDefined();
  });

  test("has GET /attachments/{id}", () => {
    expect(spec.paths["/attachments/{id}"]?.get).toBeDefined();
    expect(spec.paths["/attachments/{id}"].get.description).toContain("MIME");
  });

  test("has DELETE /attachments/{id}", () => {
    expect(spec.paths["/attachments/{id}"]?.delete).toBeDefined();
  });

  // User endpoints
  test("has GET /user/profile", () => {
    expect(spec.paths["/user/profile"]?.get).toBeDefined();
  });

  test("has GET /user/prefs", () => {
    expect(spec.paths["/user/prefs"]?.get).toBeDefined();
  });

  test("has PUT /user/display-name", () => {
    expect(spec.paths["/user/display-name"]?.put).toBeDefined();
  });

  test("has PUT /user/email", () => {
    expect(spec.paths["/user/email"]?.put).toBeDefined();
  });

  test("has PUT /user/font", () => {
    expect(spec.paths["/user/font"]?.put).toBeDefined();
    expect(spec.paths["/user/font"].put.description).toContain("caveat");
  });

  test("has PUT /user/color", () => {
    expect(spec.paths["/user/color"]?.put).toBeDefined();
  });

  test("has PUT /user/background", () => {
    expect(spec.paths["/user/background"]?.put).toBeDefined();
  });

  test("has POST /user/avatar", () => {
    expect(spec.paths["/user/avatar"]?.post).toBeDefined();
    expect(spec.paths["/user/avatar"].post.description).toContain("2MB");
  });

  test("has GET /user/avatar/{filename}", () => {
    expect(spec.paths["/user/avatar/{filename}"]?.get).toBeDefined();
    expect(spec.paths["/user/avatar/{filename}"].get.description).toContain(
      "public",
    );
  });

  // Every endpoint has a description
  test("all endpoints have descriptions", () => {
    let missing = 0;
    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, op] of Object.entries(
        methods as Record<string, any>,
      )) {
        if (!op.description || op.description.length < 10) {
          console.log(`Missing description: ${method.toUpperCase()} ${path}`);
          missing++;
        }
      }
    }
    expect(missing).toBe(0);
  });

  // Every endpoint has a summary
  test("all endpoints have summaries", () => {
    for (const [_path, methods] of Object.entries(spec.paths)) {
      for (const [_method, op] of Object.entries(
        methods as Record<string, any>,
      )) {
        expect((op as any).summary).toBeTruthy();
      }
    }
  });

  // Every endpoint is tagged
  test("all endpoints have at least one tag", () => {
    for (const [_path, methods] of Object.entries(spec.paths)) {
      for (const [_method, op] of Object.entries(
        methods as Record<string, any>,
      )) {
        expect((op as any).tags?.length).toBeGreaterThan(0);
      }
    }
  });

  // Spec is valid JSON
  test("spec serializes to valid JSON", () => {
    const json = JSON.stringify(spec);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
