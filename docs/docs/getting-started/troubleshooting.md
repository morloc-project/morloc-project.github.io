# 3.9. Troubleshooting

Morloc Manual > Getting Started | https://morloc-project.github.io/docs/getting-started/troubleshooting.html | prev: https://morloc-project.github.io/docs/getting-started/editor-support.md | next: https://morloc-project.github.io/docs/features/index.md

The problems new users actually hit, and what to do about each.

**A command is not found**

`mim: command not found` means the install directory is not on your `PATH`. The installer never edits your shell startup files; it prints the exact command for your shell when the destination is missing, and you have to open a new shell afterwards. On macOS this is the normal case rather than the exception, because the default `PATH` is built from `/etc/paths`, which does not include `~/.local/bin`.

`morloc: command not found` is different and usually means the install worked. `morloc` lives inside an environment, not on your host `PATH`. Reach it with `mim run — morloc …​`, or open a `mim shell` and drop the prefix. `mim` is the only executable that lands on your `PATH`.

**Behind a corporate firewall**

A TLS-inspecting proxy re-signs every HTTPS connection with a private CA, so downloads fail certificate verification and `mim new` stops partway through. Point `mim` at your organization’s CA:

```console
$ mim new base --cert-bundle /path/to/corp-ca.pem
$ mim modify --env base --cert-bundle /path/to/corp-ca.pem   # after it rotates
```

The file is PEM or DER and holds your CA certificates only — `mim` supplies the public roots itself. Everything it runs that fetches — `curl`, pixi, conda, git, cargo, the language runtimes — is then pointed at the result through `SSL_CERT_FILE`, `REQUESTS_CA_BUNDLE`, `CURL_CA_BUNDLE`, `CONDA_SSL_VERIFY`, `NODE_EXTRA_CA_CERTS`, `GIT_SSL_CAINFO` and `CARGO_HTTP_CAINFO`.

Obtaining the certificate is your IT department’s business, not Morloc’s, and `--cert-bundle` is the whole of Morloc’s interface to it. It is usually already on the machine. On macOS, admin-installed certificates are in the system keychain, separate from Apple’s public roots:

```console
$ security find-certificates -a -p /Library/Keychains/System.keychain > corp-ca.pem
```

On Linux, if the host already trusts the CA it is in the system store. Prefer the drop-in directory: it holds the certificates your organization added, where the trusted bundle mixes them in with several hundred public roots.

| Distribution | Trusted bundle | Drop-in directory |
| --- | --- | --- |
| Debian, Ubuntu | `/etc/ssl/certs/ca-certificates.crt` | `/usr/local/share/ca-certificates/` |
| RHEL, Fedora | `/etc/pki/tls/certs/ca-bundle.crt` | `/etc/pki/ca-trust/source/anchors/` |
| Arch | `/etc/ssl/certs/ca-certificates.crt` | `/etc/ca-certificates/trust-source/anchors/` |
| SUSE | `/etc/ssl/ca-bundle.pem` | `/etc/pki/trust/anchors/` |

Those directories hold loose `.crt` files and `--cert-bundle` takes one file, so concatenate them when there is more than one:

```console
$ cat /usr/local/share/ca-certificates/*.crt > corp-ca.pem
```

`mim` validates the file before it builds anything and prints what it found: per certificate, the subject, whether it is a CA, whether it is self-signed, the validity dates and a SHA-256 fingerprint. It refuses the file when:

-   it is empty, or over 1 MiB — a CA bundle is a handful of certificates, so this is almost always the wrong file
-   it contains private key material — export the certificate, not the key
-   it is DER but not an X.509 certificate, such as a key or a PKCS#12 archive
-   it is text — most often a proxy error page saved with a `.pem` extension
-   nothing in it decodes as a certificate

An expired or not-yet-valid certificate is reported as a warning rather than a refusal, because a skewed system clock looks identical from here. PEM blocks that fail to parse are skipped and named, not treated as fatal.

Afterwards `mim doctor` compares the source file against the fingerprints the environment was built with, which is how you find out the CA rotated under you.

**The first build takes several minutes**

Expected. `mim new` downloads the Morloc compiler, solves a conda toolchain and builds the Morloc runtime from source against it. Your first `morloc make` in a language you have not used yet pauses again to provision that language. Both results are cached: later environments reuse the downloaded compiler, and a solve with unchanged requirements is skipped entirely.

**An import fails on a fresh environment**

`morloc make` fetches a missing module; `morloc typecheck`, `dump` and `eval` do not. Build the program once, or run `morloc install <module>` by hand, and the import resolves for every command afterwards. [Writing code that is not tied to a language](https://morloc-project.github.io/docs/getting-started/abstract-modules.md) covers this.

If the fetch itself fails rather than being skipped, it is a network problem — see the firewall entry above.

**Something else**

```console
$ mim doctor                # check the default environment
$ mim doctor --env base     # or a named one
$ mim doctor --deep         # also run checks inside the container; slower
```

`--strict` makes it exit non-zero on warnings, which is what you want in CI.
