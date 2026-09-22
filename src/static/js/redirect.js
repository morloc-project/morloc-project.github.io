// Sends links into the old single-page manual (/docs/#some_anchor) and
// links to pages that have since moved to their current page.
//
// Only a page whose <body> carries data-anchors (the manual home and the
// 404 page) does anything: it fetches the anchor map paginate.mjs wrote and
// navigates when the fragment, or the requested path, has an entry. A value
// is used only if it looks like a page path inside the manual, so the map
// can never send the browser off-site, and the fragment is never placed
// anywhere but after the "#".

var MORLOC_PAGE = /^[a-z][a-z0-9-]*\/([a-z][a-z0-9-]*\.html)?(#[A-Za-z0-9_-]+)?$/;

function morlocLookup(map, key) {
	if (!map || typeof key !== "string" || !key) return null;
	if (!Object.prototype.hasOwnProperty.call(map, key)) return null;

	var value = map[key];

	return typeof value === "string" && MORLOC_PAGE.test(value) ? value : null;
}

// "#id" -> "chapter/page.html#id", or null. A value that already names a
// fragment (a renamed heading) is used as it is.
function morlocResolveAnchor(map, hash) {
	if (typeof hash !== "string" || hash.charAt(0) !== "#") return null;

	var id = hash.slice(1);
	var page = morlocLookup(map, id);

	if (!page) return null;

	return page.indexOf("#") >= 0 ? page : page + "#" + id;
}

// "/docs/old/page.html" -> "new/page.html", or null.
function morlocResolvePath(map, pathname, base) {
	base = base || "/docs/";

	if (typeof pathname !== "string" || pathname.indexOf(base) !== 0) return null;

	return morlocLookup(map, pathname.slice(base.length));
}

(function () {
	if (typeof document === "undefined" || !document.body) return;

	var src = document.body.getAttribute("data-anchors");

	if (!src) return;

	var mapUrl = new URL(src, location.href);
	var base = mapUrl.pathname.replace(/anchors\.json$/, "");

	if (!location.hash && location.pathname.indexOf(base) !== 0) return;

	fetch(mapUrl.href)
		.then(function (r) {
			return r.ok ? r.json() : null;
		})
		.then(function (map) {
			var target = morlocResolveAnchor(map, location.hash);

			if (!target) {
				var page = morlocResolvePath(map, location.pathname, base);

				if (page) target = page.indexOf("#") >= 0 ? page : page + location.hash;
			}

			if (target) location.replace(new URL(target, mapUrl).href);
		})
		.catch(function () {});
})();
