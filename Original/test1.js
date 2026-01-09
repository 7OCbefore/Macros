const FS = Java.type('java.nio.file.Files');
const Paths = Java.type('java.nio.file.Paths');
const StandardCharsets = Java.type('java.nio.charset.StandardCharsets');

const filePath = Paths.get(__dirname, "bossbars.txt");
const bossbars = World.getBossBars();

FS.writeString(filePath, String(bossbars), StandardCharsets.UTF_8);
Chat.log("§a已写入: " + filePath);
