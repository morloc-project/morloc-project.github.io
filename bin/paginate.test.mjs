// Run with `node --test bin/paginate.test.mjs` (NODE_PATH must reach cheerio and turndown).
//
// The fixture is bin/fixtures/mini.html, rendered from fixture.adoc by
// bin/fixture.sh with the real asciidoctor, so these tests see the markup the
// manual is built from rather than a hand-written imitation of it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import { paginate } from "./paginate.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(here, "fixtures", "mini.html"), "utf8");

const SITE = "https://example.test/docs/";

function run(html = fixture, extra = {}) {
	return paginate(html, {
		siteUrl: SITE,
		legacy: {},
		redirects: {},
		previous: null,
		build: { asciidoctor: "test" },
		...extra
	});
}

function file(result, path) {
	const content = result.files.get(path);

	assert.ok(content !== undefined, `missing output file ${path}`);

	return content;
}

// ---------------------------------------------------------------- file set

test("emits one page per section, one page per chapter, one page per onepage chapter", () => {
	const { files } = run();
	const paths = [...files.keys()].sort();

	for (const p of [
		"docs/index.html",
		"404.html",
		"docs/intro/index.html",
		"docs/intro/index.md",
		"docs/features/index.html",
		"docs/features/index.md",
		"docs/features/records.html",
		"docs/features/records.md",
		"docs/features/strings.html",
		"docs/features/strings.md",
		"docs/runs/index.html",
		"docs/runs/logging.html",
		"docs/runs/logging.md",
		"docs/future/index.html",
		"docs/future/index.md",
		"llms.txt",
		"llms-full.txt",
		"docs/llms.txt",
		"docs/llms-full.txt",
		"docs/toc.json",
		"docs/build-report.json",
		"docs/sitemap.xml",
		"docs/anchors.json"
	])
		assert.ok(paths.includes(p), `expected ${p} in ${paths.join(", ")}`);

	assert.ok(!paths.includes("docs/intro/one-program.html"), "onepage chapter must not split");
	assert.ok(!paths.includes("docs/all.html"), "all.html is asciidoctor's, never paginate's");
});

test("a onepage chapter holds all of its sections as fragments", () => {
	const page = file(run(), "docs/intro/index.html");

	assert.match(page, /<h3 id="one-program"/);
	assert.match(page, /<h3 id="what-it-is-not"/);
});

// -------------------------------------------------------------------- links

test("cross-page hrefs are rewritten relative to the page; same-page hrefs are kept", () => {
	const intro = file(run(), "docs/intro/index.html");

	assert.match(intro, /href="\.\.\/features\/records\.html"/);
	assert.match(intro, /href="\.\.\/features\/records\.html#field-order"/);
	assert.match(intro, /href="#one-program"/);

	const records = file(run(), "docs/features/records.html");

	assert.match(records, /href="#_field_order"/, "heading self-anchor stays a fragment");

	const logging = file(run(), "docs/runs/logging.html");

	assert.match(logging, /href="\.\.\/intro\/index\.html#what-it-is-not"/);
	assert.match(logging, /href="\.\.\/features\/strings\.html"/, "chapter prose keeps its links");
});

test("a link to a chapter lands on its page without a fragment", () => {
	const linked = fixture.replace("Nothing to see.", 'Nothing to see. <a href="#features">Features</a> and <a href="#runs">Runs</a>.');
	const intro = file(run(linked), "docs/intro/index.html");

	assert.match(intro, /<a href="\.\.\/features\/index\.html">Features<\/a>/);
	assert.match(intro, /<a href="\.\.\/runs\/index\.html">Runs<\/a>/);

	const md = file(run(linked), "docs/intro/index.md");

	assert.match(md, /\[Features\]\(https:\/\/example\.test\/docs\/features\/index\.md\)/);
});

test("an unresolvable href fails the build naming the target", () => {
	const broken = fixture.replace('href="#records"', 'href="#nowhere"');

	assert.throws(() => run(broken), /nowhere/);
});

test("a cross-page href to an auto-generated id fails the build", () => {
	const broken = fixture.replace('href="#field-order"><code>', 'href="#_field_order"><code>');

	assert.throws(() => run(broken), /_field_order/);
});

test("legacy ids feed the redirect map but never resolve in-body links", () => {
	const { files } = run(fixture, { legacy: { _old_records: "records", _old_order: "field-order" } });
	const anchors = JSON.parse(files.get("docs/anchors.json"));

	assert.equal(anchors._old_records, "features/records.html");
	assert.equal(anchors._old_order, "features/records.html#field-order");
	assert.equal(anchors.records, "features/records.html");
	assert.equal(anchors["field-order"], "features/records.html");
	assert.equal(anchors.intro, "intro/");

	const stale = fixture.replace('href="#records"', 'href="#_old_records"');

	assert.throws(() => run(stale, { legacy: { _old_records: "records" } }), /_old_records/);
});

test("assets are re-rooted and no unprefixed static path survives", () => {
	const records = file(run(), "docs/features/records.html");

	assert.match(records, /href="\.\.\/static\/css\/style\.css"/);
	assert.match(records, /href="\.\.\/static\/css\/asciidoctor\.css"/);
	assert.match(records, /href="\.\.\/manifest\.webmanifest"/);
	assert.doesNotMatch(records, /"static\//);

	const home = file(run(), "docs/index.html");

	assert.match(home, /href="static\/css\/style\.css"/);
});

// -------------------------------------------------------------------- slugs

test("a chapter or section heading with an auto-generated id fails the build", () => {
	const broken = fixture.replaceAll('id="records"', 'id="_records"').replaceAll('href="#records"', 'href="#_records"');

	assert.throws(() => run(broken), /_records/);
});

test("a reserved slug fails the build", () => {
	const broken = fixture.replaceAll('id="records"', 'id="index"').replaceAll('href="#records"', 'href="#index"');

	assert.throws(() => run(broken), /reserved/);
});

test("a duplicate id fails the build", () => {
	const broken = fixture.replace('<h3 id="logging"', '<h3 id="strings"');

	assert.throws(() => run(broken), /strings/);
});

// ------------------------------------------------------------- page markup

test("a section page carries title, canonical, prev/next, alternate and the search body", () => {
	const records = file(run(), "docs/features/records.html");

	assert.match(records, /<title>Records, "tuples" \[and lists\] - Morloc Manual<\/title>/);
	assert.match(records, /<link rel="canonical" href="https:\/\/example\.test\/docs\/features\/records\.html">/);
	assert.match(records, /<link rel="prev" href="index\.html">/);
	assert.match(records, /<link rel="next" href="strings\.html">/);
	assert.match(records, /<link rel="alternate" type="text\/markdown" href="records\.md">/);
	assert.equal(records.match(/data-pagefind-body/g).length, 1);
	assert.match(records, /data-pagefind-meta="title:Records, &quot;tuples&quot; \[and lists\]"/);
	assert.match(records, /<symbol id="copy-glyph"/);
	assert.match(records, /<body class="book toc2 toc-left">/);
	assert.match(records, /class="pwa-install-div/);
	assert.doesNotMatch(records, /<h1/, "the site title is not repeated above every page");
	assert.match(records, /<nav class="breadcrumb"[^>]*><a href="index\.html">2\. Syntax &amp; Features<\/a><\/nav>/, "the breadcrumb names the chapter, not the site");
	assert.doesNotMatch(records.match(/<div id="content">[\s\S]*/)[0].split('<div id="footer">')[0], /Morloc Manual<\/a>/, "no link home above the footer");
	assert.doesNotMatch(file(run(), "docs/features/index.html"), /class="breadcrumb"/, "a chapter page has no breadcrumb");
});

test("the footer is spaced links: the credit, home, llms.txt, and the text twin", () => {
	const records = file(run(), "docs/features/records.html");
	const footer = records.match(/<div id="footer">[\s\S]*?<\/div>/)[0];

	assert.match(footer, /<span class="credit">Created with <a [^>]*><i>Asciidoctor Jet<\/i><\/a><\/span>/);
	assert.match(footer, /<a class="home" href="\.\.\/index\.html">Home<\/a>\s*<a href="\.\.\/llms\.txt">llms\.txt<\/a>/);
	assert.match(footer, /<a class="text-view" href="records\.md">View as text<\/a>/);
	assert.doesNotMatch(footer, /Created using|Jet<\/i><\/a>\./);

	const nav = records.match(/<nav class="page-nav"[\s\S]*?<\/nav>/)[0];

	assert.doesNotMatch(nav, /View as text/);
	assert.match(nav, /Previous: 2\. Syntax/);
	assert.match(nav, /Next: 2\.2\. Strings/);

	const home = file(run(), "docs/index.html");

	assert.match(home, /<div id="footer">[\s\S]*?<\/div>/);
	assert.doesNotMatch(home.match(/<div id="footer">[\s\S]*?<\/div>/)[0], /View as text/, "the home page has no text twin");
	assert.match(home.match(/<div id="footer">[\s\S]*?<\/div>/)[0], /<a class="home" href="index\.html">Home<\/a>\s*<a href="llms\.txt">llms\.txt<\/a>/, "the home footer matches every other page's");
	assert.match(file(run(), "404.html").match(/<div id="footer">[\s\S]*?<\/div>/)[0], /<a class="home" href="docs\/index\.html">Home<\/a>/);
});

test("the last section of a chapter links forward to the next landing", () => {
	const strings = file(run(), "docs/features/strings.html");

	assert.match(strings, /<link rel="next" href="\.\.\/runs\/index\.html">/);
});

test("the sidebar is the full TOC with the current chapter and section marked", () => {
	const records = file(run(), "docs/features/records.html");

	assert.match(records, /<li class="current"><a href="index\.html">2\. Syntax &amp; Features<\/a>/);
	assert.match(records, /<li class="current active"><a href="records\.html">2\.1\. Records/);
	assert.match(records, /<a href="\.\.\/runs\/logging\.html">3\.1\. Logging<\/a>/);
	assert.match(records, /<a href="\.\.\/intro\/index\.html#one-program">1\.1\. One program<\/a>/);
});

test("the sidebar opens the current page's subsections and no other page's", () => {
	const records = file(run(), "docs/features/records.html");

	assert.match(
		records,
		/<li class="current active"><a href="records\.html">2\.1\. Records[^\n]*\n<ul class="sectlevel3">\n<li><a href="records\.html#_field_order">2\.1\.1\. Field order<\/a><\/li>\n<li><a href="records\.html#field-order">2\.1\.2\. <code>where<\/code> and order<\/a><\/li>\n<\/ul>/
	);
	assert.doesNotMatch(records, /<nav class="page-toc"/, "the subsections live in the sidebar, not in an on-page list");

	const strings = file(run(), "docs/features/strings.html");

	assert.match(strings, /<li><a href="records\.html">2\.1\. Records[^\n]*\n<ul class="sectlevel3">/, "another page's subsection list is present but not open");
	assert.match(strings, /<li class="active"><a href="strings\.html">2\.2\. Strings<\/a><\/li>/);

	const intro = file(run(), "docs/intro/index.html");

	assert.match(intro, /<li class="current active"><a href="index\.html">1\. Intro<\/a>\n<ul class="sectlevel2">\n<li><a href="index\.html#one-program">/, "a one-page chapter is open; an entry with nothing under it is not marked");
	assert.match(strings, /<li class="active"><a href="strings\.html">/, "an entry with nothing under it is not marked open");
});

test("a chapter page is the chapter heading and its prose, nothing else", () => {
	const runs = file(run(), "docs/runs/index.html");

	assert.match(runs, /<h2 id="runs">[\s\S]*Chapter prose that a landing page must carry/);
	assert.match(runs, /href="\.\.\/features\/strings\.html"/);
	assert.doesNotMatch(runs, /Logs go to standard error\./, "no section content");

	const content = runs.slice(runs.indexOf('<div id="content">'), runs.indexOf('<nav class="page-nav"'));

	assert.doesNotMatch(content, /logging\.html/, "no section list: the sidebar already has one");
	assert.equal(runs.match(/data-pagefind-body/g).length, 1);
	assert.match(runs, /<link rel="next" href="logging\.html">/);

	const features = file(run(), "docs/features/index.html");

	assert.match(features, /<h2 id="features">/);
	assert.doesNotMatch(features, /data-pagefind-body/, "no prose yet, nothing to index");
	assert.doesNotMatch(features, /Records name their fields/, "no section summaries");

	const records = file(run(), "docs/features/records.html");

	assert.doesNotMatch(records, /<h2 /, "a section page carries no chapter heading");
});

test("home and 404 have no search body; only 404 lists the whole-manual views", () => {
	const home = file(run(), "docs/index.html");
	const notFound = file(run(), "404.html");

	for (const page of [home, notFound]) {
		assert.doesNotMatch(page, /data-pagefind-body/);
		assert.match(page, /data-anchors="/);
	}

	assert.match(notFound, /Other views:.*all\.html/);
	assert.doesNotMatch(home, /Other views|all\.html/);

	assert.match(notFound, /href="docs\/static\/css\/style\.css"/);
	assert.match(home, /<h1>Morloc Manual<\/h1>/, "the home page is the one that carries the title");
});

// The preamble, between the document header and the first chapter, is the
// home page's body.
const PREAMBLE = `<div id="preamble">
<div class="sectionbody">
<div class="paragraph home-tagline"><p>A tagline.</p></div>
<div class="paragraph"><p>See <a href="#records">Records</a> and <a href="#features">Features</a>. <img src="static/img/x.svg" alt="x"></p></div>
<div class="listingblock"><div class="content"><pre>code</pre><button class="copy-button" type="button" aria-label="Copy code"><svg class="copy-icon" width="16" height="16" aria-hidden="true"><use href="#copy-glyph"></use></svg></button></div></div>
</div>
</div>`;
const withPreamble = fixture.replace('<div id="content">', `<div id="content">\n${PREAMBLE}`);

test("the home page is the preamble, with links pointed at pages, and no chapter list", () => {
	const home = file(run(withPreamble), "docs/index.html");

	assert.match(home, /<div class="paragraph home-tagline"><p>A tagline\.<\/p><\/div>/);
	assert.match(home, /<a href="features\/records\.html">Records<\/a>/);
	assert.match(home, /<a href="features\/index\.html">Features<\/a>/);
	assert.match(home, /<img src="static\/img\/x\.svg"/);
	assert.match(home, /<symbol id="copy-glyph"/, "a copy button on the home page needs the sprite");
	assert.doesNotMatch(home, /chapter-list/, "the sidebar is the table of contents");
	assert.doesNotMatch(home, /Chapter prose before any section/, "no chapter summary is repeated on the home page");
});

test("the 404 page carries neither the preamble nor a chapter list", () => {
	const notFound = file(run(withPreamble), "404.html");

	assert.match(notFound, /That page does not exist/);
	assert.doesNotMatch(notFound, /A tagline/);
	assert.doesNotMatch(notFound, /chapter-list/);
});

test("the preamble stays off every chapter page and out of the markdown", () => {
	const result = run(withPreamble);

	assert.doesNotMatch(file(result, "docs/intro/index.html"), /A tagline/);
	assert.doesNotMatch(file(result, "docs/intro/index.md"), /A tagline/);
	assert.doesNotMatch(file(result, "docs/llms-full.txt"), /A tagline/);
});

test("an id in the preamble fails the build", () => {
	const broken = withPreamble.replace('<div class="paragraph home-tagline">', '<div class="paragraph home-tagline" id="tag">');

	assert.throws(() => run(broken), /"tag"/);
});

test("a preamble link to a missing id fails the build", () => {
	const broken = withPreamble.replace('href="#records"', 'href="#nowhere"');

	assert.throws(() => run(broken), /nowhere/);
});

// ----------------------------------------------------------------- markdown

test("markdown keeps code fences with their language and no highlighting spans", () => {
	const md = file(run(), "docs/features/records.md");

	assert.match(md, /```morloc\nmodule m \(f\)\nf :: Int -> Str\n```/);
	assert.match(md, /```console\n\$ \.\/rec f 1\n"1"\n```/);
	assert.match(md, /```\nliteral block, no language\n```/);
	assert.doesNotMatch(md, /<span/);
	assert.doesNotMatch(md, /copy-button|Copy code/);
});

test("markdown renders admonitions, collapsibles and shifted headings", () => {
	const md = file(run(), "docs/features/records.md");

	assert.match(md, /^# 2\.1\. Records, "tuples" \\\[and lists\\\]\n\nMorloc Manual > Syntax & Features \| /m, "the page heading opens the twin, the nav line follows it");
	assert.match(md, /^> \*\*Warning: Experimental Feature\*\*\n> An admonition comes first/m);
	assert.match(md, /^## 2\.1\.1\. Field order$/m);
	assert.match(md, /^## 2\.1\.2\. `where` and order$/m);

	const runs = file(run(), "docs/runs/index.md");

	assert.match(runs, /^# 3\. Managing Runs\n\nMorloc Manual \| https:\/\/example\.test\/docs\/runs\/ \| prev: [^\n]*strings\.md \| next: [^\n]*logging\.md\n\nChapter prose that a landing page must carry, with a link to \[Strings\]\(https:\/\/example\.test\/docs\/features\/strings\.md\)\.\n$/m);
	assert.doesNotMatch(runs, /3\.1\. Logging/, "no section list");
	assert.equal(file(run(), "docs/features/index.md"), "# 2. Syntax & Features\n\nMorloc Manual | https://example.test/docs/features/ | prev: https://example.test/docs/intro/index.md | next: https://example.test/docs/features/records.md\n", "a chapter without prose is its heading and the nav line");
	assert.match(md, /\*\*Why the order matters\*\*\n\nCollapsed detail about ordering\./);
	assert.match(md, /Ampersand & angle <brackets> in prose/);
});

test("markdown escapes table pipes, renders lists, math and images", () => {
	const md = file(run(), "docs/features/strings.md");

	assert.match(md, /\| `Bool` \| `\\\|\\\|` \| `True \\\| False` \|/);
	assert.match(md, /\| headerless \| table \|\n\| --- \| --- \|\n\| second \| row \|/);
	assert.match(md, /\$O\(n\)\$/);
	assert.match(md, /\$\\sum_\{i=1\}\^\{n\} i = \\frac\{n\(n\+1\)\}\{2\}\$/);
	assert.match(md, /!\[An icon\]\(https:\/\/example\.test\/docs\/static\/img\/icon-192\.png\)/);
	assert.match(md, /^-\s+a bullet$/m);
	assert.match(md, /^1\.\s+first step$/m);
	assert.match(md, /\*\*`Str`\*\*/);
	assert.match(md, /\*\*Term\*\*/);
	assert.doesNotMatch(md, /katex|annotation/);
});

test("markdown links stay in markdown and the header line carries navigation", () => {
	const md = file(run(), "docs/runs/logging.md");

	assert.match(md, /\[Records, "tuples" \\\[and lists\\\]\]\(https:\/\/example\.test\/docs\/features\/records\.md\)/);
	assert.match(md, /^Morloc Manual > Managing Runs \| https:\/\/example\.test\/docs\/runs\/logging\.html \| prev: https:\/\/example\.test\/docs\/runs\/index\.md \| next: https:\/\/example\.test\/docs\/future\/index\.md$/m);
});

test("markdown of a section covers its text", () => {
	const { report } = run();

	for (const page of report.pages)
		if (page.mdBytes) assert.ok(page.coverage >= 0.9, `${page.url} coverage ${page.coverage}`);
});

// ----------------------------------------------------------- machine files

test("llms.txt lists every page under its chapter with the summary, links pointing at markdown", () => {
	const llms = file(run(), "llms.txt");

	assert.match(llms, /^# Morloc Manual\n\n> /);
	assert.match(llms, /^## 2\. Syntax & Features$/m);
	assert.match(llms, /^- \[2\.1\. Records, "tuples" \\\[and lists\\\]\]\(https:\/\/example\.test\/docs\/features\/records\.md\): Records name their fields\.$/m);
	assert.match(llms, /^- \[1\. Intro\]\(https:\/\/example\.test\/docs\/intro\/index\.md\): /m);
	assert.equal(file(run(), "docs/llms.txt"), llms);
});

test("llms-full.txt concatenates every markdown page behind its canonical url", () => {
	const full = file(run(), "llms-full.txt");

	assert.match(full, /<!-- https:\/\/example\.test\/docs\/features\/records\.html -->\n\n# 2\.1\. Records/);
	assert.ok(full.indexOf("<!-- https://example.test/docs/intro/ -->") < full.indexOf("<!-- https://example.test/docs/features/records.html -->"));
});

test("toc.json is versioned, ordered, escaped by JSON and free of timestamps", () => {
	const toc = JSON.parse(file(run(), "docs/toc.json"));

	assert.equal(toc.schema, 1);
	assert.equal(toc.url, SITE);
	assert.equal(toc.build.asciidoctor, "test");
	assert.deepEqual(
		toc.pages.map((p) => p.url),
		[
			"https://example.test/docs/intro/",
			"https://example.test/docs/features/",
			"https://example.test/docs/features/records.html",
			"https://example.test/docs/features/strings.html",
			"https://example.test/docs/runs/",
			"https://example.test/docs/runs/logging.html",
			"https://example.test/docs/future/"
		]
	);

	const records = toc.pages[2];

	assert.equal(records.title, 'Records, "tuples" [and lists]');
	assert.equal(records.number, "2.1.");
	assert.equal(records.chapter, "features");
	assert.equal(records.level, 2);
	assert.equal(records.md, "https://example.test/docs/features/records.md");
	assert.equal(records.summary, "Records name their fields.");
	assert.deepEqual(
		records.headings.map((h) => h.id),
		["_field_order", "field-order"]
	);
	assert.equal(toc.pages[1].title, "Syntax & Features");
	assert.equal(toc.pages[1].level, 1);
	assert.doesNotMatch(JSON.stringify(toc), /\d{4}-\d{2}-\d{2}T/);
});

test("sitemap.xml escapes and lists every page once", () => {
	const sitemap = file(run(), "docs/sitemap.xml");

	assert.equal(sitemap.match(/<url>/g).length, 7);
	assert.match(sitemap, /<loc>https:\/\/example\.test\/docs\/features\/records\.html<\/loc>/);
	assert.doesNotMatch(sitemap, /<lastmod>/);
});

test("build-report.json is per page and deterministic", () => {
	const a = file(run(), "docs/build-report.json");
	const b = file(run(), "docs/build-report.json");

	assert.equal(a, b);

	const report = JSON.parse(a);

	assert.ok(report.pages.find((p) => p.url === "features/records.html").bytes > 1000);
});

test("a previously published url must survive or be redirected", () => {
	const previous = { pages: [{ url: SITE + "features/records.html" }, { url: SITE + "features/gone.html" }] };

	assert.throws(() => run(fixture, { previous }), /features\/gone\.html/);

	const redirects = { "features/gone.html": "features/records.html" };

	assert.doesNotThrow(() => run(fixture, { previous, redirects }));

	const anchors = JSON.parse(file(run(fixture, { previous, redirects }), "docs/anchors.json"));

	assert.equal(anchors["features/gone.html"], "features/records.html");
});


// ------------------------------------------------------------ redirect.js

test("the redirect script resolves only known ids to validated relative pages", () => {
	const source = readFileSync(join(here, "..", "src", "static", "js", "redirect.js"), "utf8");
	const sandbox = {};

	vm.runInNewContext(source, sandbox);

	const map = { records: "features/records.html", intro: "intro/", _old_order: "features/records.html#field-order", "features/gone.html": "features/records.html", evil: "https://evil.test/x" };
	const resolve = sandbox.morlocResolveAnchor;

	assert.equal(resolve(map, "#records"), "features/records.html#records");
	assert.equal(resolve(map, "#_old_order"), "features/records.html#field-order");
	assert.equal(resolve(map, "#intro"), "intro/#intro");
	assert.equal(resolve(map, "#__proto__"), null);
	assert.equal(resolve(map, "#constructor"), null);
	assert.equal(resolve(map, "#https://evil.test"), null);
	assert.equal(resolve(map, "#evil"), null, "a value that is not a relative page is refused");
	assert.equal(resolve(map, "#unknown"), null);
	assert.equal(resolve(map, ""), null);
	assert.equal(sandbox.morlocResolvePath(map, "/docs/features/gone.html"), "features/records.html");
	assert.equal(sandbox.morlocResolvePath(map, "/docs/features/records.html"), null);
});
