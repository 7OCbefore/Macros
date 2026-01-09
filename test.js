var closeKey = "key.keyboard.x";
JsMacros.on("Key", JavaWrapper.methodToJava((e, ctx) => {
    if (e.key == closeKey) {
        Chat.log('Script stopped.');
        JavaWrapper.stop();
    }
}));

let allPlayers = World.getPlayers();
let targetPlayerName = "7OCbefore";
let targetPlayerIndex = allPlayers.findIndex(player => player.getName() === targetPlayerName);
Chat.log(`ping:${allPlayers[targetPlayerIndex].getPing()}`);

