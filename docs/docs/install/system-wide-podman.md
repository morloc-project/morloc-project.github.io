# 12.10. System-wide environments with Podman

Morloc Manual > Installation, Versions, and Deployment | https://morloc-project.github.io/docs/install/system-wide-podman.html | prev: https://morloc-project.github.io/docs/install/execution-contexts.md | next: https://morloc-project.github.io/docs/internals/index.md

Podman stores images per-user. After creating a system environment with `sudo`, configure rootless Podman to read the rootful image store by adding this line to the `[storage.options]` section of `/etc/containers/storage.conf`:

```
additionalimagestores = ["/var/lib/containers/storage"]
```

No Podman restart is needed; the setting is re-read on every invocation.

Apptainer needs no analogous configuration: `.sif` files are plain files on disk, so a system environment dropped under `/usr/local/share/morloc/environments/<env>/` is readable by every user without daemon or socket configuration. This is the natural deployment pattern on shared HPC filesystems.
