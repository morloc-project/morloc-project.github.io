# 0062: The site root page is a stale copy of the manual with broken asset paths

- Status: fixed
- Found: 2026-09-05, while fixing the theme flash on the manual page
- Component: docs

## Expected

`https://morloc-project.github.io/` is a landing page that links to the manual.
Until commit `4246b4e` (2025-10-03) `src/index.html` was exactly that: a
twenty-line black page with a single `<a href="./docs">Morloc Manual</a>`,
added in `1fbfebb` ("Make root background black").

## Observed

`src/index.html` is now a 3311-line Asciidoctor build of the manual, dated
2025-10-03. `build.sh` copies it verbatim to `docs/index.html`, so it is what
the site root serves.

Every asset it references resolves one directory too high, because the built
manual lives under `docs/docs/` and its assets under `docs/docs/static/`:

```
$ grep -n 'static/' src/index.html | head -3
535:<script defer src="static/js/script.js"></script>
582:<link rel="stylesheet" href="static/css/style.css" />
583:<link rel="stylesheet" href="static/css/pygments-light.css") />

$ ls docs
docs  index.html  manifest.webmanifest  robots.txt  service-worker.js
```

There is no `docs/static/`, so the root page loads no site CSS and no site
JavaScript. It renders with Asciidoctor's default light stylesheet only: no
dark mode, no theme switcher, no copy buttons, no working images. Its content
is also eleven months stale against `src/content/*.asc`.

Confirmed against the live site on 2026-09-05:

```
$ for u in / /static/css/style.css /docs/ /docs/static/css/style.css; do
>   printf "%s -> " "$u"
>   curl -s -o /dev/null -w "%{http_code}\n" "https://morloc-project.github.io$u"
> done
/ -> 200
/static/css/style.css -> 404
/docs/ -> 200
/docs/static/css/style.css -> 200
```

## Reproduce

Open the site root rather than `/docs`. Or, in a checkout:

```
$ ./build.sh
$ python3 -m http.server -d docs 8000
```

`http://localhost:8000/` is the broken duplicate; `http://localhost:8000/docs/`
is the real manual.

## Impact

Anyone who reaches the project's top-level URL, which is what a search engine
indexes and what a bare `morloc-project.github.io` link resolves to, gets an
unstyled and outdated manual instead of the site.

## Guess

Unverified: a build output was copied over `src/index.html` by accident. The
commit that did it is a large one ("Update planes and play with mermaids") that
touched `build.sh` and regenerated the whole site, and nothing in it suggests
the root page was meant to change. Restoring the file from `1fbfebb` is
probably the whole fix.

## Resolution

Fixed in `morloc-project.github.io`, `src/index.html` and `docs/index.html`.

The stale build is gone. `src/index.html` is again the landing page it was
before `4246b4e`: a title, a link to the manual, and nothing else. It carries
the morloc.io palette rather than the original black-and-lightblue, so the two
public pages agree on colour.

```
$ python3 -m http.server -d docs 8124 &
$ curl -s http://127.0.0.1:8124/ | tail -5
</head>
<body>
    <a href="./docs">Morloc Manual</a>
</body>
</html>
```

The guess was right: the file was a build output copied over the source.
