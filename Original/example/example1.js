/**
 * @file example1.js
 * @description Get all slot indices, item names and lore from container and inventory
 * @version 1.1.0
 */
const outputFilePath = "D:/Minecraft/originRealms/.minecraft/versions/新新源神 启动！1.20.6-Fabric 0.16.0/config/jsMacros/Macros/Original/bossbars.txt";
const firstContainerTimeoutTicks = 200;
const nextContainerTimeoutTicks = 200;
const containerOpenWaitTicks = 4;
const containerCloseWaitTicks = 4;
/**
 * Get container slots data (exclude player inventory)
 * @param {Object} inv - Inventory object from Player.openInventory()
 * @returns {Array<{slot: number, name: string}>}
 */
function getContainerSlotsData(inv) {
    const slotsData = [];
    const containerSlots = getContainerSlotIndexes(inv);
    for (const slotIndex of containerSlots) {
        const item = inv.getSlot(slotIndex);
        if (item) {
            const name = item.getName().getString();
            slotsData.push({
                slot: slotIndex,
                name: name
            });
        }
    }
    return slotsData;
}

function getContainerSlotIndexes(inv) {
    const map = inv.getMap();
    if (map?.main?.length) {
        const mainStart = map.main[0];
        return buildRange(0, mainStart);
    }
    const totalSlots = inv.getTotalSlots();
    const playerSlots = 36;
    if (totalSlots > playerSlots) {
        return buildRange(0, totalSlots - playerSlots);
    }
    return buildRange(0, totalSlots);
}

function buildRange(start, end) {
    const slots = [];
    for (let i = start; i < end; i++) {
        slots.push(i);
    }
    return slots;
}
/**
 * Build slots data report
 * @param {Array<{slot: number, name: string}>} slotsData
 * @param {number} passIndex
 * @param {string} containerTitle
 * @returns {string}
 */
function buildSlotsDataReport(slotsData, passIndex, containerTitle) {
    let content = `=== Container ${passIndex + 1}`;
    if (containerTitle) {
        content += ` (${containerTitle})`;
    }
    content += " ===\n\n";
    
    for (const data of slotsData) {
        content += `Slot ${data.slot}: ${data.name}\n`;
    }
    
    return content;
}

/**
 * Write report content to file
 * @param {string} content
 * @param {string} filePath
 * @param {number} containerCount
 * @param {number} itemCount
 */
function writeReportToFile(content, filePath, containerCount, itemCount) {
    const file = FS.open(filePath);
    file.write(content);
    Chat.log(`§a[Debug] Written ${itemCount} items from ${containerCount} container(s) to ${filePath}`);
}

function getContainerTitle(inv) {
    if (inv && typeof inv.getContainerTitle === "function") {
        const title = inv.getContainerTitle();
        return title ? String(title) : "";
    }
    return "";
}

function getContainerSignature(inv) {
    const title = getContainerTitle(inv);
    return `${title}|${inv.getTotalSlots()}`;
}

function waitForContainerOpen(timeoutTicks) {
    let ticks = 0;
    while (!Hud.isContainer() && ticks < timeoutTicks) {
        Client.waitTick(1);
        ticks++;
    }
    return Hud.isContainer();
}

function waitForContainerChange(prevSignature, timeoutTicks) {
    let ticks = 0;
    while (ticks < timeoutTicks) {
        Client.waitTick(1);
        if (!Hud.isContainer()) {
            ticks++;
            continue;
        }
        const inv = Player.openInventory();
        if (inv && getContainerSignature(inv) !== prevSignature) {
            Client.waitTick(containerOpenWaitTicks);
            return true;
        }
        ticks++;
    }
    return false;
}
/**
 * Main function - wait for container and output data
 */
function main() {
    Chat.log("§a[Debug] Waiting for container to open...");
    if (!waitForContainerOpen(firstContainerTimeoutTicks)) {
        Chat.log("§c[Debug] Timeout waiting for container");
        JavaWrapper.stop();
        return;
    }

    const reports = [];
    let totalItems = 0;
    let prevSignature = null;

    for (let passIndex = 0; passIndex < 2; passIndex++) {
        if (passIndex === 1) {
            Chat.log("§a[Debug] Waiting for next container (change)...");
            if (!waitForContainerChange(prevSignature, nextContainerTimeoutTicks)) {
                Chat.log("§c[Debug] Next container did not open in time");
                break;
            }
        }

        const inv = Player.openInventory();
        if (!inv) {
            Chat.log("§c[Debug] Failed to open inventory");
            break;
        }

        Client.waitTick(containerOpenWaitTicks);

        const slotsData = getContainerSlotsData(inv);
        const title = getContainerTitle(inv);
        const report = buildSlotsDataReport(slotsData, passIndex, title);
        reports.push(report);
        totalItems += slotsData.length;
        prevSignature = getContainerSignature(inv);

        Chat.log(`§e[Debug] Retrieved ${slotsData.length} slots (container ${passIndex + 1}).`);
        for (const data of slotsData) {
            Chat.log(`§7  Slot ${data.slot}: ${data.name}`);
        }

        let itemsWithLore = 0;
        for (const data of slotsData) {
            if (data.lore && data.lore.length > 0) {
                itemsWithLore++;
            }
        }
        Chat.log(`§e[Debug] Items with lore: ${itemsWithLore}/${slotsData.length}`);

        if (passIndex === 1) {
            inv.close();
            Client.waitTick(containerCloseWaitTicks);
        } else {
            Chat.log("§a[Debug] Keep container open to open inner/new container...");
        }
    }

    if (reports.length > 0) {
        writeReportToFile(reports.join("\n"), outputFilePath, reports.length, totalItems);
        Chat.log("§a[Debug] Done! Data written to " + outputFilePath);
    } else {
        Chat.log("§c[Debug] No container data captured");
    }

    JavaWrapper.stop();
}
// Start the script
main();

// function craft (id, craftAll = true) {
//     let inv = Player.openInventory();//打开工作台后需要刷新背包
//     if (!!inv.getCraftableRecipes()) {//确认可以合成某些物品
//         if (!inv.getCraftableRecipes().toString().includes(id)) {//如果可合成物品没有包含需要合成物品的ID
//             inv.close();//关闭工作台
//             return false;//返回
//         }
//     }
//     const recipe = inv.getCraftableRecipes()?.find(r => (r.getOutput().getItemId() === id));//获得合成配方
//     if (!recipe) {//如果合成配方不存在
//         inv.close();//关闭工作台
//         return false;//返回
//     }
//     while (recipe.getCraftableAmount()) {//当可合成数量不为0
//         recipe.craft(craftAll);//合成（是否全部合成）
//         inv.quick(0);//将输出框物品全部取出到背包
//         Client.waitTick();//等待1tick
//     }
//     inv.close();//关闭工作台
//     while (Hud.getOpenScreenName()) {//当还有Hud在前台显示（即仍未关闭工作台）时 进行等待
//         Client.waitTick();
//     }
//     return true;//完成合成 退出函数
// }
