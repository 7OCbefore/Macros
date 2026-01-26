

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


/**
 * 查找背包中的物品
 * @param {string} itemName - 要查找的物品名称（忽略大小写和特殊字符）。
 * @returns {number[]} - 匹配的槽位索引数组。
 */
function findItemByName(itemName) {
    const inventory = Player.openInventory();
    if (!inventory) return []; // 增加 inventory 为 null 的检查，防止报错
    const totalSlots = inventory.getTotalSlots();
    const matchedSlots = [];

    for (let i = 0; i < totalSlots; i++) {
        const item = inventory.getSlot(i);
        if (item) {
            const itemNameClean = item.getName().getString()
                .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]+/g, '')
                .trim()
                .toLowerCase(); // 转换为小写进行比较

            if (itemNameClean === itemName.toLowerCase()) {
                matchedSlots.push(i);
            }
        }
    }
    return matchedSlots;
}


/**
 * 获取AH信息 (修改版，获取物品数量和Crate类型, p2w/f2p)
 * @returns {Array<Object>} AH物品信息数组
 */
function getAuctionHouseItems() {
    Chat.say("/ah");
    // 等待 AH 界面打开，增加超时机制，避免无限等待
    let startTime = Date.now();
    const timeout = 5000; // 5 秒超时
    while (!Hud.isContainer()) {
        Client.waitTick();
        if (Date.now() - startTime > timeout) {
            Chat.log("§c[错误] 获取AH信息超时，请检查网络或AH是否正常。");
            return []; // 超时返回空数组
        }
    }
    const ah = Player.openInventory();
    if (!ah) { // 再次检查 inventory 是否为 null，虽然理论上不会
        Chat.log("§c[错误] 无法打开AH界面。");
        return [];
    }

    const items = [];

    const mainStartIndex = ah.getMap().main?.at(0);
    const ahEndIndex = mainStartIndex; // AH 物品都在 mainStartIndex 前面

    if (ahEndIndex === undefined) {
        Chat.log("§c[错误] 无法确定AH物品范围，AH界面可能不正常。");
        ah.close(); // 关闭可能异常的 AH 界面
        return [];
    }


    for (let i = 0; i < ahEndIndex; i++) {
        const stack = ah.getSlot(i);
        if (stack && stack.getItemId() !== "minecraft:air") {
            let itemName = stack.getName().getString()
                .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]+/g, '')
                .trim();
            const itemCount = stack.getCount();
            const itemLore = stack.getLore();
            let crateType = ""; // 默认为空，非Crate物品

            if (itemName.includes("Crate")) {
                let isP2WCrate = false;
                let isF2PCrate = false;
                if (itemLore && itemLore.length > 0) {
                    for (const javaLine of itemLore) {
                        const line = javaLine.getString().trim();
                        const reward3String = "and reveal 3 rewards!";
                        const reward1String = "and reveal 1 reward!";
                        if (line === reward3String) {
                            isP2WCrate = true;
                            break;
                        }
                        if (line === reward1String) {
                            isF2PCrate = true;
                            break;
                        }
                    }
                }
                if (isP2WCrate) {
                    crateType = " (p2w)";
                } else if (isF2PCrate) {
                    crateType = " (f2p)";
                } else {
                    crateType = " (未知类型)";
                }
                itemName += crateType; // 将Crate类型添加到物品名称中
            }


            let itemPrice = null;
            let itemSeller = null;

            if (itemLore && itemLore.length > 0) {
                for (const javaLine of itemLore) {
                    const line = javaLine.toString();
                    const priceMatch = line?.match(/Price:\s*((?:\d{1,3}(?:,\d{3})*)|(?:\d+))/);
                    if (priceMatch) {
                        const priceString = priceMatch[1].replace(/,/g, '');
                        itemPrice = parseInt(priceString);
                    }

                    const sellerMatch = line?.match(/Seller:\s*(.+)/) ?? null;
                    if (sellerMatch) {
                        itemSeller = sellerMatch[1].replace(/[^a-zA-Z0-9_]/g, '');
                    }
                }
            }

            items.push({
                slot: i, // AH 物品槽位
                name: itemName, // 物品名称 (包含 Crate 类型)
                count: itemCount, // 物品数量
                price: itemPrice, // 物品价格
                seller: itemSeller // 物品卖家
            });
        }
    }
    // ah.close(); // 获取完 AH 信息后关闭 AH 界面
    return items;
}


/**
 * 从 CSV 文件读取物品价格信息 (p2w/f2p) - 调试增强版 V2 - 修改版，适配新 CSV 格式, 支持 CareFinish 价格
 */
function readPricesFromCSV(filePath = "E:\\minecraft\\起源OriginRealms\\.minecraft\\versions\\新新源神 启动！1.20.6-Fabric 0.16.0\\config\\jsMacros\\Macros\\originPlanting\\捡漏\\inventory_data.csv") {
    const priceMap = new Map();
    if (FS.exists(filePath)) {
        const file = FS.open(filePath);
        const lineIterator = file.readLines();
        let lineCount = 0;
        try {
            while (lineIterator.hasNext()) {
                const line = lineIterator.next();
                lineCount++;
                if (lineCount === 1) continue; // 跳过 CSV 文件的第一行 (Header)
                const parts = line.split(','); // 使用逗号分隔 CSV 列
                if (parts.length >= 6) { // 检查列数是否足够，现在有 6 列 (Slot, Name, Count, Price, Seller, CareFinish)
                    const itemName = parts[1].trim(); // 物品名称在 CSV 的第二列 (索引为 1)
                    const itemPriceCSV = parseInt(parts[3].trim()); // 物品价格在 CSV 的第四列 (索引为 3)
                    const careFinishPriceCSV = parseInt(parts[5].trim()); // CareFinish 价格在 CSV 的第六列 (索引为 5)

                    if (!isNaN(itemPriceCSV)) {
                        priceMap.set(itemName, { regularPrice: itemPriceCSV, careFinishPrice: isNaN(careFinishPriceCSV) ? 0 : careFinishPriceCSV }); // 存储普通价格和 CareFinish 价格
                    }
                } else {
                    Chat.log(`[DEBUG] readPricesFromCSV: 警告: CSV 行格式不正确, 行: ${line}`);
                }
            }
        } finally {
            lineIterator.close();
        }
    } else {
        Chat.log("§e[DEBUG] readPricesFromCSV: CSV 文件不存在: " + filePath);
    }
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
                Client.waitTick(14); // 等待购买确认GUI出现
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

                if (ahItem.name.endsWith(" Finish Token")) {
                    const baseItemName = ahItem.name.replace(" Finish Token", "").trim();
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
                        Client.waitTick(14); // 等待购买确认GUI出现
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
function getRandomNumber(min = 14, max = 42) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}


let lastPurchaseSuccessful = false; // 记录上次是否成功购买

function mainLoop() {
    while (true) {
        let waitTicks;
        if (lastPurchaseSuccessful) {
            waitTicks = 20; // 如果上次购买成功，则快速再次执行
            lastPurchaseSuccessful = false; // 重置标志
            // Chat.log("§e[DEBUG] mainLoop: 上次购买成功, 快速等待 " + waitTicks + " ticks 后再次检查...");
        } else {
            waitTicks = getRandomNumber(32, 56); // 否则使用随机间隔
            Chat.log("§e[DEBUG] mainLoop: 等待 " + waitTicks + " ticks 后检查...");
        }
        Client.waitTick(waitTicks);
        const purchaseMade = compareAHPricesAndClick(); // 执行购买逻辑，并获取是否购买成功的返回值
        if (purchaseMade) {
            lastPurchaseSuccessful = true; // 如果本次点击了购买，则设置成功标志
            // Chat.log("§e[DEBUG] mainLoop: 本次成功点击购买物品!");
        } else {
            Client.waitTick(32); // 即使没有购买也等待一段时间，避免过快循环
            // Player.openInventory().closeAndDrop(); // 不需要关闭并丢弃，因为 getAuctionHouseItems 已经关闭了 AH
            // Chat.log("§e[DEBUG] mainLoop: 本次没有发现符合购买条件的物品.");
        }
    }
}


// 主逻辑 - 启动主循环
Chat.log("§a捡漏机器人已上线");
mainLoop();