/*
 * 种植脚本 - 模块化重构版
 * 功能：自动耕地、施肥、种植
 * 依赖：./common/farmingUtils.js, ./config/plantingConfig.json
 */

// --- 导入模块 ---
const Utils = require('./common/farmingUtils.js');

// --- 尝试加载配置 ---
let ConfigData = Utils.loadConfig('./config/plantingConfig.json');

// 如果加载失败，使用默认回退配置
if (!ConfigData) {
    Chat.log("§c[Init] 无法加载配置文件，使用默认设置。");
    ConfigData = {
        defaultStartPos: [0, 0, 0], // 需要用户手动设置
        chests: {
            soil: { pos: [0,0,0], dumpPos: [0,0,0] },
            fertilizer: { pos: [0,0,0], dumpPos: [0,0,0] },
            seeds: { pos: [0,0,0], dumpPos: [0,0,0] }
        },
        items: {
            soil: "minecraft:paper",
            fertilizer: "minecraft:paper",
            seeds: "minecraft:paper"
        }
    };
}

// --- 初始化状态 ---
const state = new Utils.FarmingState();
Utils.setupPauseControl(state);

// 脚本内部状态机
const ScriptMode = {
    IDLE: "IDLE",
    SET_CHEST: "SET_CHEST",
    SET_START: "SET_START",
    WORKING: "WORKING"
};

let currentMode = ScriptMode.IDLE;
// 运行时动态坐标 (如果用户点击设置了，优先用这个，否则用 ConfigData)
let dynamicPositions = {
    seedChest: null,
    startPos: null
};

// --- 渲染与提示 ---
Hud.clearDraw3Ds();

// 启动提示
Chat.log("§a=== 种植助手已启动 ===");
Chat.log("§7按 [Click Left] 设置坐标 (如果是首次)");
Chat.log("§7按 [1] 铺土 | [2] 施肥 | [3] 播种");
Chat.log("§7按 [Z] 暂停 | [X] 退出");

// --- 核心事件监听 ---
JsMacros.on("Key", JavaWrapper.methodToJava((event, ctx) => {
    // 仅处理按键按下
    if (event.action !== 1) return;

    // 防止在打字时触发
    if (Hud.isOpen()) return;

    const keyName = event.key;

    // 1. 坐标设置逻辑 (左键点击)
    if (keyName == "key.mouse.left") {
        if (currentMode === ScriptMode.IDLE) {
            // 允许用户通过点击开始设置流程 (可选，或者通过命令触发)
            // 这里为了兼容旧习惯：如果未设置过，或者用户想重设，怎么触发？
            // 让我们保持简单：如果用户手持“木棍”点击，则进入设置模式？或者直接响应点击？
            // 为了防止误触，我们只在脚本刚启动且没有坐标时，或者特定状态下响应。
            // 现改为：按住 Shift 点击左键开始重设坐标
            if (Client.getMinecraft().options.keyShift.isPressed()) {
                currentMode = ScriptMode.SET_CHEST;
                Chat.log("§e[Setup] 进入设置模式。请点击【种子箱子】...");
                event.cancel(); // 阻止原本的攻击/破坏
                return;
            }
        }

        if (currentMode === ScriptMode.SET_CHEST) {
            const target = Player.getInteractionManager().getTargetedBlock();
            if (target) {
                const pos = target.toPos3D();
                dynamicPositions.seedChest = [pos.x, pos.y, pos.z];
                Chat.log(`§a[Setup] 种子箱子已设定: ${pos.x}, ${pos.y}, ${pos.z}`);
                Chat.log("§e[Setup] 请点击【起始位置】...");
                currentMode = ScriptMode.SET_START;
                event.cancel();
            }
        } else if (currentMode === ScriptMode.SET_START) {
            const target = Player.getInteractionManager().getTargetedBlock();
            if (target) {
                const pos = target.toPos3D();
                dynamicPositions.startPos = [pos.x, pos.y, pos.z];
                Chat.log(`§a[Setup] 起始位置已设定: ${pos.x}, ${pos.y}, ${pos.z}`);
                Chat.log("§a[Setup] 设置完成！现在可以使用 1/2/3 功能键。");
                currentMode = ScriptMode.IDLE;
                event.cancel();
            }
        }
        return;
    }

    // 2. 功能键逻辑 (1, 2, 3)
    if (currentMode === ScriptMode.IDLE && !state.isActionRunning) {
        if (keyName == "key.keyboard.1") {
            runTask("Soil", ConfigData.chests.soil.pos, ConfigData.chests.soil.dumpPos, ConfigData.items.soil, "铺土");
        } else if (keyName == "key.keyboard.2") {
            runTask("Fertilizer", ConfigData.chests.fertilizer.pos, ConfigData.chests.fertilizer.dumpPos, ConfigData.items.fertilizer, "施肥");
        } else if (keyName == "key.keyboard.3") {
            // 播种特殊：如果手动设置了箱子，用手动的，否则用配置的
            const chestPos = dynamicPositions.seedChest || ConfigData.chests.seeds.pos;
            // 如果是动态设置的箱子，清空位置简单推算一下（例如上方）或者也需要配置。这里为了兼容旧逻辑：
            const dumpPos = dynamicPositions.seedChest ? 
                            [chestPos[0], chestPos[1] + 2, chestPos[2] + 1] : 
                            ConfigData.chests.seeds.dumpPos;
            
            runTask("Seeds", chestPos, dumpPos, ConfigData.items.seeds, "播种");
        }
    } else if (state.isActionRunning) {
        if (["key.keyboard.1", "key.keyboard.2", "key.keyboard.3"].includes(keyName)) {
            Chat.log("§c[Warn] 任务进行中，请等待完成或按 Z 暂停/ X 停止。");
        }
    }
}));

// --- 任务执行封装 ---
function runTask(taskType, chestPos, dumpPos, itemId, logName) {
    // 检查起始位置
    const start = dynamicPositions.startPos || ConfigData.defaultStartPos;
    // 如果配置也是 0,0,0 说明未配置
    if (start[0] === 0 && start[1] === 0) {
        Chat.log("§c[Error] 未设置起始位置！请按住 Shift + 左键点击方块进行设置。");
        return;
    }

    state.setRunning(true, logName);
    Chat.log(`§a[Task] 开始任务: ${logName}`);

    // 在新线程运行，避免阻塞事件监听
    // JSMacros 事件回调是同步的，耗时操作必须开线程
    // JavaWrapper.methodToJava 包装的回调通常在主线程或事件线程，不能长时间阻塞？
    // JSMacros 脚本通常在自己的线程运行，但是 `on` 回调会阻塞后续事件吗？
    // 最佳实践是把耗时逻辑放进新的 execution context 或者 simply call async function if supported.
    // 但 JSMacros API 的 Client.waitTick 必须在脚本线程调用。
    // 当前结构是：主脚本执行完就结束了，全靠监听器。监听器触发时是单独的线程吗？
    // 通常 `JsMacros.on` 的回调是在事件触发线程执行的。如果在这里 waitTick，会卡住游戏事件处理？
    // 不，JSMacros 的监听器回调通常允许执行脚本逻辑。
    // 但是为了保险，我们可以用 `check` 循环或者 `Time.sleep` (Java) 但 waitTick 是最安全的。
    // 我们直接执行，因为之前的脚本也是这样做的。
    
    new Thread(() => {
        try {
            const end = ConfigData.defaultEndPos; // 硬编码的结束点，也可配置化

            // 执行蛇形走位
            Utils.snakeWalk(start, end, chestPos, itemId, (x, y, z) => {
                // 具体的动作回调
                Player.getInteractionManager().interactBlock(x, y, z, 1, false);
            }, state);

            // 任务结束，清空背包
            if (state.isActionRunning) { // 如果是被强制停止的就不清空了
                Utils.transferItemsToChest(dumpPos, [itemId]);
                Utils.eat();
            }
            
            Chat.log(`§a[Task] ${logName} 完成！`);
        } catch (e) {
            Chat.log(`§c[Error] 任务执行出错: ${e}`);
            e.printStackTrace && e.printStackTrace();
        } finally {
            state.setRunning(false);
            currentMode = ScriptMode.IDLE;
        }
    }).start();
}