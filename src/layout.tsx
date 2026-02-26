// @ts-expect-error - package.json not in exports but Bun resolves it
import { version as webauthnVersion } from "@simplewebauthn/browser/package.json";
import { version as alpineVersion } from "alpinejs/package.json";
import type { Child } from "hono/jsx";
import { clientConfig } from "@/shared";
import { version as htmxVersion } from "htmx.org/package.json";
import { version as htmxSseVersion } from "htmx-ext-sse/package.json";

export type Page = {
  id?: string;
  title: string;
  children: Child;
  scripts?: string[];
  font?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
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
        content={props.description || "Collaborative sticky note board. Drag, drop, and organize your ideas."}
      />
      <title>{pageTitle(props.title)}</title>

      {/* Open Graph */}
      <meta property="og:title" content={pageTitle(props.title)} />
      <meta property="og:description" content={props.description || "Collaborative sticky note board. Drag, drop, and organize your ideas."} />
      <meta property="og:type" content="website" />
      {props.canonical && <meta property="og:url" content={props.canonical} />}
      {props.ogImage && <meta property="og:image" content={props.ogImage} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle(props.title)} />
      <meta name="twitter:description" content={props.description || "Collaborative sticky note board. Drag, drop, and organize your ideas."} />
      {props.ogImage && <meta name="twitter:image" content={props.ogImage} />}

      {props.canonical && <link rel="canonical" href={props.canonical} />}
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      <link rel="stylesheet" href="/www/fonts.css" />
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
      <script dangerouslySetInnerHTML={{ __html: `window.__TAKKR__=${clientConfig()};` }} />
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
