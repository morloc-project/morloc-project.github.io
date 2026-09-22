// Precaches the shell every page needs; pages themselves are cached as they
// are visited. Bump cacheName whenever the precached list changes.
const cacheName = "v0.2.0";
const cacheAssets = [
	"./",
	"./index.html",
	"./static/css/asciidoctor.css",
	"./static/css/pygments-default.css",
	"./static/css/style.css",
	"./static/css/pygments-light.css",
	"./static/css/pygments-dark.css",
	"./static/css/katex.min.css",
	"./static/css/fonts.css",
	"./static/fonts/montserrat-400-latin.woff2",
	"./static/fonts/pt-mono-400-latin.woff2",
	"./static/js/script.js",
	"./static/js/redirect.js",
	"./static/img/admonition_icons/tip.png",
	"./static/img/admonition_icons/warning.png",
	"./static/img/admonition_icons/note.png",
	"./static/img/admonition_icons/caution.png",
	"./static/img/admonition_icons/important.png",
	"./static/img/clear_cross.svg",
	"./static/img/favicon.ico",
	"./static/img/icon-192.png",
	"./static/img/icon-512.png",
	"./static/img/moon.svg",
	"./static/img/sun.svg",
	"./static/img/up-arrow.svg"
];

// Never cached at runtime: the machine-readable files (an agent wants the
// current one), the whole-manual page (2 MB), and the search index (its
// chunk names change every build).
const uncached = /\.(md|txt|json|xml)$|\/all\.html$|\/pagefind\//;

self.addEventListener("install", (e) => {
	// Cache files
	e.waitUntil(
		caches
			.open(cacheName)
			.then((cache) => cache.addAll(cacheAssets))
			.then(() => self.skipWaiting())
			.catch((err) => console.error(`Cache error: ${err}`))
	);
});

self.addEventListener("activate", (e) => {
	e.waitUntil(
		// Delete any previous cache
		caches.keys().then((cacheKeys) => {
			return Promise.all(
				cacheKeys.map((cacheKey) => {
					if (cacheKey !== cacheName) return caches.delete(cacheKey);
				})
			);
		})
	);
});

self.addEventListener("fetch", (e) => {
	if (e.request.method !== "GET") return;

	const url = new URL(e.request.url);

	if (url.origin !== self.location.origin || uncached.test(url.pathname))
		return;

	e.respondWith(
		fetch(e.request)
			.then((response) => {
				// Only a real, same-origin success is worth keeping: an error page
				// cached during a deploy would otherwise be served offline forever.
				if (response.ok && response.type === "basic") {
					const resClone = response.clone();

					caches
						.open(cacheName)
						.then((cache) => cache.put(e.request, resClone));
				}

				return response;
			})
			.catch(() =>
				caches
					.match(e.request)
					.then((response) => response || Response.error())
			)
	);
});
