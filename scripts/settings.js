import { NerpsXP, i18n } from "./nerps-xp.js";

export const registerSettings = function () {
    // Register any custom module settings here
	let modulename = "nerps-xp";

	const debouncedReload = foundry.utils.debounce(function () { window.location.reload(); }, 100);

	game.settings.register(modulename, "show-encounter-xp", {
		name: i18n("Nerps-XP.show-encounter-xp.name"),
		hint: i18n("Nerps-XP.show-encounter-xp.hint"),
		scope: "world",
		config: true,
		default: true,
		type: Boolean,
		onChange: debouncedReload
	});

	game.settings.register(modulename, "show-encounter-xp-hud", {
		name: i18n("Nerps-XP.show-encounter-xp-hud.name"),
		hint: i18n("Nerps-XP.show-encounter-xp-hud.hint"),
		scope: "world",
		config: true,
		default: true,
		type: Boolean
	});

	game.settings.register(modulename, "debug-mode", {
		name: "Toggle Debug Mode",
		hint: "If checked, will enable Debug level logging for Nerps XP.",
		scope: "world",
		config: true,
		default: false,
		type: Boolean
	});
};
