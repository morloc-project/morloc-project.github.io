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

// Service worker and PWA

if (navigator.serviceWorker) {
	window.addEventListener("load", () => {
		navigator.serviceWorker
			.register("service-worker.js")
			.catch((err) => console.error(`Service Worker error: ${err}`));
	});

	window.addEventListener("beforeinstallprompt", (e) => {
		e.preventDefault();
		pwaInstallEvent = e;
		showPWAInstallPrompt();
	});

	pwaInstallBtn.addEventListener("click", () => {
		pwaInstallEvent.prompt();
		pwaInstallDiv.classList.add("hidden");
	});

	pwaInstallDismiss.addEventListener("click", () =>
		dismissPWAInstallPrompt()
	);
}

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

const observer = new IntersectionObserver(scrollToTop);
observer.observe(header);

backToTopBtn.addEventListener("click", () => header.scrollIntoView(true));

// Functions

function showPWAInstallPrompt() {
	pwaInstallDiv.classList.remove("hidden");
	pwaInstallDiv.classList.add("pwa-install-div-summon");
}

function dismissPWAInstallPrompt() {
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
