import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import MarkdownIt from "markdown-it";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const markdownDir = path.join(repo, "docs", "md");
const outputDir = path.join(repo, "docs", "web", "dist");
const assetsDir = path.join(outputDir, "assets");
const runFile = promisify(execFile);

function inside(parent, file) {
  const relative = path.relative(parent, file);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function htmlEscape(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function slugify(value) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "section";
}

const files = (await readdir(markdownDir)).filter(file => file.endsWith(".md"));
if (!files.includes("index.md")) throw new Error("docs/md/index.md is required");
const pages = files.map(file => {
  if (file === "index.md") return { file, slug: "index", output: "index.html", position: 0 };
  const match = /^([1-9]\d*)_([a-z0-9][a-z0-9-]*)\.md$/.exec(file);
  if (!match) throw new Error(`Documentation file needs a numeric prefix: ${file}`);
  return { file, slug: match[2], output: `${match[2]}.html`, position: Number(match[1]) };
}).sort((a, b) => a.position - b.position);
if (new Set(pages.map(page => page.position)).size !== pages.length ||
    new Set(pages.map(page => page.output)).size !== pages.length ||
    pages.some((page, index) => page.position !== index)) {
  throw new Error("Documentation prefixes must be unique and consecutive, starting at 1");
}
const pageBySource = new Map(pages.map(page => [path.join(markdownDir, page.file), page]));

await rm(outputDir, { recursive: true, force: true });
await mkdir(assetsDir, { recursive: true });
await mkdir(path.join(outputDir, "source"), { recursive: true });

const markdown = new MarkdownIt({ html: false, linkify: true, typographer: false });
function withCopyButton(render) {
  return (...args) => `<div class="relative my-6 [&>pre]:my-0 [&>pre]:pt-12">
    <button type="button" data-copy-code class="absolute right-3 top-3 z-10 rounded-md border border-white/15 bg-[#1b2a22] px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-brand/50 hover:text-brand-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-light" aria-label="Copy code">Copy</button>
    ${render(...args)}</div>`;
}
markdown.renderer.rules.fence = withCopyButton(markdown.renderer.rules.fence);
markdown.renderer.rules.code_block = withCopyButton(markdown.renderer.rules.code_block);
const copiedSources = new Set();

async function copyLinkedSource(source) {
  const relative = path.relative(repo, source);
  if (!inside(repo, source)) throw new Error(`Link escapes repository: ${source}`);
  if (copiedSources.has(relative)) return;
  copiedSources.add(relative);
  const target = path.join(outputDir, "source", relative);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target);
}

function rewriteLink(href, source, linkedSources) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href) || href.startsWith("#")) return href;
  const match = /^([^?#]*)([?#].*)?$/.exec(href);
  if (!match || !match[1]) return href;
  const resolved = path.resolve(path.dirname(source), decodeURIComponent(match[1]));
  if (!inside(repo, resolved)) throw new Error(`Link escapes repository: ${href} in ${source}`);
  const suffix = match[2] ?? "";
  if (inside(markdownDir, resolved) && resolved.endsWith(".md")) {
    const page = pageBySource.get(resolved);
    if (!page) throw new Error(`Broken Markdown link: ${href} in ${source}`);
    return `${page.output}${suffix}`;
  }
  linkedSources.add(resolved);
  return `source/${path.relative(repo, resolved).split(path.sep).join("/")}${suffix}`;
}

const rendered = [];
for (const page of pages) {
  const { slug } = page;
  const source = path.join(markdownDir, page.file);
  const markdownText = await readFile(source, "utf8");
  const headings = [];
  const ids = new Map();
  const linkedSources = new Set();
  const renderer = markdown.renderer;
  renderer.rules.heading_open = (tokens, index, options, env, self) => {
    const token = tokens[index];
    const title = tokens[index + 1].content;
    const base = slugify(title);
    const count = ids.get(base) ?? 0;
    ids.set(base, count + 1);
    const id = count ? `${base}-${count + 1}` : base;
    token.attrSet("id", id);
    headings.push({ level: Number(token.tag.slice(1)), title, id });
    return self.renderToken(tokens, index, options);
  };
  renderer.rules.link_open = (tokens, index, options, env, self) => {
    const token = tokens[index];
    const href = token.attrGet("href");
    if (href) token.attrSet("href", rewriteLink(href, source, linkedSources));
    return self.renderToken(tokens, index, options);
  };
  const content = markdown.render(markdownText);
  for (const linkedSource of linkedSources) await copyLinkedSource(linkedSource);
  const title = headings.find(heading => heading.level === 1)?.title ?? slug;
  rendered.push({
    slug,
    file: page.output,
    title,
    headings: headings.filter(heading => heading.level === 2),
    content
  });
}

await copyFile(path.join(repo, "assets", "treegger-logo.svg"), path.join(assetsDir, "treegger-logo.svg"));
await copyFile(path.join(repo, "docs", "web", "copy-code.js"), path.join(assetsDir, "copy-code.js"));

function pageLinks(current) {
  return rendered.map(page => `<a href="${page.file}" class="block rounded-lg px-3 py-2 text-sm transition-colors ${page.slug === current.slug
    ? "bg-brand/10 font-medium text-brand-light"
    : "text-slate-400 hover:bg-white/5 hover:text-slate-100"}"${page.slug === current.slug ? ' aria-current="page"' : ""}>${htmlEscape(page.title)}</a>`).join("\n");
}

function sidebar(page) {
  return `<a class="mb-9 flex items-center gap-3 rounded-lg px-2 text-white no-underline" href="index.html" aria-label="Treegger documentation home">
    <img src="./assets/treegger-logo.svg" width="34" height="34" alt="">
    <span class="text-xl font-bold tracking-tight">treegger<small class="block text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-light/70">documentation</small></span>
  </a>
  <div class="mb-3 px-3 text-[11px] font-semibold tracking-[0.17em] text-brand-light/65">GUIDES & REFERENCE</div>
  <nav class="flex flex-col gap-0.5" aria-label="Pages">${pageLinks(page)}</nav>`;
}

for (const [index, page] of rendered.entries()) {
  const previous = rendered[index - 1];
  const next = rendered[index + 1];
  const toc = page.headings.length ? `<div class="sticky top-24 border-l border-white/10 pl-5">
    <div class="mb-4 text-[11px] font-semibold tracking-[0.15em] text-brand-light/70">ON THIS PAGE</div>
    <nav class="flex flex-col gap-3" aria-label="Page sections">${page.headings.map(heading => `<a class="text-sm text-slate-500 hover:text-brand-light" href="#${heading.id}">${htmlEscape(heading.title)}</a>`).join("\n")}</nav>
  </div>` : "";
  const adjacent = [
    previous && `<a class="flex flex-col gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:border-brand/35 hover:bg-brand/5" href="${previous.file}"><span class="text-xs text-slate-500">← Previous</span><strong class="font-medium text-brand-light">${htmlEscape(previous.title)}</strong></a>`,
    next && `<a class="flex flex-col gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:border-brand/35 hover:bg-brand/5 sm:col-start-2" href="${next.file}"><span class="text-xs text-slate-500">Next →</span><strong class="font-medium text-brand-light">${htmlEscape(next.title)}</strong></a>`
  ].filter(Boolean).join("\n");
  const document = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="theme-color" content="#0b1210">
  <meta name="description" content="Treegger documentation: ${htmlEscape(page.title)}">
  <title>${htmlEscape(page.title)} · Treegger</title>
  <link rel="icon" type="image/svg+xml" href="./assets/treegger-logo.svg">
  <link rel="stylesheet" href="./assets/styles.css">
</head>
<body class="min-h-screen bg-[#0b1210] font-sans text-slate-300 antialiased" data-page="${htmlEscape(page.slug)}">
  <a class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-slate-950" href="#content">Skip to content</a>
  <div class="min-h-screen lg:grid lg:grid-cols-[268px_minmax(0,1fr)]">
    <aside class="hidden border-r border-white/10 bg-[#0e1913] px-5 pb-6 pt-7 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-y-auto" aria-label="Documentation navigation">${sidebar(page)}</aside>
    <div class="flex min-w-0 min-h-screen flex-col">
      <details class="border-b border-white/10 bg-[#0e1913] px-5 py-3 lg:hidden"><summary class="cursor-pointer text-sm font-medium text-brand-light">Documentation menu</summary><nav class="mt-4 flex max-h-[60vh] flex-col gap-0.5 overflow-y-auto" aria-label="Pages">${pageLinks(page)}</nav></details>
      <div class="mx-auto grid w-full max-w-[1450px] flex-1 grid-cols-1 gap-12 px-5 pb-24 pt-10 sm:px-8 lg:px-12 xl:grid-cols-[minmax(0,1fr)_210px] xl:gap-16">
        <div class="min-w-0">
          <main id="content" class="prose prose-invert max-w-none prose-headings:scroll-mt-24 prose-headings:text-slate-50 prose-a:text-brand-light prose-a:decoration-brand/40 hover:prose-a:text-brand-light prose-strong:text-slate-100 prose-code:text-brand-light prose-pre:rounded-xl prose-pre:border prose-pre:border-white/10 prose-pre:bg-[#101b16] prose-th:text-brand-light prose-td:text-slate-300">${page.content}</main>
          <nav class="mt-16 grid gap-3 border-t border-white/10 pt-8 sm:grid-cols-2" aria-label="Adjacent pages">${adjacent}</nav>
        </div>
        <aside class="hidden xl:block" aria-label="On this page">${toc}</aside>
      </div>
      <footer class="border-t border-white/10 px-5 py-6 text-sm text-slate-500 sm:px-8 lg:px-12">
        <div class="mx-auto flex max-w-[1450px] flex-wrap items-center justify-between gap-3">
          <span class="font-semibold text-slate-300">Treegger</span>
          <div class="flex flex-wrap items-center gap-5"><a class="hover:text-brand-light" href="https://github.com/eone666/treegger" target="_blank" rel="noopener noreferrer">GitHub repository ↗</a><a class="hover:text-brand-light" href="https://github.com/eone666/treegger/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">MIT License</a></div>
        </div>
      </footer>
    </div>
  </div>
  <script defer src="./assets/copy-code.js"></script>
</body>
</html>
`;
  await writeFile(path.join(outputDir, page.file), document);
}

await runFile(path.join(repo, "node_modules", ".bin", "tailwindcss"), [
  "-i", path.join(repo, "docs", "web", "input.css"),
  "-o", path.join(assetsDir, "styles.css"),
  "--minify"
], { cwd: repo });

console.log(`Built ${rendered.length} documentation pages in docs/web/dist/`);
