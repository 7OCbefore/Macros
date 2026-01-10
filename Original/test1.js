/**
 * 定点容器读取脚本 (Direct Command & Targeted Slots)
 * * 功能：
 * 1. 直接通过指令打开内层容器。
 * 2. 智能等待：专门监控目标槽位 (20-24, 29-33) 的稳定性。
 * 3. 过滤干扰：忽略边框和其他无关槽位的动态变化。
 */

// --- 配置区 ---
const CMD = "/ah player 7OCbefore"; 
// 目标槽位：第一行 20-24，第二行 29-33
const TARGET_SLOTS = [20, 21, 22, 23, 24, 29, 30, 31, 32, 33];
const STABLE_TICKS_REQUIRED = 20; // 需要连续稳定 1 秒 (20 ticks)
const MAX_WAIT_TICKS = 100;       // 最大等待 5 秒

// --- 工具函数 ---

/**
 * 只获取目标槽位的快照
 * 返回格式：["ID:Count", "ID:Count", ...]
 */
function getTargetSlotsSnapshot(inv) {
    let snapshot = [];
    if (!inv) return snapshot;
    
    for (let slot of TARGET_SLOTS) {
        let item = inv.getSlot(slot);
        if (item && !item.isEmpty()) {
            // 记录 物品ID + 数量 (作为指纹)
            snapshot.push(`${item.getItemId()}:${item.getCount()}`);
        } else {
            snapshot.push("AIR");
        }
    }
    return snapshot;
}

/**
 * 比较两个快照是否完全一致
 */
function isSnapshotStable(snap1, snap2) {
    if (snap1.length !== snap2.length) return false;
    for (let i = 0; i < snap1.length; i++) {
        if (snap1[i] !== snap2[i]) return false;
    }
    return true;
}

// --- 主程序 ---

Chat.log("§b=== 启动定点读取脚本 ===");
Chat.log(`§e目标槽位: [${TARGET_SLOTS.join(", ")}]`);

// 1. 发送指令
Chat.say(CMD);

// 2. 等待容器打开
let wait = 0;
while (!Hud.isContainer() && wait < 40) {
    Client.waitTick(1);
    wait++;
}

if (!Hud.isContainer()) {
    Chat.log("§c错误：容器未打开。");
} else {
    Chat.log("§a容器已打开，开始监控目标区域...");

    let stableCount = 0;
    let lastSnap = [];
    let isSuccess = false;
    let finalInv = null;

    // 3. 循环监控稳定性
    for (let t = 0; t < MAX_WAIT_TICKS; t++) {
        Client.waitTick(1);
        
        let currentInv = Player.openInventory();
        let currentSnap = getTargetSlotsSnapshot(currentInv);
        
        // 检查是否全空 (防止刚打开瞬间还没数据)
        // 这里的逻辑是：如果所有目标槽位都是 AIR，我们认为它可能还没加载出来，
        // 除非它真的就是空的。为了保险，我们只在非全空状态下才开始累积稳定性，
        // 或者如果它稳定了足够久的全空状态，也算成功。
        let isAllAir = currentSnap.every(s => s === "AIR");
        
        if (lastSnap.length > 0 && isSnapshotStable(lastSnap, currentSnap)) {
            stableCount++;
        } else {
            stableCount = 0; // 发生变化，重置计数
        }
        
        lastSnap = currentSnap;

        // 调试日志 (可选)
        // if (t % 10 === 0) Chat.log(`Tick ${t}: Stable=${stableCount}, AllAir=${isAllAir}`);

        // 判定加载完成条件：
        // 1. 连续稳定了 N tick
        // 2. 且不能是刚打开那一瞬间的空状态 (除非稳定了很久确实没东西)
        if (stableCount >= STABLE_TICKS_REQUIRED) {
            Chat.log(`§a数据加载完成！(稳定耗时: ${stableCount} ticks)`);
            isSuccess = true;
            finalInv = currentInv;
            break;
        }
    }

    // 4. 输出结果
    if (isSuccess && finalInv) {
        Chat.log(`§e=== 容器内容 (${finalInv.getContainerTitle()}) ===`);
        
        let hasItem = false;
        for (let slot of TARGET_SLOTS) {
            let item = finalInv.getSlot(slot);
            if (item && !item.isEmpty()) {
                let name = item.getName().getString();
                let count = item.getCount();
                // 可以在这里添加更多 NBT 信息的获取，如果需要
                Chat.log(`§f[${slot}] §a${name} §7x${count}`);
                hasItem = true;
            } else {
                // 如果需要显示空槽位，取消下面注释
                // Chat.log(`§8[${slot}] <空>`);
            }
        }
        
        if (!hasItem) {
            Chat.log("§7目标区域 (20-24, 29-33) 未检测到任何物品。");
        }
        
    } else {
        Chat.log("§c警告：读取超时。可能是网络太卡或目标区域持续变化。");
        Chat.log("最后一次快照状态: " + lastSnap.join(", "));
    }
}