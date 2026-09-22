// Splits the single-page manual asciidoctor built (docs/docs/all.html) into
// one page per `===` section, a page per `==` chapter holding the chapter's
// heading and the prose before its first section (a `.onepage` chapter
// keeps its sections too), and the files a program or a language model
// reads instead of HTML: a markdown twin of every page, llms.txt,
// llms-full.txt, toc.json, sitemap.xml, and the anchor map the home and 404
// pages use to redirect links into the old single page.
//
// Every output is a projection of one table, id -> page, built from the ids
// inside #content. Nothing is authored twice, and any link that cannot be
// resolved through that table fails the build.
//
// Usage: node bin/paginate.mjs <site-root>
//
// <site-root> is the GitHub Pages root (docs/); the manual lives in its
// docs/ subdirectory. The script never rewrites all.html.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { packageVersion } from "./pkgversion.mjs";

// Required rather than imported so that NODE_PATH is honoured: the build image
// installs the packages outside the source tree.
const require = createRequire(import.meta.url);
const cheerio = require("cheerio");
const TurndownService = require("turndown");

export const SITE_URL = "https://morloc-project.github.io/docs/";
export const SITE_NAME = "Morloc Manual";

// The manual's directory under the site root, and the path from the site root
// back to the manual for files that live at the root (404.html).
const MANUAL_DIR = "docs";

const SLUG = /^[a-z][a-z0-9-]*$/;
const RESERVED = new Set([
	"index",
	"all",
	"static",
	"pagefind",
	"anchors",
	"toc",
	"sitemap",
	"manifest",
	"service-worker",
	"robots",
	"llms",
	"llms-full",
	"404",
	"build-report"
]);

const ADMONITIONS = ["note", "tip", "important", "warning", "caution"];

// ------------------------------------------------------------------ helpers

class BuildError extends Error {}

function fail(message) {
	throw new BuildError(message);
}

function escAttr(text) {
	return text
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function escHtml(text) {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const escXml = escAttr;

// Markdown link text: brackets and backslashes would otherwise change the
// link's shape.
function escMdText(text) {
	return text.replace(/([\\[\]])/g, "\\$1");
}

const NUMBER = /^(\d+(?:\.\d+)*\.)\s+/;

// A heading's text without inline markup, split from its section number.
function headingText($, el) {
	const clone = $(el).clone();

	clone.find("a.anchor").remove();

	const raw = clone.text().replace(/\s+/g, " ").trim();
	const m = NUMBER.exec(raw);

	return m ? { number: m[1], title: raw.slice(m[0].length) } : { number: "", title: raw };
}

function firstSentence(text) {
	const compact = text.replace(/\s+/g, " ").trim();
	const m = /^(.+?[.!?])(\s|$)/.exec(compact);
	let sentence = m ? m[1] : compact;

	if (sentence.length > 160) sentence = sentence.slice(0, 157).replace(/\s+\S*$/, "") + "...";

	return sentence;
}

// The first plain paragraph among `nodes`, skipping admonitions, listings and
// anything else that is not prose.
function summaryOf($, nodes) {
	for (const node of nodes) {
		const el = $(node);

		if (el.is("div.paragraph")) return firstSentence(el.find("> p").text());
	}

	return "";
}

function childWithClass(node, cls) {
	for (let i = 0; i < node.childNodes.length; i++) {
		const c = node.childNodes[i];

		if (c.nodeType === 1 && c.classList.contains(cls)) return c;
	}

	return null;
}

// turndown's DOM returns NodeLists that are not iterable.
function all(node, selector) {
	return Array.prototype.slice.call(node.querySelectorAll(selector));
}

function words(text) {
	return text.split(/\s+/).filter(Boolean).length;
}

// ------------------------------------------------------------- page model

function isRelativeAsset(value) {
	return value && !/^(#|[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(value);
}

// Prefix every relative asset reference in the tree with the page's path back
// to the manual directory. Fragment links are left for the link rewrite.
function rerootAssets($, root, prefix) {
	for (const attr of ["href", "src", "poster", "data"])
		$(root)
			.find(`[${attr}]`)
			.addBack(`[${attr}]`)
			.each((_, el) => {
				const value = $(el).attr(attr);

				if (isRelativeAsset(value)) $(el).attr(attr, prefix + value);
			});
}

function buildModel($, opts) {
	const content = $("#content");

	if (content.length !== 1) fail("paginate: no #content in all.html");

	const chapters = [];
	const pages = [];
	const ids = new Map(); // id -> page

	function checkSlug(id, what) {
		if (!SLUG.test(id)) fail(`paginate: ${what} id "${id}" is not a slug (${SLUG}); give the heading an explicit [[anchor]]`);
		if (RESERVED.has(id)) fail(`paginate: ${what} id "${id}" is reserved`);
	}

	function claim(page, el) {
		const own = $(el).attr("id");
		const found = own ? [own] : [];

		$(el)
			.find("[id]")
			.each((_, e) => found.push($(e).attr("id")));

		for (const id of found) {
			if (ids.has(id)) fail(`paginate: duplicate id "${id}" (${ids.get(id).path} and ${page.path})`);
			ids.set(id, page);
			page.ids.add(id);
		}
	}

	content.find("> div.sect1").each((_, sect1) => {
		const h2 = $(sect1).find("> h2");
		const id = h2.attr("id");

		checkSlug(id, "chapter");

		const { number, title } = headingText($, h2);
		const body = $(sect1).find("> div.sectionbody");
		const intro = body.children().filter((_, el) => !$(el).is("div.sect2")).toArray();
		const sections = body.find("> div.sect2").toArray();
		const onepage = $(sect1).hasClass("onepage");
		const chapter = { slug: id, number, title, onepage, heading: h2[0], intro, sections: [], node: sect1 };

		chapters.push(chapter);

		// The chapter's page: the whole chapter under the onepage role,
		// otherwise its heading and the prose before its first section.
		const landing = {
			kind: onepage ? "onepage" : "chapter",
			chapter,
			slug: id,
			dir: id,
			path: `${id}/`,
			file: `${id}/index.html`,
			md: `${id}/index.md`,
			number,
			title,
			level: 1,
			summary: summaryOf($, intro),
			node: onepage ? sect1 : null,
			ids: new Set()
		};

		pages.push(landing);

		if (onepage) {
			claim(landing, sect1);
		} else {
			ids.set(id, landing);
			landing.ids.add(id);
			for (const el of intro) claim(landing, el);
		}

		for (const sect2 of sections) {
			const h3 = $(sect2).find("> h3");
			const sid = h3.attr("id");

			checkSlug(sid, "section");

			const heading = headingText($, h3);
			const page = onepage
				? landing
				: {
						kind: "section",
						chapter,
						slug: sid,
						dir: id,
						path: `${id}/${sid}.html`,
						file: `${id}/${sid}.html`,
						md: `${id}/${sid}.md`,
						number: heading.number,
						title: heading.title,
						level: 2,
						summary: summaryOf($, $(sect2).children().toArray()),
						node: sect2,
						ids: new Set()
					};

			chapter.sections.push({ ...heading, id: sid, page });

			if (!onepage) {
				pages.push(page);
				claim(page, sect2);
			}
		}
	});

	// Every id in #content must belong to exactly one page.
	content.find("[id]").each((_, el) => {
		const id = $(el).attr("id");

		if (!ids.has(id)) fail(`paginate: id "${id}" is outside every chapter`);
	});

	for (const page of pages) {
		page.headings = [];

		const scope = $(pageNodes(page)).find(page.kind === "section" ? "h4, h5" : "h3, h4, h5");

		scope.each((_, h) => {
			page.headings.push({ id: $(h).attr("id"), level: Number(h.tagName[1]) - 1, ...headingText($, h) });
		});
	}

	// Reading order gives prev/next.
	pages.forEach((page, i) => {
		page.prev = pages[i - 1] ?? null;
		page.next = pages[i + 1] ?? null;
	});

	return { chapters, pages, ids };
}

// The nodes a page is made of, in order: a chapter page is its heading and
// the prose before its first section; every other page is one section.
function pageNodes(page) {
	return page.node ? [page.node] : [page.chapter.heading, ...page.chapter.intro];
}

// The fragment a link to `id` needs on its page: none when the id is the
// page's own heading.
function fragment(target, id) {
	return target.slug === id ? "" : "#" + id;
}

// --------------------------------------------------------------- linking

// Relative href from a page in directory `dir` ("" for the manual root) to a
// manual-relative target path. Landings are spelled index.html so the link
// works under file:// as well as on the server.
function linkTo(prefix, dir, target) {
	const file = target.endsWith("/") ? target + "index.html" : target;

	if (dir && file.startsWith(dir + "/")) return file.slice(dir.length + 1);

	return prefix + file;
}

// Rewrite every fragment link in `root` for `page`: same-page targets stay
// fragments, others point at their page. Unknown or auto-generated targets
// fail the build.
function rewriteLinks($, root, page, model, prefix) {
	let count = 0;

	$(root)
		.find('a[href^="#"]')
		.each((_, a) => {
			const id = $(a).attr("href").slice(1);

			if (!id || page.ids.has(id)) return;

			const target = model.ids.get(id);

			if (!target) fail(`paginate: unresolved link #${id} on ${page.path}`);
			if (id.startsWith("_"))
				fail(`paginate: link from ${page.path} to #${id} crosses pages but the target has an auto-generated id; give it an explicit [[anchor]]`);

			$(a).attr("href", linkTo(prefix, page.dir, target.path) + fragment(target, id));
			count++;
		});

	return count;
}

// The sidebar: asciidoctor's own TOC markup with hrefs pointed at pages, a
// search box under the title, and the current page marked `active`. An entry
// whose sublist should be open is marked `current`: the current chapter, and
// any heading on the current page that has subheadings.
function sidebar(tocHtml, page, model, prefix) {
	const t = cheerio.load(tocHtml, null, false);
	const dir = page ? page.dir : "";

	t("a[href^='#']").each((_, a) => {
		const id = t(a).attr("href").slice(1);
		const target = model.ids.get(id);

		if (!target) fail(`paginate: TOC entry #${id} has no page`);

		const li = t(a).parent("li");

		t(a).attr("href", linkTo(prefix, dir, target.path) + fragment(target, id));

		const open = page && (li.parent().is("ul.sectlevel1") ? target.chapter === page.chapter : target === page);

		if (open && li.children("ul").length) li.addClass("current");
		if (page && target === page && target.slug === id) li.addClass("active");
	});

	t("#toctitle").after('<div id="search" data-pagefind-ignore></div>');

	return t.html();
}

// ---------------------------------------------------------------- markdown

function turndown(siteUrl, shift) {
	const td = new TurndownService({
		headingStyle: "atx",
		codeBlockStyle: "fenced",
		bulletListMarker: "-",
		emDelimiter: "*"
	});

	td.remove(["script", "style", "button"]);

	td.addRule("anchor", {
		filter: (node) => node.nodeName === "A" && node.classList.contains("anchor"),
		replacement: () => ""
	});

	td.addRule("heading", {
		filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
		replacement: (content, node) => {
			const level = Math.max(1, Number(node.nodeName[1]) - shift);
			const text = content.trim().replace(/^(\d+)\\\. /, "$1. ");

			return `\n\n${"#".repeat(level)} ${text}\n\n`;
		}
	});

	// asciidoctor wraps every list item's text in <p>; without this the
	// markdown lists come out loose.
	td.addRule("listItemParagraph", {
		filter: (node) => node.nodeName === "P" && node.parentNode && node.parentNode.nodeName === "LI",
		replacement: (content) => content
	});

	td.addRule("listing", {
		filter: (node) => node.nodeName === "DIV" && (node.classList.contains("listingblock") || node.classList.contains("literalblock")),
		replacement: (content, node) => {
			const title = childWithClass(node, "title");
			const code = node.querySelector("pre > code") ?? node.querySelector("pre");
			const lang = (code && code.getAttribute("data-lang")) || "";
			const text = code ? code.textContent.replace(/\n$/, "") : "";
			const head = title ? `**${td.escape(title.textContent.trim())}**\n\n` : "";

			return `\n\n${head}\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
		}
	});

	td.addRule("math", {
		filter: (node) => node.nodeName === "SPAN" && (node.classList.contains("katex") || node.classList.contains("katex-display")),
		replacement: (content, node) => {
			const src = node.getAttribute("data-tex") || content;

			return node.classList.contains("katex-display") ? `\n\n$$${src}$$\n\n` : `$${src}$`;
		}
	});

	td.addRule("admonition", {
		filter: (node) => node.nodeName === "DIV" && node.classList.contains("admonitionblock"),
		replacement: (content, node) => {
			const kind = ADMONITIONS.find((k) => node.classList.contains(k)) ?? "note";
			const cell = node.querySelector("td.content");
			const title = cell && childWithClass(cell, "title");
			const label = kind[0].toUpperCase() + kind.slice(1) + (title ? ": " + title.textContent.trim() : "");
			const clone = cell.cloneNode(true);

			if (title) childWithClass(clone, "title").remove();

			const body = td.turndown(clone.innerHTML).trim();
			const quoted = `**${label}**\n${body}`.split("\n").map((l) => "> " + l).join("\n");

			return `\n\n${quoted}\n\n`;
		}
	});

	td.addRule("details", {
		filter: "details",
		replacement: (content, node) => {
			const summary = node.querySelector("summary");
			const body = childWithClass(node, "content");
			const label = summary ? `**${td.escape(summary.textContent.trim())}**\n\n` : "";

			return `\n\n${label}${body ? td.turndown(body.innerHTML).trim() : content.trim()}\n\n`;
		}
	});

	td.addRule("definitionTerm", {
		filter: "dt",
		replacement: (content) => `\n\n**${content.trim()}**\n\n`
	});

	td.addRule("definition", {
		filter: "dd",
		replacement: (content) => `${content.trim()}\n\n`
	});

	td.addRule("horizontalList", {
		filter: (node) => node.nodeName === "DIV" && node.classList.contains("hdlist"),
		replacement: (content, node) => {
			const out = [];

			for (const row of all(node, "tr")) {
				const [term, def] = all(row, "td");

				if (term) out.push(`**${td.turndown(term.innerHTML).trim()}**`);
				if (def) out.push(td.turndown(def.innerHTML).trim());
			}

			return `\n\n${out.join("\n\n")}\n\n`;
		}
	});

	td.addRule("table", {
		filter: (node) => node.nodeName === "TABLE" && node.classList.contains("tableblock"),
		replacement: (content, node) => {
			const rows = all(node, "tr").map((tr) =>
				all(tr, "th, td").map((cell) => td.turndown(cell.innerHTML).replace(/\s*\n\s*/g, " ").replace(/\|/g, "\\|").trim())
			);

			if (rows.length === 0) return "";

			const caption = node.querySelector("caption");
			const head = caption ? `**${td.escape(caption.textContent.trim())}**\n\n` : "";
			const [first, ...rest] = rows;
			const line = (cells) => `| ${cells.join(" | ")} |`;

			return `\n\n${head}${line(first)}\n${line(first.map(() => "---"))}\n${rest.map(line).join("\n")}\n\n`;
		}
	});

	td.addRule("blockTitle", {
		filter: (node) => node.nodeName === "DIV" && node.classList.contains("title") && node.parentNode && /block$/.test(node.parentNode.className || ""),
		replacement: (content) => `\n\n**${content.trim()}**\n\n`
	});

	td.addRule("image", {
		filter: "img",
		replacement: (content, node) => {
			const src = node.getAttribute("src") || "";
			const alt = node.getAttribute("alt") || "";

			return src ? `![${alt}](${isRelativeAsset(src) ? siteUrl + src : src})` : "";
		}
	});

	return td;
}

// Markdown twin of one page's section markup: cross-page links go to the
// other page's markdown, assets become absolute.
function toMarkdown($, page, model, siteUrl) {
	const root = $("<div></div>").append(pageNodes(page).map((el) => $(el).clone()));

	// KaTeX keeps the TeX source in its MathML half; carry it on the wrapper
	// before that half (a duplicate of the visible text) is dropped.
	root.find("span.katex, span.katex-display").each((_, el) => {
		const tex = $(el).find('annotation[encoding="application/x-tex"]').first().text().trim();

		if (tex && !$(el).parents(".katex-display").length) $(el).attr("data-tex", tex);
	});
	root.find(".katex-mathml").remove();
	root.find("button.copy-button").remove();

	root.find('a[href^="#"]').each((_, a) => {
		const id = $(a).attr("href").slice(1);

		if (page.ids.has(id)) return;

		const target = model.ids.get(id);

		if (target) $(a).attr("href", siteUrl + target.md + fragment(target, id));
	});

	root.find("[href], [src]").each((_, el) => {
		for (const attr of ["href", "src"]) {
			const value = $(el).attr(attr);

			if (isRelativeAsset(value)) $(el).attr(attr, siteUrl + value);
		}
	});

	// The page's own heading becomes the markdown h1.
	const shift = page.kind === "section" ? 2 : 1;

	return turndown(siteUrl, shift).turndown(root.html()).replace(/\n{3,}/g, "\n\n").trim();
}

// The markdown page: the body, which opens with the page's heading, with one
// navigation line after that heading.
function mdPage(page, body, siteUrl) {
	const parts = [`${SITE_NAME}${page.kind === "section" ? " > " + page.chapter.title : ""}`, siteUrl + page.path];

	if (page.prev) parts.push("prev: " + siteUrl + page.prev.md);
	if (page.next) parts.push("next: " + siteUrl + page.next.md);

	const nav = parts.join(" | ");
	const nl = body.indexOf("\n");
	const out = nl < 0 ? `${body}\n\n${nav}` : `${body.slice(0, nl)}\n\n${nav}\n${body.slice(nl)}`;

	return out.replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

// ------------------------------------------------------------- templates

function pageHead(headHtml, page, prefix, siteUrl) {
	const h = cheerio.load(`<div id="h">${headHtml}</div>`, null, false);

	h("title, meta[property='og:title'], meta[property='og:url'], link[rel='canonical']").remove();

	const title = page ? `${page.title} - ${SITE_NAME}` : SITE_NAME;
	const canonical = page ? siteUrl + page.path : siteUrl;
	const lines = [
		`<title>${escHtml(title)}</title>`,
		`<meta property="og:title" content="${escAttr(title)}">`,
		`<meta property="og:url" content="${escAttr(canonical)}">`,
		`<link rel="canonical" href="${escAttr(canonical)}">`
	];

	if (page) {
		if (page.prev) lines.push(`<link rel="prev" href="${escAttr(linkTo(prefix, page.dir, page.prev.path))}">`);
		if (page.next) lines.push(`<link rel="next" href="${escAttr(linkTo(prefix, page.dir, page.next.path))}">`);
		lines.push(`<link rel="alternate" type="text/markdown" href="${escAttr(linkTo(prefix, page.dir, page.md))}">`);
	}

	h("#h").append(lines.join("\n"));

	return h("#h").html();
}

function navLinks(prefix, page) {
	const out = [];

	if (page.prev) out.push(`<a class="prev" rel="prev" href="${escAttr(linkTo(prefix, page.dir, page.prev.path))}">Previous: ${escHtml(page.prev.number + " " + page.prev.title)}</a>`);
	if (page.next) out.push(`<a class="next" rel="next" href="${escAttr(linkTo(prefix, page.dir, page.next.path))}">Next: ${escHtml(page.next.number + " " + page.next.title)}</a>`);

	return `<nav class="page-nav" data-pagefind-ignore>\n${out.join("\n")}\n</nav>`;
}

function breadcrumb(prefix, page) {
	const parts = [`<a href="${escAttr(prefix + "index.html")}">${SITE_NAME}</a>`];

	if (page.kind === "section")
		parts.push(`<a href="${escAttr(linkTo(prefix, page.dir, page.chapter.slug + "/"))}">${escHtml(page.chapter.number + " " + page.chapter.title)}</a>`);

	return `<nav class="breadcrumb" data-pagefind-ignore>${parts.join(' <span class="sep">&gt;</span> ')}</nav>`;
}

// Every page's footer: the credit asciidoctor's docinfo put there, then the
// machine-readable index and, on a page that has one, its markdown twin.
function footerLinks(tail, prefix, page) {
	tail("#footer").append(`\n<a href="${escAttr(prefix + "llms.txt")}">llms.txt</a>`);
	if (page) tail("#footer").append(`\n<a class="text-view" href="${escAttr(linkTo(prefix, page.dir, page.md))}">View as text</a>`);
}

// The site title heads only the home and 404 pages; a section page starts
// with its breadcrumb, whose first crumb is the same link home.
function shell({ htmlAttrs, head, sprite, toc, title, content, tail, bodyAttrs }) {
	return `<!DOCTYPE html>
<html${htmlAttrs}>
<head>
${head}
</head>
<body class="book toc2 toc-left"${bodyAttrs}>
${sprite}
<div id="header">
${title ? `<h1>${escHtml(title)}</h1>\n` : ""}${toc}
</div>
<div id="content">
${content}
</div>
${tail}
</body>
</html>
`;
}

// ------------------------------------------------------------------ main

export function paginate(html, opts) {
	const siteUrl = opts.siteUrl ?? SITE_URL;
	const legacy = opts.legacy ?? {};
	const redirects = opts.redirects ?? {};
	const $ = cheerio.load(html);
	const model = buildModel($, opts);
	const files = new Map();
	const report = { pages: [] };

	const htmlAttrs = Object.entries($("html").attr() ?? {})
		.map(([k, v]) => ` ${k}="${escAttr(v)}"`)
		.join("");
	const headHtml = $("head").html();
	const sprite = $("body > svg").first();
	const spriteHtml = sprite.length ? $.html(sprite) : "";
	const tocHtml = $.html($("#toc"));
	const tailHtml = $("#content")
		.nextAll()
		.toArray()
		.map((el) => $.html(el))
		.join("\n");
	const author = $("#header .details").length ? $.html($("#header .details")) : "";
	const blurb = model.pages.length ? model.pages[0].summary : "";

	if (!tocHtml) fail("paginate: no #toc in all.html");

	function emitPage(page, prefix) {
		const root = $('<div class="page-body"></div>').append(pageNodes(page).map((el) => $(el).clone()));
		const body = cheerio.load("<div id=\"page\"></div>", null, false);

		body("#page").append(root);

		const p = body("#page");

		// One search body per page; a chapter page with no prose yet has
		// nothing to index.
		if (page.node || page.chapter.intro.length > 0) p.find(".page-body").attr("data-pagefind-body", "").attr("data-pagefind-meta", "title:" + page.title);
		p.find(".katex-mathml").attr("data-pagefind-ignore", "");

		rerootAssets(body, p, prefix);
		rewriteLinks(body, p, page, model, prefix);

		const parts = [breadcrumb(prefix, page), p.html(), navLinks(prefix, page)];

		const tail = cheerio.load(`<div id="tail">${tailHtml}</div>`, null, false);

		rerootAssets(tail, tail("#tail"), prefix);
		footerLinks(tail, prefix, page);

		const headFrag = cheerio.load(`<div id="h">${headHtml}</div>`, null, false);

		rerootAssets(headFrag, headFrag("#h"), prefix);

		const doc = shell({
			htmlAttrs,
			head: pageHead(headFrag("#h").html(), page, prefix, siteUrl),
			sprite: spriteHtml,
			toc: sidebar(tocHtml, page, model, prefix),
			title: "",
			content: parts.filter(Boolean).join("\n"),
			tail: tail("#tail").html(),
			bodyAttrs: ""
		});

		const links = (doc.match(/href="/g) || []).length;

		const md = mdPage(page, toMarkdown($, page, model, siteUrl), siteUrl);
		const source = $("<div></div>").append(pageNodes(page).map((el) => $(el).clone()));

		source.find(".katex-mathml").remove();

		const sourceWords = words(source.text());
		const coverage = sourceWords ? Math.min(1, words(md) / sourceWords) : 1;

		files.set(`${MANUAL_DIR}/${page.file}`, doc);
		files.set(`${MANUAL_DIR}/${page.md}`, md);
		report.pages.push({
			url: page.path,
			bytes: Buffer.byteLength(doc),
			mdBytes: Buffer.byteLength(md),
			links,
			headings: page.headings.length,
			coverage: Number(coverage.toFixed(3))
		});

		if (sourceWords > 0 && coverage < 0.9) fail(`paginate: markdown for ${page.path} keeps only ${(coverage * 100).toFixed(0)}% of the section's words`);
	}

	for (const page of model.pages) emitPage(page, "../");

	// Home and 404: no search body, the chapter list, the whole-manual views,
	// and the anchor map for links into the old single page.
	function emitRoot(file, prefix) {
		const cards = model.pages
			.filter((p) => p.level === 1)
			.map((p) => {
				const summary = p.summary || (p.chapter.sections[0] && p.chapter.sections[0].page.summary) || "";

				return `<li><a href="${escAttr(prefix + p.file)}">${escHtml(p.number + " " + p.title)}</a>${summary ? `<p>${escHtml(summary)}</p>` : ""}</li>`;
			})
			.join("\n");
		const content = [
			file === "404.html" ? `<div class="paragraph"><p><strong>That page does not exist.</strong> The manual moved to one page per section; the table of contents and the search box are on the left.</p></div>` : "",
			blurb ? `<div class="paragraph"><p>${escHtml(blurb)}</p></div>` : "",
			`<ul class="chapter-list">\n${cards}\n</ul>`,
			`<div class="paragraph other-views"><p>Other views: <a href="${escAttr(prefix + "all.html")}">the whole manual on one page</a>, <a href="${escAttr(prefix + "llms.txt")}">llms.txt</a> (an index for language models), <a href="${escAttr(prefix + "llms-full.txt")}">llms-full.txt</a> (every page as text), <a href="${escAttr(prefix + "toc.json")}">toc.json</a>.</p></div>`
		];
		const tail = cheerio.load(`<div id="tail">${tailHtml}</div>`, null, false);

		rerootAssets(tail, tail("#tail"), prefix);
		footerLinks(tail, prefix, null);

		const headFrag = cheerio.load(`<div id="h">${headHtml}</div>`, null, false);

		rerootAssets(headFrag, headFrag("#h"), prefix);

		const doc = shell({
			htmlAttrs,
			head: pageHead(headFrag("#h").html(), null, prefix, siteUrl),
			sprite: "",
			toc: sidebar(tocHtml, null, model, prefix),
			title: SITE_NAME,
			content: (file === "404.html" ? "" : author) + content.filter(Boolean).join("\n"),
			tail: tail("#tail").html(),
			bodyAttrs: ` data-anchors="${escAttr(prefix + "anchors.json")}"`
		});

		files.set(file, doc);
	}

	emitRoot(`${MANUAL_DIR}/index.html`, "");
	emitRoot("404.html", `${MANUAL_DIR}/`);

	// Machine files.
	const anchors = {};

	for (const [id, page] of model.ids) anchors[id] = page.path;
	// A legacy id maps to its page, plus the fragment of the renamed heading
	// when that heading is not the page's own.
	for (const [old, id] of Object.entries(legacy)) {
		if (!model.ids.has(id)) fail(`paginate: legacy anchor ${old} points at unknown id ${id}`);

		anchors[old] = model.ids.get(id).path + fragment(model.ids.get(id), id);
	}

	const paths = new Set(model.pages.map((p) => p.path));

	for (const [old, target] of Object.entries(redirects)) {
		if (!paths.has(target)) fail(`paginate: redirect ${old} points at unknown page ${target}`);
		anchors[old] = target;
	}

	if (opts.previous && Array.isArray(opts.previous.pages))
		for (const { url } of opts.previous.pages) {
			if (typeof url !== "string" || !url.startsWith(siteUrl)) continue;

			const path = url.slice(siteUrl.length);

			if (!paths.has(path) && !(path in redirects)) fail(`paginate: previously published page ${path} vanished without an entry in src/redirects.json`);
		}

	const tocPages = model.pages.map((p) => ({
		number: p.number,
		title: p.title,
		id: p.slug,
		url: siteUrl + p.path,
		md: siteUrl + p.md,
		chapter: p.chapter.slug,
		level: p.level,
		summary: p.summary,
		headings: p.headings.map((h) => ({ id: h.id, title: h.title, number: h.number }))
	}));
	const toc = { schema: 1, title: SITE_NAME, url: siteUrl, build: opts.build ?? {}, pages: tocPages };

	const llmsLines = [`# ${SITE_NAME}`, "", `> ${blurb || "The manual for Morloc, a typed polyglot workflow language."}`, ""];

	for (const c of model.chapters) {
		llmsLines.push(`## ${c.number} ${c.title}`, "");

		for (const p of model.pages.filter((p) => p.chapter === c)) {
			const summary = p.summary ? `: ${p.summary}` : "";

			llmsLines.push(`- [${p.number} ${escMdText(p.title)}](${siteUrl}${p.md})${summary}`);
		}

		llmsLines.push("");
	}

	const llms = llmsLines.join("\n");
	const full = model.pages.map((p) => `<!-- ${siteUrl}${p.path} -->\n\n${files.get(`${MANUAL_DIR}/${p.md}`)}`).join("\n\n---\n\n");
	const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${model.pages
		.map((p) => `<url><loc>${escXml(siteUrl + p.path)}</loc></url>`)
		.join("\n")}\n</urlset>\n`;

	report.pages.sort((a, b) => (a.url < b.url ? -1 : 1));

	files.set("llms.txt", llms);
	files.set("llms-full.txt", full);
	files.set(`${MANUAL_DIR}/llms.txt`, llms);
	files.set(`${MANUAL_DIR}/llms-full.txt`, full);
	files.set(`${MANUAL_DIR}/toc.json`, JSON.stringify(toc, null, 1) + "\n");
	files.set(`${MANUAL_DIR}/build-report.json`, JSON.stringify({ schema: 1, pages: report.pages }, null, 1) + "\n");
	files.set(`${MANUAL_DIR}/sitemap.xml`, sitemap);
	files.set(`${MANUAL_DIR}/anchors.json`, JSON.stringify(anchors, null, 1) + "\n");

	const largest = report.pages.reduce((a, b) => (b.bytes > a.bytes ? b : a), report.pages[0]);
	const stats = {
		pages: model.pages.length + 2,
		md: model.pages.length,
		chapters: model.chapters.length,
		onepage: model.pages.filter((p) => p.kind === "onepage").length,
		links: report.pages.reduce((n, p) => n + p.links, 0),
		anchors: Object.keys(anchors).length,
		largest: largest ? `${largest.url}:${largest.bytes}` : "-"
	};

	return { files, report, stats, model };
}

// ------------------------------------------------------------------- CLI

function git(repo, args) {
	try {
		return execFileSync("git", ["-c", "safe.directory=*", "-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
	} catch {
		return null;
	}
}

function main() {
	const [siteRoot] = process.argv.slice(2);

	if (!siteRoot) {
		console.error("usage: paginate.mjs <site-root>");
		process.exit(1);
	}

	const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
	const manual = join(siteRoot, MANUAL_DIR);
	const html = readFileSync(join(manual, "all.html"), "utf8");
	const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
	const generator = /<meta name="generator" content="([^"]*)"/.exec(html);
	const previousText = git(repo, ["show", `HEAD:${siteRoot.replace(/\/+$/, "")}/${MANUAL_DIR}/toc.json`]);
	let previous = null;

	try {
		previous = previousText ? JSON.parse(previousText) : null;
	} catch {
		previous = null;
	}

	const build = {
		asciidoctor: generator ? generator[1] : null,
		node: process.version,
		cheerio: packageVersion("cheerio"),
		turndown: packageVersion("turndown"),
		pagefind: packageVersion("pagefind"),
		source: git(repo, ["rev-parse", "HEAD"])
	};

	let result;

	try {
		result = paginate(html, {
			siteUrl: SITE_URL,
			legacy: readJson(join(repo, "src", "legacy-anchors.json")),
			redirects: readJson(join(repo, "src", "redirects.json")),
			previous,
			build
		});
	} catch (err) {
		if (err instanceof BuildError) {
			console.error(err.message);
			process.exit(1);
		}

		throw err;
	}

	for (const [path, content] of result.files) {
		const target = join(siteRoot, path);

		mkdirSync(dirname(target), { recursive: true });
		writeFileSync(target, content);
	}

	const s = result.stats;

	console.log(`paginate: pages=${s.pages} md=${s.md} chapters=${s.chapters} onepage=${s.onepage} links=${s.links} anchors=${s.anchors} largest=${s.largest}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
