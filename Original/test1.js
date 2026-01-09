// 单元测试：测试与方块交互（模拟右键点击）
Chat.log("=== 测试与方块交互（模拟右键） ===");

// Jacko 的方块坐标
const jackoPos = { x: -57, y: 71, z: -115 };

// 获取玩家位置
const player = Player.getPlayer();
Chat.log("玩家位置: " + player.getBlockPos().toString());

// 使用 KeyBind 模拟右键点击
Chat.log("执行右键点击...");

// 右键点击
KeyBind.fromString("key.keyboard.right").onTick();

Chat.log("右键点击已执行");

// 等待查看结果
Client.waitTick(20);
Chat.log("等待完成");
