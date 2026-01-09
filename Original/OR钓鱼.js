/**
 * OR钓鱼.js (功能增强稳定版)
 * * 修正了核心钓鱼循环与物品存放逻辑的冲突问题。
 * * 新增稳定性检查，当检测到浮漂未正常抛出时，会自动尝试重新抛竿。
 * 1. 启动时通过左键点击选择一个容器(如木桶)来存放渔获。
 * 2. 成功钓上鱼后(通过成功音效判断)，会自动执行完整的“收鱼-转身-存物-转身-抛竿”流程。
 * 3. 核心钓鱼循环(while)负责处理钓鱼小游戏交互，并守护钓鱼状态。
 */

// --- 工具函数 ---
const mclog = (prefix, msg, prefixColor = 0x6, msgColor = 0xe) => {
    Chat.log(Chat.createTextBuilder()
        .append("[").withColor(prefixColor)
        .append(prefix).withColor(prefixColor)
        .append("]").withColor(prefixColor)
        .append(" " + msg).withColor(msgColor)
        .build());
};
const Point3D = (x, y, z) => ({ x, y, z });

// --- 脚本配置 ---
const SCRIPT_NAME = '自动钓鱼Plus';
const EVENT_NAME = 'AutoFishEvent';
const FISH_SUCCESS_SOUND = 'minecraft:custom.item.fishing_rod.success';
const STRUGGLE_CHAR = '';
const END_STRUGGLE_CHAR = '';
const RECAST_COOLDOWN = 3000; // (新增) 自动重新抛竿的冷却时间(毫秒)

// --- 脚本状态 ---
let isFishing = false;
let canRightClick = true;
let isDepositing = false; // 状态锁，为true时表示正在存东西，暂停钓鱼小游戏交互
let barrel_pos = null;
let fishingYaw = 0;
let fishingPitch = 0;
let lastRecastAttempt = 0; // (新增) 上次尝试重抛的时间戳

// --- 事件与监听器管理 ---
const AutoFishEvent = JsMacros.createCustomEvent(EVENT_NAME);
AutoFishEvent.registerEvent();
const profile = JsMacros.getProfile();
const listeners = profile.getRegistry().getListeners(EVENT_NAME);

// --- 主要功能函数 ---

function startFishing() {
    isFishing = true;
    mclog(SCRIPT_NAME, '自动钓鱼已开启', 0x6, 0xa);
    Time.sleep(200);
    Player.getPlayer().interact(); // 首次抛竿
    lastRecastAttempt = Date.now(); // 记录首次抛竿时间

    const soundHandle = JsMacros.on('Sound', JavaWrapper.methodToJava((e) => {
        const player = Player.getPlayer();
        // 当听到成功音效，并且当前不处于存放物品的状态时，执行存物流程
        if (e.sound === FISH_SUCCESS_SOUND && !isDepositing) {
            isDepositing = true; // 上锁，暂停主循环的interact
            mclog(SCRIPT_NAME, '肥肥得吃！', 0x6, 0xb);
            
            // 成功的音效意味着物品已经上钩并飞向玩家，无需再次收竿
            // 等待1秒确保物品进入背包
            Time.sleep(1000); 

            // --- 存放物品流程 (简化版，适用于Fish Barrel) ---
            mclog(SCRIPT_NAME, '正在与Fish Barrel交互存放渔获...', 0x6, 0xb);
            player.lookAt(barrel_pos.x + 0.5, barrel_pos.y + 0.5, barrel_pos.z + 0.5);
            Time.sleep(500); // 短暂延迟以确保玩家已转向
            player.interact(); // 直接与Fish Barrel交互来存放物品
            Time.sleep(500); // 等待交互完成
            
            // 4. 恢复视角并再次抛竿
            player.lookAt(fishingYaw, fishingPitch);
            Time.sleep(1000);
            player.interact();
            lastRecastAttempt = Date.now(); // 记录本次抛竿时间
            mclog(SCRIPT_NAME, '已自动抛竿，继续钓鱼...', 0x6, 0xa);
            
            isDepositing = false; // 解锁，让主循环恢复工作
        }
    }));

    const titleHandle = JsMacros.on('Title', JavaWrapper.methodToJava((e) => {
        if (e.type === 'ACTIONBAR') {
            const actionbarText = e.message.getString();
            if (actionbarText.includes(END_STRUGGLE_CHAR) && !canRightClick) {
                mclog(SCRIPT_NAME, '鱼儿累了，快收竿！', 0x6, 0xe);
                canRightClick = true;
            }
            if (actionbarText.includes(STRUGGLE_CHAR) && canRightClick) {
                mclog(SCRIPT_NAME, '线要断了，快松手！', 0x6, 0xc);
                canRightClick = false;
            }
        }
    }));

    JsMacros.once(EVENT_NAME, JavaWrapper.methodToJava(() => {
        isFishing = false;
        JsMacros.off(soundHandle);
        JsMacros.off(titleHandle);
        mclog(SCRIPT_NAME, '已移除所有监听器', 0x6, 0x7);
    }));

    const player = Player.getPlayer();
    
    // ==================== 修改后的钓鱼主循环 ====================
    while (isFishing) {
        // 如果正在存东西，则跳过所有判断，等待存放流程结束
        if (isDepositing) {
            Time.sleep(100);
            continue;
        }

        const bobber = player.getFishingBobber();
        
        if (bobber) {
            // --- 情况一：浮漂存在，执行正常的钓鱼小游戏交互 ---
            if (canRightClick && bobber.hasCaughtFish()) {
                player.interact();
            }
        } else {
            // --- 情况二：浮漂不存在，说明卡住了，需要重新抛竿 ---
            const now = Date.now();
            if (now - lastRecastAttempt > RECAST_COOLDOWN) {
                mclog(SCRIPT_NAME, '检测到浮漂未抛出，尝试自动重新抛竿...', 0x6, 0xd);
                player.lookAt(fishingYaw, fishingPitch); // 确保朝向正确
                Time.sleep(100);
                player.interact();
                lastRecastAttempt = now; // 更新尝试时间
            }
        }
        
        Time.sleep(100); // 降低循环频率，减少性能占用
    }
}

// --- 脚本主入口 ---
if (listeners.size() > 0) {
    AutoFishEvent.trigger();
    mclog(SCRIPT_NAME, '自动钓鱼已关闭', 0x6, 0xc);
} else {
    mclog(SCRIPT_NAME, '请左键点击一个方块作为存放渔获的容器。', 0x6, 0xb);
    
    const clickListener = JsMacros.on('Key', true, JavaWrapper.methodToJava((event, ctx) => {
        if (event.key === "key.mouse.left" && event.action === 1) {
            event.cancel();
            ctx.releaseLock();
            
            const targetedBlock = Player.getInteractionManager().getTargetedBlock();
            if (targetedBlock) {
                const blockPos = targetedBlock.toPos3D();
                barrel_pos = Point3D(blockPos.x, blockPos.y, blockPos.z);
                
                mclog(SCRIPT_NAME, `容器位置已记录: (${blockPos.x}, ${blockPos.y}, ${blockPos.z})`, 0x6, 0xa);
                clickListener.off();

                mclog(SCRIPT_NAME, '请保持朝向钓鱼方向，脚本将在4秒后开始...', 0x6, 0xb);
                Time.sleep(4000);
                
                const player = Player.getPlayer();
                fishingYaw = player.getYaw();
                fishingPitch = player.getPitch();
                mclog(SCRIPT_NAME, `钓鱼方向已记录 (Yaw: ${fishingYaw.toFixed(1)}, Pitch: ${fishingPitch.toFixed(1)})`, 0x6, 0xa);

                startFishing();
            } else {
                mclog(SCRIPT_NAME, '未检测到方块，请重试。', 0x6, 0xc);
            }
        }
    }));
}
