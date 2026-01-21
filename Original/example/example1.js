/**
 * @file example1.js
 * @description Get all slot indices, item names and lore from container and inventory
 * @version 1.1.0
 */
const outputFilePath = "D:/Minecraft/originRealms/.minecraft/versions/新新源神 启动！1.20.6-Fabric 0.16.0/config/jsMacros/Macros/Original/bossbars.txt";
/**
 * Get all slots data from inventory (container + player inventory)
 * @param {Object} inv - Inventory object from Player.openInventory()
 * @returns {Array<{slot: number, name: string, lore?: Array<string>}>}
 */
function getAllSlotsData(inv) {
    const totalSlots = inv.getTotalSlots();
    const slotsData = [];
    for (let slotIndex = 0; slotIndex < totalSlots; slotIndex++) {
        const item = inv.getSlot(slotIndex);
        if (item) {
            // Get name without any processing - raw string from Minecraft
            const name = item.getName().getString();
            // Get item lore
            const lore = getItemLore(item);
            slotsData.push({
                slot: slotIndex,
                name: name,
                lore: lore
            });
        }
    }
    return slotsData;
}
/**
 * Get item lore from NBT data
 * @param {Object} item - Item object from inventory slot
 * @returns {Array<string>} Array of lore strings, empty if no lore
 */
function getItemLore(item) {
    const lore = [];
    
    try {
        // Get NBT data from item
        const nbt = item.getNbt();
        if (!nbt) {
            return lore;
        }
        
        // Try to get display compound first (standard Minecraft format)
        const display = nbt.getCompound("display");
        if (display) {
            const loreList = display.getList("Lore");
            if (loreList) {
                const size = loreList.size();
                for (let i = 0; i < size; i++) {
                    // Each lore element is a StringTag, get its string value
                    const loreString = loreList.getString(i);
                    if (loreString) {
                        lore.push(loreString);
                    }
                }
            }
        }
    } catch (e) {
        // Item may not have NBT or lore, silently return empty
    }
    
    return lore;
}
/**
 * Write slots data to file (includes lore info)
 * @param {Array<{slot: number, name: string, lore?: Array<string>}>} slotsData
 * @param {string} filePath
 */
function writeSlotsDataToFile(slotsData, filePath) {
    let content = "";
    
    for (const data of slotsData) {
        content += `Slot ${data.slot}: ${data.name}\n`;
        
        // 如果有 lore 信息，添加到输出中
        if (data.lore && data.lore.length > 0) {
            for (let i = 0; i < data.lore.length; i++) {
                content += `  │ Lore ${i + 1}: ${data.lore[i]}\n`;
            }
        } else {
            content += `  │ (No lore)\n`;
        }
        content += "\n";
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
    
    // Log lore info
    let itemsWithLore = 0;
    for (const data of slotsData) {
        if (data.lore && data.lore.length > 0) {
            itemsWithLore++;
        }
    }
    Chat.log(`§e[Debug] Items with lore: ${itemsWithLore}/${slotsData.length}`);
    
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