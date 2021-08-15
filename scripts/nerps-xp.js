import {registerSettings} from "./settings.js";

// export let log = new Logger();
let log;

export let i18n = key => {
  return game.i18n.localize(key);
};

export let setting = key => {
  return game.settings.get("nerps-xp", key);
};

export const threatLevels = ["trivial", "low", "moderate", "severe", "extreme"];

export class NerpsXP {
  /*
   * Note: Neutral disposition are ignored...
  */
  static getBudgetXP(combat) {
    // Lets only use NPC & PC Sheets. Familiars and Vehicles shouldn't count for now.
    // NPC may be a valid Ally and can be excluded by setting to Neutral if needed.
    const avgPartyLevel = Math.round(combat.combatants
        .filter(combatant => combatant.token.data.disposition == 1 && (combatant.actor.type == 'character' || combatant.actor.type == 'npc'))
        .reduce((accumulator, combatant, _, array) => accumulator + combatant.actor.data.data.details?.level?.value / array.length, 0)
    );

    const partySize = combat.combatants
    .filter(combatant => combatant.token.data.disposition == 1 && (combatant.actor.type == 'character' || combatant.actor.type == 'npc'))
        .length;

    const npcLevels = combat.combatants
    .filter(combatant => combatant.token.data.disposition == -1 && (combatant.actor.type == 'character' || combatant.actor.type == 'npc'))
    .map(combatant => combatant.actor.data.data.details?.level?.value);

    let hazardLevels = [];
    const hazards = combat.combatants
    .filter(combatant => combatant.token.data.disposition == -1 && (combatant.actor.type == 'hazard'))
    .forEach(hazard => hazardLevels.push({
      level: {value: hazard.actor.data.data.details?.level?.value},
      isComplex: hazard.actor.data.data.details?.isComplex
    }));

    log.debug("partySize: ", partySize);
    log.debug("npcLevels: ", npcLevels);
    log.debug("hazardLevels: ", hazardLevels);

    const xpData = game.pf2e.gm.calculateXP(avgPartyLevel, partySize, npcLevels, hazardLevels,
        {proficiencyWithoutLevel: game.settings.get('pf2e', 'proficiencyVariant') === 'ProficiencyWithoutLevel'});

    log.debug("XP pf2e.gm.calculateXP: ", xpData);

    let nextLevel = threatLevels[Math.min(4, threatLevels.findIndex(level => level === xpData.rating) + 1)];
    const budgetLeft = xpData.totalXP - xpData.encounterBudgets[xpData.rating]
    const nextThreatBudget = xpData.encounterBudgets[nextLevel] - xpData.totalXP;

    let threatLevel = xpData.totalXP > 0 ? xpData.rating : "No Threat";
    let budgetNext = nextThreatBudget > 0 ? `Next: ${nextThreatBudget}xp` : "&mdash;";

    // Don't show next budget until there is a threat
    if (budgetLeft <= 0 || threatLevel === "No Threat") {
      budgetNext = "&mdash;";
    }

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
      threat: threatLevel
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
    _   __                          _  __ ____ 
   / | / /__  _________  _____     | |/ // __ \\
  /  |/ / _ \\/ ___/ __ \\/ ___/_____|   // /_/ /
 / /|  /  __/ /  / /_/ (__  )_____/   |/ ____/ 
/_/ |_/\\___/_/  / .___/____/     /_/|_/_/      
               /_/                             
`, `font-family: monospace`);

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
    $('<nav>').addClass('encounters flexrow encounter-xp-row')
    .append($('<h3>').html('APL: ' + xpData.apl))
    .append($('<div>').addClass('encounter-xp').attr('rating', xpData.threat).html(xpData.threat + "!".repeat(xpData.overkill) + xpToNextBudget))
    .append($('<h3>').html(xpData.budgetNext))
    .insertAfter($('#combat-round .encounters:last'));
  }

});

// Hooks.on('renderTokenHUD', async (app, html, options) => {
//   if (!setting('show-encounter-xp-hud') || !game.user.isGM || !game.combat) {
//     return;
//   }
//
//   // $('.col.right', html).append(
//   //       $('<h3>').html("+100xp")
//   // );
// });