import {Dice} from "./Dice";
import * as Parser from "./Parser";
import {Fighter} from "./Fighter";
import {Fight} from "./Fight";
import {IParserResponse} from "./interfaces/IParserResponse";
import {ICommandHandler} from "./interfaces/ICommandHandler";
import {IFChatLib} from "./interfaces/IFChatLib";


export class CommandHandler implements ICommandHandler{
    fChatLibInstance:IFChatLib;
    channel:string;

    constructor(fChatLib:IFChatLib, chan:string){
        this.fChatLibInstance = fChatLib;
        this.channel = chan;
    }

    register(args:string, data:FChatResponse){
        let parsedResult:IParserResponse = Parser.Commands.register(args);
        if(parsedResult.success){
            Fighter.exists(data.character).then(doesExist =>{
                if(!doesExist){
                    Fighter.create(data.character, parsedResult.args.power, parsedResult.args.dexterity, parsedResult.args.toughness, parsedResult.args.endurance, parsedResult.args.willpower).then(()=>{
                        this.fChatLibInstance.sendMessage("You are now registered! Welcome!", this.channel);
                    }).catch(err => {
                        this.fChatLibInstance.throwError(err);
                    });
                }
                else{
                    this.fChatLibInstance.sendMessage("[color=red]You are already registered.[/color]", this.channel);
                }
            }).catch(err =>{
                console.log(err);
            });
        }
    };

    stats(args:string, data:FChatResponse){
        Fighter.exists(data.character).then(fighter =>{
            if(fighter){
                fighter = <Fighter>fighter;
                this.fChatLibInstance.sendMessage(fighter.outputStats(), this.channel);
            }
            else{
                this.fChatLibInstance.sendMessage("[color=red]You are not registered.[/color]", this.channel);
            }
        }).catch(err =>{
            this.fChatLibInstance.throwError(err);
        });
    };

    getStats(args:string, data:FChatResponse){
        Fighter.exists(args).then(fighter =>{
            if(fighter){
                fighter = <Fighter>fighter;
                this.fChatLibInstance.sendMessage(fighter.outputStats(), this.channel);
            }
            else{
                this.fChatLibInstance.sendMessage("[color=red]This wrestler is not registered.[/color]", this.channel);
            }
        }).catch(err =>{
            this.fChatLibInstance.throwError(err);
        });
    };
}