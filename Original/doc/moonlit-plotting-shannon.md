# 作物自动售货机脚本重构计划

## 高级工程师的实战思路

对于游戏脚本，高级工程师不会追求"企业级架构"，而是会问：

```
"这个脚本要解决什么问题？" → 自动拍卖作物 + 定时 Jacko 售卖
"哪些是真正痛点？"         → 魔法数字多、状态混乱、难以调试
"重构投入产出比？"         → 改完能跑，下次改起来快
```

**最终方案：保持单文件，渐进式重构**

---

## 一、识别的问题

### 1.1 必须解决的问题 (P0)

| 问题 | 位置 | 影响 |
|------|------|------|
| 魔法数字泛滥 | `64`, `1200`, `134`, `2134` 等 | 改一个值要找半天 |
| 递归风险 | `processCropMessageQueue()` | 队列长可能栈溢出 |
| 状态标志过多 | `isProcessing`, `isJackoMode`, `isScheduling` | 状态不可预测 |
| 代码重复 | 多处 `findItemByName` + 计数逻辑 | 改一处漏一处 |

### 1.2 建议解决的问题 (P1)

| 问题 | 位置 | 影响 |
|------|------|------|
| 硬编码配置 | `jackoSellTimeHour = 7` | 改时间要改代码 |
| 错误处理缺失 | 大部分函数无错误处理 | 出问题不知道哪里错 |
| 日志混乱 | 所有 `Chat.log` 都一样 | 调试时难以筛选 |

---

## 二、重构计划

### 阶段 1: 配置集中管理 (P0)

**目标**: 所有可能修改的值放在一起

```javascript
// ==================== 配置区 ====================
const CONFIG = {
  // 脚本控制
  closeKey: "key.keyboard.x",

  // 拍卖默认
  defaultSellAmount: 64,
  defaultAuctionPrice: 800,

  // Jacko 定时 (24小时制)
  jackoSellHour: 7,
  jackoSellMinute: 0,

  // 时序控制 (tick)
  tickInterval: 2134,
  teleportWaitTicks: 134,
  moveWaitTicks: 6,

  // 堆叠大小
  fullStack: 64,
  jackoRequiredStack: 192, // 64 * 3
};

// 作物配置
const CROPS = {
  Apple:   { name: "Apple",   basket: "AppleBasket", chestPos: [204, 56, 394], jackoPrice: 17 },
  Mango:   { name: "Mango",   basket: "MangoBasket", chestPos: [204, 56, 391], jackoPrice: 17 },
  Banana:  { name: "Banana",  basket: "BananaBasket", chestPos: [204, 56, 388], jackoPrice: 17 },
};

// Jacko 位置
const JACKO_POS = {
  teleport: [-54, 70, -119],
  interact1: [-57, 70, -115],
  lookAt: [-57, 71, -115],
};

// 预生成 Map 供快速查找
const CROP_MAP = Object.values(CROPS);
// ==================== 配置区结束 ====================
```

**改动点**:
- 文件顶部集中放置所有配置
- 使用 `Object.freeze()` 防止意外修改

---

### 阶段 2: 消除递归 (P0)

**目标**: 递归改迭代，避免栈溢出

```javascript
// 之前 (递归，有栈溢出风险)
function processCropMessageQueue() {
  if (cropMessageQueue.length > 0) {
    const msg = cropMessageQueue.shift();
    handleCropSold(msg.crop, msg.amount);
    Client.waitTick(10);
    processCropMessageQueue(); // 递归调用
  }
}

// 之后 (迭代，安全)
function processCropMessageQueue() {
  if (isProcessing || cropMessageQueue.length === 0) return;

  isProcessing = true;
  const processor = () => {
    if (cropMessageQueue.length === 0) {
      isProcessing = false;
      return;
    }
    const msg = cropMessageQueue.shift();
    handleCropSold(msg.crop, msg.amount);
    Client.waitTick(10);
    processor(); // 迭代调用
  };
  processor();
}
```

---

### 阶段 3: 状态机重构 (P0)

**目标**: 用状态机替代散落的布尔标志

```javascript
// 状态定义
const STATE = {
  IDLE: 'idle',
  PROCESSING: 'processing',
  JACKO_MODE: 'jacko_mode',
  SCHEDULING: 'scheduling',
};

// 状态管理
let currentState = STATE.IDLE;

function setState(newState) {
  const prev = currentState;
  currentState = newState;
  logStateChange(prev, newState);
}

function isIdle() {
  return currentState === STATE.IDLE;
}

// 使用示例
if (isIdle() && !isJackoMode) {
  setState(STATE.PROCESSING);
  processCropMessageQueue();
}
```

---

### 阶段 4: 消除代码重复 (P1)

**目标**: 提取公共函数

```javascript
// ==================== 通用工具函数 ====================

/**
 * 查找物品槽位
 */
function findItem(itemName) {
  const inv = Player.openInventory();
  const slots = [];
  for (let i = 0; i < inv.getTotalSlots(); i++) {
    const item = inv.getSlot(i);
    if (item && item.getName().getString().replace(/[^a-zA-Z]+/g, '').trim() === itemName) {
      slots.push(i);
    }
  }
  return slots;
}

/**
 * 计算背包中指定物品总数
 */
function countItem(itemName) {
  const slots = findItem(itemName);
  const inv = Player.openInventory();
  return slots.reduce((sum, slot) => sum + inv.getSlot(slot).getCount(), 0);
}

/**
 * 检查背包中物品是否充足
 */
function hasEnough(itemName, amount) {
  return countItem(itemName) >= amount;
}

/**
 * 等待直到容器打开
 */
function waitForContainer() {
  let attempts = 0;
  while (!Hud.isContainer() && attempts < 100) {
    Client.waitTick();
    attempts++;
  }
  return Hud.isContainer();
}
// ==================== 工具函数结束 ====================
```

---

### 阶段 5: 错误处理 (P1)

**目标**: 关键操作加错误处理

```javascript
/**
 * 安全执行操作，带重试
 */
function withRetry(fn, maxAttempts = 3, delayTicks = 20) {
  let lastError = null;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return fn();
    } catch (e) {
      lastError = e;
      Client.waitTick(delayTicks);
    }
  }
  logError(`操作失败，已重试 ${maxAttempts} 次: ${lastError}`);
  return false;
}

/**
 * 安全移动到目标
 */
function safeMoveTo(x, y, z, threshold = 5) {
  return withRetry(() => moveToBlock(x, y, z, threshold), 2);
}

/**
 * 安全获取箱子中的篮子
 */
function safeGetBasket(basketName, chestPos) {
  return withRetry(() => getBasketFromChest(basketName, chestPos), 2);
}
```

---

### 阶段 6: 日志系统 (P1)

**目标**: 区分日志级别，便于调试

```javascript
// ==================== 日志系统 ====================
const LOG_LEVEL = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
let currentLogLevel = LOG_LEVEL.INFO;

function log(level, message, color = '§a') {
  if (level >= currentLogLevel) {
    Chat.log(`${color}[${level}] ${message}`);
  }
}

const logInfo   = (msg) => log(LOG_LEVEL.INFO,  msg, '§a');
const logWarn   = (msg) => log(LOG_LEVEL.WARN,  msg, '§e');
const logError  = (msg) => log(LOG_LEVEL.ERROR, msg, '§c');
const logDebug  = (msg) => log(LOG_LEVEL.DEBUG, msg, '§7');
// ==================== 日志系统结束 ====================
```

---

### 阶段 7: 代码组织 (P1)

**目标**: 按功能区域划分，便于阅读

```javascript
// ==================== 1. 配置 ====================
// (见阶段1)

// ==================== 2. 状态管理 ====================
// (见阶段3)

// ==================== 3. 通用工具 ====================
// (见阶段4)

// ==================== 4. 拍卖模块 ====================
function auction(itemName, amount = CONFIG.defaultSellAmount) { /* ... */ }

// ==================== 5. Jacko 模块 ====================
function sellToJacko() { /* ... */ }
function jackoSchedule() { /* ... */ }

// ==================== 6. 事件监听 ====================
JsMacros.on('Key', ...);
JsMacros.on('RecvMessage', ...);
JsMacros.on('Tick', ...);

// ==================== 7. 启动 ====================
logInfo('自动售货机已启动');
```

---

## 三、具体改动清单

| 阶段 | 改动内容 | 风险 |
|------|----------|------|
| P0-1 | 配置集中到文件顶部 | 低 |
| P0-2 | 递归改迭代 | 低 |
| P0-3 | 状态机替代布尔标志 | 中 |
| P1-4 | 提取公共函数 | 低 |
| P1-5 | 添加错误处理 | 低 |
| P1-6 | 添加日志级别 | 低 |
| P1-7 | 代码区域划分 | 无 |

---

## 四、验证步骤

1. **对比测试**: 运行原脚本和新脚本，功能结果一致
2. **边界测试**: 队列为空/满时的行为
3. **错误测试**: 箱子打不开、物品找不到等场景

---

## 五、输出文件

| 文件 | 说明 |
|------|------|
| `重构版本/作物自动售货机.js` | 重构后的脚本 |
| `Original/作物自动售货机-待优化.js` | 保留原文件 |

---

## 六、高级工程师的额外建议

> "如果这是我的项目，我还会考虑："

1. **添加监控**: 记录每次操作耗时，发现性能问题
2. **一键回滚**: 如果重构出问题，能快速切回旧版本
3. **注释 WHY 而非 WHAT**: 解释为什么这么做，而非在做什么
4. **渐进式提交**: 每次只改一小部分，确保每步都能运行
