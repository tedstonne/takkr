import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { api } from "@/api";
import { pages } from "@/pages";

// Initialize schema
import "@/schema";

const app = new Hono();

// Static files
app.use("/www/*", serveStatic({ root: "./" }));
app.use("/favicon.svg", serveStatic({ path: "./www/favicon.svg" }));

// API routes
app.route("/api", api);

// Page routes
app.route("/", pages);

export default {
  port: 3001,
  fetch: app.fetch,
};
