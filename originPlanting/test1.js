function getBossBarInfo() {
    const bossbars = World.getBossBars();

    if (!bossbars || bossbars.length === 0) {
        Chat.log("Bossbar 信息为空，无法读取时间信息。");
        return null;
    }

    for (let i = 0; i < bossbars.length; i++) {
        const bossbar = bossbars[i];
        let name = bossbar.getName(); // 获取 Bossbar 名称

        // 确保 name 是字符串类型
        if (typeof name !== 'string') {
            name = String(name); // 如果不是字符串，则尝试转换为字符串
            Chat.log(`§eBossbar 名称类型为 ${typeof name}，已转换为字符串: ${name}`);
        }

        // 使用正则表达式搜索时间格式 "HH:MM AM" 或 "HH:MM PM"
        let timeRegex = /(\d{1,2}):(\d{2}) (AM|PM)/i;
        let timeMatch = name.match(timeRegex);

        if (timeMatch && timeMatch[0]) {
            const timeString = timeMatch[0];
            Chat.log("§e当前时间 (Bossbar): " + timeString);
            return {
                raw: timeString,
                hours: parseInt(timeMatch[1], 10),
                minutes: parseInt(timeMatch[2], 10),
                ampm: timeMatch[3].toUpperCase()
            };
        }
    }

    Chat.log("在 Bossbar 信息中未找到时间信息。");
    return null;
}

const timeInfo = getBossBarInfo();

if (timeInfo) {
    Chat.log("小时: " + timeInfo.hours);
    Chat.log("分钟: " + timeInfo.minutes);
    Chat.log("AM/PM: " + timeInfo.ampm);
} else {
    // 处理未找到时间信息的情况
}