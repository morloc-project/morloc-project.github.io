const pwaInstallDiv = document.querySelector(".pwa-install-div");
const pwaInstallBtn = document.querySelector("#pwa-install-btn");
const pwaInstallDismiss = document.querySelector("#pwa-install-dismiss");
const backToTopBtn = document.querySelector(".back-to-top-btn");
const header = document.querySelector("#header");
const body = document.querySelector("body");

const storageKey = "theme";
const root = document.documentElement;

let pwaInstallEvent;
let themeBtn;
let systemDarkTheme = window.matchMedia("(prefers-color-scheme: dark)");

// The manual's directory, whatever page this is: the manifest link is written
// relative to it on every page.

const manifestLink = document.querySelector('link[rel="manifest"]');
const manualUrl = manifestLink
	? new URL(".", manifestLink.href)
	: new URL(".", location.href);

// Service worker and PWA

if (navigator.serviceWorker && manifestLink) {
	window.addEventListener("load", () => {
		navigator.serviceWorker
			.register(new URL("service-worker.js", manualUrl))
			.catch((err) => console.error(`Service Worker error: ${err}`));
	});

	window.addEventListener("beforeinstallprompt", (e) => {
		e.preventDefault();
		pwaInstallEvent = e;
		showPWAInstallPrompt();
	});

	if (pwaInstallBtn)
		pwaInstallBtn.addEventListener("click", () => {
			pwaInstallEvent.prompt();
			pwaInstallDiv.classList.add("hidden");
		});

	if (pwaInstallDismiss)
		pwaInstallDismiss.addEventListener("click", () =>
			dismissPWAInstallPrompt()
		);
}

// Search (Pagefind's UI, when its bundle is on the page)
//
// The UI never reports a bundle it cannot load: it shows "Searching..."
// forever. The bundle is unreachable from a file:// page (module imports and
// fetch are refused there) and offline (the index is never cached), so probe
// its entry file and replace the box with a message when the probe fails.

document.addEventListener("DOMContentLoaded", () => {
	const mount = document.querySelector("#search");

	if (!mount || typeof PagefindUI === "undefined") return;

	const bundleUrl = new URL("pagefind/", manualUrl);

	const ui = new PagefindUI({
		element: "#search",
		baseUrl: manualUrl.pathname,
		bundlePath: bundleUrl.pathname,
		showImages: false,
		showSubResults: true,
		excerptLength: 20
	});

	fetch(new URL("pagefind-entry.json", bundleUrl), { cache: "no-store" })
		.then((response) => {
			if (!response.ok) throw new Error(response.status);
		})
		.catch(() => {
			ui.destroy();

			const note = document.createElement("p");
			note.className = "search-unavailable";

			if (location.protocol === "file:") {
				const all = document.createElement("a");
				all.href = new URL("all.html", manualUrl).href;
				all.textContent = "the whole manual on one page";
				note.append(
					"Search needs the manual served over http (make serve). Opened from disk, use the browser's find on ",
					all,
					"."
				);
			} else {
				note.textContent = "Search is unavailable offline.";
			}

			mount.replaceChildren(note);
		});
});

// DOM ready listener

document.addEventListener("DOMContentLoaded", () => {
	createThemeSwitcher();
	applyTheme(currentTheme()); // The head script already set the class.
	mobileEdgeCaseStyling();
});

// System/browser theme change listener

if (!systemDarkTheme.addEventListener)
	systemDarkTheme.addEventListener = (event, listener) =>
		systemDarkTheme.addListener(listener);

systemDarkTheme.addEventListener("change", (e) => {
	if (!storedTheme()) applyTheme(e.matches ? "dark" : "light");
});

// Code block copy buttons
//
// The buttons themselves are baked into the HTML at build time; one delegated
// listener serves all of them.

document.addEventListener("click", (e) => {
	const button = e.target.closest(".copy-button");

	if (!button) return;

	const block = button.parentNode.querySelector("pre > code");

	if (!block) return;

	let text = block.innerText;

	if (button.dataset.stripPrompt)
		text = text
			.split("\n")
			.map((line) => line.replace(/^\$\s/, ""))
			.join("\n");

	navigator.clipboard.writeText(text).then(() => {
		button.classList.add("copied");
		setTimeout(() => button.classList.remove("copied"), 300);
	});
});

// Back to top button

if (header && backToTopBtn) {
	const observer = new IntersectionObserver(scrollToTop);
	observer.observe(header);

	backToTopBtn.addEventListener("click", () => header.scrollIntoView(true));
}

// Functions

function showPWAInstallPrompt() {
	if (!pwaInstallDiv) return;

	pwaInstallDiv.classList.remove("hidden");
	pwaInstallDiv.classList.add("pwa-install-div-summon");
}

function dismissPWAInstallPrompt() {
	if (!pwaInstallDiv) return;

	pwaInstallDiv.classList.add("pwa-install-div-dismiss");
	setTimeout(() => pwaInstallDiv.classList.add("hidden"), 2000);
}

function scrollToTop(entries, observer) {
	entries.forEach((entry) => {
		if (entry.isIntersecting) backToTopBtn.classList.add("hidden");
		else backToTopBtn.classList.remove("hidden");
	});
}

function createThemeSwitcher() {
	themeBtn = document.createElement("button");

	themeBtn.classList.add("btn", "theme-switcher");
	themeBtn.addEventListener("click", switchTheme);
	body.appendChild(themeBtn);
}

function currentTheme() {
	return root.classList.contains("dark") ? "dark" : "light";
}

function storedTheme() {
	try {
		return localStorage.getItem(storageKey);
	} catch (e) {
		return null;
	}
}

function switchTheme() {
	const theme = currentTheme() === "dark" ? "light" : "dark";

	applyTheme(theme);

	try {
		localStorage.setItem(storageKey, theme);
	} catch (e) {}
}

function applyTheme(theme) {
	root.classList.toggle("dark", theme === "dark");

	if (!themeBtn) return;

	themeBtn.setAttribute(
		"aria-label",
		theme === "dark" ? "Light mode" : "Dark mode"
	);
}

function mobileEdgeCaseStyling() {
	const userAgent = navigator.userAgent;

	if (
		(userAgent.indexOf("Edg") > -1 && userAgent.indexOf("Mobile") > -1) ||
		userAgent.indexOf("iPhone") > -1
	)
		body.classList.add("mobile-edge-case");
}
