# 作物自动售货机（架构重构版）

## 目标与原则
该脚本面向新手脚本的可维护性问题，按“高内聚、低耦合、可恢复”的思路重构。核心目标是：配置驱动、流程可中断、异常可回退，并保持自动上架与 Jacko 售卖互不干扰。

## 结构与职责
- `VendingApplication`：入口与事件装配，负责配置加载、事件注册、队列驱动。
- `VendingInventoryOps`（`Original/planting/services/VendingInventoryOps.js`）：物品查找、堆叠拆分、数量统计。
- `VendingMovementOps`（`Original/planting/services/VendingMovementOps.js`）：移动逻辑与超时保护。
- `VendingBasketService`（`Original/planting/services/VendingBasketService.js`）：箱子取篮子与篮子拆分流程。
- `VendingAuctionService`（`Original/planting/services/VendingAuctionService.js`）：自动上架逻辑（含动态价格）。
- `VendingJackoService`（`Original/planting/services/VendingJackoService.js`）：传送、移动、交互、筛选出售、补货流程。
- `VendingScheduler`（`Original/planting/services/VendingScheduler.js`）：Bossbar 时间解析与定时触发。

## 配置说明
配置文件位于 `Original/config/vendingConfig.json`，必须包含：
- `scriptConfig`: `closeKey`、`defaultSellAmount`、`defaultAuctionPrice`、`safeMode`。
- `jackoData`: `pos1`、`pos2`、`sellTime`（hour/minute）。
- `cropData`: 作物名、篮子名、箱子坐标、Jacko 售卖条件。

可选字段（未配置则使用默认值）：
- `jackoData.messages`: 广告语列表。
- `jackoData.interactPos`: Jacko 交互方块坐标（[x,y,z]），默认沿用 `pos2`。
- `jackoData.teleportCommand` / `jackoData.returnCommand`：传送与返回指令。
- `timings` / `thresholds`: 延迟与距离阈值调优。

## 安全模式（dryRun/safeMode）
- 将 `scriptConfig.safeMode`（或别名 `scriptConfig.dryRun`）设为 `true`，脚本只打印日志，不移动、不交互、不执行聊天指令。
- 安全模式仍会解析消息并驱动流程，便于验证逻辑分支与调度。

## 运行流程（简述）
1. 监听聊天中的 “bought your …” 消息，进入售出队列。
2. 队列按顺序补货/上架，失败时优先从箱子取篮子再重试。
3. 定时任务按 Bossbar 时间触发 Jacko 售卖，完成后继续处理队列。

## 验证建议
- 先在安全世界验证：上架流程、篮子补货、Jacko 交互三条链路。
- 出现卡住时检查坐标是否正确、Bossbar 是否有时间字符串。

## 回归检查清单
1. 启动脚本后确认日志显示启动信息与按键提示。
2. 开启 `safeMode` 运行一轮，确认仅输出日志且无任何交互动作。
3. 模拟一次售出消息，确认队列进入并触发上架逻辑。
4. 清空指定作物后触发补货，确认能从箱子取篮子并再上架。
5. 调整 Bossbar 时间至触发点，确认 Jacko 流程可执行并返回。
