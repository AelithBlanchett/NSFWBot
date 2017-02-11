import {Model} from "./Model";
import {Fighter} from "./Fighter";
import {Achievement} from "./Achievement";
import {Feature} from "./Feature";

export class FighterRepository{

    public static async persist(fighter:Fighter):Promise<void>{
        try
        {
            let id = await Model.db('nsfw_fighters').where({name: fighter.name}).first();
            let currentSeason = await Model.db('nsfw_constants').where({key: "currentSeason"}).first();
            if(id != null){
                await Model.db('nsfw_fighters').insert({
                    name: fighter.name,
                    season: currentSeason.value,
                    power: fighter.power,
                    sensuality: fighter.sensuality,
                    dexterity: fighter.dexterity,
                    toughness: fighter.toughness,
                    endurance: fighter.endurance,
                    willpower: fighter.willpower,
                    areStatsPrivate: fighter.areStatsPrivate,
                    tokens: fighter.tokens,
                    tokensSpent: fighter.tokensSpent
                });
            }
            else{
                await Model.db('nsfw_fighters').where({name: fighter.name, season: currentSeason.value}).update({
                    power: fighter.power,
                    sensuality: fighter.sensuality,
                    dexterity: fighter.dexterity,
                    toughness: fighter.toughness,
                    endurance: fighter.endurance,
                    willpower: fighter.willpower,
                    areStatsPrivate: fighter.areStatsPrivate,
                    tokens: fighter.tokens,
                    tokensSpent: fighter.tokensSpent
                });
            }
        }
        catch(ex){
            throw ex;
        }
    }

    public static async load(name:string):Promise<Fighter>{
        let loadedFighter:Fighter = new Fighter(name);

        try
        {
            let currentSeason = await Model.db('nsfw_constants').where({key: "currentSeason"}).first();
            var loadedData = await Model.db('nsfw_v_fighters').where({name: name, season: currentSeason.value}).select();

            var data = loadedData[0];

            for(let prop of Object.getOwnPropertyNames(data)){
                if(Object.getOwnPropertyNames(loadedFighter).indexOf(prop) != -1){
                    if(typeof data[prop] != "function"){
                        loadedFighter[prop] = data[prop];
                    }
                }
            }

            let achievements = await FighterRepository.loadAllAchievements(name, currentSeason.value);
            loadedFighter.achievements = achievements;

            let features = await FighterRepository.loadAllFeatures(name, currentSeason.value);
            loadedFighter.features = features;
        }
        catch(ex){
        }

        return loadedFighter;
    }

    static async loadAllAchievements(fighterName:string, season:number):Promise<Achievement[]>{
        let result;

        try{
            result = await Model.db('nsfw_fighters_achievements').select('idAchievement', 'createdAt').where('idFighter', fighterName).andWhere('season', season);
        }
        catch(ex){
            throw ex;
        }

        let achievementsArray:Achievement[] = [];
        for(let row of result){
            achievementsArray.push(new Achievement(parseInt(row.idAchievement), row.createdAt));
        }
        return achievementsArray;
    }

    static async loadAllFeatures(fighterName:string, season:number):Promise<Feature[]>{
        let result;

        try{
            result = await Model.db('nsfw_fighters_features').where('idFighter', fighterName).andWhere('season', season).select();
        }
        catch(ex){
            throw ex;
        }

        let featuresArray:Feature[] = [];
        for(let row of result){
            featuresArray.push(new Feature(fighterName, row.type, row.uses, row.idFeature));
        }
        return featuresArray;
    }

}