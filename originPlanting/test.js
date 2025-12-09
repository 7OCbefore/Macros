

closeKey = "key.keyboard.x"
// 强制暂停脚本 - 监听按键事件
JsMacros.on("Key", JavaWrapper.methodToJava((event, context) => {
    if (event.key === closeKey) {
        Chat.log('§a捡漏机器人下线了');
        JavaWrapper.stop();
    }
}));

/*
* 获取新物品信息并写入csv表格, 并与AH价格比较点击 (单位价格比较版本, Crate区分, p2w/f2p, FinishToken支持) - 自动化购买
*/

const logFilePath = "E:\\minecraft\\起源OriginRealms\\.minecraft\\versions\\新新源神 启动！1.20.6-Fabric 0.16.0\\config\\jsMacros\\Macros\\originPlanting\\捡漏\\FindingBargain_Log.csv"; // 日志文件路径

/**
 * 记录成功购买日志到 CSV 文件
 * @param {string} itemName - 物品名称
 * @param {number} ahUnitPrice - AH 单价
 * @param {number} csvUnitPrice - CSV 单价 (可能是普通价格或 CareFinish 价格)
 * @param {string} priceType - 价格类型 ("Regular" 或 "CareFinish")
 * @param {string} seller - 卖家 (可选)
 */
function logSuccessfulPurchase(itemName, ahUnitPrice, csvUnitPrice, priceType, seller = "Unknown") {
    const timestamp = new Date().toLocaleString(); // 获取当前时间并格式化

    let logEntry = "";
    try {
        // 检查文件是否存在，如果不存在则写入表头 (放在 try 外部，避免重复检查)
        if (!FS.exists(logFilePath)) {
            logEntry += "Timestamp,Item Name,AH Unit Price,CSV Price,Price Type,Quantity,Seller\n";
        }
        logEntry += `${timestamp},${itemName},${ahUnitPrice},${csvUnitPrice},${priceType},1,${seller}\n`; // 构建 CSV 行
        FS.append(logFilePath, logEntry); // 使用 FS.append 直接追加，无需先 open 再 append
        Chat.log(`§a[日志] 成功购买记录已写入: ${itemName}, AH单价: ${ahUnitPrice}, CSV(${priceType})单价: ${csvUnitPrice}`); // 可选的控制台日志
    } catch (e) {
        Chat.log(`§c[错误] 写入购买日志失败: ${e}`);
    }
}

// 优化1：使用Map缓存物品名称和槽位的映射关系
const itemNameCache = new Map();

function findItemByName(itemName) {
    const inventory = Player.openInventory();
    if (!inventory) return [];
    
    // 转换itemName为统一格式
    const normalizedName = itemName.toLowerCase();
    
    // 检查缓存
    if (itemNameCache.has(normalizedName)) {
        const cachedSlots = itemNameCache.get(normalizedName);
        // 验证缓存是否仍然有效
        if (cachedSlots.every(slot => {
            const item = inventory.getSlot(slot);
            return item && item.getName().getString()
                .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]+/g, '')
                .trim()
                .toLowerCase() === normalizedName;
        })) {
            return cachedSlots;
        }
    }
    
    // 缓存未命中或失效，重新搜索
    const totalSlots = inventory.getTotalSlots();
    const matchedSlots = [];
    
    for (let i = 0; i < totalSlots; i++) {
        const item = inventory.getSlot(i);
        if (item) {
            const itemNameClean = item.getName().getString()
                .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]+/g, '')
                .trim()
                .toLowerCase();
                
            if (itemNameClean === normalizedName) {
                matchedSlots.push(i);
            }
        }
    }
    
    // 更新缓存
    itemNameCache.set(normalizedName, matchedSlots);
    return matchedSlots;
}

// 优化2：使用Set存储已处理的物品，避免重复处理
const processedItems = new Set();

// 优化3：批量处理AH物品信息
function getAuctionHouseItems() {
    Chat.say("/ah");
    const startTime = Date.now();
    const timeout = 5000;
    
    while (!Hud.isContainer()) {
        if (Date.now() - startTime > timeout) {
            Chat.log("§c[错误] 获取AH信息超时，请检查网络或AH是否正常。");
            return [];
        }
        Client.waitTick();
    }
    
    const ah = Player.openInventory();
    if (!ah) return [];
    
    const mainStartIndex = ah.getMap().main?.at(0);
    if (mainStartIndex === undefined) {
        Chat.log("§c[错误] 无法确定AH物品范围，AH界面可能不正常。");
        ah.close();
        return [];
    }
    
    // 批量处理物品信息
    const items = [];
    const batchSize = 10; // 每批处理的物品数量
    
    for (let i = 0; i < mainStartIndex; i += batchSize) {
        const batchEnd = Math.min(i + batchSize, mainStartIndex);
        const batchItems = [];
        
        for (let j = i; j < batchEnd; j++) {
            const stack = ah.getSlot(j);
            if (!stack || stack.getItemId() === "minecraft:air") continue;
            
            const itemInfo = processItemStack(stack, j);
            if (itemInfo) batchItems.push(itemInfo);
        }
        
        items.push(...batchItems);
    }
    
    return items;
}

// 优化4：抽离物品处理逻辑，提高代码复用性
function processItemStack(stack, slot) {
    if (!stack) return null;
    
    let itemName = stack.getName().getString()
        .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]+/g, '')
        .trim();
    const itemCount = stack.getCount();
    const itemLore = stack.getLore();
    
    // 处理Crate类型
    const crateInfo = processCrateType(itemName, itemLore);
    itemName = crateInfo.name;
    
    // 处理价格和卖家信息
    const { price, seller } = extractPriceAndSeller(itemLore);
    
    if (price === null) return null;
    
    return {
        slot,
        name: itemName,
        count: itemCount,
        price,
        seller
    };
}

// 优化5：使用缓存提高CSV读取效率
let csvPriceCache = null;
let lastCsvReadTime = 0;
const CSV_CACHE_DURATION = 60000; // 缓存有效期1分钟

function readPricesFromCSV(filePath) {
    const currentTime = Date.now();
    
    // 如果缓存有效，直接返回缓存数据
    if (csvPriceCache && (currentTime - lastCsvReadTime) < CSV_CACHE_DURATION) {
        return csvPriceCache;
    }
    
    const priceMap = new Map();
    if (!FS.exists(filePath)) {
        Chat.log("§e[警告] CSV文件不存在: " + filePath);
        return priceMap;
    }
    
    try {
        const file = FS.open(filePath);
        const lineIterator = file.readLines();
        let lineCount = 0;
        
        while (lineIterator.hasNext()) {
            const line = lineIterator.next();
            if (++lineCount === 1) continue;
            
            const parts = line.split(',');
            if (parts.length < 6) continue;
            
            const itemName = parts[1].trim();
            const itemPrice = parseInt(parts[3].trim());
            const careFinishPrice = parseInt(parts[5].trim());
            
            if (!isNaN(itemPrice)) {
                priceMap.set(itemName, {
                    regularPrice: itemPrice,
                    careFinishPrice: isNaN(careFinishPrice) ? 0 : careFinishPrice
                });
            }
        }
        
        lineIterator.close();
    } catch (e) {
        Chat.log(`§c[错误] 读取CSV文件失败: ${e}`);
        return new Map();
    }
    
    // 更新缓存
    csvPriceCache = priceMap;
    lastCsvReadTime = currentTime;
    
    return priceMap;
}


/**
 * 比较 AH 物品价格和 CSV 价格，并点击价格更低的 AH 物品, 返回是否点击购买, 支持 CareFinish 价格
 */
let isPurchasing = false; // 添加一个标志变量来防止同时购买多个物品
function compareAHPricesAndClick() {
    if (isPurchasing) {
        // Chat.log("§e[DEBUG] compareAHPricesAndClick: 上次购买尚未完成，跳过本次检查。");
        return false; // 如果正在购买，则直接返回，避免重复购买
    }

    const ahItems = getAuctionHouseItems();
    if (ahItems.length === 0) { // 如果获取 AH 物品失败，则直接返回
        return false;
    }
    const csvPriceMap = readPricesFromCSV();

    let purchaseMade = false; // 标记是否点击购买

    for (const ahItem of ahItems) {
        if (ahItem.name && ahItem.price !== null && ahItem.count !== null && ahItem.count > 0) {
            // 新增逻辑：如果物品名包含 "Skin" 且价格低于 5678，则直接购买
            if (ahItem.name.includes("Skin") && ahItem.price < 5678) {
                Chat.log(`§a[皮肤捡漏] 物品: ${ahItem.name}, 价格: ${ahItem.price}`);
                Player.openInventory().click(ahItem.slot);
                purchaseMade = true; // 标记为已点击购买
                isPurchasing = true; // 设置正在购买标志
                Client.waitTick(8); // 等待购买确认GUI出现
                if (confirmPurchase()) { // 调用确认购买函数, 成功购买才记录日志
                    logSuccessfulPurchase(ahItem.name, ahItem.price / ahItem.count, "N/A", "Regular", ahItem.seller); // 记录日志 - Skin 物品没有 CSV 价格, 价格类型标记为 "Regular"
                } else {
                    isPurchasing = false; // 确认购买失败，重置购买标志
                    return false; // 确认购买失败，直接返回，不再继续检查
                }
                break; // 点击购买后，跳出循环，本次只购买一个物品
            } else { // 如果不是 Skin 物品或者价格不低于 5678，则进行 CSV 价格比较
                let itemNameForCSVLookup = ahItem.name;
                let priceType = "Regular"; // 默认价格类型为 Regular
                let csvPriceToCompare = undefined;

                if (ahItem.name.match(/\s*Finish\s+Token\s*$/)) {
                    const baseItemName = ahItem.name.replace(/\s*Finish\s+Token\s*$/, "").trim();
                    const csvPriceData = csvPriceMap.get(baseItemName);
                    if (csvPriceData && csvPriceData.careFinishPrice > 0) {
                        csvPriceToCompare = csvPriceData.careFinishPrice;
                        itemNameForCSVLookup = baseItemName; // 使用本体物品名记录日志
                        priceType = "CareFinish"; // 价格类型标记为 CareFinish
                    }
                }

                if (csvPriceToCompare === undefined) { // 如果是 Finish Token 物品但 CareFinish 价格无效，或者不是 Finish Token 物品，则尝试普通价格
                    const csvPriceData = csvPriceMap.get(ahItem.name);
                    if (csvPriceData) {
                        csvPriceToCompare = csvPriceData.regularPrice;
                        priceType = "Regular"; // 价格类型标记为 Regular
                    } else {
                        csvPriceToCompare = undefined; // 确保在没有价格数据时保持 undefined
                    }
                }

                if (csvPriceToCompare !== undefined) {
                    const ahUnitPrice = ahItem.price / ahItem.count;
                    if (ahUnitPrice <= csvPriceToCompare) {
                        Chat.log(`§a[捡漏成功] 物品: ${ahItem.name}, AH单价: ${ahUnitPrice.toFixed(2)}, CSV(${priceType})单价: ${csvPriceToCompare}`);
                        Player.openInventory().click(ahItem.slot);
                        purchaseMade = true; // 标记为已点击购买
                        isPurchasing = true; // 设置正在购买标志
                        Client.waitTick(8); // 等待购买确认GUI出现
                        if (confirmPurchase()) { // 调用确认购买函数, 成功购买才记录日志
                            logSuccessfulPurchase(itemNameForCSVLookup, ahUnitPrice, csvPriceToCompare, priceType, ahItem.seller); // 记录日志，使用 itemNameForCSVLookup 和 priceType
                        } else {
                            isPurchasing = false; // 确认购买失败，重置购买标志
                            return false; // 确认购买失败，直接返回，不再继续检查
                        }
                        break; // 点击购买后，跳出循环，本次只购买一个物品
                    }
                }
            }
        }
    }
    if (!purchaseMade) {
        isPurchasing = false; // 没有购买任何东西，重置购买标志 (虽然理论上在循环中 break 前面已经设置了，但为了保险)
    }
    // Chat.log("§e[DEBUG] compareAHPricesAndClick 函数结束, AH 价格比较完成. Purchase Made: " + purchaseMade);
    Chat.log("§eAH price comparison completed.");
    return purchaseMade; // 返回是否点击购买
}

/**
 * 确认购买GUI中点击 "Confirm" 按钮
 */
function confirmPurchase() {
    // Chat.log("§e[DEBUG] confirmPurchase: 开始尝试确认购买...");
    Client.waitTick(10); // 增加等待时间，确保购买确认GUI有足够时间打开
    let confirmBuyGUI = Player.openInventory();
    if (confirmBuyGUI) {
        let confirmButtonSlots = findItemByName("Confirm");
        if (confirmButtonSlots && confirmButtonSlots.length > 0) {
            let confirmButtonSlot = confirmButtonSlots[0];
            // Chat.log(`§e[DEBUG] confirmPurchase: 找到 "Confirm" 按钮, 点击槽位: ${confirmButtonSlot}`);
            confirmBuyGUI.click(confirmButtonSlot);
            Client.waitTick(2); // 稍作等待，让GUI关闭
            // Chat.log("§a[购买确认] 成功点击 \"Confirm\" 按钮。");
            isPurchasing = false; // 确认购买成功，重置购买标志
            return true; // 返回 true 表示成功确认购买
        } else {
            Chat.log("§e[DEBUG] confirmPurchase: 警告: 未找到 \"Confirm\" 按钮, 购买可能未确认，正在尝试关闭GUI。");
            Player.openInventory().close(); // 尝试关闭 GUI，避免卡住
            isPurchasing = false; // 确认购买失败，重置购买标志
            return false; // 返回 false 表示未能确认购买
        }
    } else {
        Chat.log("§e[DEBUG] confirmPurchase: 警告: 购买确认GUI未打开, 购买可能未确认。");
        isPurchasing = false; // 确认购买失败，重置购买标志
        return false; // 返回 false 表示未能确认购买
    }
    // Chat.log("§e[DEBUG] confirmPurchase: 函数结束");
}


// 生成随机整数
function getRandomNumber(min = 28, max = 56) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}


let lastPurchaseSuccessful = false; // 记录上次是否成功购买

// 优化6：使用节流控制主循环执行频率
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

const throttledCompareAndClick = throttle(compareAHPricesAndClick, 1000);

function mainLoop() {
    while (true) {
        const waitTicks = lastPurchaseSuccessful ? 20 : getRandomNumber();
        Client.waitTick(waitTicks);
        
        try {
            throttledCompareAndClick();
        } catch (e) {
            Chat.log(`§c[错误] 执行购买逻辑时发生错误: ${e}`);
            Client.waitTick(64); // 发生错误时增加等待时间
        }
    }
}


// 主逻辑 - 启动主循环
Chat.log("§a捡漏机器人已上线");
mainLoop();