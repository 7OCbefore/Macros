/**
 * @file example2.js
 * @description Capture ACTIONBAR text and log to file
 * @version 1.0.0
 */
const outputFilePath = "D:/Minecraft/originRealms/.minecraft/versions/新新源神 启动！1.20.6-Fabric 0.16.0/config/jsMacros/Macros/Original/actionbar_log.txt";
const closeKey = "key.keyboard.x";
const flushIntervalMs = 2000;

function readAllText(filePath) {
    if (!FS.exists(filePath)) {
        return "";
    }
    const file = FS.open(filePath);
    const lineIterator = file.readLines();
    const lines = [];

    while (lineIterator.hasNext()) {
        lines.push(lineIterator.next());
    }

    lineIterator.close();
    return lines.join("\n");
}

function appendLines(lines) {
    if (!lines.length) {
        return;
    }

    const existing = readAllText(outputFilePath);
    const newContent = lines.join("\n");
    const content = existing ? `${existing}\n${newContent}\n` : `${newContent}\n`;
    const file = FS.open(outputFilePath);
    file.write(content);
}

let buffer = [];
let lastFlushTime = Date.now();

const titleListener = JsMacros.on("Title", JavaWrapper.methodToJava((e) => {
    if (e.type !== "ACTIONBAR") {
        return;
    }

    const actionbarText = e.message.getString();
    if (!actionbarText) {
        return;
    }

    const numbersOnly = actionbarText.replace(/\D+/g, "").trim();
    if (!numbersOnly) {
        return;
    }

    buffer.push(`[${new Date().toISOString()}] ${numbersOnly}`);

    const now = Date.now();
    if (now - lastFlushTime >= flushIntervalMs) {
        appendLines(buffer);
        buffer = [];
        lastFlushTime = now;
    }
}));

const keyListener = JsMacros.on("Key", JavaWrapper.methodToJava((event) => {
    if (event.key === closeKey && event.action === 1) {
        appendLines(buffer);
        buffer = [];
        JsMacros.off(titleListener);
        JsMacros.off(keyListener);
        Chat.log(`§a[Actionbar] Log flushed to ${outputFilePath}`);
        JavaWrapper.stop();
    }
}));

Chat.log("§a[Actionbar] Logging ACTIONBAR. Press X to stop.");
