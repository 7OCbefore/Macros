/**
 * @file example1.js
 * @description Get all slot indices and item names from container and inventory
 * @version 1.0.0
 */

const outputFilePath = "D:/Minecraft/originRealms/.minecraft/versions/新新源神 启动！1.20.6-Fabric 0.16.0/config/jsMacros/Macros/Original/bossbars.txt";

/**
 * Get all slots data from inventory (container + player inventory)
 * @param {Object} inv - Inventory object from Player.openInventory()
 * @returns {Array<{slot: number, name: string}>}
 */
function getAllSlotsData(inv) {
    const totalSlots = inv.getTotalSlots();
    const slotsData = [];

    for (let slotIndex = 0; slotIndex < totalSlots; slotIndex++) {
        const item = inv.getSlot(slotIndex);
        if (item) {
            // Get name without any processing - raw string from Minecraft
            const name = item.getName().getString();
            slotsData.push({
                slot: slotIndex,
                name: name
            });
        }
    }

    return slotsData;
}

/**
 * Write slots data to file
 * @param {Array<{slot: number, name: string}>} slotsData
 * @param {string} filePath
 */
function writeSlotsDataToFile(slotsData, filePath) {
    let content = "";
    
    for (const data of slotsData) {
        content += `Slot ${data.slot}: ${data.name}\n`;
    }
    
    // FS.open() + FileHandler.write() will create or overwrite the file
    const file = FS.open(filePath);
    file.write(content);
    // FileHandler auto-closes, no close() needed
    Chat.log(`§a[Debug] Written ${slotsData.length} items to ${filePath}`);
}

/**
 * Main function - wait for container and output data
 */
function main() {
    Chat.log("§a[Debug] Waiting for container to open...");
    
    // Wait for user to open a container or workbench
    while (!Hud.isContainer()) {
        Client.waitTick(1);
    }
    
    // Container opened, get inventory data
    Chat.log("§a[Debug] Container opened, retrieving data...");
    
    const inv = Player.openInventory();
    if (!inv) {
        Chat.log("§c[Debug] Failed to open inventory");
        JavaWrapper.stop();
        return;
    }
    
    const slotsData = getAllSlotsData(inv);
    
    // Write to file
    writeSlotsDataToFile(slotsData, outputFilePath);
    
    // Also log to chat for quick verification
    Chat.log(`§e[Debug] Retrieved ${slotsData.length} slots:`);
    for (const data of slotsData) {
        Chat.log(`§7  Slot ${data.slot}: ${data.name}`);
    }
    
    inv.close();
    
    Chat.log("§a[Debug] Done! Data written to " + outputFilePath);
    JavaWrapper.stop();
}

// Start the script
main();

function craft (id, craftAll = true) {

    let inv = Player.openInventory();//打开工作台后需要刷新背包
    if (!!inv.getCraftableRecipes()) {//确认可以合成某些物品
        if (!inv.getCraftableRecipes().toString().includes(id)) {//如果可合成物品没有包含需要合成物品的ID
            inv.close();//关闭工作台
            return false;//返回
        }
    }

    const recipe = inv.getCraftableRecipes()?.find(r => (r.getOutput().getItemId() === id));//获得合成配方

    if (!recipe) {//如果合成配方不存在
        inv.close();//关闭工作台
        return false;//返回
    }

    while (recipe.getCraftableAmount()) {//当可合成数量不为0
        recipe.craft(craftAll);//合成（是否全部合成）
        inv.quick(0);//将输出框物品全部取出到背包
        Client.waitTick();//等待1tick
    }
    inv.close();//关闭工作台

    while (Hud.getOpenScreenName()) {//当还有Hud在前台显示（即仍未关闭工作台）时 进行等待
        Client.waitTick();
    }

    return true;//完成合成 退出函数
}
