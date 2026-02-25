// @ts-expect-error - package.json not in exports but Bun resolves it
import { version as webauthnVersion } from "@simplewebauthn/browser/package.json";
import { version as alpineVersion } from "alpinejs/package.json";
import type { Child } from "hono/jsx";
import { version as htmxVersion } from "htmx.org/package.json";
import { version as htmxSseVersion } from "htmx-ext-sse/package.json";

export type Page = {
  id?: string;
  title: string;
  children: Child;
  scripts?: string[];
  font?: string;
};

const pageTitle = (title: string): string =>
  title ? `takkr :: ${title}` : "takkr";

export const Layout = (props: Page) => (
  <html lang="en" class="h-full">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta
        name="description"
        content="Collaborative sticky note board. Drag, drop, and organize your ideas."
      />
      <title>{pageTitle(props.title)}</title>
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      <link
        href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&family=Cookie&family=Gochi+Hand&family=Grand+Hotel&family=Handlee&family=Indie+Flower&family=Kalam:wght@400;700&family=Inter:wght@400;500;600&family=Parisienne&family=Sofia&display=swap"
        rel="stylesheet"
      />
      <link rel="stylesheet" href="/www/styles.css" />
      <script
        defer
        src={`https://cdn.jsdelivr.net/npm/htmx.org@${htmxVersion}/dist/htmx.min.js`}
      />
      <script
        defer
        src={`https://cdn.jsdelivr.net/npm/htmx-ext-sse@${htmxSseVersion}/sse.min.js`}
      />
      <script
        defer
        src={`https://cdn.jsdelivr.net/npm/@simplewebauthn/browser@${webauthnVersion}/dist/bundle/index.umd.min.js`}
      />
      {props.scripts?.map((script: string) => (
        <script type="module" src={script} />
      ))}
      <script
        defer
        src={`https://cdn.jsdelivr.net/npm/alpinejs@${alpineVersion}/dist/cdn.min.js`}
      />
    </head>
    <body class="h-full overflow-hidden" data-font={props.font || "caveat"}>
      <main id="hx-body" class={`h-full overflow-hidden ${props.id || ""}`}>
        {props.children}
      </main>
    </body>
  </html>
);
