/*
* 获取新物品信息并写入csv表格
*/

/**
 * 查找背包中的物品
 * @param {string} itemName - 要查找的物品名称（忽略大小写和特殊字符）。
 * @returns {number[]} - 匹配的槽位索引数组。
 */
function findItemByName(itemName) {
    const inventory = Player.openInventory(); // 打开玩家背包或箱子
    const totalSlots = inventory.getTotalSlots(); // 获取总槽位数
    const matchedSlots = []; // 存储匹配的槽位索引

    for (let i = 0; i < totalSlots; i++) {
        const item = inventory.getSlot(i); // 获取当前槽位的物品
        if (item) {
            // 清理物品名称：保留汉字、字母和阿拉伯数字，移除其他字符
            const itemNameClean = item.getName().getString()
                .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]+/g, '')
                .trim();

            // 比较清理后的名称
            if (itemNameClean === itemName.toLowerCase()) {
                matchedSlots.push(i); // 如果匹配，记录槽位索引
            }
        }
    }
    return matchedSlots;
}

/**
 * 获取容器内物品信息
 * @returns {Array<Object>} 物品信息数组，每个对象包含 slot, name, count, price, seller 属性
 */
function getContainerItems() {
    while (!Hud.isContainer()) {
        Client.waitTick();
    }
    const inv = Player.openInventory();
    const items = [];
    const mainStartIndex = inv.getMap().main?.at(0);
    const invEndIndex = mainStartIndex;

    for (let i = 0; i < invEndIndex; i++) {
        const stack = inv.getSlot(i);
        if (stack && stack.getItemId() !== "minecraft:air") {
            const itemName = stack.getName().getString()
                .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]+/g, '')
                .trim();
            const itemCount = stack.getCount();
            const itemLore = stack.getLore();

            let itemPrice = null;
            let itemSeller = null;

            // TODO
            /*
            lore中要针对氪金和非氪金的crate作区别
            and reveal 3 rewards!   氪金
            and reveal 1 rewards!   非氪金
            */
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
                        itemSeller = sellerMatch[1];
                    }
                }
            }

            items.push({
                slot: i,
                name: itemName,
                count: itemCount,
                price: itemPrice,
                seller: itemSeller
            });
        }
    }

    return items;
}

/**
 * 将物品信息写入 CSV 文件
 * @param {Array<Object>} items 物品信息数组
 * @param {string} filePath 文件路径
 */
function writeItemsToCSV(items, filePath = "inventory_data.csv") {
    let csvData = "";

    // 检查文件是否存在，如果不存在则写入表头
    if (!FS.exists(filePath)) {
        csvData += "Slot,Name,Count,Price,Seller\n";
    }

    items.forEach(item => {
        csvData += `${item.slot},${item.name},${item.count}个,${item.price},${item.seller}\n`;
    });

    const file = FS.open(filePath).append(csvData); // append 添加

    Chat.log("Inventory data saved to " + filePath);
}



// r1
const items1 = getContainerItems();
writeItemsToCSV(items1);
Chat.log(`容器打开了`);

