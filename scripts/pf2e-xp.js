import {registerSettings} from "./settings.js";

// export let log = new Logger();
let log;

export let i18n = key => {
    return game.i18n.localize(key);
};

export let setting = key => {
    return game.settings.get("pf2e-xp", key);
};

export const threatLevels = ["trivial", "low", "moderate", "severe", "extreme"];

export class Pf2eXp {
    static getLevels(actors, type) {
        return actors.filter((a) => a.type === type).map((a) => parseInt(a.level ?? "1", 10));
    }

    static getHazardLevels(actors) {
        return actors.filter((a) => a.type === "hazard");
    }

    static getPartySize(combat) {
        return combat.combatants
            .filter(combatant => combatant.actor.prototypeToken.disposition === 1 && (combatant.actor.type === 'character' || combatant.actor.type === 'npc'))
            .length;
    }

    static getPartyAPL(combat) {
        return Math.round(
            combat.combatants
                .filter(combatant => combatant.actor.prototypeToken.disposition === 1 && (combatant.actor.type === 'character' || combatant.actor.type === 'npc'))
                .reduce((accumulator, combatant, _, array) => accumulator + combatant.actor.level / array.length, 0));
    }

    /*
     * Note: Neutral disposition are ignored...
    */
    static getBudgetXP(combat) {
        // Lets only use NPC & PC Sheets. Familiars and Vehicles shouldn't count for now.
        // NPC may be a valid Ally and can be excluded by setting to Neutral if needed.
        const avgPartyLevel = Pf2eXp.getPartyAPL(combat);
        const partySize = Pf2eXp.getPartySize(combat);

        const npcLevels = combat.combatants
            .filter(combatant => combatant.actor.prototypeToken.disposition === -1 && (combatant.actor.type === 'character' || combatant.actor.type === 'npc'))
            .map(combatant => combatant.actor.level);

        const hazardLevels = combat.combatants.filter(combatant => combatant.actor.prototypeToken.disposition === -1 && (combatant.actor.type === 'hazard')).map(combatant => combatant.actor)

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
            console.log("pf2e-xp", '|', ...args);
        } catch (e) {
        }
    }

    debug(...args) {
        try {
            if (setting('debug-mode')) {
                console.log("pf2e-xp", '|', ...args);
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
v${game.modules.get("pf2e-xp").data.version}
`, `font-family: monospace`); // Small

    registerSettings();
    log = new Logger();
    console.log("### pf2e-xp Initialized!")
});

// Hooks.once('ready', async function () {
//
// });

Hooks.on('renderCombatTracker', async (app, html, data) => {
    // No need to update combat tracker if pop out called or game setting is false...
    if (app._popout != null || !setting('show-encounter-xp') || !game.user.isGM || !data.combat) {
        return;
    } // TODO: Not working with popout!

    let xpData = Pf2eXp.getBudgetXP(data.combat); // PF2E Calculations
    log.debug("xpData", xpData);

    let signedBudgetLeft = new Intl.NumberFormat("en-US", {signDisplay: "exceptZero"}).format(xpData.budgetLeft);
    let xpToNextBudget = signedBudgetLeft != 0 ? ` (${signedBudgetLeft})` : "";

    switch (xpData.budgetNext) {
        case "x2":
        case "x3":
            xpData.threat = "ludicrous";
            break;
        case "x4":
        case "x5":
            xpData.threat = "absurd";
            break;
        default:
            if (xpData.budgetNext.startsWith("x")) {
                xpData.threat = "TPK";
            }
    }


    if (data.combat.combatants.size > 0) {
        $('<nav>').addClass('encounters flexrow encounter-xp-row').attr('id', 'encounter-xp-row-1')
            .append($('<h3>').addClass('noborder').html('APL: ' + xpData.apl))
            .append($('<div>').addClass('encounter-xp').attr('rating', xpData.threat).html(xpData.threat + "!".repeat(xpData.overkill) + xpToNextBudget))
            .append($('<h3>').addClass('noborder').html(xpData.budgetNext))
            .insertAfter($('#combat > header > div'));

        if (xpData.reward === xpData.rewardPerPlayer) {
            $('<nav>').addClass('encounters flexrow encounter-xp-row-2')
                .append($('<h3>').addClass('noborder').html(`Reward: ${xpData.reward} xp`))
                .insertAfter($('#encounter-xp-row-1'));
        } else {
            $('<nav>').addClass('encounters flexrow encounter-xp-row-2x2')
                .append($('<h3>').addClass('noborder').html(`Reward: ${xpData.reward} xp &nbsp;&nbsp;/&nbsp;&nbsp; Adjusted: ${xpData.rewardPerPlayer} xp`))
                .insertAfter($('#encounter-xp-row-1'));
        }
    }
});

Hooks.on('renderTokenHUD', async (app, html, options) => {
    if (!setting('show-encounter-xp-hud') || !game.user.isGM || !game.combat) {
        return;
    }

    const hudActor = app.object.actor;
    const characterType = hudActor.type;

    if (characterType !== "npc" && characterType !== "hazard") {
        return;
    }

    let npcLevels = Pf2eXp.getLevels([hudActor], "npc");
    let avgPartyLevel = Pf2eXp.getPartyAPL(game.combat);
    let partySize = Pf2eXp.getPartySize(game.combat);
    let hazardLevels = Pf2eXp.getHazardLevels([hudActor]);

    const xp = game.pf2e.gm.calculateXP(avgPartyLevel, partySize, npcLevels, hazardLevels, {
        proficiencyWithoutLevel: game.settings.get("pf2e", "proficiencyVariant") === "ProficiencyWithoutLevel"
    });

    console.log("xp", xp);

    let rating = "";
    if (xp.totalXP < 40) {
        rating = "No Threat";
    } else if (xp.totalXP >= 40 && xp.totalXP < 60) {
        rating = "trivial";
    } else if (xp.totalXP >= 60 && xp.totalXP < 80) {
        rating = "low";
    } else if (xp.totalXP >= 80 && xp.totalXP < 120) {
        rating = "moderate";
    } else if (xp.totalXP >= 120 && xp.totalXP < 160) {
        rating = "severe";
    } else if (xp.totalXP >= 160) {
        rating = "extreme";
    } else {
        rating = "lackey";
    }



    $('.col.middle', html).prepend(
        $('<div class="attribute">')
            .addClass("token-hud-xp")
            .attr('size', hudActor.size)
            .attr('rating', rating)
            .html(`<input type="text" readonly name="xp.value" data-bar="xp" value="+${xp.totalXP} xp">`)
    );
});