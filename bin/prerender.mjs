// Bakes work the browser used to do on every visit into the built HTML:
// LaTeX is typeset with KaTeX and code blocks get their copy button, so the
// page needs no math engine and no per-block DOM construction at load.
//
// Usage: node bin/prerender.mjs <html-file> <macro-file>

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

// Required rather than imported so that NODE_PATH is honoured: the build image
// installs katex outside the source tree.
const katex = createRequire(import.meta.url)("katex");

const [htmlPath, macroPath] = process.argv.slice(2);

if (!htmlPath || !macroPath) {
	console.error("usage: prerender.mjs <html-file> <macro-file>");
	process.exit(1);
}

// Regions whose text is never math and never gains a copy button.
const OPAQUE = /<(pre|script|style|textarea)\b[^>]*>[\s\S]*?<\/\1>/gi;

const ENTITIES = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " "
};

function decodeEntities(text) {
	return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body) => {
		if (body[0] === "#") {
			const code =
				body[1] === "x" || body[1] === "X"
					? parseInt(body.slice(2), 16)
					: parseInt(body.slice(1), 10);
			return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
		}

		const named = ENTITIES[body.toLowerCase()];

		return named === undefined ? whole : named;
	});
}

// Split into alternating [outside, opaque, outside, ...] so a transform only
// ever sees markup it is allowed to rewrite.
function mapOutsideOpaque(html, transform) {
	let out = "";
	let last = 0;

	OPAQUE.lastIndex = 0;

	for (let m = OPAQUE.exec(html); m; m = OPAQUE.exec(html)) {
		out += transform(html.slice(last, m.index)) + m[0];
		last = m.index + m[0].length;
	}

	return out + transform(html.slice(last));
}

// The text a transform is allowed to see, joined; used to audit the result.
function outsideOpaque(html) {
	let out = "";

	mapOutsideOpaque(html, (chunk) => {
		out += chunk;

		return chunk;
	});

	return out;
}

// ---- math -------------------------------------------------------------

// Asciidoctor emits latexmath as MathJax delimiters in the text: \(inline\)
// and \[display\]. Both are typeset here and the delimiters disappear.
const MATH = /\\\((.+?)\\\)|\\\[([\s\S]+?)\\\]/g;

const macros = {};
let mathCount = 0;

// \def and \newcommand mutate the shared macro table under globalGroup, which
// is how the macro file reaches every later expression.
katex.renderToString(readFileSync(macroPath, "utf8"), {
	macros,
	globalGroup: true,
	throwOnError: true,
	displayMode: true
});

function renderMath(text) {
	return text.replace(MATH, (whole, inline, display) => {
		const tex = decodeEntities(inline === undefined ? display : inline);

		try {
			const html = katex.renderToString(tex, {
				macros,
				displayMode: inline === undefined,
				throwOnError: true,
				strict: "ignore"
			});

			mathCount += 1;

			return html;
		} catch (err) {
			console.error(`prerender: cannot typeset ${whole}\n  ${err.message}`);
			process.exit(1);
		}
	});
}

// ---- copy buttons -----------------------------------------------------

// One sprite definition serves every button; each button only references it.
const COPY_SPRITE =
	'<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" ' +
	'style="position:absolute" aria-hidden="true"><symbol id="copy-glyph" ' +
	'viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" ' +
	'stroke-linejoin="round">' +
	'<path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 ' +
	'2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 ' +
	'-2.667 -2.667z"></path><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 ' +
	'-1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1"></path>' +
	'</symbol></svg>';

const COPY_ICON =
	'<svg class="copy-icon" width="16" height="16" aria-hidden="true">' +
	'<use href="#copy-glyph"></use></svg>';

// The button sits in the wrapper that holds the <pre>, matching the structure
// asciidoctor emits for a listing block.
const CODE_BLOCK = /(<div class="content">\s*<pre\b[^>]*>\s*<code\b([^>]*)>[\s\S]*?<\/code><\/pre>\s*)(<\/div>)/g;

let buttonCount = 0;

function addCopyButtons(html) {
	return html.replace(CODE_BLOCK, (whole, body, codeAttrs, close) => {
		const stripsPrompt = /data-lang="console"/.test(codeAttrs);

		buttonCount += 1;

		return (
			body +
			'<button class="copy-button" type="button" aria-label="Copy code"' +
			(stripsPrompt ? ' data-strip-prompt="true"' : "") +
			">" +
			COPY_ICON +
			"</button>" +
			close
		);
	});
}

// ---- mathjax removal --------------------------------------------------

function dropMathJax(html) {
	return html
		.replace(/<script type="text\/x-mathjax-config">[\s\S]*?<\/script>\n?/g, "")
		.replace(/<script[^>]*\bsrc="[^"]*mathjax[^"]*"[^>]*><\/script>\n?/gi, "");
}

// ---- run --------------------------------------------------------------

let html = readFileSync(htmlPath, "utf8");
const before = html.length;

html = dropMathJax(html);

if (/<script[^>]*mathjax|text\/x-mathjax/i.test(html)) {
	console.error("prerender: MathJax still referenced after removal");
	process.exit(1);
}

html = mapOutsideOpaque(html, renderMath);

// Anything left in MathJax's delimiters would ship as raw source. \$ is the
// asciimath form, which KaTeX cannot read at all: fail rather than serve it.
const stray = /\\\(.{0,60}|\\\[.{0,60}|\\\$.{0,60}/.exec(outsideOpaque(html));

if (stray) {
	console.error(`prerender: unrendered math near ${stray[0]}`);
	process.exit(1);
}

html = addCopyButtons(html);

if (buttonCount > 0) {
	const body = /<body\b[^>]*>/.exec(html);

	if (!body) {
		console.error("prerender: no <body> to hold the icon sprite");
		process.exit(1);
	}

	html = html.replace(body[0], body[0] + "\n" + COPY_SPRITE);
}

writeFileSync(htmlPath, html);

console.log(
	`prerender: ${mathCount} expressions typeset, ${buttonCount} copy buttons ` +
		`baked, ${before} -> ${html.length} bytes`
);
