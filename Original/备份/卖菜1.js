/**
 * @file 自动售货机脚本 - 基于JSMacros模组
 * @description  监听出售消息，自动补货上架指定作物。
 * @version 1.0.0
 * @author [7OCbefore]
 * @date [2025-01-23]
 */
// 脚本启动提示
Chat.log('§a自动售货机已上线');

/**
 * @typedef {object} CropInfo
 * @property {string} name - 作物名称 (用于匹配消息和物品).
 * @property {string} basket - 作物篮子物品名称.
 * @property {number[]} chestPos - 存放篮子的箱子坐标 [x, y, z].
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
};

/**
 * @global {number|null} defaultAuctionPriceDynamic - 动态获取的默认拍卖价格.
 */
let defaultAuctionPriceDynamic = null;

/**
 * @constant {Object<string, CropInfo>} cropData - 作物数据配置.
 * @description  定义不同作物的名称、篮子和箱子位置.
 */
const cropData = {
    "Apple": {
        name: "Apple",
        basket: "AppleBasket",
        chestPos: [204, 56, 394] // 3-star 苹果箱子位置
    },
    "Mango": {
        name: "Mango",
        basket: "MangoBasket",
        chestPos: [204, 56, 391] // 3-star 芒果箱子位置
    },
    "Banana": {
        name: "Banana",
        basket: "BananaBasket",
        chestPos: [204, 56, 388] // 3-star 香蕉箱子位置
    }
};

/**
 * @global {boolean} isProcessing - 标记是否正在处理作物消息队列.
 */
let isProcessing = false;

/**
 * @global {Array<{crop: string, amount: number}>} cropMessageQueue - 存储卖出的作物信息队列.
 */
const cropMessageQueue = [];

// 强制暂停脚本 - 监听按键事件
JsMacros.on("Key", JavaWrapper.methodToJava((event, context) => {
    if (event.key === scriptConfig.closeKey) {
        Chat.log('§a自动售货机已下线');
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
    const price = defaultAuctionPriceDynamic;

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
                // 上架物品
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
 */
function moveToBlock(x, y, z) {
    const player = Player.getPlayer();
    const targetX = x + 0.5; // 方块中心 X
    const targetY = y + 0.5; // 方块中心 Y
    const targetZ = z + 0.5; // 方块中心 Z
    player.lookAt(targetX, targetY, targetZ); // 朝向目标方块
    while (player.distanceTo(targetX, targetY, targetZ) > 5) { // 距离大于5时持续移动
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
            chestInventory.swapHotbar(slot, chestInventory.getSelectedHotbarSlotIndex()); // 切换到主手
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
        inventory.swapHotbar(1, inventory.getSelectedHotbarSlotIndex()); // 切换到快捷栏第二个槽位 (假设篮子放在第二个槽位)
        Client.waitTick(6);
        inventory.quick(0); // 快速移动篮子到背包 (假设背包第一个空位是种植槽位)
        Client.waitTick(14);
        if (auction(cropName, amount)) { // 再次尝试上架
            Chat.log(`§a成功上架 ${amount}个 ${cropName}`);
        } else {
            Chat.log(`§a未能成功上架 ${cropName}`);
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
            if (!isProcessing) {
                processCropMessageQueue(); // 如果当前没有处理队列，则开始处理
            }
        }
    }
}));