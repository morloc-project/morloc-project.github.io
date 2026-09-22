// Checks the built site as it will be pushed: every local link and asset in
// every page resolves to a file, every fragment to an id in that file, every
// URL in the machine-readable files to a page on disk, each page has the
// structure the templates promise, and the search index covers every page
// that asked to be indexed. paginate.mjs proves its model; this proves the
// tree.
//
// Usage: node bin/audit.mjs <site-root>

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve, sep } from "node:path";

const require = createRequire(import.meta.url);
const cheerio = require("cheerio");

const [siteRoot] = process.argv.slice(2);

if (!siteRoot) {
	console.error("usage: audit.mjs <site-root>");
	process.exit(1);
}

const site = resolve(siteRoot);
const manual = join(site, "docs");
const SITE_URL = "https://morloc-project.github.io/docs/";
const problems = [];

function problem(text) {
	problems.push(text);
}

function walk(dir, out = []) {
	for (const name of readdirSync(dir)) {
		if (name === ".asciidoctor") continue;

		const path = join(dir, name);

		if (statSync(path).isDirectory()) walk(path, out);
		else out.push(path);
	}

	return out;
}

const files = walk(site);
const htmlFiles = files.filter((f) => f.endsWith(".html"));
const ids = new Map(); // file -> Set of ids
const docs = new Map(); // file -> cheerio

for (const file of htmlFiles) {
	const $ = cheerio.load(readFileSync(file, "utf8"));

	docs.set(file, $);
	ids.set(file, new Set($("[id]").map((_, el) => $(el).attr("id")).toArray()));
}

// A local reference from `file` to `value`: the target file and fragment.
function resolveRef(file, value) {
	const [pathPart, fragment = null] = value.split("#", 2);
	let target = file;

	if (pathPart) {
		if (pathPart.startsWith("/")) target = join(site, pathPart);
		else target = resolve(dirname(file), pathPart);

		if (target.endsWith(sep) || (existsSync(target) && statSync(target).isDirectory())) target = join(target, "index.html");
	}

	return { target, fragment };
}

let links = 0;
let frags = 0;

for (const [file, $] of docs) {
	const rel = relative(site, file);
	const isAll = rel === join("docs", "all.html");

	for (const attr of ["href", "src", "poster", "data"])
		$(`[${attr}]`).each((_, el) => {
			const value = $(el).attr(attr);

			if (!value || /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) return;

			const { target, fragment } = resolveRef(file, value);

			links++;

			if (!existsSync(target)) {
				problem(`${rel}: ${attr}="${value}" -> ${relative(site, target)} does not exist`);
				return;
			}

			if (fragment !== null && fragment !== "") {
				frags++;

				const set = ids.get(target);

				if (set && !set.has(fragment)) problem(`${rel}: ${attr}="${value}" -> no id "${fragment}" in ${relative(site, target)}`);
			}
		});

	// Structure every generated page promises (the site-root landing page is
	// hand-written and all.html is asciidoctor's).
	if (isAll || rel === "index.html") continue;

	if ($("title").length !== 1) problem(`${rel}: expected one <title>, found ${$("title").length}`);
	if ($('link[rel="canonical"]').length !== 1) problem(`${rel}: expected one canonical link`);
	if (/HOME_HREF|\$\{/.test($.html())) problem(`${rel}: unreplaced template placeholder`);

	const bodies = $("[data-pagefind-body]").length;
	const isRoot = rel === "404.html" || rel === join("docs", "index.html");

	if (isRoot && bodies !== 0) problem(`${rel}: home/404 must not be indexed`);
	if (!isRoot && bodies > 1) problem(`${rel}: ${bodies} search bodies`);
	if (bodies === 1 && $("[data-pagefind-meta]").length !== 1) problem(`${rel}: search body without a title meta`);

	for (const leak of ["/documents/", "/opt/node_modules"]) if ($.html().includes(leak)) problem(`${rel}: contains build path ${leak}`);
}

// Machine files: every URL they carry is a page on disk.
function checkUrl(source, url) {
	if (!url.startsWith(SITE_URL)) return problem(`${source}: ${url} is not under ${SITE_URL}`);

	const { target } = resolveRef(join(manual, "index.html"), url.slice(SITE_URL.length) || "index.html");

	if (!existsSync(target)) problem(`${source}: ${url} -> ${relative(site, target)} does not exist`);
}

const toc = JSON.parse(readFileSync(join(manual, "toc.json"), "utf8"));

if (toc.schema !== 1) problem("toc.json: schema is not 1");

for (const page of toc.pages) {
	checkUrl("toc.json", page.url);
	checkUrl("toc.json", page.md);
	if (page.level === 1 && !page.url.endsWith("/")) problem(`toc.json: landing ${page.url} is not spelled as a directory`);
}

const sitemap = readFileSync(join(manual, "sitemap.xml"), "utf8");
const locs = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));

if (locs.length !== toc.pages.length) problem(`sitemap.xml lists ${locs.length} pages, toc.json ${toc.pages.length}`);
for (const loc of locs) checkUrl("sitemap.xml", loc);

for (const name of ["llms.txt", "llms-full.txt"]) {
	const root = readFileSync(join(site, name), "utf8");
	const copy = readFileSync(join(manual, name), "utf8");

	if (root !== copy) problem(`${name}: root and docs/ copies differ`);
}

for (const url of [...readFileSync(join(site, "llms.txt"), "utf8").matchAll(/\]\((https?:[^)]+)\)/g)].map((m) => m[1])) checkUrl("llms.txt", url);

// anchors.json: every value is a page; a key that is an id must exist on
// that page unless it is a legacy id from the single-page manual.
const anchors = JSON.parse(readFileSync(join(manual, "anchors.json"), "utf8"));
const legacy = JSON.parse(readFileSync(join(dirname(new URL(import.meta.url).pathname), "..", "src", "legacy-anchors.json"), "utf8"));

for (const [key, value] of Object.entries(anchors)) {
	const { target, fragment } = resolveRef(join(manual, "index.html"), value);

	if (!existsSync(target)) problem(`anchors.json: ${key} -> ${value} does not exist`);
	else if (fragment && !ids.get(target)?.has(fragment)) problem(`anchors.json: ${key} -> ${value} has no such id`);
	else if (!key.includes("/") && !(key in legacy) && !ids.get(target)?.has(key)) problem(`anchors.json: ${key} -> ${value} has no such id`);
}

// Search coverage: pagefind indexed exactly the pages that carry a body.
const entryFile = join(manual, "pagefind", "pagefind-entry.json");

if (!existsSync(entryFile)) {
	console.error(`audit: ${relative(site, entryFile)} is missing; pagefind did not run`);
	process.exit(1);
}

const entry = JSON.parse(readFileSync(entryFile, "utf8"));
const indexed = Object.values(entry.languages ?? {}).reduce((n, l) => n + (l.page_count ?? 0), 0);
const withBody = [...docs].filter(([file, $]) => $("[data-pagefind-body]").length === 1).length;

if (indexed !== withBody) problem(`pagefind indexed ${indexed} pages but ${withBody} carry data-pagefind-body`);

if (problems.length) {
	for (const p of problems) console.error("audit: " + p);
	console.error(`audit: ${problems.length} problem(s)`);
	process.exit(1);
}

console.log(`audit: files=${files.length} html=${htmlFiles.length} links=${links} frags=${frags} search=${indexed} ok`);
