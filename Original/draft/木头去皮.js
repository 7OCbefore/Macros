var closeKey = "key.keyboard.x";
JsMacros.on("Key", JavaWrapper.methodToJava((e, ctx) => {
    if (e.key == closeKey) {
        Chat.log('Script stopped.');
        JavaWrapper.stop();
    }
}));


// 定义木头方块和斧头的名称
// 定义树木相关方块的 ID
const WOOD_NAMES = [
    "oak_log", // "橡木原木"
    "spruce_log", // "云杉原木"
    "birch_log", // "白桦原木"
    "jungle_log", // "丛林原木"
    "acacia_log", // "金合欢原木"
    "dark_oak_log", // "深色橡木原木"
    "oak_leaves", // "橡木树叶"
    "spruce_leaves", // "云杉树叶"
    "birch_leaves", // "白桦树叶"
    "jungle_leaves", // "丛林树叶"
    "acacia_leaves", // "金合欢树叶"
    "dark_oak_leaves", // "深色橡木树叶"
    "橡木原木",
    "云杉原木",
    "白桦原木",
    "丛林原木",
    "金合欢原木",
    "深色橡木原木",
    "橡木树叶",
    "云杉树叶",
    "白桦树叶",
    "丛林树叶",
    "金合欢树叶",
    "深色橡木树叶",

];
const AXE_NAME = "legendaryaxe"; // 斧头类型

/**
 * 查找背包中的物品
 * @param {string} itemName - 要查找的物品名称（忽略大小写和特殊字符）。
 * @returns {number[]} - 匹配的槽位索引数组。
 */
function findItemByName(itemName) {
    const inventory = Player.openInventory(); // 打开玩家背包或箱子
    const totalSlots = inventory.getTotalSlots(); // 获取总槽位数
    const matchedSlots = []; // 存储匹配的槽位索引

    for (let i = 0; i < totalSlots; i++) {
        const item = inventory.getSlot(i); // 获取当前槽位的物品
        if (item) {
            // 清理物品名称：保留汉字、字母和阿拉伯数字，移除其他字符
            const itemNameClean = item.getName().getString()
                .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]+/g, '') // 去除非汉字、字母和数字字符
                .trim() // 去除首尾空格
                .toLowerCase(); // 转换为小写以忽略大小写

            // 比较清理后的名称
            if (itemNameClean === itemName.toLowerCase()) {
                matchedSlots.push(i); // 如果匹配，记录槽位索引
            }
        }
    }

    return matchedSlots;
}

/**
 * 从背包或箱子中找到并切换物品到主手
 * @param {string[]} targetItems - 目标物品名称数组。
 * @returns {boolean} - 是否成功找到并切换物品。
 */
function switchToOffhand(targetItems) {
    const inventory = Player.openInventory(); // 打开玩家背包或箱子
    inventory.quick(45);
    Client.waitTick(4);
    for (const itemName of targetItems) {
        const itemSlots = findItemByName(itemName); // 查找物品槽位
        if (itemSlots.length > 0) {
            const slot = itemSlots[0]; // 取第一个匹配的槽位
            inventory.swap(slot, 45); // 切换到副手
            Client.waitTick(4); // 等待切换完成
            Chat.log(`§a已将 ${itemName} 切换到副手`);
            return true; // 成功切换
        }
    }
    Chat.log("§c未找到任何符合条件的物品！");
    return false; // 未找到物品
}

/**
 * 自动剥皮逻辑
 */
function autoDebarkWood() {
    // 导入必要的模块
    const player = Player.getPlayer(); // 获取玩家对象
    const interactionManager = Player.getInteractionManager();
    const inventory = Player.openInventory();

    while (true) {
        // 检查副手中的木头数量
        const offhandCount = inventory.getSlot(45).getCount();
        Chat.log(`副手中的木头数量：${offhandCount}`);
        if (offhandCount <= 1) {
            Client.waitTick(34);
            KeyBind.keyBind("key.attack", false);
            // 如果副手中的木头不足，尝试从背包中补充
            if (!switchToOffhand(WOOD_NAMES)) {
                Chat.log("§c背包中没有更多木头，剥皮结束！");
                break; // 背包中没有木头，退出循环
            }
        }

        // 获取玩家当前位置,向下取整转成int
        var x = Math.floor(player.getX());
        var y = Math.floor(player.getY());
        var z = Math.floor(player.getZ());
        // Chat.log(`当前位置：x=${x}, y=${y}, z=${z}`);

        // 玩家看向脚下
        player.lookAt("down");

        // 起跳
        KeyBind.keyBind("key.jump", true); // 按下跳跃键
        Client.waitTick(6); // 等待 6 tick
        KeyBind.keyBind("key.jump", false);


        interactionManager.interactBlock(x, y, z, player.getFacingDirection().getName(), true); // 放置木头
        Client.waitTick(1); // 等待 6 tick

        // 对木头方块右键剥皮
        interactionManager.interactBlock(x, y, z, player.getFacingDirection().getName(), false); // 剥皮
        Client.waitTick(4); // 等待 6 tick

        // 破坏剥皮后的木头方块
        // interactionManager.breakBlock(x, y, z); // 破坏方块
        KeyBind.keyBind("key.attack", true);
        Client.waitTick(3); // 等待 6 tick

    }
}

// 执行自动剥皮
autoDebarkWood();
