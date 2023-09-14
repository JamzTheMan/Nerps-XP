import { i18n } from "./pf2e-xp.js";

export const registerSettings = function () {
    // Register any custom module settings here
	const MODULE_NAME = "pf2e-xp";

	game.settings.register(MODULE_NAME, "show-encounter-xp", {
		name: i18n("pf2e-xp.show-encounter-xp.name"),
		hint: i18n("pf2e-xp.show-encounter-xp.hint"),
		scope: "world",
		config: true,
		default: true,
		type: Boolean,
		requiresReload: true
	});

	game.settings.register(MODULE_NAME, "show-encounter-xp-hud", {
		name: i18n("pf2e-xp.show-encounter-xp-hud.name"),
		hint: i18n("pf2e-xp.show-encounter-xp-hud.hint"),
		scope: "world",
		config: true,
		default: true,
		type: Boolean
	});

	game.settings.register(MODULE_NAME, "debug-mode", {
		name: "Toggle Debug Mode",
		hint: "If checked, will enable Debug level logging for Nerps XP.",
		scope: "world",
		config: true,
		default: false,
		type: Boolean
	});
};
