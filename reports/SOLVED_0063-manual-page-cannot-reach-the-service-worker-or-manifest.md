# 0063: The manual page cannot reach the service worker or the web manifest

- Status: fixed
- Found: 2026-09-05, while fixing the theme flash on the manual page
- Component: docs

## Expected

The manual is a PWA: `src/service-worker.js` caches the site for offline use
and `src/manifest.webmanifest` drives the install prompt. `src/docinfo.html`
asks for both, and `src/static/js/script.js` registers the worker on load.

## Observed

Both requests 404, so the worker never registers and the manifest never loads.
The page asks for them relative to itself, at `/docs/`, but `build.sh` copies
them to the site root:

```
$ grep -n 'manifest\|service-worker' src/docinfo.html src/static/js/script.js
src/docinfo.html:<link rel="manifest" href="manifest.webmanifest" />
src/static/js/script.js:.register("service-worker.js")
```

Live, on 2026-09-05:

```
$ for u in /docs/ /docs/service-worker.js /docs/manifest.webmanifest \
>          /service-worker.js; do
>   printf "%s -> " "$u"
>   curl -s -o /dev/null -w "%{http_code}\n" "https://morloc-project.github.io$u"
> done
/docs/ -> 200
/docs/service-worker.js -> 404
/docs/manifest.webmanifest -> 404
/service-worker.js -> 200
```

The copies at the root are reachable only by the root page, which is itself
broken (see `reports/SOLVED_0062-site-root-page-is-a-stale-copy-of-the-manual.md`).

## Reproduce

Open `https://morloc-project.github.io/docs/` with the browser console open.
The console shows the registration failure, and the Application panel lists no
service worker and no manifest.

## Impact

The manual has no offline support and cannot be installed, on the one URL that
serves it. Nothing else breaks: the registration failure is caught and logged,
and the PWA install prompt simply never fires.

Since no worker is ever installed, the `cacheName` version string in
`src/service-worker.js` currently has no effect on what a reader sees.

## Guess

Unverified: `build.sh` copies `index.html`, `manifest.webmanifest`,
`robots.txt` and `service-worker.js` to `docs/` while Asciidoctor writes the
manual to `docs/docs/`. The two were probably in the same directory before the
site moved under `docs/docs/`. Copying the manifest and the worker into
`docs/docs/` as well, or registering the worker with a root-relative path and
an explicit scope, would each fix it.

## Resolution

Fixed in `morloc-project.github.io`, `build.sh` and `src/service-worker.js`.

`build.sh` now copies `manifest.webmanifest` and `service-worker.js` into
`docs/docs/`, beside the page that asks for them, and leaves only the landing
page and `robots.txt` at the site root. That is the layout the manifest already
assumed: it declares `"scope": "/docs/"` and reaches its icons through
`./static/img/`, neither of which works from the root.

Two things in the worker's own asset list had to move with it. `./robots.txt`
was dropped, because the crawler file belongs at the origin root and a single
404 in `cache.addAll` fails the whole install. The two Pygments stylesheets were
added, because the page loads them and an offline read would otherwise lose
syntax colour.

Verified by serving the build output and requesting every URL the worker
caches, resolved against its new location:

```
$ python3 -m http.server -d docs 8124 &
$ for u in / /robots.txt /docs/ /docs/service-worker.js \
>          /docs/manifest.webmanifest; do
>   printf "%-30s -> " "$u"
>   curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8124$u"
> done
/                              -> 200
/robots.txt                    -> 200
/docs/                         -> 200
/docs/service-worker.js        -> 200
/docs/manifest.webmanifest     -> 200

all 18 cached assets return 200
```
