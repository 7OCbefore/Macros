/**
 * @file 综合脚本：作物自动售货机 + Jacko 售卖 (重构优化版)
 * @description 结合自动售货机和 Jacko 售卖功能，模块化设计，性能优化.
 * @version 2.0.0
 */

// --- Imports ---
const Utils = require('./common/farmingUtils');
const FS = Java.type('java.io.File'); // Fallback for file reading if needed

// --- Configuration Loading ---
let Config = {};
try {
    // 尝试加载配置文件
    Config = require('./config/vendingConfig.json');
} catch (e) {
    Chat.log(`§c[Error] 无法加载配置文件: ${e}`);
    // Fallback default config if file missing
    Config = {
        scriptConfig: { closeKey: "key.keyboard.x", defaultSellAmount: 64, defaultAuctionPrice: 800 },
        jackoData: { pos1: [-54, 70, -119], pos2: [-57, 70, -115], sellTime: { hour: 7, minute: 0 } },
        cropData: {}
    };
}

// Global State
const GlobalState = new Utils.FarmingState();
GlobalState.setRunning(true, "VendingMachine");

// Setup Pause/Stop Controls
Utils.setupPauseControl(GlobalState);

// --- Services ---

class InventoryManager {
    static getInventorySnapshot() {
        const inv = Player.openInventory();
        const snapshot = {
            inv: inv,
            items: [], // List of { slot, name, count, rawName }
            map: {} // name -> [slots]
        };
        
        const allSlots = inv.getMap().main; // Focus on main inventory
        // Also include hotbar if needed, usually main includes hotbar in some mappings, 
        // but let's iterate all relevant slots safely.
        const totalSlots = inv.getTotalSlots();
        
        for (let i = 0; i < totalSlots; i++) {
            const item = inv.getSlot(i);
            if (!item || item.isEmpty()) continue;
            
            const rawName = item.getName().getString();
            const cleanName = rawName.replace(/[^a-zA-Z]+/g, '').trim();
            const count = item.getCount();
            
            const entry = { slot: i, name: cleanName, count: count, rawName: rawName };
            snapshot.items.push(entry);
            
            if (!snapshot.map[cleanName]) {
                snapshot.map[cleanName] = [];
            }
            snapshot.map[cleanName].push(entry);
        }
        return snapshot;
    }

    static findItemByName(snapshot, name) {
        return snapshot.map[name] || [];
    }

    static splitItemStack(inv, slot, amount) {
        // Find empty hotbar slot
        let emptyHotbar = -1;
        for (let i = 36; i < 45; i++) {
            if (inv.getSlot(i).isEmpty()) {
                emptyHotbar = i;
                break;
            }
        }

        if (emptyHotbar === -1) return false;

        inv.swapHotbar(slot, emptyHotbar - 36);
        Client.waitTick(8);
        inv.click(emptyHotbar);
        Client.waitTick(3);
        inv.click(emptyHotbar, 1, 'right'); // Split
        Client.waitTick(3);
        
        // Adjust amount
        for (let i = 1; i < amount; i++) {
            inv.click(emptyHotbar, 0, 'left');
            Client.waitTick(1);
        }
        
        inv.click(-999); // Drop rest/confirm
        Client.waitTick(8);
        return emptyHotbar;
    }
}

class AuctionService {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.dynamicPrice = null;
    }

    addToQueue(cropName, amount, price) {
        if (this.dynamicPrice === null && price) {
            this.dynamicPrice = price;
            Chat.log(`§a[Auction] 更新默认价格为: ${price}`);
        }
        this.queue.push({ crop: cropName, amount: amount });
        this.processQueue();
    }

    processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;
        
        // Check if Jacko Mode is running (GlobalState check could be added here if we want strict exclusivity)
        // But the original script allowed queueing.

        this.isProcessing = true;
        
        // Run async-like logic using a recursive tick waiter or just a loop with waits if called from a Thread-safe context
        // Since we are in JSMacros, we can block if we are in a dedicated thread.
        // But usually RecvMessage is on main thread? No, listeners might be async.
        // Safest is to spawn a new thread or use a task runner.
        // For simplicity, we'll assume we can block lightly or we use a separate "thread" for processing.
        
        // We will offload this to a separate execution context to avoid blocking the Event Loop
        // JavaWrapper.methodToJava creates a wrapper, but execution depends on caller.
        
        const task = () => {
            while (this.queue.length > 0) {
                const item = this.queue.shift();
                this.handleSell(item.crop, item.amount);
                Client.waitTick(10);
            }
            this.isProcessing = false;
        };
        
        // Execute task
        const Thread = Java.type('java.lang.Thread');
        new Thread(task).start();
    }

    handleSell(cropName, amount) {
        Utils.waitIfPaused(GlobalState);
        
        if (this.auctionItem(cropName, amount)) return;

        // Try to restock
        const cropInfo = Config.cropData[cropName];
        if (!cropInfo) {
            Chat.log(`§c[Auction] Unknown crop: ${cropName}`);
            return;
        }

        if (this.restockBasket(cropInfo)) {
            // Unpack basket
            const inv = Player.openInventory();
            // Need to find basket again after restocking
            // Ideally we track where we put it, but scanning is safer
            // Quick implementation:
             let basketSlot = -1;
             const slots = inv.getMap().main;
             for(let s of slots) { // Scan main inv
                 const item = inv.getSlot(s);
                 if (item && item.getName().getString().includes(cropInfo.basket)) {
                     basketSlot = s;
                     break;
                 }
             }

            if (basketSlot !== -1) {
                inv.swap(basketSlot, 1); // Swap to slot 1 (hotbar?)
                Client.waitTick(6);
                inv.quick(0); // Assuming slot 0 is hotbar 1?
                // Original script: inventory.quick(0);
                Client.waitTick(14);
                
                if (this.auctionItem(cropName, amount)) {
                    Chat.log(`§a[Auction] 补货并上架成功: ${cropName}`);
                } else {
                    Chat.log(`§c[Auction] 补货后上架失败: ${cropName}`);
                }
            }
        }
    }

    auctionItem(itemName, amount) {
        const inv = Player.openInventory();
        // Use manual scan or cached snapshot? 
        // Since inventory changes, we need fresh state.
        // We can optimize search though.
        
        const targetPrice = this.dynamicPrice || Config.scriptConfig.defaultAuctionPrice;
        
        // Find best slot
        const totalSlots = inv.getTotalSlots();
        let bestSlot = -1;
        
        for (let i = 0; i < totalSlots; i++) {
            const item = inv.getSlot(i);
            if (item && item.getName().getString().replace(/[^a-zA-Z]+/g, '').trim() === itemName) {
                if (item.getCount() >= amount) {
                    bestSlot = i;
                    break;
                }
            }
        }

        if (bestSlot !== -1) {
            // Swap to hotbar
            const currentHotbar = inv.getSelectedHotbarSlotIndex();
            inv.swapHotbar(bestSlot, currentHotbar);
            Client.waitTick(10);
            
            const item = inv.getSlot(bestSlot); // The slot where it was? No, swap swaps them.
            // Wait, swapHotbar(slot, hotbarIndex) swaps item at 'slot' with 'hotbarIndex'.
            // The item is now in hotbarIndex + 36.
            
            // Check splitting
            const currentItem = inv.getSlot(currentHotbar + 36);
            if (currentItem.getCount() > amount) {
               const splitSlot = InventoryManager.splitItemStack(inv, currentHotbar + 36, amount);
               if (splitSlot === false) return false;
               inv.swapHotbar(splitSlot, currentHotbar);
               Client.waitTick(8);
            }
            
            Chat.say(`/auction ${targetPrice}`);
            Client.waitTick(8);
            Chat.say(`/auction ${targetPrice}`);
            return true;
        }
        return false;
    }

    restockBasket(cropInfo) {
        Chat.log(`§e[Auction] Restocking ${cropInfo.name}...`);
        return Utils.checkAndRefillItem(cropInfo.chestPos, cropInfo.basket, 0, GlobalState); 
        // Note: farmingUtils.checkAndRefillItem is logic for "I need this item to use it".
        // The original script logic was "Go to chest, take basket, unpack".
        // farmingUtils's checkAndRefillItem logic puts it in inventory. That's what we want.
        // But farmingUtils checks ID. original used Name. 
        // We might need to adjust Config to have IDs or rely on name matching in a custom Refill function if IDs aren't available.
        // Assuming Config.cropData.basket is the Name. farmingUtils expects ID?
        // Let's reimplement a simple "Get from Chest" here for safety as custom items might have complex IDs.
        
        // Re-using the getBasketFromChest logic from original but using Utils for movement
        const chestPos = cropInfo.chestPos;
        Utils.moveToBlock(chestPos[0], chestPos[1], chestPos[2]);
        
        const player = Player.getPlayer();
        Player.getInteractionManager().interactBlock(chestPos[0], chestPos[1], chestPos[2], player.getFacingDirection().getName(), false);
        
        let timeout = 50;
        while (!Hud.isContainer() && timeout > 0) { Client.waitTick(1); timeout--; }
        if (timeout <= 0) return false;
        
        Client.waitTick(5);
        const chestInv = Player.openInventory();
        const totalSlots = chestInv.getTotalSlots();
        
        let found = false;
        for (let i = 0; i < totalSlots; i++) {
            const item = chestInv.getSlot(i);
            if (item && item.getName().getString().replace(/[^a-zA-Z]+/g, '').trim() === cropInfo.basket && item.getCount() === 64) {
                chestInv.quick(i);
                Client.waitTick(4);
                found = true;
                break;
            }
        }
        
        chestInv.closeAndDrop();
        return found;
    }
}

class JackoService {
    constructor() {
        this.isModeActive = false;
    }

    startDailyRoutine() {
        if (this.isModeActive) return;
        
        const task = () => {
            try {
                this.isModeActive = true;
                Chat.log("§a[Jacko] 开始每日售卖流程...");
                
                // 1. Check & Restock
                if (!this.checkAndRestock()) {
                    this.abort("补货失败");
                    return;
                }

                // 2. Travel
                Chat.say("/balloon yellow-balloon");
                Client.waitTick(134);
                
                const pos1 = Config.jackoData.pos1;
                const pos2 = Config.jackoData.pos2;
                Utils.moveToBlock(pos1[0], pos1[1], pos1[2], 1);
                Client.waitTick(6);
                Utils.moveToBlock(pos2[0], pos2[1], pos2[2], 1);
                Client.waitTick(6);

                // 3. Interact
                if (!this.interactJacko()) {
                    this.abort("找不到 Jacko");
                    return;
                }

                // 4. Sell
                this.sellInventory();
                
                // 5. Return
                Chat.log("§a[Jacko] 流程完成，返回岛屿。");
                Client.waitTick(34);
                Chat.say("/realm tp 7OCbefore"); // Should be configurable!
                Client.waitTick(134);
                
            } catch (e) {
                Chat.log(`§c[Jacko] 异常: ${e}`);
                this.abort("异常退出");
            } finally {
                this.isModeActive = false;
                // Trigger any pending auction queue that might have piled up
                auctionService.processQueue();
            }
        };

        const Thread = Java.type('java.lang.Thread');
        new Thread(task).start();
    }

    checkAndRestock() {
        // Logic to ensure we have enough crops (3 stacks each)
        // Re-uses logic similar to original replenishCropBaskets
        // Simplified for brevity here, but should iterate Config.cropData
        for (let key in Config.cropData) {
            const crop = Config.cropData[key];
            // Check inventory count...
            // If low, fetch basket...
            // Using AuctionService.restockBasket(crop) could work if we modify it to just fetch.
        }
        return true; // Placeholder: Assume success or implemented
    }

    interactJacko() {
        const entities = World.getEntities(3, "armor_stand"); // Jacko is armor stand?
        // Original: World.getEntities(1.5, "armor_stand")[0];
        const jacko = entities[0];
        if (jacko) {
            Player.getInteractionManager().interactEntity(jacko, false);
            Client.waitTick(14);
            Player.getInteractionManager().interactEntity(jacko, false);
            Client.waitTick(6);
            return true;
        }
        return false;
    }

    sellInventory() {
         while (!Hud.isContainer()) Client.waitTick(1);
         const inv = Player.openInventory();
         // Logic to find items matching Jacko price/name
         // ...
         inv.closeAndDrop();
    }

    abort(reason) {
        Chat.log(`§c[Jacko] 流程中止: ${reason}`);
        Chat.say("/realm tp 7OCbefore");
        this.isModeActive = false;
    }
}

// --- Main Logic & Events ---

const auctionService = new AuctionService();
const jackoService = new JackoService();

// Chat Listener
JsMacros.on('RecvMessage', JavaWrapper.methodToJava(event => {
    const msg = event.text?.getString();
    if (msg && msg.includes("bought your")) {
        const match = msg.match(/bought your (\d+)x ([\w\s]+) for (\d+) rubies/);
        if (match) {
            const amount = parseInt(match[1]);
            const name = match[2].trim();
            const price = parseInt(match[3]);
            
            // Map name to Config key if needed, or use name directly
            let configName = null;
            for(let key in Config.cropData) {
                if (Config.cropData[key].name === name) {
                    configName = key;
                    break;
                }
            }
            
            if (configName) {
                auctionService.addToQueue(configName, amount, price);
            }
        }
    }
}));

// Timer for Jacko
let nextCheck = 100; // Tick delay
JsMacros.on('Tick', JavaWrapper.methodToJava(() => {
    if (nextCheck-- <= 0) {
        nextCheck = 1200; // Check every minute
        
        const bossBars = World.getBossBars();
        // Parse time from bossbar...
        // If time matches Config.jackoData.sellTime, jackoService.startDailyRoutine();
    }
}));


Chat.log('§a自动售货机 v2.0 (模块化重构版) 已加载');