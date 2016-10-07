interface IMessage {
    action: Array<string>;
    damage: number;
    hit: Array<string>;
    status: Array<string>;
    hint: Array<string>;
    special: Array<string>;
    info: Array<string>;
    error: Array<string>;
}

export class Message implements IMessage {
    action:Array<string>;
    damage:number;
    heal:number;
    hit:Array<string>;
    status:Array<string>;
    hint:Array<string>;
    special:Array<string>;
    info:Array<string>;
    error:Array<string>;

    constructor(){
        this.action = [];
        this.damage = 0;
        this.heal = 0;
        this.hit = [];
        this.status = [];
        this.hint = [];
        this.special = [];
        this.info = [];
        this.error = [];
    }

    getAction() {
        return "Action: " + this.action.join(" ") + " ";
    }

    getDamage() {
        return "[color=yellow]( Damage: " + this.damage + " )[/color]";
    }

    getHeal() {
        return "[color=yellow]( Heal: " + this.heal + " )[/color]";
    }

    getHit() {
        return "[color=red][b]" + this.hit.join("\n") + "[/b][/color]";
    }

    getHint() {
        return "[color=cyan]" + this.hint.join("\n") + "[/color]";
    }

    getSpecial() {
        return "\n[color=red]" + this.special.join("\n") + "[/color]";
    }

    getStatus(){
        return this.status.join("\n");
    }

    getInfo(){
        return "\n" + this.info.join("\n");
    }

    addAction(line) {
        if (typeof line === "string") this.action.push(line);
    }

    addHit(line) {
        if (typeof line === "string") this.hit.push(line);
    }

    addStatus(line) {
        if (typeof line === "string") this.status.push(line);
    }

    addInfo(line){
        if (typeof line === "string") this.info.push(line);
    }


    getMessage() {
        let message = "";

        var lines = [""];

        lines[0] += this.getAction();
        if(this.damage != 0){ lines[0] += this.getDamage();}
        if(this.heal != 0){ lines[0] += this.getHeal();}
        if (lines[0] == "") lines = [];

        if (this.hit.length) lines.push(this.getHit());
        if (this.status.length) lines.push(this.getStatus());
        if (this.hint.length) lines.push(this.getHint());
        if (this.special.length) lines.push(this.getSpecial());
        if (this.info.length) lines.push(this.getInfo());

        message = lines.join("\n");

        return message;
    }
}