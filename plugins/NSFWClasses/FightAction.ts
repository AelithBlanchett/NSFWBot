import {Fighter} from "./Fighter";
import {Constants} from "./Constants";
import Tier = Constants.Tier;
import {Data} from "./Model";
import BaseDamage = Constants.BaseDamage;
import {Fight} from "./Fight";
import {Dice} from "./Dice";
import TierDifficulty = Constants.TierDifficulty;
import Trigger = Constants.Trigger;
import Action = Constants.Action;

export class FightAction{
    id: number;
    fightId: number;
    atTurn: number;
    type: string;
    tier: Tier;
    isHold: boolean;
    attacker: Fighter;
    defender: Fighter;
    hpDamage: number;
    lustDamage: number;
    focusDamage: number;
    diceScore: number;
    missed: boolean;
    requiresRoll: boolean;

    constructor(fightId:number, currentTurn:number, tier:Tier, attacker:Fighter, defender?:Fighter) {
        this.fightId = fightId;
        this.type = "";
        this.isHold = false;
        this.missed = true;
        this.hpDamage = 0;
        this.lustDamage = 0;
        this.focusDamage = 0;
        this.diceScore = 0;
        this.tier = tier;
        this.atTurn = currentTurn;
        this.attacker = attacker;
        this.defender = defender;
        this.requiresRoll = true;
    }

    strikeFormula(tier:Tier, actorAtk:number, targetDef:number, roll:number):number{
        return BaseDamage[Tier[tier]]-(actorAtk-targetDef)+roll;
    }

    requiredDiceScore(attack:Action, tier:Tier):number{
        let scoreRequired = 0;
        //difficulties here
        //if fighter.indexOf(mod) != -1 then add some difficulty
        scoreRequired += TierDifficulty[Tier[this.tier]];
        return scoreRequired;
    }

    actionGateway(actionType:Action):Trigger{
        let result;
        switch (actionType) {
            case Action.Brawl:
                result = this.actionBrawl();
                break;
            case Action.SexStrike:
                result = this.actionSexStrike();
                break;
            case Action.Tag:
                result = this.actionTag();
                break;
            case Action.Pass:
                result = this.actionPass();
                break;
            default:
                result = Trigger.None;
                break;
        }
        return result;
    }

    actionBrawl():Trigger{
        this.attacker.triggerMods(Trigger.BeforeBrawlAttack);
        this.type = "brawl";
        this.diceScore = this.attacker.roll(1) + this.attacker.power;
        if(this.diceScore >= this.requiredDiceScore(Action.Brawl, this.tier)){
            this.missed = false;
            this.hpDamage = this.strikeFormula(this.tier, this.attacker.power, this.defender.toughness, this.diceScore);
        }
        return Trigger.AfterBrawlAttack;
    }

    actionSexStrike():Trigger{
        this.attacker.triggerMods(Trigger.BeforeSexStrikeAttack);
        this.type = "sexstrike";
        this.diceScore = this.attacker.roll(1) + this.attacker.sensuality;
        if(this.diceScore >= this.requiredDiceScore(Action.SexStrike, this.tier)){
            this.missed = false;
            this.lustDamage = this.strikeFormula(this.tier, this.attacker.sensuality, this.defender.endurance, this.diceScore);
        }
        return Trigger.AfterSexStrikeAttack;
    }

    actionSubHold():Trigger{
        this.attacker.triggerMods(Trigger.BeforeSubmissionHold);
        this.type = "subhold";
        this.diceScore = this.attacker.dice.roll(1) + this.attacker.sensuality;
        if(this.diceScore >= this.requiredDiceScore(Action.SexStrike, this.tier)){
            this.missed = false;
            this.lustDamage = this.strikeFormula(this.tier, this.attacker.sensuality, this.defender.endurance, this.diceScore);
        }
        return Trigger.AfterSubmissionHold;
    }

    actionTag():Trigger{ //"skips" a turn
        this.attacker.triggerMods(Trigger.BeforeTag);
        this.type = "tag";
        this.diceScore = -1;
        this.requiresRoll = false;
        this.attacker.lastTagTurn = this.atTurn;
        this.defender.lastTagTurn = this.atTurn;
        this.attacker.isInTheRing = false;
        this.defender.isInTheRing = true;
        this.missed = false;
        return Trigger.AfterTag;
    }

    actionPass():Trigger{ //"skips" a turn
        this.attacker.triggerMods(Trigger.BeforePass);
        this.type = "pass";
        this.diceScore = -1;
        this.requiresRoll = false;
        this.missed = false;
        return Trigger.AfterPass;
    }

    commitDb(){
        let attackerId = this.attacker.id || null;
        let defenderId = this.defender.id || null;
        var sql = "INSERT INTO `flistplugins`.?? (`idFight`,`atTurn`,`type`,`tier`,`isHold`,`idAttacker`,`idDefender`,`hpDamage`,`lustDamage`,`focusDamage`,`diceScore`,`missed`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?);";
        sql = Data.db.format(sql, [Constants.actionTableName, this.fightId, this.atTurn, this.type, this.tier, this.isHold, attackerId, defenderId, this.hpDamage, this.lustDamage, this.focusDamage, this.diceScore, this.missed]);
        Data.db.query(sql, (err, results) => {
            if (err) {
                throw err;
            }
            else {
                this.id = results.insertId;
            }
        });
    }

    commit(fight:Fight){
        fight.addMessage("\n");
        if(this.missed == false){
            if(this.requiresRoll == false){ //-1 == no roll
                //fight.addMessage(`The ${this.type} is [b][color=green]SUCCESSFUL![/color][/b]`);
            }
            else{
                fight.addMessage(`${this.attacker.name} rolled ${this.diceScore}, the ${this.type} attack [b][color=green]HITS![/color][/b]`);
            }
        }
        else{
            fight.addMessage(`${this.attacker.name} rolled ${this.diceScore}, the ${this.type} attack [b][color=red]MISSED![/color][/b]`);
        }

        if(this.requiresRoll){
            fight.addMessage(`${this.attacker.name} needed to roll ${this.diceScore} for the ${Tier[this.tier]} ${this.type} attack to hit.`);
        }

        fight.pastActions.push(this);

        if(this.missed == false) {
            if (this.hpDamage > 0) {
                this.defender.hitHp(this.hpDamage);
            }
            if (this.lustDamage > 0) {
                this.defender.hitLust(this.lustDamage);
            }
            if(this.focusDamage != 0){
                this.defender.hitFocus(this.focusDamage);
            }
        }

        if(this.type == "tag"){
            fight.addMessage(`[b][color=red]TAG![/color][/b] ${this.defender.name} enters inside the ring!`);
        }

        if(this.defender.isDead()){
            fight.addMessage(`${this.defender.name} couldn't take the hits anymore! [b][color=red]They're out![/color][/b]`);
            this.defender.triggerOutsideRing();
        }
        else if(this.defender.isSexuallyExhausted()){
            fight.addMessage(`${this.defender.name} is too sexually exhausted to continue! [b][color=red]They're out![/color][/b]`);
            this.defender.triggerOutsideRing();
        }
        else if(this.defender.isBroken()){
            fight.addMessage(`${this.defender.name} is too sexually exhausted to continue! [b][color=red]They're out![/color][/b]`);
            this.defender.triggerOutsideRing();
        }

        //Save it to the DB
        this.commitDb();

        //check for fight ending status
        if (fight.fighterList.getUsedTeams().length != 1) {
            fight.nextTurn();
        } else { //if there's only one team left in the fight, then we're sure it's over
            fight.outputStatus();
            fight.endFight();
        }
    }
}