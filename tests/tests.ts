import {Fighter} from "../src/Fighter";
import {Fight} from "../src/Fight";
import {IFChatLib} from "../src/interfaces/IFChatLib";
import {CommandHandler} from "../src/CommandHandler";
import * as Constants from "../src/Constants";
import Tier = Constants.Tier;
import {Utils} from "../src/Utils";
import {Action, ActionType} from "../src/Action";
import {StunModifier} from "../src/CustomModifiers";
import {EnumEx} from "../src/Utils";
import Trigger = Constants.Trigger;
import {Feature} from "../src/Feature";
import {FeatureType} from "../src/Constants";
import {ItemPickupModifier} from "../src/CustomModifiers";
import {ModifierType} from "../src/Constants";
var waitUntil = require('wait-until');
var Jasmine = require('jasmine');
import {ActiveFighter} from "../src/ActiveFighter";
import {FighterRepository} from "../src/FighterRepository";
import {ActiveFighterRepository} from "../src/ActiveFighterRepository";
import {ActionRepository} from "../src/ActionRepository";
import {FightRepository} from "../src/FightRepository";
import {Dice} from "../src/Dice";
var jasmine = new Jasmine();
var fChatLibInstance:any;
var debug = false;
var mockedClasses = [];
var usedIndexes = [];
var usedFighters = [];

const DEFAULT_TIMEOUT = 15000;
const INTERVAL_TO_WAIT_FOR = 5;

function getMock(mockedClass) {
    if (mockedClasses.indexOf(mockedClass) != -1) {
        return new mockedClasses[mockedClasses.indexOf(mockedClass)]();
    }
    Object.getOwnPropertyNames(mockedClass.prototype).forEach(m => spyOn(mockedClass.prototype, m).and.callThrough());
    mockedClasses.push(mockedClass);

    return new mockedClass();
}

//
//Abstraction of database layer
//

function abstractDatabase() {

    FighterRepository.load = async function (name) {
        return new Promise(function (resolve, reject) {
            resolve(createFighter(name));
        });
    };

    ActiveFighterRepository.initialize = async function (name) {
        return new Promise(function (resolve, reject) {
            resolve(createFighter(name));
        });
    };

    ActiveFighterRepository.load = async function (name, fightId) {
        return new Promise(function (resolve, reject) {
            resolve(createFighter(name));
        });
    };

    ActionRepository.persist = async function (action) {
        return new Promise<void>(function (resolve, reject) {
            action.idAction = Utils.generateUUID();
            resolve();
        });
    };

    FightRepository.persist = async function (fight) {
        return new Promise<void>(function (resolve, reject) {
            resolve();
        });
    };

    FighterRepository.persist = async function (fight) {
        return new Promise<void>(function (resolve, reject) {
            resolve();
        });
    };

    FightRepository.exists = async function (fight) {
        return false;
    };

    FightRepository.load = async function (id) {
        return new Fight();
    };
}

//Utilities

function createFighter(name, intStatsToAssign:number = 3):ActiveFighter {
    let myFighter;
    if (Utils.findIndex(usedFighters, "name", name) == -1) {
        myFighter = getMock(ActiveFighter);
        let randomId = -1;
        do {
            randomId = Utils.getRandomInt(0, 1000000);
        } while (usedIndexes.indexOf(randomId) != -1);
        myFighter.power = myFighter.dexterity = myFighter.sensuality = myFighter.toughness = myFighter.willpower = myFighter.endurance = intStatsToAssign;
        myFighter.startingPower = intStatsToAssign;
        myFighter.startingEndurance = intStatsToAssign;
        myFighter.startingSensuality = intStatsToAssign;
        myFighter.startingToughness = intStatsToAssign;
        myFighter.startingWillpower = intStatsToAssign;
        myFighter.startingDexterity = intStatsToAssign;
        myFighter.dexterityDelta = 0;
        myFighter.enduranceDelta = 0;
        myFighter.powerDelta = 0;
        myFighter.sensualityDelta = 0;
        myFighter.toughnessDelta = 0;
        myFighter.willpowerDelta = 0;
        myFighter.id = randomId;
        myFighter.name = name;
        myFighter.hp = myFighter.hpPerHeart();
        myFighter.heartsRemaining = myFighter.maxHearts();
        myFighter.lust = 0;
        myFighter.orgasmsRemaining = myFighter.maxOrgasms();
        myFighter.focus = myFighter.willpower;
        myFighter.dice = new Dice(10);
        usedFighters.push(myFighter);
    }
    else {
        myFighter = usedFighters[Utils.findIndex(usedFighters, "name", name)];
    }

    return myFighter;
}

function doAction(cmd:CommandHandler, action:string, target:string = "", condition?:any) {
    return new Promise((resolve, reject) => {
        if (!condition) {
            condition = () => {
                return (cmd.fight.hasStarted && !cmd.fight.hasEnded && cmd.fight.waitingForAction && cmd.fight.currentTurn > 0);
            };
        }
        waitUntil().interval(10).times(50).condition(condition).done((res) => {
            if (res) {
                cmd.fight.currentPlayer.dice.addMod(50);
                cmd[action](target, {character: cmd.fight.currentPlayer.name, channel: "here"});
                waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(condition).done(() => {
                    resolve();
                });
            }
            else {
                reject("Couldn't execute action. Is the fight started and waiting for action?");
            }
        });
    });
}


function wasHealthHit(cmd:CommandHandler, name:string) {
    return (
        (
            cmd.fight.getFighterByName(name).hp == cmd.fight.getFighterByName(name).hpPerHeart() &&
            cmd.fight.getFighterByName(name).heartsRemaining < cmd.fight.getFighterByName(name).maxHearts()
        )
        ||
        cmd.fight.getFighterByName(name).hp < cmd.fight.getFighterByName(name).hpPerHeart()
    );
}

function wasLustHit(cmd:CommandHandler, name:string) {
    return (
        (
            cmd.fight.getFighterByName(name).lust == cmd.fight.getFighterByName(name).lustPerOrgasm() &&
            cmd.fight.getFighterByName(name).orgasmsRemaining < cmd.fight.getFighterByName(name).maxOrgasms()
        )
        ||
        cmd.fight.getFighterByName(name).lust < cmd.fight.getFighterByName(name).lustPerOrgasm()
    );
}

async function initiateMatchSettings2vs2Tag(cmdHandler) {
    cmdHandler.fight.setFightType("tagteam");
    await cmdHandler.join("Red", {character: "Aelith Blanchette", channel: "here"});
    await cmdHandler.join("Purple", {character: "Purple1", channel: "here"});
    await cmdHandler.join("Purple", {character: "Purple2", channel: "here"});
    await cmdHandler.join("Red", {character: "TheTinaArmstrong", channel: "here"});
    await cmdHandler.ready("Red", {character: "TheTinaArmstrong", channel: "here"});
    await cmdHandler.ready("Red", {character: "Aelith Blanchette", channel: "here"});
    await cmdHandler.ready("Red", {character: "Purple1", channel: "here"});
    await cmdHandler.ready("Red", {character: "Purple2", channel: "here"});
}

async function initiateMatchSettings1vs1(cmdHandler) {
    cmdHandler.fight.setFightType("tagteam");
    await cmdHandler.join("Red", {character: "Aelith Blanchette", channel: "here"});
    await cmdHandler.join("Blue", {character: "TheTinaArmstrong", channel: "here"});
    await cmdHandler.ready("Blue", {character: "TheTinaArmstrong", channel: "here"});
    await cmdHandler.ready("Red", {character: "Aelith Blanchette", channel: "here"});
}

function wasMessageSent(msg) {
    return fChatLibInstance.sendMessage.calls.all().find(x => x.args[0].indexOf(msg) != -1) != undefined;
}

function wasPrivMessageSent(msg) {
    return fChatLibInstance.sendPrivMessage.calls.all().find(x => x.args[0].indexOf(msg) != -1) != undefined;
}

function refillHPLPFP(cmd, name) {
    cmd.fight.getFighterByName(name).orgasmsRemaining = cmd.fight.getFighterByName(name).maxOrgasms(); //to prevent ending the fight this way
    cmd.fight.getFighterByName(name).heartsRemaining = cmd.fight.getFighterByName(name).maxHearts();
    cmd.fight.getFighterByName(name).consecutiveTurnsWithoutFocus = 0; //to prevent ending the fight this way
    cmd.fight.getFighterByName(name).focus = cmd.fight.getFighterByName(name).maxFocus();
}


/// <reference path="../typings/jasmine/jasmine.d.ts">
describe("The player(s)", () => {


    beforeEach(function () {
        abstractDatabase();
        fChatLibInstance = {
            sendMessage: function (message:string, channel:string) {
                if (debug) {
                    console.log("Sent MESSAGE " + message + " on channel " + channel);
                }
            },
            throwError: function (s:string) {
                if (debug) {
                    console.log("Sent ERROR " + s);
                }
            },
            sendPrivMessage: function (character:string, message:string) {
                if (debug) {
                    console.log("Sent PRIVMESSAGE " + message + " to " + character);
                }
            },
            addPrivateMessageListener: function (fn:any) {

            },
            isUserChatOP: function (username:string, channel:string) {
                return username == "Aelith Blanchette";
            }
        };

        usedIndexes = [];
        usedFighters = [];

        spyOn(fChatLibInstance, 'sendMessage').and.callThrough();
        spyOn(fChatLibInstance, 'throwError').and.callThrough();
        spyOn(fChatLibInstance, 'sendPrivMessage').and.callThrough();
        spyOn(ActiveFighterRepository, 'load').and.callThrough();
        spyOn(ActiveFighterRepository, 'initialize').and.callThrough();
        spyOn(FighterRepository, 'load').and.callThrough();

        debug = true;

        jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;
    }, DEFAULT_TIMEOUT);


   it("should be initialized to 3-3-3-3-3-3 name = Yolo", function () { //1
        let fighterYolo = createFighter("Yolo");
        expect(fighterYolo.name).toBe("Yolo");
    }, DEFAULT_TIMEOUT);

    it("should be initialized 3-3-3-3-3-3 stats with two different names", async function () { //2
        let fighterYolo = createFighter("Yolo");
        let fighterLoyo = createFighter("Loyo");
        expect(fighterYolo.name + fighterLoyo.name).toBe("YoloLoyo");
    }, DEFAULT_TIMEOUT);


    it("should join the match", async function (done) { //3
        var x = new CommandHandler(fChatLibInstance, "here");
        var data:FChatResponse = {character: "Aelith Blanchette", channel: "here"};
        x.join("", data);
        setTimeout(() => {
            if (wasMessageSent("stepped into the ring for the")) {
                done();
            }
            else {
                done.fail(new Error("The player couldn't join the match"));
            }
        }, 300);
    }, DEFAULT_TIMEOUT);

    it("should have been checking if fighter exists", async function (done) { //4
        var x = new CommandHandler(fChatLibInstance, "here");
        var data:FChatResponse = {character: "Aelith Blanchette", channel: "here"};
        await x.join("", data);
        expect(ActiveFighterRepository.initialize).toHaveBeenCalled();
        done();
    }, DEFAULT_TIMEOUT);

    it("should not be joining a match twice", async function (done) { //5
        var x = new CommandHandler(fChatLibInstance, "here");
        var data:FChatResponse = {character: "Aelith Blanchette", channel: "here"};
        await x.join("", data);
        await x.join("", data);
        if (wasMessageSent("You have already joined the fight")) {
            done();
        }
        else {
            done.fail(new Error("The player joined the match twice"));
        }
    }, DEFAULT_TIMEOUT);


    it("should join the match and set as ready", async function (done) { //6
        var x = new CommandHandler(fChatLibInstance, "here");
        var data:FChatResponse = {character: "Aelith Blanchette", channel: "here"};
        await x.ready("", data);
        if (wasMessageSent("is now ready to get it on!")) {
            done();
        }
        else {
            done.fail(new Error("Did not put the player as ready"));
        }
    }, DEFAULT_TIMEOUT);

    it("should have already joined the ring and already set ready", async function (done) { //7
        var x = new CommandHandler(fChatLibInstance, "here");
        var data:FChatResponse = {character: "Aelith Blanchette", channel: "here"};
        await x.ready("", data);
        await x.ready("", data);
        if (wasMessageSent("You are already ready.")) {
            done();
        }
        else {
            done.fail(new Error("Did not successfully check if the fighter was already ready"));
        }
    }, DEFAULT_TIMEOUT);

    it("should be ready to start with the default blue and red team", async function (done) { //8
        var x = new CommandHandler(fChatLibInstance, "here");
        await x.join("", {character: "Aelith Blanchette", channel: "here"});
        await x.join("", {character: "TheTinaArmstrong", channel: "here"});
        if (wasMessageSent("stepped into the ring for the [color=Blue]Blue[/color] team! Waiting for everyone to be !ready.")
            && wasMessageSent("stepped into the ring for the [color=Red]Red[/color] team! Waiting for everyone to be !ready.")
            && x.fight.hasStarted == false) {
            done();
        }
        else {
            done.fail(new Error("Did not put the player as ready"));
        }
    }, DEFAULT_TIMEOUT);

    it("should tag successfully with Aelith", async function (done) { // 9
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings2vs2Tag(cmd);
        waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(() => {
                return (cmd.fight.hasStarted && cmd.fight.waitingForAction);
            }).done(() => {
                cmd.fight.setCurrentPlayer("TheTinaArmstrong");
                doAction(cmd, "tag", "Aelith Blanchette").then(() => {
                    waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(() => {
                        return (cmd.fight.getFighterByName("Aelith Blanchette").isInTheRing);
                    }).done((res) => {
                        if (res) {
                            done();
                        }
                        else {
                            done.fail(new Error("Did not tag with Aelith"));
                        }
                    });
                });
            });
        });
    }, DEFAULT_TIMEOUT);


    it("should swap to TheTinaArmstrong", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(2).times(500).condition(() => {
            return (cmd.fight.hasStarted && !cmd.fight.hasEnded && cmd.fight.waitingForAction)
        }).done(() => {
            let fighterNameBefore = cmd.fight.currentPlayer.name;
            cmd.fight.assignRandomTargetToFighter(cmd.fight.currentPlayer);
            cmd.fight.setCurrentPlayer(cmd.fight.currentTarget.name);
            if (cmd.fight.currentPlayer.name != fighterNameBefore) {
                done();
            }
            else {
                done.fail(new Error("Fighters didn't swap places."));
            }
        });
    }, DEFAULT_TIMEOUT);

    it("should do a brawl move", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(2).times(500).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            cmd.fight.setCurrentPlayer("TheTinaArmstrong");
            doAction(cmd, "brawl", "Light").then(() => {
                if (wasHealthHit(cmd, "Aelith Blanchette")) {
                    done();
                }
                else {
                    done.fail(new Error("HPs were not drained despite the fact that the attack should have hit."));
                }
            }).catch(err => {
                fChatLibInstance.throwError(err);
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should do a sexstrike move", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(2).times(500).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            doAction(cmd, "sex", "Light").then(() => {
                if (wasLustHit(cmd, "Aelith Blanchette")) {
                    done();
                }
                else {
                    done.fail(new Error("Did not do a sextrike move, or the damage wasn't done"));
                }
            }).catch(err => {
                fChatLibInstance.throwError(err);
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should do a highrisk move", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(2).times(500).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            cmd.fight.setCurrentPlayer("TheTinaArmstrong");
            doAction(cmd, "highrisk", "Light").then(() => {
                if (wasHealthHit(cmd, "Aelith Blanchette")) {
                    done();
                }
                else {
                    done.fail(new Error("HPs were not drained despite the fact that the attack should have hit."));
                }
            }).catch(err => {
                fChatLibInstance.throwError(err);
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should do a penetration move", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(2).times(500).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            cmd.fight.setCurrentPlayer("TheTinaArmstrong");
            doAction(cmd, "penetration", "Light").then(() => {
                if (wasLustHit(cmd, "Aelith Blanchette")) {
                    done();
                }
                else {
                    done.fail(new Error("HPs were not drained despite the fact that the attack should have hit."));
                }
            }).catch(err => {
                fChatLibInstance.throwError(err);
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should pass", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(2).times(500).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            let fighterNameBefore = cmd.fight.currentPlayer.name;
            doAction(cmd, "rest", "").then(() => {
                if (cmd.fight.currentPlayer.name != fighterNameBefore) {
                    done();
                }
                else {
                    done.fail(new Error("Did not pass turn correctly"));
                }
            }).catch(err => {
                fChatLibInstance.throwError(err);
            });
        });
    }, DEFAULT_TIMEOUT);

    it(`should give a loss after ${Constants.Fight.Action.Globals.maxTurnsWithoutFocus} turns without focus`, async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(2).times(500).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            cmd.fight.getFighterByName("Aelith Blanchette").focus = -100;
            for (var i = 0; i < Constants.Fight.Action.Globals.maxTurnsWithoutFocus; i++) {
                cmd.fight.nextTurn();
            }
            if (cmd.fight.getFighterByName("Aelith Blanchette").isBroken()) {
                done();
            }
            else {
                done.fail(new Error(`Player was still alive after ${Constants.Fight.Action.Globals.maxTurnsWithoutFocus} turns without focus`));
            }
        });
    }, DEFAULT_TIMEOUT);

    it("should do a subhold and tick", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(2).times(500).condition(() => {
            return cmd.fight.hasStarted;
        }).done(() => {
            waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(() => {
                return cmd.fight.waitingForAction
            }).done(() => {
                cmd.fight.setCurrentPlayer("TheTinaArmstrong");
                doAction(cmd, "subhold", "Light").then(() => {
                    if (wasHealthHit(cmd, "Aelith Blanchette") && cmd.fight.getFighterByName("Aelith Blanchette").modifiers.findIndex(x => x.name == Constants.Modifier.SubHold) != -1) {
                        done();
                    }
                    else {
                        done.fail(new Error("Didn't tick subhold"));
                    }
                }).catch(err => {
                    fChatLibInstance.throwError(err);
                });
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should do a subhold and expire after the number of turns specified", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(10).times(500).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            cmd.fight.setCurrentPlayer("TheTinaArmstrong");
            doAction(cmd, "subhold", "Light").then(() => {
                for (var i = 0; i < Constants.Fight.Action.Globals.initialNumberOfTurnsForHold; i++) {
                    cmd.fight.nextTurn();
                    refillHPLPFP(cmd, "Aelith Blanchette");
                }
                if (cmd.fight.getFighterByName("Aelith Blanchette").modifiers.length == 0) {
                    done();
                }
                else {
                    done.fail(new Error("Did not correctly expire the sexhold modifiers."));
                }
            }).catch(err => {
                fChatLibInstance.throwError(err);
            });
        });
    }, DEFAULT_TIMEOUT + 5000);

    it("should do a subhold and let the opponent escape", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(2).times(500).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            cmd.fight.setCurrentPlayer("TheTinaArmstrong");
            doAction(cmd, "subhold", "Light").then(() => {
                doAction(cmd, "escape", "Light").then(() => {
                    let condition = () => {
                        return (cmd.fight.hasStarted && !cmd.fight.hasEnded && cmd.fight.waitingForAction);
                    };
                    waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(condition).done(() => {
                        if (cmd.fight.currentPlayer == cmd.fight.getFighterByName("Aelith Blanchette")) {
                            done();
                        }
                        else {
                            done.fail(new Error("Did not say that the attacker has an accuracy bonus."));
                        }
                    });
                }).catch(err => {
                    fChatLibInstance.throwError(err);
                });
            }).catch(err => {
                fChatLibInstance.throwError(err);
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should do a subhold and trigger bonus brawl modifier", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(2).times(500).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            cmd.fight.setCurrentPlayer("TheTinaArmstrong");
            doAction(cmd, "subhold", "Light").then(() => {
                doAction(cmd, "brawl", "Light").then(() => {
                    let condition = () => {
                        return (cmd.fight.hasStarted && !cmd.fight.hasEnded && cmd.fight.waitingForAction);
                    };
                    waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(condition).done(() => {
                        if (wasMessageSent(Constants.Modifier.SubHoldBrawlBonus)) {
                            done();
                        }
                        else {
                            done.fail(new Error("Did not say that the attacker has an accuracy bonus."));
                        }
                    });
                }).catch(err => {
                    fChatLibInstance.throwError(err);
                });
            }).catch(err => {
                fChatLibInstance.throwError(err);
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should not be allowed to do a subhold while already in one", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(2).times(500).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            cmd.fight.setCurrentPlayer("TheTinaArmstrong");
            doAction(cmd, "subhold", "Light").then(() => {
                doAction(cmd, "subhold", "Light").then(() => {
                    let condition = () => {
                        return (cmd.fight.hasStarted && !cmd.fight.hasEnded && cmd.fight.waitingForAction);
                    };
                    waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(condition).done(() => {
                        if (cmd.fight.currentPlayer.isInHold()) {
                            done();
                        }
                        else {
                            done.fail(new Error("Did not say that the attacker is locked in a hold."));
                        }
                    });
                });
            }).catch(err => {
                fChatLibInstance.throwError(err);
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should be allowed to do a second subhold while already APPLYING one", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(2).times(500).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            cmd.fight.setCurrentPlayer("TheTinaArmstrong");
            doAction(cmd, "subhold", "Light").then(() => {
                cmd.fight.nextTurn();
                doAction(cmd, "subhold", "Light").then(() => {
                    let condition = () => {
                        return (cmd.fight.hasStarted && !cmd.fight.hasEnded && cmd.fight.waitingForAction);
                    };
                    waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(condition).done(() => {
                        if (!wasMessageSent("[b][color=red]You cannot do that since you're in a hold.[/color][/b]\n")) {
                            done();
                        }
                        else {
                            done.fail(new Error("Didn't stack the two subholds correctly"));
                        }
                    });
                });
            }).catch(err => {
                fChatLibInstance.throwError(err);
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should stack the current subhold with another subhold, verify stacking", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(2).times(500).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            cmd.fight.setCurrentPlayer("TheTinaArmstrong");
            doAction(cmd, "subhold", "Light").then(() => {
                cmd.fight.nextTurn();
                doAction(cmd, "subhold", "Light").then(() => {
                    let condition = () => {
                        return (cmd.fight.hasStarted && !cmd.fight.hasEnded && cmd.fight.waitingForAction);
                    };
                    waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(condition).done(() => {
                        if (wasMessageSent("Hold Stacking!")) {
                            done();
                        }
                        else {
                            done.fail(new Error("The number of uses after a hold stacking hasn't been increased correctly."))
                        }
                    });
                });
            }).catch(err => {
                fChatLibInstance.throwError(err);
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should stack the current subhold with another subhold, verify uses", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(2).times(500).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            cmd.fight.setCurrentPlayer("TheTinaArmstrong");
            doAction(cmd, "subhold", "Light").then(() => {
                let indexOfSubHoldModifier = cmd.fight.getFighterByName("Aelith Blanchette").modifiers.findIndex(x => x.name == Constants.Modifier.SubHold);
                if (indexOfSubHoldModifier == -1) {
                    done.fail(new Error("Did not find the correct subhold modifier in the defender's list."));
                }
                let usesLeftBefore = cmd.fight.getFighterByName("Aelith Blanchette").modifiers[indexOfSubHoldModifier].uses;
                cmd.fight.nextTurn();
                refillHPLPFP(cmd, "Aelith Blanchette");
                doAction(cmd, "subhold", "Light").then(() => {
                    let condition = () => {
                        return (cmd.fight.hasStarted && !cmd.fight.hasEnded && cmd.fight.waitingForAction);
                    };
                    waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(condition).done(() => {
                        let usesLeftAfter = 0;
                        if (cmd.fight.getFighterByName("Aelith Blanchette").modifiers[indexOfSubHoldModifier]) {
                            usesLeftAfter = cmd.fight.getFighterByName("Aelith Blanchette").modifiers[indexOfSubHoldModifier].uses;
                        }
                        if (usesLeftAfter > usesLeftBefore) {
                            done();
                        }
                        else {
                            done.fail(new Error("The number of uses after a hold stacking hasn't been increased correctly."))
                        }
                    });
                });
            }).catch(err => {
                fChatLibInstance.throwError(err);
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should do a sexhold and tick", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(2).times(500).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            cmd.fight.setCurrentPlayer("TheTinaArmstrong");
            doAction(cmd, "sexhold", "Light").then(() => {
                let condition = () => {
                    return (cmd.fight.hasStarted && !cmd.fight.hasEnded && cmd.fight.waitingForAction);
                };
                waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(condition).done(() => {
                    if (wasLustHit(cmd, "Aelith Blanchette") && cmd.fight.getFighterByName("Aelith Blanchette").modifiers.findIndex(x => x.name == Constants.Modifier.SexHold) != -1) {
                        done();
                    }
                    else {
                        done.fail(new Error("Didn't tick sexhold"));
                    }
                });
            }).catch(err => {
                fChatLibInstance.throwError(err);
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should not be able to do a humhold without a sexhold", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(2).times(500).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            cmd.fight.setCurrentPlayer("TheTinaArmstrong");
            doAction(cmd, "humhold", "Light").then(() => {
                let condition = () => {
                    return (cmd.fight.hasStarted && !cmd.fight.hasEnded && cmd.fight.waitingForAction);
                };
                waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(condition).done(() => {
                    if (wasPrivMessageSent(Constants.Messages.checkAttackRequirementsNotInSexualHold)) {
                        done();
                    }
                    else {
                        done.fail(new Error("Still did a humiliation hold without a sexhold"));
                    }
                });
            }).catch(err => {
                fChatLibInstance.throwError(err);
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should be able to do a humhold with sexhold", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(2).times(500).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            cmd.fight.setCurrentPlayer("TheTinaArmstrong");
            doAction(cmd, "sexhold", "Light").then(() => {
                cmd.fight.nextTurn();
                doAction(cmd, "humhold", "Light").then(() => {
                    let condition = () => {
                        return (cmd.fight.hasStarted && !cmd.fight.hasEnded && cmd.fight.waitingForAction);
                    };
                    waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(condition).done(() => {
                        if (cmd.fight.pastActions[cmd.fight.pastActions.length - 1].type == ActionType.HumHold) {
                            done();
                        }
                        else {
                            done.fail(new Error("Didn't get to do a humiliation hold after a sexhold"));
                        }
                    });
                });
            }).catch(err => {
                fChatLibInstance.throwError(err);
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should be making the humhold tick", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(2).times(500).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            cmd.fight.setCurrentPlayer("TheTinaArmstrong");
            doAction(cmd, "sexhold", "Light").then(() => {
                cmd.fight.nextTurn();
                refillHPLPFP(cmd, "Aelith Blanchette");
                doAction(cmd, "humhold", "Light").then(() => {
                    let condition = () => {
                        return (cmd.fight.hasStarted && !cmd.fight.hasEnded && cmd.fight.waitingForAction);
                    };
                    waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(condition).done(() => {
                        if (cmd.fight.getFighterByName("Aelith Blanchette").modifiers.findIndex(x => x.name == Constants.Modifier.HumHold) != -1) {
                            done();
                        }
                        else {
                            done.fail(new Error("Didn't give humiliation hold modifier"));
                        }
                    });
                });
            }).catch(err => {
                fChatLibInstance.throwError(err);
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should be dealing more focus damage with humiliation ", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(2).times(500).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            cmd.fight.setCurrentPlayer("TheTinaArmstrong");
            doAction(cmd, "degradation", "Light").then(() => {
                cmd.fight.nextTurn();
                doAction(cmd, "sexhold", "Light").then(() => {
                    cmd.fight.nextTurn();
                    doAction(cmd, "humhold", "Light").then(() => {
                        let condition = () => {
                            return (cmd.fight.hasStarted && !cmd.fight.hasEnded && cmd.fight.waitingForAction);
                        };
                        waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(condition).done(() => {
                            if (wasMessageSent("is still affected by the degradation malus!")) {
                                done();
                            }
                            else {
                                done.fail(new Error("Didn't deal more damage with degradation malus"));
                            }
                        });
                    });
                });
            }).catch(err => {
                fChatLibInstance.throwError(err);
            });
        });
    }, DEFAULT_TIMEOUT + 100000);


    it("should pickup an item and trigger bonus brawl modifier", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(2).times(500).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            cmd.fight.setCurrentPlayer("TheTinaArmstrong");
            doAction(cmd, "itempickup", "Light").then(() => {
                cmd.fight.nextTurn();
                doAction(cmd, "brawl", "Light").then(() => {
                    let condition = () => {
                        return (cmd.fight.hasStarted && !cmd.fight.hasEnded && cmd.fight.waitingForAction);
                    };
                    waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(condition).done(() => {
                        if (wasMessageSent(Constants.Modifier.ItemPickupBonus)) {
                            done();
                        }
                        else {
                            done.fail(new Error("Did not say that the attacker has an item pickup bonus."));
                        }
                    });
                }).catch(err => {
                    fChatLibInstance.throwError(err);
                });
            }).catch(err => {
                fChatLibInstance.throwError(err);
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should pickup a sextoy and trigger bonus sexstrike modifier", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            cmd.fight.setCurrentPlayer("TheTinaArmstrong");
            doAction(cmd, "sextoypickup", "Light").then(() => {
                cmd.fight.nextTurn();
                doAction(cmd, "sex", "Light").then(() => {
                    let condition = () => {
                        return (cmd.fight.hasStarted && !cmd.fight.hasEnded && cmd.fight.waitingForAction);
                    };
                    waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(condition).done(() => {
                        if (cmd.fight.getFighterByName("TheTinaArmstrong").modifiers.findIndex((x) => x.type == Constants.ModifierType.SextoyPickupBonus) != -1) {
                            done();
                        }
                        else {
                            done.fail(new Error("Did not have the sextoy item pickup bonus modifier."));
                        }
                    });
                }).catch(err => {
                    fChatLibInstance.throwError(err);
                });
            }).catch(err => {
                fChatLibInstance.throwError(err);
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should win the match with 3 bondage attacks", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            cmd.fight.setCurrentPlayer("TheTinaArmstrong");
            doAction(cmd, "sexhold", "Light").then(() => {
                cmd.fight.nextTurn();
                refillHPLPFP(cmd, "Aelith Blanchette");
                doAction(cmd, "bondage", "Light").then(() => {
                    cmd.fight.nextTurn();
                    refillHPLPFP(cmd, "Aelith Blanchette");
                    doAction(cmd, "sexhold", "Light").then(() => {
                        cmd.fight.nextTurn();
                        refillHPLPFP(cmd, "Aelith Blanchette");
                        doAction(cmd, "bondage", "Light").then(() => {
                            cmd.fight.nextTurn();
                            refillHPLPFP(cmd, "Aelith Blanchette");
                            doAction(cmd, "bondage", "Light").then(() => {
                                refillHPLPFP(cmd, "Aelith Blanchette");
                                let condition = () => {
                                    return (cmd.fight.hasStarted && !cmd.fight.hasEnded && cmd.fight.waitingForAction);
                                };
                                waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(condition).done(() => {
                                    if (cmd.fight.getFighterByName("Aelith Blanchette").isCompletelyBound()) {
                                        done();
                                    }
                                    else {
                                        done.fail(new Error("Did not say that the receiver must abandon because of bondage."));
                                    }
                                });
                            }).catch(err => {
                                fChatLibInstance.throwError(err);
                            });
                        }).catch(err => {
                            fChatLibInstance.throwError(err);
                        });
                    }).catch(err => {
                        fChatLibInstance.throwError(err);
                    });
                }).catch(err => {
                    fChatLibInstance.throwError(err);
                });
            }).catch(err => {
                fChatLibInstance.throwError(err);
            });
        });
    }, DEFAULT_TIMEOUT + 10000);

    it("should say you can't place a bondage attack without a sexhold", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(2).times(500).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            cmd.fight.setCurrentPlayer("TheTinaArmstrong");
            doAction(cmd, "bondage", "Light").then(() => {
                let condition = () => {
                    return (cmd.fight.hasStarted && !cmd.fight.hasEnded && cmd.fight.waitingForAction);
                };
                waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(condition).done(() => {
                    if (wasPrivMessageSent(Constants.Messages.checkAttackRequirementsNotInSexualHold)) {
                        done();
                    }
                    else {
                        done.fail(new Error("Did not say that the attacker must apply a sexhold for a bondage attack."));
                    }
                });
            }).catch(err => {
                fChatLibInstance.throwError(err);
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should forfeit the match and give the win", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(2).times(500).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            doAction(cmd, "forfeit", "").then(() => {
                let condition = () => {
                    return (cmd.fight.hasStarted && !cmd.fight.hasEnded && cmd.fight.waitingForAction);
                };
                waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(condition).done(() => {
                    if (wasMessageSent("has too many items on them to possibly fight!")) {
                        done();
                    }
                    else {
                        done.fail(new Error("Did not say that the attacker must apply a sexhold for a bondage attack."));
                    }
                });
            }).catch(err => {
                fChatLibInstance.throwError(err);
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should call the match a draw", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(2).times(500).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            doAction(cmd, "draw", "").then(() => {
                cmd.fight.nextTurn();
                doAction(cmd, "draw", "").then(() => {
                    let condition = () => {
                        return (cmd.fight.hasEnded);
                    };
                    waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(condition).done(() => {
                        if (wasMessageSent("Everybody agrees, it's a draw!")) {
                            done();
                        }
                        else {
                            done.fail(new Error("Did not say that there's a draw."));
                        }
                    });
                });
            }).catch(err => {
                fChatLibInstance.throwError(err);
            });
        });
    }, DEFAULT_TIMEOUT);


    it("should win the match with 3 bondage attacks and check if mods are not incorrectly", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            cmd.fight.setCurrentPlayer("TheTinaArmstrong");
            doAction(cmd, "sexhold", "Light").then(() => {
                cmd.fight.nextTurn();
                refillHPLPFP(cmd, "Aelith Blanchette");
                doAction(cmd, "bondage", "Light").then(() => {
                    cmd.fight.nextTurn();
                    refillHPLPFP(cmd, "Aelith Blanchette");
                    doAction(cmd, "sexhold", "Light").then(() => {
                        cmd.fight.nextTurn();
                        refillHPLPFP(cmd, "Aelith Blanchette");
                        doAction(cmd, "bondage", "Light").then(() => {
                            refillHPLPFP(cmd, "Aelith Blanchette");
                            doAction(cmd, "rest", "Light").then(() => {
                                refillHPLPFP(cmd, "Aelith Blanchette");
                                doAction(cmd, "bondage", "Light").then(() => {
                                    refillHPLPFP(cmd, "Aelith Blanchette");
                                    let condition = () => {
                                        return (cmd.fight.hasStarted && !cmd.fight.hasEnded && cmd.fight.waitingForAction);
                                    };
                                    waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(condition).done(() => {
                                        if (cmd.fight.getFighterByName("Aelith Blanchette").isCompletelyBound()) {
                                            done();
                                        }
                                        else {
                                            done.fail(new Error("Did not say that the receiver must abandon because of bondage."));
                                        }
                                    });
                                }).catch(err => {
                                    fChatLibInstance.throwError(err);
                                });
                            }).catch(err => {
                                fChatLibInstance.throwError(err);
                            });
                        }).catch(err => {
                            fChatLibInstance.throwError(err);
                        });
                    }).catch(err => {
                        fChatLibInstance.throwError(err);
                    });
                }).catch(err => {
                    fChatLibInstance.throwError(err);
                });
            }).catch(err => {
                fChatLibInstance.throwError(err);
            });
        });
    }, DEFAULT_TIMEOUT + 10000);

    it("should grant the itemPickupModifier bonus for the KickStart feature", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        createFighter("TheTinaArmstrong").features.push(new Feature("TheTinaArmstrong", FeatureType.KickStart, 1));
        await initiateMatchSettings1vs1(cmd);

        waitUntil().interval(2).times(500).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            cmd.fight.setCurrentPlayer("TheTinaArmstrong");
            let condition = () => {
                return (cmd.fight.hasStarted && !cmd.fight.hasEnded && cmd.fight.waitingForAction);
            };
            waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(condition).done(() => {
                if (cmd.fight.getFighterByName("TheTinaArmstrong").modifiers.length == 1
                    && cmd.fight.getFighterByName("TheTinaArmstrong").modifiers[0].type == ModifierType.ItemPickupBonus) {
                    done();
                }
                else {
                    done.fail(new Error("Didn't do the stun"));
                }
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should do a stun and grant the stun modifier", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(2).times(500).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            cmd.fight.setCurrentPlayer("TheTinaArmstrong");
            doAction(cmd, "stun", "Light").then(() => {
                let condition = () => {
                    return (cmd.fight.hasStarted && !cmd.fight.hasEnded && cmd.fight.waitingForAction);
                };
                waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(condition).done(() => {
                    if (cmd.fight.getFighterByName("Aelith Blanchette").modifiers.length > 0 &&
                        cmd.fight.getFighterByName("Aelith Blanchette").modifiers[0] instanceof StunModifier) {
                        done();
                    }
                    else {
                        done.fail(new Error("Didn't do the stun"));
                    }
                });
            }).catch(err => {
                fChatLibInstance.throwError(err);
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should do a stun and grant the stun modifier, and reduce the dice roll", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(2).times(500).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            cmd.fight.setCurrentPlayer("TheTinaArmstrong");
            doAction(cmd, "stun", "Light").then(() => {
                doAction(cmd, "brawl", "Light").then(() => {
                    let condition = () => {
                        return (cmd.fight.hasStarted && !cmd.fight.hasEnded && cmd.fight.waitingForAction);
                    };
                    waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(condition).done(() => {
                        if (cmd.fight.getFighterByName("Aelith Blanchette").modifiers.length == 0 && wasMessageSent("penalty applied on their dice roll")) {
                            done();
                        }
                        else {
                            done.fail(new Error("Didn't do the stun"));
                        }
                    });
                });
            }).catch(err => {
                fChatLibInstance.throwError(err);
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should do a forcedworship attack", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(2).times(500).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            cmd.fight.setCurrentPlayer("TheTinaArmstrong");
            doAction(cmd, "forcedworship", "Light").then(() => {
                let condition = () => {
                    return (cmd.fight.hasStarted && !cmd.fight.hasEnded && cmd.fight.waitingForAction);
                };
                waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(condition).done(() => {
                    if (wasMessageSent(Constants.Messages.HitMessage)) {
                        done();
                    }
                    else {
                        done.fail(new Error("Didn't do a forcedworship attack"));
                    }
                });
            }).catch(err => {
                fChatLibInstance.throwError(err);
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should heal 0 hp because it's already full", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            var initialHp = cmd.fight.getFighterByName("Aelith Blanchette").hp;
            cmd.fight.getFighterByName("Aelith Blanchette").healHP(10);
            cmd.fight.message.send();
            waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(() => {
                return (cmd.fight.hasStarted && cmd.fight.waitingForAction);
            }).done(() => {
                var healedHp = (cmd.fight.getFighterByName("Aelith Blanchette").hpPerHeart() - initialHp);
                if (healedHp == 0) {
                    done();
                }
                else {
                    done.fail(new Error("Either heal was not triggered or was different than 0HP"));
                }
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should heal whatever hp amount is left", async function (done) { // 0
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            var initialHp = 10;
            cmd.fight.getFighterByName("Aelith Blanchette").hp = initialHp;
            cmd.fight.getFighterByName("Aelith Blanchette").healHP(50);
            cmd.fight.message.send();
            waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(() => {
                return (cmd.fight.hasStarted && cmd.fight.waitingForAction);
            }).done(() => {
                var healedFp = (cmd.fight.getFighterByName("Aelith Blanchette").hpPerHeart() - initialHp);
                var lifeAfter = cmd.fight.getFighterByName("Aelith Blanchette").hp;
                if (lifeAfter == (initialHp + healedFp)) {
                    done();
                }
                else {
                    done.fail(new Error("Either heal was not triggered or was different than the required HP"));
                }
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should heal 1 HP", async function (done) { // 0
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            var initialHp = 1;
            cmd.fight.getFighterByName("Aelith Blanchette").hp = initialHp;
            cmd.fight.getFighterByName("Aelith Blanchette").healHP(1);
            cmd.fight.message.send();
            waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(() => {
                return (cmd.fight.hasStarted && cmd.fight.waitingForAction);
            }).done(() => {
                var healedHp = (cmd.fight.getFighterByName("Aelith Blanchette").hp - initialHp);
                if (healedHp == 1) {
                    done();
                }
                else {
                    done.fail(new Error("Either heal was not triggered or was different than 1HP"));
                }
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should heal 0 lp because it's already full", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            var initialLp = cmd.fight.getFighterByName("Aelith Blanchette").lust;
            cmd.fight.getFighterByName("Aelith Blanchette").healLP(10);
            cmd.fight.message.send();
            waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(() => {
                return (cmd.fight.hasStarted && cmd.fight.waitingForAction);
            }).done(() => {
                if (cmd.fight.getFighterByName("Aelith Blanchette").lust == 0) {
                    done();
                }
                else {
                    done.fail(new Error("Either heal was not triggered or was different than 0HP"));
                }
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should heal whatever lp amount is left", async function (done) { // 0
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            var initialLp = 2;
            cmd.fight.getFighterByName("Aelith Blanchette").lust = initialLp;
            cmd.fight.getFighterByName("Aelith Blanchette").healLP(50);
            cmd.fight.message.send();
            waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(() => {
                return (cmd.fight.hasStarted && cmd.fight.waitingForAction);
            }).done(() => {
                var healedLp = (initialLp - cmd.fight.getFighterByName("Aelith Blanchette").lust);
                var lifeAfter = cmd.fight.getFighterByName("Aelith Blanchette").lust;
                if (lifeAfter == (initialLp - healedLp)) {
                    done();
                }
                else {
                    done.fail(new Error("Either heal was not triggered or was different than the required LP"));
                }
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should heal 1 LP", async function (done) { // 0
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            var initialLp = 1;
            cmd.fight.getFighterByName("Aelith Blanchette").lust = 1;
            cmd.fight.getFighterByName("Aelith Blanchette").healLP(1);
            cmd.fight.message.send();
            waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(() => {
                return (cmd.fight.hasStarted && cmd.fight.waitingForAction);
            }).done(() => {
                var healedLp = (initialLp - cmd.fight.getFighterByName("Aelith Blanchette").lust);
                if (healedLp == 1) {
                    done();
                }
                else {
                    done.fail(new Error("Either lustheal was not triggered or was different than 1LP"));
                }
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should heal 0 fp because it's already full", async function (done) {
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            refillHPLPFP(cmd, "Aelith Blanchette");
            var initialFp = cmd.fight.getFighterByName("Aelith Blanchette").focus;
            cmd.fight.getFighterByName("Aelith Blanchette").healFP(10);
            cmd.fight.message.send();
            waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(() => {
                return (cmd.fight.hasStarted && cmd.fight.waitingForAction);
            }).done(() => {
                var healedFp = (cmd.fight.getFighterByName("Aelith Blanchette").maxFocus() - initialFp);
                if (healedFp == 0) {
                    done();
                }
                else {
                    done.fail(new Error("Either heal was not triggered or was different than 0FP"));
                }
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should heal whatever fp amount is left", async function (done) { // 0
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            var initialFp = 1;
            cmd.fight.getFighterByName("Aelith Blanchette").focus = initialFp;
            cmd.fight.getFighterByName("Aelith Blanchette").healFP(50);
            cmd.fight.message.send();
            waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(() => {
                return (cmd.fight.hasStarted && cmd.fight.waitingForAction);
            }).done(() => {
                if (cmd.fight.getFighterByName("Aelith Blanchette").focus == cmd.fight.getFighterByName("Aelith Blanchette").maxFocus()) {
                    done();
                }
                else {
                    done.fail(new Error("Either heal was not triggered or was different than the required FP"));
                }
            });
        });
    }, DEFAULT_TIMEOUT);

    it("should heal 1 FP", async function (done) { // 0
        var cmd = new CommandHandler(fChatLibInstance, "here");
        await initiateMatchSettings1vs1(cmd);
        waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(() => {
            return cmd.fight.fighters.findIndex(x => x.name == "TheTinaArmstrong") != -1;
        }).done(() => {
            var initialFp = 1;
            cmd.fight.getFighterByName("Aelith Blanchette").focus = initialFp;
            cmd.fight.getFighterByName("Aelith Blanchette").healFP(1);
            cmd.fight.message.send();
            waitUntil().interval(INTERVAL_TO_WAIT_FOR).times(50).condition(() => {
                return (cmd.fight.hasStarted && cmd.fight.waitingForAction);
            }).done(() => {
                var healedHp = (cmd.fight.getFighterByName("Aelith Blanchette").focus - initialFp);
                if (healedHp == 1) {
                    done();
                }
                else {
                    done.fail(new Error("Either heal was not triggered or was different than 1FP"));
                }
            });
        });
    }, DEFAULT_TIMEOUT);

});

jasmine.execute();