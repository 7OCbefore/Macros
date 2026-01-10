/**
 * @file test.js
 * @description Jacko容器测试脚本 - 输出容器内所有物品信息
 * @purpose 用于调试"从Jacko容器中检测收购作物类型"功能
 */

// --- 配置区 ---
const CLOSE_KEY = "key.keyboard.x";

// 从全局配置读取jackoData（复用售货机脚本的配置）
const ConfigLoader = require('./core/ConfigLoader.js');

/**
 * 读取jacko配置
 */
function getJackoConfig() {
    const rawConfig = ConfigLoader.load('config/vendingConfig.json');
    if (!rawConfig || !rawConfig.jackoData) {
        Chat.log('[Error] jackoData not found in config');
        return null;
    }
    return rawConfig.jackoData;
}

/**
 * 标准化物品名称
 */
function normalizeName(name) {
    return name.replace(/[^a-zA-Z0-9]/g, '').trim();
}

/**
 * 输出容器内容到聊天框
 */
function dumpContainerContent(inventory, containerName) {
    const totalSlots = inventory.getTotalSlots();
    Chat.log(`§a=== ${containerName} Content (${totalSlots} slots) ===`);

    let itemCount = 0;
    for (let i = 0; i < totalSlots; i++) {
        const item = inventory.getSlot(i);
        if (item && !item.isEmpty() && typeof item.getName === 'function') {
            const rawName = item.getName().getString();
            const name = normalizeName(rawName);
            const count = item.getCount();
            const itemId = typeof item.getItemId === 'function' ? item.getItemId() : 'unknown';

            Chat.log(`§e[Slot ${i}] §f${name} §7x${count} §8(ID: ${itemId})`);
            itemCount++;
        }
    }

    if (itemCount === 0) {
        Chat.log(`§7${containerName} is empty.`);
    } else {
        Chat.log(`§aTotal items: ${itemCount}`);
    }
    Chat.log(`§a=== End of ${containerName} ===`);
}

// --- 主程序 ---

Chat.log('§b=== Jacko容器测试脚本 ===');
Chat.log('§e按 X 停止脚本');

// 读取配置
const jackoData = getJackoConfig();
if (!jackoData || !jackoData.interactPos) {
    Chat.log('§c[Failed] jackoData.interactPos not found in config');
    JavaWrapper.stop();
    throw new Error('Jacko config missing');
}

// 注册关闭脚本的按键事件
JsMacros.on("Key", JavaWrapper.methodToJava((event) => {
    if (event.key === CLOSE_KEY) {
        Chat.log('§a测试脚本已停止');
        JavaWrapper.stop();
    }
}));

// 移动到Jacko位置
const interactPos = jackoData.interactPos;
Chat.log(`§e移动到 Jacko 交互点: [${interactPos.join(', ')}]`);

const player = Player.getPlayer();
const targetX = interactPos[0] + 0.5;
const targetY = interactPos[1] + 0.5;
const targetZ = interactPos[2] + 0.5;

player.lookAt(targetX, targetY, targetZ);

// 移动直到接近目标
while (player.distanceTo(targetX, targetY, targetZ) > 1.5) {
    player.lookAt(targetX, targetY, targetZ);
    KeyBind.keyBind("key.forward", true);
    KeyBind.keyBind("key.sprint", true);
    Client.waitTick(1);
}
KeyBind.keyBind("key.forward", false);
KeyBind.keyBind("key.sprint", false);

Chat.log('§a到达Jacko位置，开始交互...');

// 第一次交互
Player.getInteractionManager().interact();
Client.waitTick(14);

// 第二次交互
player.lookAt(targetX, targetY, targetZ);
Player.getInteractionManager().interact();
Client.waitTick(6);

// 等待容器打开
Chat.log('§e等待容器打开...');
let waitTicks = 0;
const maxWait = 100;
while (!Hud.isContainer() && waitTicks < maxWait) {
    Client.waitTick(1);
    waitTicks++;
}

if (!Hud.isContainer()) {
    Chat.log('§c[Failed] 容器未打开');
} else {
    Chat.log('§a容器已打开');

    const jackoInv = Player.openInventory();
    const containerTitle = jackoInv.getContainerTitle();
    Chat.log(`§b容器标题: ${containerTitle}`);

    // 输出容器内容
    dumpContainerContent(jackoInv, 'Jacko Inventory');

    // 额外输出：按堆叠数量分组显示（用于识别收购作物）
    Chat.log('§b=== 按堆叠数量分组 ===');
    const stackGroups = {};
    for (let i = 0; i < jackoInv.getTotalSlots(); i++) {
        const item = jackoInv.getSlot(i);
        if (item && !item.isEmpty() && typeof item.getCount === 'function') {
            const count = item.getCount();
            const name = normalizeName(item.getName().getString());
            if (!stackGroups[count]) {
                stackGroups[count] = [];
            }
            stackGroups[count].push({ slot: i, name: name });
        }
    }

    // 按堆叠数量排序输出
    const sortedCounts = Object.keys(stackGroups).map(Number).sort((a, b) => b - a);
    for (const count of sortedCounts) {
        const items = stackGroups[count];
        const names = items.map(i => `${i.name}@${i.slot}`).join(', ');
        Chat.log(`§6[${count}x] §f${names}`);
    }

    Chat.log('§a=== 测试完成 ===');
    Chat.log('§7提示：收购作物的识别逻辑是检查物品堆叠数量是否等于 sellForJackoPrice (当前为17)');

    // 不自动关闭，让玩家可以手动查看
    Chat.log('§e按 X 停止脚本');
}
