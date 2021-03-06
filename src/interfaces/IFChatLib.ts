export interface IFChatLib{
    sendMessage(s: string, chan: string);
    throwError(s: string);
    sendPrivMessage(message: string, character: string);
    isUserChatOP(username: string, channel: string);
    addPrivateMessageListener(fn: any);
    isUserMaster(character:string, channel:string);
}