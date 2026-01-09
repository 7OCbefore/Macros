/**
 * @file 综合脚本：作物自动售货机 + Jacko 售卖 (最终优化版)
 * @description 结合自动售货机和 Jacko 售卖功能，根据时间自动切换模式.
 * @version 1.2.4 (最终优化版)
 * @author [Your Name]
 * @date [Current Date]
 */

// 脚本启动提示
Chat.log('§a自动售货机(光顾Jacko版)(最终优化版)已上线');

/**
 * @typedef {object} CropInfo
 * @property {string} name - 作物名称 (用于匹配消息和物品).
 * @property {string} basket - 作物篮子物品名称.
 * @property {number[]} chestPos - 存放篮子的箱子坐标 [x, y, z].
 * @property {number} sellForJackoPrice - Jacko 收购价格 (用于 test.js).
 */

/**
 * @typedef {object} ScriptConfiguration
 * @property {string} closeKey - 停止脚本的按键 (Minecraft KeyCode).
 * @property {number} defaultAuctionPrice - 默认拍卖价格.
 * @property {number} defaultSellAmount - 默认出售数量.
 */

/**
 * @constant {ScriptConfiguration} scriptConfig - 脚本全局配置.
 */
const scriptConfig = {
    closeKey: "key.keyboard.x",        // 默认停止按键为 X
    defaultSellAmount: 64,          // 默认出售数量
    defaultAuctionPrice: 800,
};

/**
 * @global {number|null} defaultAuctionPriceDynamic - 动态获取的默认拍卖价格.
 */
let defaultAuctionPriceDynamic = null;

/**
 * @constant {Object<string, CropInfo>} cropData - 作物数据配置.
 * @description  定义不同作物的名称、篮子、箱子位置和 Jacko 价格.
 */
const cropData = {
    "Apple": {
        name: "Apple",
        basket: "AppleBasket",
        chestPos: [204, 56, 394], // 3-star 苹果箱子位置
        sellForJackoPrice: 17,
    },
    "Mango": {
        name: "Mango",
        basket: "MangoBasket",
        chestPos: [204, 56, 391], // 3-star 芒果箱子位置
        sellForJackoPrice: 17,
    },
    "Banana": {
        name: "Banana",
        basket: "BananaBasket",
        chestPos: [204, 56, 388], // 3-star 香蕉箱子位置
        sellForJackoPrice: 17,
    }
};

/**
 * @constant {Object<string, CropInfo>} cropDataMap - 作物数据配置 Map.
 * @description  使用作物名称作为键，优化查找效率.
 */
const cropDataMap = Object.keys(cropData).reduce((map, cropKey) => {
    map[cropData[cropKey].name] = cropData[cropKey];
    return map;
}, {});


/**
 * @global {boolean} isProcessing - 标记是否正在处理作物消息队列.
 */
let isProcessing = false;

/**
 * @global {Array<{crop: string, amount: number}>} cropMessageQueue - 存储卖出的作物信息队列.
 */
const cropMessageQueue = [];

/**
 * @global {boolean} isJackoMode - 标记当前是否为 Jacko 售卖模式.
 */
let isJackoMode = false;

/**
 * @constant {object} jackoData - Jacko 相关数据配置.
 */
const jackoData = {
    pos1: [-54, 70, -119], // Jacko 位置 1
    pos2: [-57, 70, -115]  // Jacko 位置 2
};


// 强制暂停脚本 - 监听按键事件
JsMacros.on("Key", JavaWrapper.methodToJava((event, context) => {
    if (event.key === scriptConfig.closeKey) {
        Chat.log('§a自动售货机下线了');
        JavaWrapper.stop();
    }
}));

/**
 * 查找指定名称的物品在背包中的槽位.
 *
 * @param {string} itemName - 要查找的物品名称 (不区分大小写，移除特殊字符).
 * @returns {number[]} - 包含匹配物品槽位索引的数组，如果未找到则返回空数组.
 */
function findItemByName(itemName) {
    const inventory = Player.openInventory();
    const totalSlots = inventory.getTotalSlots();
    const matchedSlots = [];
    for (let i = 0; i < totalSlots; i++) {
        const item = inventory.getSlot(i);
        if (item && item.getName().getString().replace(/[^a-zA-Z]+/g, '').trim() === itemName) {
            matchedSlots.push(i);
        }
    }
    return matchedSlots;
}

/**
 * 查找快捷栏中的空槽位.
 *
 * @returns {number} - 空槽位的索引 (36-44)，如果未找到则返回 -1.
 */
function findEmptyHotbarSlot() {
    const inventory = Player.openInventory();
    for (let i = 36; i < 45; i++) { // 快捷栏槽位范围 36-44
        if (!inventory.getSlot(i)) {
            return i;
        }
    }
    return -1; // 没有找到空槽位
}

/**
 * 拆分物品堆叠到指定数量.
 *
 * @param {Inventory} inventory - 玩家物品栏对象.
 * @param {number} slot - 物品所在槽位索引.
 * @param {number} amount - 目标拆分数量.
 * @returns {number|boolean} - 拆分后物品所在的快捷栏槽位索引 (36-44)，拆分失败返回 false.
 */
function splitItemStack(inventory, slot, amount) {
    const emptyHotbarSlot = findEmptyHotbarSlot();
    if (emptyHotbarSlot === -1) {
        Chat.log('§a快捷栏没有空槽位，无法拆分物品');
        return false;
    }
    // 将物品移动到空的快捷栏位置
    inventory.swapHotbar(slot, emptyHotbarSlot - 36);
    Client.waitTick(8);
    // 拆分物品
    inventory.click(emptyHotbarSlot);
    Client.waitTick(3);
    inventory.click(emptyHotbarSlot, 1, 'right'); // 右键点击拆分
    Client.waitTick(3);
    // 调整数量
    for (let i = 1; i < amount; i++) {
        inventory.click(emptyHotbarSlot, 0, 'left'); // 左键增加数量
        Client.waitTick(1);
    }
    // 确认拆分
    inventory.click(-999); // 点击物品栏外确认
    Client.waitTick(8);
    return emptyHotbarSlot; // 返回拆分后物品所在的槽位
}

/**
 * 自动拍卖指定数量的物品.
 *
 * @param {string} itemName - 要拍卖的物品名称.
 * @param {number} [amount=scriptConfig.defaultSellAmount] - 拍卖数量，默认为配置中的默认出售数量.
 * @returns {boolean} - 上架成功返回 true，否则返回 false.
 */
function auction(itemName, amount = scriptConfig.defaultSellAmount) {
    const inventory = Player.openInventory();
    const itemSlots = findItemByName(itemName);
    // 使用动态获取的价格，默认为配置中的默认价格
    const price = defaultAuctionPriceDynamic !== null ? defaultAuctionPriceDynamic : scriptConfig.defaultAuctionPrice;

    if (itemSlots.length > 0) {
        for (const slot of itemSlots) {
            const stackSize = inventory.getSlot(slot).getCount();
            if (stackSize >= amount) {
                // 将找到的物品与主手物品交换
                inventory.swapHotbar(slot, inventory.getSelectedHotbarSlotIndex());
                Client.waitTick(10);
                // 如果需要拆分物品
                if (stackSize > amount) {
                    const splitSlot = splitItemStack(inventory, slot, amount);
                    if (splitSlot === false) {
                        return false;
                    }
                    inventory.swapHotbar(splitSlot, inventory.getSelectedHotbarSlotIndex());
                    Client.waitTick(8);
                }
                // 上架物品 - 两次 Chat.say
                Chat.say(`/auction ${price}`);
                Client.waitTick(8);
                Chat.say(`/auction ${price}`);
                Chat.log(`§a已将${amount}个 ${itemName} 换到主手并上架，来自槽位 ${slot}`);
                return true; // 上架成功
            }
        }
        Chat.log(`§a未找到${amount}堆叠的 ${itemName}`);
    } else {
        Chat.log(`§a未找到物品: ${itemName}`);
    }
    return false; // 上架失败
}

/**
 * 朝目标方块移动并停止.
 *
 * @param {number} x - 目标方块 X 坐标.
 * @param {number} y - 目标方块 Y 坐标.
 * @param {number} z - 目标方块 Z 坐标.
 * @param {number} [distanceThreshold=5] - 停止移动的距离阈值，默认为 5.
 */
function moveToBlock(x, y, z, distanceThreshold = 5) {
    const player = Player.getPlayer();
    const targetX = x + 0.5; // 方块中心 X
    const targetY = y + 0.5; // 方块中心 Y
    const targetZ = z + 0.5; // 方块中心 Z
    player.lookAt(targetX, targetY, targetZ); // 朝向目标方块
    while (player.distanceTo(targetX, targetY, targetZ) > distanceThreshold) {
        player.lookAt(targetX, targetY, targetZ); // 持续朝向目标
        KeyBind.keyBind("key.forward", true); // 按住前进键
        KeyBind.keyBind("key.sprint", true);  // 按住疾跑键
        Client.waitTick(1);
    }
    KeyBind.keyBind("key.forward", false); // 松开前进键
}

/**
 * 从箱子中取出指定名称的篮子.
 *
 * @param {string} basketName - 篮子物品名称.
 * @param {number[]} chestPos - 箱子坐标 [x, y, z].
 * @returns {boolean} - 取出篮子成功返回 true，否则返回 false.
 */
function getBasketFromChest(basketName, chestPos) {
    moveToBlock(chestPos[0], chestPos[1], chestPos[2]); // 移动到箱子位置
    const player = Player.getPlayer();
    Player.getInteractionManager().interactBlock(chestPos[0], chestPos[1], chestPos[2], player.getFacingDirection().getName(), false); // 模拟右键打开箱子
    // 等待箱子打开
    while (!Hud.isContainer()) {
        Client.waitTick();
    }
    Client.waitTick(4); // 等待界面加载
    const chestInventory = Player.openInventory();
    const basketSlots = findItemByName(basketName); // 查找箱子中的篮子
    for (const slot of basketSlots) {
        const slotItem = chestInventory.getSlot(slot);
        if (slotItem.getCount() === 64) { // 检查是否为完整堆叠
            chestInventory.quick(slot); // 使用 quick() 取出篮子
            Client.waitTick(4);
            Chat.log(`§a成功从箱子中取出 ${basketName}`);
            chestInventory.closeAndDrop(); // 关闭箱子并掉落物品到地上 (如果快捷栏已满)
            Client.waitTick(4);
            return true; // 取出篮子成功
        }
    }
    Chat.log(`§a箱子中没有找到64个 ${basketName}`);
    return false; // 箱子中未找到篮子
}

/**
 * 处理作物售出后的补货和上架流程.
 *
 * @param {string} cropName - 售出的作物名称.
 * @param {number} [amount=scriptConfig.defaultSellAmount] - 售出数量，默认为配置中的默认出售数量.
 */
function handleCropSold(cropName, amount = scriptConfig.defaultSellAmount) {
    if (auction(cropName, amount)) { // 尝试直接上架
        return; // 如果上架成功，直接返回
    }
    const cropInfo = cropData[cropName]; // 获取作物配置信息
    if (!cropInfo) {
        Chat.log(`§a未知作物: ${cropName}`);
        return; // 未知作物，不处理
    }
    // 从箱子获取篮子并尝试再次上架
    if (getBasketFromChest(cropInfo.basket, cropInfo.chestPos)) {
        const inventory = Player.openInventory();
        const basketSlots = findItemByName(cropInfo.basket); // 找到背包中的篮子
        if (basketSlots.length > 0) {
            const basketSlotInInventory = basketSlots[0]; // 假设只找到一个篮子，取第一个槽位
            inventory.swap(basketSlotInInventory, 1);
            Client.waitTick(6);
            inventory.quick(0);
            Client.waitTick(14);
            if (auction(cropName, amount)) { // 再次尝试上架
                Chat.log(`§a成功上架 ${amount}个 ${cropName}`);
            } else {
                Chat.log(`§a未能成功上架 ${cropName}`);
            }
        } else {
            Chat.log(`§c在背包中未找到 ${cropInfo.basket}, 无法完成补货.`);
        }
    }
}

/**
 * 处理作物消息队列 - 递归处理队列中的作物售出消息.
 * @private
 */
function processCropMessageQueue() {
    if (cropMessageQueue.length > 0) {
        isProcessing = true; // 标记正在处理
        const cropMessage = cropMessageQueue.shift(); // 取出队列首个消息
        handleCropSold(cropMessage.crop, cropMessage.amount); // 处理作物售出
        Client.waitTick(10); // 等待一段时间再处理下一个
        processCropMessageQueue(); // 递归调用处理下一个消息
    } else {
        isProcessing = false; // 标记处理完成
    }
}

// 监听接收消息事件 - 用于检测出售消息
JsMacros.on('RecvMessage', JavaWrapper.methodToJava(event => {
    if (event.text?.getString().includes("bought your")) { // 检查消息是否包含 "bought your" (出售消息)
        let cropName = "";
        let amount = scriptConfig.defaultSellAmount; // 默认出售数量
        let price = scriptConfig.defaultAuctionPrice; // 默认拍卖价格
        const message = event.text.getString();

        // 从消息中提取出售数量和价格
        const match = message.match(/bought your (\d+)x ([\w\s]+) for (\d+) rubies/);
        if (match) {
            amount = parseInt(match[1], 10); // 解析出售数量
            cropName = match[2].trim();      // 解析作物名称
            price = parseInt(match[3], 10);  // 解析出售价格
        }

        // 更新动态默认价格
        if (defaultAuctionPriceDynamic === null) {
            defaultAuctionPriceDynamic = price;
            Chat.log(`§a首次监听到的价格：${price} rubies，已设置为默认价格`);
        }

        // 识别出售的作物名称
        for (const cropKey in cropData) {
            if (message.includes(cropData[cropKey].name)) {
                cropName = cropData[cropKey].name;
                break; // 找到匹配的作物后跳出循环
            }
        }

        if (cropName) {
            cropMessageQueue.push({ crop: cropName, amount: amount }); // 添加到消息队列
            if (!isJackoMode && !isProcessing) { // 只有在非 Jacko 模式且当前没有处理队列时才开始处理
                processCropMessageQueue(); // 如果当前没有处理队列，则开始处理
            }
        }
    }
}));

/**
    =========== test.js 功能部分 (最终优化版) ==============
 */

// 生成随机整数
function getRandomNumber(min = 60, max = 2666) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}




/**
 * 查找符合条件的槽位 (Jacko 售卖) - 优化版.
 */
function findItemByConditions() {
    const inventory = Player.openInventory();
    const totalSlots = inventory.getTotalSlots();
    const matchedSlots = [];

    // // 存储所有可能的消息
    // const messages = [
    //     "/ad profit crops in my ah",
    //     "/ad cheap 3-star crops in my ah",
    //     "/ad anyone need some crops check my ah"
    // ];

    for (let i = 0; i < totalSlots; i++) {
        const item = inventory.getSlot(i);
        if (item) {
            const itemName = item.getName().getString().replace(/[^a-zA-Z]+/g, '').trim();
            const stackSize = item.getCount();

            // 直接使用 cropDataMap 进行快速查找
            const cropInfo = cropDataMap[itemName];
            if (cropInfo && stackSize === cropInfo.sellForJackoPrice) {
                matchedSlots.push(i);
                Chat.say(`${inventory.getSlot(matchedSlots[0]).getName().getString().replace(/[^a-zA-Z]+/g, '').trim()} day`)
                yanchibuchang = getRandomNumber(60, 1666);
                Client.waitTick(yanchibuchang);

                // // 随机选择一个消息
                // var randomMessage = messages[getRandomNumber(0, messages.length - 1)];
                // // 使用随机选择的消息
                // Chat.say(randomMessage);
            }

            // 检查是否包含 "Golden" 
            if (itemName.includes("Golden")) {
                matchedSlots.push(i);
            }
        }
    }
    return matchedSlots;
}

/**
 * 获取BossBar信息并提取时间 (优化版 - 无需文件IO -  精简输出).
 */
function getBossBarInfo() {
    const bossbarInfo = World.getBossBars();
    let timeString = null;

    if (!bossbarInfo) {
        Chat.log("Bossbar 信息为空，无法读取时间信息。");
        return null;
    }

    let bossbarString;
    if (typeof bossbarInfo === 'string') {
        bossbarString = bossbarInfo; // 如果已经是字符串，直接使用
    } else if (typeof bossbarInfo === 'object') {
        bossbarString = String(bossbarInfo); // 尝试将 object 转换为字符串
        //  移除调试输出： Chat.log(`§eBossbar 信息类型为 Object，尝试转换为字符串: ${bossbarString}`);
    } else {
        Chat.log(`§cBossbar 信息类型未知: ${typeof bossbarInfo}. 无法解析时间.`);
        return null; // 无法处理的类型，返回 null
    }

    // 使用正则表达式搜索时间格式 "HH:MM AM" 或 "HH:MM PM"
    let timeRegex = /(\d{1,2}):(\d{2}) (AM|PM)/i;
    let timeMatch = bossbarString.match(timeRegex);

    if (timeMatch && timeMatch[0]) {
        timeString = timeMatch[0];
        Chat.log("§e当前时间 (Bossbar): " + timeString);
        return {
            raw: timeString,
            hours: parseInt(timeMatch[1], 10),
            minutes: parseInt(timeMatch[2], 10),
            ampm: timeMatch[3].toUpperCase()
        };
    } else {
        Chat.log("在 Bossbar 信息中未找到时间信息。");
        return null;
    }
}


/**
 * 检查背包中每种作物的数量是否大于等于目标数量.
 * @param {number} targetAmount - 每种作物的目标数量.
 * @returns {boolean} - 如果所有作物都满足目标数量，则返回 true，否则返回 false.
 */
function checkCropQuantities(targetAmount) {
    for (const cropKey in cropData) {
        const cropName = cropData[cropKey].name;
        const itemSlots = findItemByName(cropName);
        let totalCropCount = 0;
        for (const slot of itemSlots) {
            totalCropCount += Player.openInventory().getSlot(slot).getCount();
        }
        if (totalCropCount < targetAmount) {
            Chat.log(`§e背包中 ${cropName} 数量不足 (${totalCropCount}/${targetAmount}), 需要补充.`);
            return false; // 至少有一种作物数量不足
        }
    }
    Chat.log(`§a背包中所有作物数量充足，无需补充.`);
    return true; // 所有作物数量都满足要求
}

/**
 * 补充作物篮子并拆分.
 * @returns {boolean} - 成功补充并拆分所有作物篮子返回 true, 否则返回 false.
 */
function replenishCropBaskets() {
    for (const cropKey in cropData) {
        const cropInfo = cropData[cropKey];
        const requiredAmount = 64 * 3; // Jacko 需要的数量
        const cropName = cropInfo.name;

        const itemSlots = findItemByName(cropName);
        let totalCropCount = 0;
        for (const slot of itemSlots) {
            totalCropCount += Player.openInventory().getSlot(slot).getCount();
        }

        if (totalCropCount < requiredAmount) {
            Chat.log(`§e开始补充 ${cropName} 篮子...`);
            if (!getBasketFromChest(cropInfo.basket, cropInfo.chestPos)) {
                Chat.log(`§c获取 ${cropName} 篮子失败，Jacko 售卖流程中断.`);
                return false; // 获取篮子失败，中断流程
            }

            const inventory = Player.openInventory();
            const basketSlots = findItemByName(cropInfo.basket); // 找到背包中的篮子
            if (basketSlots.length > 0) {
                const basketSlotInInventory = basketSlots[0]; // 假设只找到一个篮子，取第一个槽位
                inventory.swap(basketSlotInInventory, 1);
                Client.waitTick(6);
                inventory.quick(0);
                Client.waitTick(14);
                Chat.log(`§a成功补充并拆分 ${cropName} 篮子.`);
            } else {
                Chat.log(`§c在背包中未找到 ${cropInfo.basket}, 无法完成篮子拆分.`);
                return false; // 未找到篮子，拆分失败
            }
        }
    }
    return true; // 所有作物篮子补充完成
}


/**
    ===========封装主要逻辑部分 (Jacko 售卖) (最终优化版) ==============
 */
// 封装传送逻辑
function teleportToBalloon() {
    Chat.say("/balloon yellow-balloon");
    Client.waitTick(134); // 等待传送完成
}

// 封装移动到 Jacko 的逻辑
function moveToJackoFunc(pos1, pos2) {
    moveToBlock(pos1[0], pos1[1], pos1[2], 1);
    Client.waitTick(6);
    moveToBlock(pos2[0], pos2[1], pos2[2], 1);
    Client.waitTick(6);
}

// 封装与 Jacko 交互的逻辑
function interactWithJacko() {
    const jackoEntity = World.getEntities(1.5, "armor_stand")[0];
    if (jackoEntity) {
        Player.getInteractionManager().interactEntity(jackoEntity, false);
        Client.waitTick(14);
        Player.getInteractionManager().interactEntity(jackoEntity, false);
        Client.waitTick(6);
    } else {
        Chat.log("§cJacko NPC 未找到!");
        return false;
    }
    return true;
}

// 封装打开 Jacko UI 并处理槽位逻辑
function processJackoInventory() {
    // 等待容器界面加载
    while (!Hud.isContainer()) {
        Client.waitTick();
    }

    // 打开 Jacko 的库存
    const jackoInv = Player.openInventory();

    // 查找符合条件的槽位
    const itemSlots = findItemByConditions();

    if (itemSlots.length === 0) {
        Chat.log("§aJacko 库存中没有可出售的物品");
        jackoInv.close();
        return false;
    }

    // 遍历找到的槽位并执行 quick() 操作
    for (const slot of itemSlots) {
        jackoInv.quick(slot);
    }
    jackoInv.closeAndDrop();
    Chat.log("§a成功出售 Jacko 库存中的物品");
    return true;
}

// 主函数：整合所有 Jacko 售卖步骤
function sellToJacko(jackoData) {
    try {
        Chat.log("§a开始 Jacko 售卖流程...");
        isJackoMode = true;

        // 0. 检查作物数量并补充篮子
        if (!checkCropQuantities(64 * 3)) {
            if (!replenishCropBaskets()) {
                Client.waitTick(34);
                Chat.say("/realm tp 7OCbefore")
                Client.waitTick(134);
                isJackoMode = false;
                return false;
            }
        }

        // 1. 传送到黄气球
        teleportToBalloon();
        Client.waitTick(4);

        // 2. 走到 Jacko 旁边
        moveToJackoFunc(jackoData.pos1, jackoData.pos2);
        Client.waitTick(4);

        // 3. 右键两次和 Jacko 交互查看今日作物
        if (!interactWithJacko()) {
            Client.waitTick(34);
            Chat.say("/realm tp 7OCbefore")
            Client.waitTick(134);
            isJackoMode = false;
            return false;
        }
        Client.waitTick(4);

        // 4. 处理 Jacko 的库存
        if (!processJackoInventory()) {
            Client.waitTick(34);
            Chat.say("/realm tp 7OCbefore")
            Client.waitTick(134);
            isJackoMode = false;
            return false;
        }
        Client.waitTick(5);

        Chat.log("§aJacko 售卖完成！");
        Client.waitTick(34);
        Chat.say("/realm tp 7OCbefore")
        Client.waitTick(134);
        isJackoMode = false;
        processCropMessageQueue();
        return true;

    } catch (error) {
        Chat.log(`§cJacko 售卖发生错误: ${error.message}`);
        Client.waitTick(34);
        Chat.say("/realm tp 7OCbefore")
        Client.waitTick(134);
        isJackoMode = false;
        processCropMessageQueue();
        return false;
    }
}

/**
    =========== 定时任务 -  动态时间检查 (最终优化版) ==============
 */
let nextCheckTime = 0;
const jackoSellTimeHour = 7; // 7:00 AM
const jackoSellTimeMinute = 0;
let isScheduling = false;
let yanchibuchang = 0;

function jackoSchedule() {
    if (isScheduling) {
        Chat.log(`§7[jackoSchedule] Already scheduling, skipping.`);
        return nextCheckTime;
    }
    isScheduling = true;

    const timeInfo = getBossBarInfo();
    if (!timeInfo) {
        Chat.log(`§c获取 Bossbar 时间信息失败，无法进行 Jacko 调度.`);
        isScheduling = false;
        return nextCheckTime;
    }

    let currentHour = timeInfo.hours;
    let currentMinute = timeInfo.minutes;
    const currentAmPm = timeInfo.ampm;

    // 【调试日志】 输出解析出的时间信息
    // Chat.log(`§7[jackoSchedule] 解析时间: ${currentHour}:${currentMinute} ${currentAmPm}`);

    // 转换为 24 小时制，方便比较
    const currentHour24 = (currentAmPm === "PM" && currentHour !== 12) ? currentHour + 12 : (currentAmPm === "AM" && currentHour === 12) ? 0 : currentHour;
    const currentTimeMinutes = currentHour24 * 60 + currentMinute;
    const jackoSellTimeMinutes = jackoSellTimeHour * 60 + jackoSellTimeMinute;

    // 【调试日志】 输出转换后的分钟数和 Jacko 售卖时间分钟数
    // Chat.log(`§7[jackoSchedule] 当前时间 (分钟): ${currentTimeMinutes}, Jacko 售卖时间 (分钟): ${jackoSellTimeMinutes}`);
    // 【调试日志】 输出 isFirstRun 的值
    // Chat.log(`§7[jackoSchedule] isFirstRun: ${isFirstRun}`);

    let delayMinutes;
    if (currentTimeMinutes >= jackoSellTimeMinutes) {
        // 当前时间已过或等于 Jacko 售卖时间
        delayMinutes = (24 * 60) - currentTimeMinutes + jackoSellTimeMinutes; // 计算到明天 7:00 AM
        Chat.log(`§e当前时间已过 ${jackoSellTimeHour}:00 AM，立即执行 Jacko 售卖并计划下次售卖...`);
        sellToJacko(jackoData); // 首次运行时立即执行 Jacko 售卖
        Client.waitTick(168); // 执行售卖后等待
    } else {
        // 当前时间早于 Jacko 售卖时间
        delayMinutes = jackoSellTimeMinutes - currentTimeMinutes; // 计算到今天 7:00 AM
        const delayHours = Math.floor(delayMinutes / 60);
        const delayMinutePart = delayMinutes % 60;
        Chat.log(`§e将在约 ${delayHours} 小时 ${delayMinutePart} 分钟后 执行 Jacko 售卖...`);
    }

    const delayHoursForNext = Math.floor(delayMinutes / 60);
    nextCheckTime = Math.max(0, delayHoursForNext * 1200 - yanchibuchang - 1600); // 确保 nextCheckTime 不为负数
    const nextCheckDelayHours = Math.floor(nextCheckTime / 1200);
    yanchibuchang = 0; // 重置延迟补偿

    Chat.log(`§aJacko 售卖计划完成, 下次计划售卖时间为约 ${nextCheckDelayHours} 小时(${nextCheckTime}tick)后.`);
    isScheduling = false;
    return nextCheckTime;
}


// 初始执行定时任务
nextCheckTime = jackoSchedule();

// 定时检查和重新调度
JsMacros.on('Tick', JavaWrapper.methodToJava(() => {
    if (World.getTime() % 2134 === 0) { //1200tick,1分钟(留足间隔，不然会出问题）
        nextCheckTime -= 2134; // 减少剩余检查时间
        // Chat.log(`§7剩余检查时间间隔 (ticks): ${nextCheckTime}`);
        if (nextCheckTime <= 0) {
            jackoSchedule(); // 重新调度并获取新的检查间隔
        }
    }
}));
