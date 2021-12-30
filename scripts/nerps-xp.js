import {registerSettings} from "./settings.js";

// export let log = new Logger();
let log;

export let i18n = key => {
  return game.i18n.localize(key);
};

export let setting = key => {
  return game.settings.get("Nerps-XP", key);
};

export const threatLevels = ["trivial", "low", "moderate", "severe", "extreme"];

export class NerpsXP {
  static getLevels(actors, type) {
    return actors.filter((a) => a.data.type === type).map((a) => parseInt(a.data.data.details.level.value ?? "1", 10));
  }

  static getHazardLevels(actors) {
    return actors.filter((a) => a.data.type === "hazard");
  }

  static getPartySize(combat) {
    return combat.combatants
    .filter(combatant => combatant.token.data.disposition === 1 && (combatant.actor.type === 'character' || combatant.actor.type === 'npc'))
        .length;
  }

  static getPartyAPL(combat) {
    return Math.round(
        combat.combatants
        .filter(combatant => combatant.token.data.disposition === 1 && (combatant.actor.type === 'character' || combatant.actor.type === 'npc'))
        .reduce((accumulator, combatant, _, array) => accumulator + combatant.actor.data.data.details?.level?.value / array.length, 0));
  }

  /*
   * Note: Neutral disposition are ignored...
  */
  static getBudgetXP(combat) {
    // Lets only use NPC & PC Sheets. Familiars and Vehicles shouldn't count for now.
    // NPC may be a valid Ally and can be excluded by setting to Neutral if needed.
    const avgPartyLevel = NerpsXP.getPartyAPL(combat);
    const partySize = NerpsXP.getPartySize(combat);

    const npcLevels = combat.combatants
    .filter(combatant => combatant.token.data.disposition === -1 && (combatant.actor.type === 'character' || combatant.actor.type === 'npc'))
    .map(combatant => combatant.actor.data.data.details?.level?.value);

    const hazardLevels = combat.combatants.filter(combatant => combatant.token.data.disposition === -1 && (combatant.actor.type === 'hazard')).map(combatant => combatant.actor)

    log.debug("partySize: ", partySize);
    log.debug("npcLevels: ", npcLevels);
    log.debug("hazardLevels: ", hazardLevels);

    const xpData = game.pf2e.gm.calculateXP(avgPartyLevel, partySize, npcLevels, hazardLevels,
        {proficiencyWithoutLevel: game.settings.get('pf2e', 'proficiencyVariant') === 'ProficiencyWithoutLevel'});

    log.debug("XP pf2e.gm.calculateXP: ", xpData);

    let nextLevel = threatLevels[Math.min(4, threatLevels.findIndex(level => level === xpData.rating) + 1)];
    const budgetLeft = xpData.totalXP - xpData.encounterBudgets[xpData.rating]
    const nextThreatBudget = xpData.encounterBudgets[nextLevel] - xpData.totalXP;

    log.debug("nextThreatBudget: ", nextThreatBudget);

    let threatLevel = xpData.totalXP > 0 ? xpData.rating : "No Threat";
    let budgetNext = nextThreatBudget > 0 ? `Next: ${nextThreatBudget}xp` : "&mdash;";

    log.debug("threatLevel: ", threatLevel);
    log.debug("budgetNext: ", budgetNext);
    log.debug("budgetLeft: ", budgetLeft);

    // Don't show next budget until there is a threat
    if (threatLevel === "No Threat") {
      budgetNext = "&mdash;";
    }

    log.debug("budgetNext 2: ", budgetNext);

    // Set next budget to a x multiplier of trivial budget over extreme budget
    if (threatLevel === "extreme") {
      const trivialBudget = xpData.encounterBudgets["trivial"]
      const extremeMultiplier = 1 + ((xpData.totalXP - xpData.encounterBudgets["extreme"]) / trivialBudget);
      if (extremeMultiplier >= 2) {
        budgetNext = "x" + Math.round(extremeMultiplier);
      }
    }

    return {
      xp: xpData.totalXP,
      budgetLeft: budgetLeft,
      budgetNext: budgetNext,
      apl: avgPartyLevel,
      threat: threatLevel,
      reward: xpData.ratingXP,
      rewardPerPlayer: xpData.xpPerPlayer
    };
  }
}

/*
 Custom logger class
 */
export class Logger {
  info(...args) {
    try {
      console.log("Nerps-XP", '|', ...args);
    } catch (e) {
    }
  }

  debug(...args) {
    try {
      if (setting('debug-mode')) {
        console.log("Nerps-XP", '|', ...args);
      }
    } catch (e) {
    }
  }
}

/********
 Hooks
 *********/
Hooks.once('init', async function () {
  console.log(`%c
  _  _                  __  _____ 
 | \\| |___ _ _ _ __ ___ \\ \\/ / _ \\
 | .\` / -_) '_| '_ (_-<  >  <|  _/
 |_|\\_\\___|_| | .__/__/ /_/\\_\\_|  
              |_|                                                  
v${game.modules.get("Nerps-XP").data.version}
`, `font-family: monospace`); // Small

  registerSettings();
  log = new Logger();
  console.log("### Nerps-XP Initialized!")
});

// Hooks.once('ready', async function () {
//
// });

Hooks.on('renderCombatTracker', async (app, html, data) => {
  // No need to update combat tracker if pop out called or game setting is false...
  if (app.options.id == "combat-popout" || !setting('show-encounter-xp') || !game.user.isGM || !data.combat) {
    return;
  }

  let xpData = NerpsXP.getBudgetXP(data.combat); // PF2E Calculations
  log.debug("xpData", xpData);

  let signedBudgetLeft = new Intl.NumberFormat("en-US", {signDisplay: "exceptZero"}).format(xpData.budgetLeft);
  let xpToNextBudget = signedBudgetLeft != 0 ? ` (${signedBudgetLeft})` : "";

  if (data.combat.combatants.size > 0) {
    $('<nav>').addClass('encounters flexrow encounter-xp-row').attr('id', 'encounter-xp-row-1')
    .append($('<h3>').html('APL: ' + xpData.apl))
    .append($('<div>').addClass('encounter-xp').attr('rating', xpData.threat).html(xpData.threat + "!".repeat(xpData.overkill) + xpToNextBudget))
    .append($('<h3>').html(xpData.budgetNext))
    .insertAfter($('#combat-round .encounters:last'));

    if (xpData.reward === xpData.rewardPerPlayer) {
      $('<nav>').addClass('encounters flexrow encounter-xp-row-2')
      .append($('<h3>').html(`Reward: ${xpData.reward} xp`))
      .insertAfter($('#encounter-xp-row-1'));
    } else {
      $('<nav>').addClass('encounters flexrow encounter-xp-row-2')
      .append($('<h3>').html(`Reward: ${xpData.reward} xp`))
      .append($('<h3>').html(`Adjusted: ${xpData.rewardPerPlayer} xp`))
      .insertAfter($('#encounter-xp-row-1'));
    }
  }
});

Hooks.on('renderTokenHUD', async (app, html, options) => {
  if (!setting('show-encounter-xp-hud') || !game.user.isGM || !game.combat) {
    return;
  }

  const hudActor = app.object.data.document.actor
  const characterType = hudActor.type

  if (characterType !== "npc" && characterType !== "hazard") {
    return;
  }

  let npcLevels = NerpsXP.getLevels([hudActor], "npc");
  let avgPartyLevel = NerpsXP.getPartyAPL(game.combat);
  let partySize = NerpsXP.getPartySize(game.combat);
  let hazardLevels = NerpsXP.getHazardLevels([hudActor]);

  const xp = game.pf2e.gm.calculateXP(avgPartyLevel, partySize, npcLevels, hazardLevels, {
    proficiencyWithoutLevel: game.settings.get("pf2e", "proficiencyVariant") === "ProficiencyWithoutLevel",
  });

  log.debug("TokenHUD: xp", xp);

  let adjustFontSize = 'style="font-size:175%"'
  if (hudActor.size == "tiny") {
    adjustFontSize = 'style="font-size:90%"';
  }

  $('.col.middle', html).prepend(
      $('<div class="attribute">').html(`<input ${adjustFontSize} type="text" readonly name="xp.value" data-bar="xp" value="+${xp.totalXP} xp">`)
  );
});