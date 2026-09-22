// The installed version of a node package, found by looking for its
// package.json in the module lookup paths (NODE_PATH included). Reading the
// file directly sidesteps packages whose "exports" hide package.json from
// require().
//
// Usage: node bin/pkgversion.mjs <package>   (prints the version, or nothing)

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

export function packageVersion(name) {
	for (const dir of require.resolve.paths(name) ?? []) {
		const file = join(dir, name, "package.json");

		if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")).version ?? null;
	}

	return null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.stdout.write(packageVersion(process.argv[2]) ?? "");
