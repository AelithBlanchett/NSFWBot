import {Fighter} from "./Fighter";
import {BaseModel} from "./Model";
import {Dice} from "./Dice";
import {FightAction} from "./FightAction";
import {IFChatLib} from "./interfaces/IFChatLib";
import {Utils} from "./Utils";
import {Dictionary} from "./Dictionary";

export enum Team {
    Unknown = -1,
    Blue = 0,
    Red = 1,
    Yellow = 2,
    Orange = 3,
    Pink = 4,
    Purple = 5
}

export class Fight extends BaseModel{
    id:number = -1;
    hasStarted:boolean  = false;
    fighters:Array<Fighter> = [];
    blueTeam:Array<Fighter> = [];
    redTeam:Array<Fighter> = [];
    stage:string;

    teamsToAssignTo:number = 2;

    //real fighting variables
    arrCurrentFighterForTeam:Dictionary<Team,number>;
    arrTeams:Dictionary<Team,Array<Fighter>>;
    currentTeamTurn:Team = Team.Unknown;
    currentTurn:number = 0;

    fightActions:Array<FightAction>;
    attacker:Fighter;
    defender:Fighter;
    holdAttacker:Fighter;
    holdDefender:Fighter;

    message:string = "";
    fChatLibInstance:IFChatLib;
    channel:string;

    public constructor(fChatLibInstance:IFChatLib, channel:string, stage?:string) {
        super();
        this.stage = stage || "Wrestling Ring";
        this.fChatLibInstance = fChatLibInstance;
        this.channel = channel;
        this.arrTeams = new Dictionary<Team,Array<Fighter>>();
        this.arrCurrentFighterForTeam = new Dictionary<Team,number>();
    }

    //Pre-fight utils

    join(fighter:Fighter, team:Team){
        if(!this.hasStarted){
            if(!this.findFighter(fighter.name)){ //find fighter by its name property instead of comparing objects, which doesn't work.
                if(team != Team.Unknown){
                    fighter.assignedTeam = team;
                }
                else{
                    fighter.assignedTeam = this.getTeamToAssign();
                }
                this.fighters.push(fighter);
                if(!this.arrTeams.containsKey(fighter.assignedTeam)){
                    this.arrTeams.add(fighter.assignedTeam, []);
                }
                this.arrTeams.getValue(fighter.assignedTeam).push(fighter);
                return true;
            }
        }
        return false;
    }

    getTeamToAssign(){
        let teamToUse:Team = Team.Blue;
        let arrPlayersCount = new Dictionary<Team, number>();
        let usedTeams= this.getUsedTeams();
        for(var teamId of usedTeams){
            arrPlayersCount.add(teamId as Team, this.getPlayersInTeam(Team[Team[teamId]]));
        }

        let mostPlayersInTeam = Math.max(...arrPlayersCount.values());
        let leastPlayersInTeam = Math.min(...arrPlayersCount.values());
        let indexOfFirstEmptiestTeam = arrPlayersCount.values().indexOf(leastPlayersInTeam);

        if(mostPlayersInTeam == leastPlayersInTeam){
            teamToUse = Team.Blue;
        }
        else{
            teamToUse = Team[Team[indexOfFirstEmptiestTeam]];
        }

        return teamToUse;
    }

    setFighterReady(fighter:Fighter){
        if(!this.hasStarted){
            if(!this.findFighter(fighter.name)){
                this.join(fighter, Team.Unknown);
            }
            var fighterInFight = this.findFighter(fighter.name);
            if(fighterInFight && !fighterInFight.isReady){ //find fighter by its name property instead of comparing objects, which doesn't work.
                fighterInFight.isReady = true;
                this.addMessage("[color=red]"+fighter.name+" is now ready to get it on![/color]");
                this.sendMessage();
                if(this.canStartMatch()){
                    this.startMatch();
                }
                return true;
            }
        }
        return false;
    }

    isEveryoneReady(){
        let isEveryoneReady = true;
        for(var fighter of this.fighters){
            if(!fighter.isReady){
                isEveryoneReady = false;
            }
        }
        return isEveryoneReady;
    }

    canStartMatch(){
        let areTeamsBalanced:boolean = true;
        for(var i = 1; i < this.arrTeams.keys().length; i++)
        {
            if(this.arrTeams.values()[i].length !== this.arrTeams.values()[i].length)
                areTeamsBalanced = false;
        }
        return (this.isEveryoneReady() && areTeamsBalanced && !this.hasStarted && this.fighters.length > 1); //only start if everyone's ready and if the teams are balanced
    }


    //Fight logic

    startMatch(){
        this.addMessage("\n[color=green]Everyone's ready, let's start the match![/color]");
        this.hasStarted = true;

        for(var team of this.getUsedTeams()){
            this.arrCurrentFighterForTeam.add(team, 0);
        }

        this.fighters = Utils.shuffleArray(this.fighters); //random order for teams

        //for(var i = 0; i < (this.blueTeam.length) && (i < this.redTeam.length); i++){
        //    this.addMessage(`[b][color=blue]${this.blueTeam[i].name}[/color] VS [color=blue]${this.redTeam[i].name}[/color][/b]`);
        //}
        //TODO: Print as much names as there are teams
        this.sendMessage();
        this.currentTeamTurn = this.rollAllDice();
        this.addMessage(`${Team[this.currentTeamTurn]} team starts first!`);
        this.sendMessage();
        this.nextTurn();
    }

    nextTurn(){
        this.currentTurn++;
        this.outputStatus();
        //TODO: do turns
    }

    //Fighting info displays

    outputStatus(){
        this.addMessage(`\n[b]Turn #" + this.currentTurn + "[/b] --------------- It's [b][u][color=pink]${this.currentActor.name}[/color][/u][/b]'s turn.\n`);
        for(var fighter of this.blueTeam){
            this.addMessage(this.outputPlayerStatus(fighter, Team.Blue));
        }
        for(var fighter of this.redTeam){
            this.addMessage(this.outputPlayerStatus(fighter, Team.Red));
        }
        this.sendMessage();
    }

    outputPlayerStatus(fighter:Fighter, team?:Team){
        return `[color=${Team[team]}][b]${fighter.name}: [/b]${fighter.hp}/${fighter.hpPerHeart} [color=red]HP[/color]  |  ${fighter.heartsRemaining}/${fighter.maxHearts} [color=red]Hearts[/color]  |  ${fighter.lust}/${fighter.lustPerOrgasm} [color=pink]Lust[/color]  |  ${fighter.orgasmsRemaining}/${fighter.maxOrgasms} [color=pink]Orgasms[/color]  |  [sub]${fighter.minFocus}[/sub]|[b]${fighter.focus}[/b]|[sub]${fighter.maxFocus}[/sub] Focus[/color]\n`;
    }



    //Fight helpers

    findFighter(name){
        let index = this.fighters.map(function(e) { return e.name; }).indexOf(name);
        return this.fighters[index];
    }

    findFighterId(name){
        let index = this.fighters.map(function(e) { return e.name; }).indexOf(name);
        return index;
    }

    get currentActor():Fighter{
        return this.arrTeams.getValue(this.currentTeamTurn)[this.arrCurrentFighterForTeam.getValue(this.currentTeamTurn)];
    }

    get currentTarget():Fighter{
        //TODO: Re-do that pls
    }

    getPlayersInTeam(team:Team){
        let count = 0;
        for(var fighter of this.fighters){
            if(fighter.assignedTeam == team){
                count++;
            }
        }
        return count;
    }

    getUsedTeams():Array<Team>{
        let teamsList:Array<Team> = this.getTeamsIdList();
        let arrUsedTeamOrNot:Array<boolean> = [];
        for(var team of teamsList){
            arrUsedTeamOrNot[team] = false;
            if((this.getPlayersInTeam(Team[Team[team]]) > 0) || (team < this.teamsToAssignTo)){
                arrUsedTeamOrNot[team] = true;
            }
        }
        let usedTeams:Array<Team> = [];
        for(var i = 0; i<arrUsedTeamOrNot.length; i++){
            if(arrUsedTeamOrNot[i]){
                usedTeams.push(i);
            }
        }
        return usedTeams;
    }

    //Dice rolling

    rollAllDice(){ //make this modular to teams
        let arrResults = new Dictionary<Team,number>();
        let theDice = new Dice(10);
        for(var team of this.arrTeams.keys()){
            arrResults.add(team, theDice.roll(1));
            this.addMessage(`\n[color=${Team[team]}]${Team[team]}[/color] team rolled a ${arrResults.getValue(team)}`);
        }

        let bestScore = Math.max(...arrResults.values());
        let indexOfBestTeam = arrResults.values().indexOf(bestScore);
        let worstScore = Math.min(...arrResults.values());
        let indexOfWorstTeam = arrResults.values().indexOf(worstScore);

        if(bestScore == worstScore){
            this.rollAllDice();
        }
        let winner:Team = Team.Unknown;
        if(this.getAllIndexes(arrResults.values(),bestScore).length == 1){
            winner = Team[Team[arrResults.keys()[indexOfBestTeam]]];
        }
        else{
            this.addMessage("Tie! Re-rolling.")
            this.rollAllDice();
        }
        return winner;
    }

    getAllIndexes(arr, val) {
        var indexes = [], i;
        for(i = 0; i < arr.length; i++)
            if (arr[i] === val)
                indexes.push(i);
        return indexes;
    }

    //Messaging

    addMessage(strMsg:string){
        this.message += strMsg +"\n";
    }

    sendMessage(){
        this.fChatLibInstance.sendMessage(this.message, this.channel);
        this.message = "";
    }

    //Misc. shortcuts
    get fighterCount():number {
        return this.fighters.length;
    }

    getTeamsIdList():Array<number>{
        let arrResult = [];
        for (var enumMember in Team) {
            var isValueProperty = parseInt(enumMember, 10) >= 0
            if (isValueProperty) {
                arrResult.push(enumMember);
            }
        }
        return arrResult;
    }

}