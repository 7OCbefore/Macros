/**
 * @file SupplyCheckService.js
 * @description Sequential supply check and purchasing for soil, fertilizer, and seeds
 */

const Point3D = require('../core/Point3D.js');

class SupplyCheckService {
    constructor(config, cropRegistry, movementService, inventoryService) {
        this._config = config;
        this._cropRegistry = cropRegistry;
        this._movementService = movementService;
        this._inventoryService = inventoryService;

        this._timings = config.timings || {};
        this._purchase = config.purchase || {};
        this._maxTrips = this._purchase.maxTrips || 3;
        this._maxStack = config.constants?.maxStackSize || 64;
    }

    ensureSuppliesReady(state) {
        if (!this._checkAndPurchaseSoil(state)) {
            return false;
        }
        if (!this._checkAndPurchaseFertilizer(state)) {
            return false;
        }
        if (!this._checkAndPurchaseSeeds(state)) {
            return false;
        }
        return true;
    }

    _checkAndPurchaseSoil(state) {
        const chest = this._config.chests?.soil;
        const items = this._config.items?.soil || [];
        return this._checkAndPurchaseSupply('soil', chest, items, this._buyFromJeckyl.bind(this), state);
    }

    _checkAndPurchaseFertilizer(state) {
        const chest = this._config.chests?.fertilizer;
        const items = this._config.items?.fertilizer || [];
        return this._checkAndPurchaseSupply('fertilizer', chest, items, this._buyFromJeckyl.bind(this), state);
    }

    _checkAndPurchaseSeeds(state) {
        const cropId = state?.activeCrop || this._config.scriptConfig?.activeCrop;
        const seedsByCrop = this._config.seedsByCrop || {};
        const seedChest = seedsByCrop[cropId];
        const seedItems = this._cropRegistry.getSeedItemsByCrop(cropId);

        if (!cropId || !seedChest) {
            Chat.log('§c[Supply] activeCrop or seedsByCrop config missing.');
            return false;
        }
        if (seedItems.length === 0) {
            Chat.log(`§c[Supply] No seed items configured for crop: ${cropId}`);
            return false;
        }

        return this._checkAndPurchaseSupply('seeds', seedChest, seedItems, this._buySeeds.bind(this), state);
    }

    _checkAndPurchaseSupply(label, chestConfig, itemNames, purchaseHandler, state) {
        if (!chestConfig?.supply) {
            Chat.log(`§c[Supply] Missing supply chest config for ${label}.`);
            return false;
        }
        if (!itemNames || itemNames.length === 0) {
            Chat.log(`§c[Supply] No item names provided for ${label}.`);
            return false;
        }

        let supplyStatus = this._getChestStatus(chestConfig.supply, itemNames, state);
        if (!supplyStatus) {
            return false;
        }

        let dumpStatus = null;
        if (chestConfig.dump) {
            dumpStatus = this._getChestStatus(chestConfig.dump, itemNames, state);
            if (!dumpStatus) {
                return false;
            }
        }
        let combined = this._combineChestsStatus(supplyStatus, dumpStatus);
        if (combined.foreignCount > 0) {
            Chat.log(`§c[Supply] ${label} chest contains non-target items.`);
            return false;
        }
        if (combined.missing === 0) {
            Chat.log(`§a[Supply] ${label} chests are full.`);
            return true;
        }

        if (this._countItemsInInventory(itemNames) > 0) {
            Chat.log(`§e[Supply] Using inventory items to refill ${label}.`);
            if (combined.missingSupply > 0) {
                this._inventoryService.transferToChest(
                    Point3D.from(chestConfig.supply),
                    itemNames,
                    this._movementService
                );
            }
            if (chestConfig.dump && combined.missingDump > 0) {
                this._inventoryService.transferToChest(
                    Point3D.from(chestConfig.dump),
                    itemNames,
                    this._movementService
                );
            }

            if (combined.missingSupply > 0) {
                supplyStatus = this._getChestStatus(chestConfig.supply, itemNames, state);
                if (!supplyStatus) {
                    return false;
                }
            }
            if (chestConfig.dump && combined.missingDump > 0) {
                dumpStatus = this._getChestStatus(chestConfig.dump, itemNames, state);
                if (!dumpStatus) {
                    return false;
                }
            }

            combined = this._combineChestsStatus(supplyStatus, dumpStatus);
            if (combined.foreignCount > 0) {
                Chat.log(`§c[Supply] ${label} chest contains non-target items.`);
                return false;
            }
            if (combined.missing === 0) {
                Chat.log(`§a[Supply] ${label} chests are full.`);
                return true;
            }
        }

        let trips = 0;
        while (trips < this._maxTrips) {
            const capacity = this._getInventoryCapacity(itemNames);
            if (capacity <= 0) {
                Chat.log(`§c[Supply] Inventory has no capacity for ${label}.`);
                return false;
            }

            const purchaseAmount = Math.min(combined.missing, capacity);
            Chat.log(`§e[Supply] ${label} missing ${combined.missing}. Buying ${purchaseAmount}...`);

            if (!purchaseHandler(itemNames, purchaseAmount, state)) {
                Chat.log(`§c[Supply] Failed to purchase ${label}.`);
                return false;
            }

            this._returnToBase();

            if (combined.missingSupply > 0) {
                this._inventoryService.transferToChest(
                    Point3D.from(chestConfig.supply),
                    itemNames,
                    this._movementService
                );
            }
            if (chestConfig.dump && combined.missingDump > 0) {
                this._inventoryService.transferToChest(
                    Point3D.from(chestConfig.dump),
                    itemNames,
                    this._movementService
                );
            }

            if (combined.missingSupply > 0) {
                supplyStatus = this._getChestStatus(chestConfig.supply, itemNames, state);
                if (!supplyStatus) {
                    return false;
                }
            }
            if (chestConfig.dump && combined.missingDump > 0) {
                dumpStatus = this._getChestStatus(chestConfig.dump, itemNames, state);
                if (!dumpStatus) {
                    return false;
                }
            }

            combined = this._combineChestsStatus(supplyStatus, dumpStatus);
            if (combined.foreignCount > 0) {
                Chat.log(`§c[Supply] ${label} chest contains non-target items.`);
                return false;
            }
            if (combined.missing === 0) {
                Chat.log(`§a[Supply] ${label} chests are full.`);
                return true;
            }

            trips++;
        }

        Chat.log(`§c[Supply] ${label} not full after ${this._maxTrips} trips.`);
        return false;
    }

    _buyFromJeckyl(itemNames, amount, state) {
        const npc = this._purchase.jeckyl;
        return this._buyFromNpcShop(npc, itemNames, amount, state);
    }

    _buySeeds(itemNames, amount, state) {
        const npc = this._purchase.seedShop;
        return this._buySeedsFromNpc(npc, itemNames, amount, state);
    }

    _buyFromNpcShop(npcConfig, itemNames, amount, state) {
        const shopInv = this._openNpcShop(npcConfig, state);
        if (!shopInv) {
            return false;
        }

        const slotInfo = this._getSlotRanges(shopInv);
        const itemSlot = this._findItemSlot(shopInv, slotInfo.containerSlots, itemNames);

        this._logShopDebug('ShopOpen', shopInv, slotInfo, itemSlot, itemNames);

        if (itemSlot < 0) {
            Chat.log('§c[Supply] Item not found in shop.');
            this._closeContainer(shopInv);
            return false;
        }

        const purchased = this._buyFromShop(shopInv, itemSlot, itemNames, amount, slotInfo.playerSlots);
        this._closeContainer(shopInv);
        return purchased;
    }

    _buySeedsFromNpc(npcConfig, itemNames, amount, state) {
        const shopInv = this._openNpcShop(npcConfig, state);
        if (!shopInv) {
            return false;
        }

        let slotInfo = this._getSlotRanges(shopInv);
        let itemSlot = this._findItemSlot(shopInv, slotInfo.containerSlots, itemNames);
        let currentSignature = this._getContainerSignature(shopInv);

        this._logShopDebug('SeedShopOpen', shopInv, slotInfo, itemSlot, itemNames);

        if (itemSlot < 0) {
            if (this._clickNextPage(shopInv, slotInfo.containerSlots, npcConfig?.nextPageName)) {
                const changed = this._waitForContainerChange(currentSignature);
                if (!changed) {
                    Client.waitTick(this._purchase.pageWaitTicks || 6);
                }
                const refreshed = Player.openInventory();
                slotInfo = this._getSlotRanges(refreshed);
                itemSlot = this._findItemSlot(refreshed, slotInfo.containerSlots, itemNames);
                currentSignature = this._getContainerSignature(refreshed);
                this._logShopDebug('SeedShopPage2', refreshed, slotInfo, itemSlot, itemNames);
            }
        }

        if (itemSlot < 0) {
            Chat.log('§c[Supply] Seed item not found in shop pages.');
            this._closeContainer(shopInv);
            return false;
        }

        const purchased = this._buyFromShop(shopInv, itemSlot, itemNames, amount, slotInfo.playerSlots);
        this._closeContainer(shopInv);
        return purchased;
    }

    _buyFromShop(inv, itemSlot, itemNames, amount, playerSlots) {
        let remaining = amount;
        let currentCount = this._countItemsInSlots(inv, playerSlots, itemNames);
        let purchasedAny = false;

        while (remaining > 0) {
            const capacity = this._getInventoryCapacity(itemNames, inv, playerSlots);
            if (capacity <= 0) {
                break;
            }

            inv.quick(itemSlot);
            const result = this._waitForPurchaseDelta(inv, playerSlots, itemNames, currentCount);
            if (result.delta <= 0) {
                Chat.log('§e[Supply] Purchase delta not observed after retries.');
                break;
            }

            purchasedAny = true;
            remaining -= result.delta;
            currentCount = result.newCount;
        }

        return purchasedAny;
    }

    _waitForPurchaseDelta(inv, playerSlots, itemNames, currentCount) {
        const attempts = this._purchase.deltaRetries || 3;
        const waitTicks = this._purchase.deltaWaitTicks || 6;
        let newCount = currentCount;

        for (let i = 0; i < attempts; i++) {
            Client.waitTick(waitTicks);
            newCount = this._countItemsInSlots(inv, playerSlots, itemNames);
            const delta = Math.max(0, newCount - currentCount);
            if (delta > 0) {
                return { delta, newCount };
            }
        }

        return { delta: 0, newCount };
    }

    _logShopDebug(tag, inv, slotInfo, itemSlot, itemNames) {
        const totalSlots = inv.getTotalSlots();
        const map = inv.getMap();
        const mainLen = map?.main?.length || 0;
        const hotbarLen = map?.hotbar?.length || 0;
        const playerLen = slotInfo?.playerSlots?.length || 0;
        const containerLen = slotInfo?.containerSlots?.length || 0;
        const sampleItem = itemSlot >= 0 ? this._safeGetDisplayName(inv.getSlot(itemSlot)) : '';
        const targets = (Array.isArray(itemNames) ? itemNames : [itemNames]).join(', ');
        Chat.log(`§7[Supply][Debug:${tag}] total=${totalSlots} main=${mainLen} hotbar=${hotbarLen} player=${playerLen} container=${containerLen} itemSlot=${itemSlot} itemName=${sampleItem}`);
        Chat.log(`§7[Supply][Debug:${tag}] targets=${targets}`);
    }

    _clickNextPage(inv, containerSlots, nextPageName) {
        if (!nextPageName) {
            return false;
        }
        const nextSlot = this._findItemSlot(inv, containerSlots, [nextPageName]);
        if (nextSlot < 0) {
            return false;
        }
        inv.click(nextSlot);
        Client.waitTick(2);
        return true;
    }

    _getContainerSignature(inv) {
        const title = inv && typeof inv.getContainerTitle === 'function'
            ? String(inv.getContainerTitle() || '')
            : '';
        const syncId = this._getContainerSyncId(inv);
        return `${title}|${inv.getTotalSlots()}|${syncId}`;
    }

    _getContainerSyncId(inv) {
        try {
            if (inv && typeof inv.getCurrentSyncId === 'function') {
                return inv.getCurrentSyncId();
            }
        } catch (error) {
            return 0;
        }
        return 0;
    }

    _waitForContainerChange(prevSignature) {
        const timeout = this._timings.containerWaitTimeout || 100;
        let ticks = 0;
        while (ticks < timeout) {
            Client.waitTick(1);
            if (!Hud.isContainer()) {
                ticks++;
                continue;
            }
            const inv = Player.openInventory();
            if (this._getContainerSignature(inv) !== prevSignature) {
                Client.waitTick(this._timings.chestWaitTicks || 6);
                return true;
            }
            ticks++;
        }
        return false;
    }

    _openNpcShop(npcConfig, state) {
        if (!npcConfig) {
            Chat.log('§c[Supply] NPC config missing.');
            return null;
        }

        this._teleport(npcConfig.teleportCommand);

        if (npcConfig.pos1) {
            this._moveToNpcBlock(npcConfig.pos1, npcConfig.distanceThreshold);
            Client.waitTick(4);
        }
        if (npcConfig.pos2) {
            this._moveToNpcBlock(npcConfig.pos2, npcConfig.distanceThreshold);
            Client.waitTick(4);
        }

        if (!this._interactWithNpc(npcConfig)) {
            return null;
        }

        const timeout = this._timings.containerWaitTimeout || 100;
        let ticks = 0;
        while (!Hud.isContainer()) {
            if (ticks >= timeout) {
                Chat.log('§c[Supply] Shop container timed out.');
                return null;
            }
            Client.waitTick();
            ticks++;
        }

        Client.waitTick(this._timings.chestWaitTicks || 6);
        return Player.openInventory();
    }

    _interactWithNpc(npcConfig) {
        const player = Player.getPlayer();
        const interactPos = npcConfig.interactPos || npcConfig.pos2 || npcConfig.pos1;
        if (!interactPos) {
            return false;
        }

        this._lookAtBlockCenter(player, interactPos);
        Player.getInteractionManager().interact();
        Client.waitTick(this._timings.npcInteractWait || 8);

        this._lookAtBlockCenter(player, interactPos);
        Player.getInteractionManager().interact();
        Client.waitTick(this._timings.npcSecondInteractWait || 8);

        return true;
    }

    _teleport(command) {
        if (!command) {
            return;
        }
        Chat.say(command);
        Client.waitTick(this._timings.teleportWait || 0);
    }

    _returnToBase() {
        this._teleport(this._purchase.returnCommand);
    }

    _lookAtBlockCenter(player, pos) {
        const target = Point3D.from(pos);
        if (!target) {
            return;
        }
        const center = target.toCenter();
        player.lookAt(center.x, center.y, center.z);
    }

    _moveToNpcBlock(pos, distanceThreshold) {
        const threshold = distanceThreshold || this._config.thresholds?.jackoDistance || 2;
        const target = Point3D.from(pos).toCenter();
        const player = Player.getPlayer();
        const timeout = this._timings.moveTimeout || 500;
        const moveTick = this._timings.moveTick || 1;
        let ticks = 0;

        player.lookAt(target.x, target.y, target.z);

        while (player.distanceTo(target.x, target.y, target.z) > threshold) {
            if (ticks >= timeout) {
                break;
            }

            player.lookAt(target.x, target.y, target.z);
            KeyBind.keyBind('key.forward', true);
            KeyBind.keyBind('key.sprint', true);
            Client.waitTick(moveTick);
            ticks += moveTick;
        }

        KeyBind.keyBind('key.forward', false);
        KeyBind.keyBind('key.sprint', false);
    }

    _getChestStatus(chestPos, itemNames, state) {
        const inv = this._openChest(chestPos, state);
        if (!inv) {
            return null;
        }

        const slotInfo = this._getSlotRanges(inv);
        const status = this._getContainerStatus(inv, slotInfo.containerSlots, itemNames);

        this._closeContainer(inv);
        return status;
    }

    _combineChestsStatus(supplyStatus, dumpStatus) {
        const safeSupply = supplyStatus || { missing: 0, foreignCount: 0, isFull: true };
        const safeDump = dumpStatus || { missing: 0, foreignCount: 0, isFull: true };
        const missingSupply = safeSupply.missingEffective !== undefined
            ? safeSupply.missingEffective
            : (safeSupply.missing || 0);
        const missingDump = safeDump.missingEffective !== undefined
            ? safeDump.missingEffective
            : (safeDump.missing || 0);
        const foreignCount = (safeSupply.foreignCount || 0) + (safeDump.foreignCount || 0);
        const rawMissing = (safeSupply.missing || 0) + (safeDump.missing || 0);
        return {
            missingSupply,
            missingDump,
            missing: missingSupply + missingDump,
            rawMissing,
            foreignCount,
            isFull: safeSupply.isFull && safeDump.isFull
        };
    }

    _openChest(chestPos, state) {
        const targetPos = Point3D.from(chestPos);
        if (!this._movementService.moveTo(targetPos, state)) {
            Chat.log('§c[Supply] Failed to reach chest.');
            return null;
        }

        const player = Player.getPlayer();
        Player.getInteractionManager().interactBlock(
            targetPos.x,
            targetPos.y,
            targetPos.z,
            player.getFacingDirection().getName(),
            false
        );

        const timeout = this._timings.containerWaitTimeout || 100;
        let ticks = 0;
        while (!Hud.isContainer()) {
            if (ticks >= timeout) {
                Chat.log('§c[Supply] Chest open timed out.');
                return null;
            }
            Client.waitTick();
            ticks++;
        }

        Client.waitTick(this._timings.chestWaitTicks || 6);
        return Player.openInventory();
    }

    _closeContainer(inv) {
        inv.closeAndDrop();
        Client.waitTick(this._timings.invCloseWaitTicks || 6);
    }

    _getSlotRanges(inv) {
        const map = inv.getMap();
        const totalSlots = inv.getTotalSlots();
        if (map?.main?.length) {
            const mainStart = map.main[0];
            const playerSlots = [...map.main];
            if (map.hotbar?.length) {
                playerSlots.push(...map.hotbar);
            }
            return {
                containerSlots: this._buildRange(0, mainStart),
                playerSlots
            };
        }
        const maxInvSlots = this._config.constants?.maxInventorySlots || 36;
        if (totalSlots >= maxInvSlots) {
            const playerStart = totalSlots - maxInvSlots;
            return {
                containerSlots: this._buildRange(0, playerStart),
                playerSlots: this._buildRange(playerStart, totalSlots)
            };
        }
        return {
            containerSlots: this._buildRange(0, totalSlots),
            playerSlots: []
        };
    }

    _buildRange(start, end) {
        const slots = [];
        for (let i = start; i < end; i++) {
            slots.push(i);
        }
        return slots;
    }

    _getContainerStatus(inv, slotIndexes, itemNames) {
        const targetSet = this._buildTargetSet(itemNames);
        let missing = 0;
        let emptyCount = 0;
        let partialCount = 0;
        let foreignCount = 0;

        for (const slotIndex of slotIndexes) {
            const item = inv.getSlot(slotIndex);
            if (!item || item.isEmpty()) {
                emptyCount++;
                missing += this._maxStack;
                continue;
            }
            if (!this._safeGetDisplayName(item)) {
                foreignCount++;
                continue;
            }
            if (!this._isTargetItem(item, targetSet)) {
                foreignCount++;
                continue;
            }

            const count = item.getCount();
            const maxStack = item.getMaxCount ? item.getMaxCount() : this._maxStack;
            if (count < maxStack) {
                partialCount++;
                missing += (maxStack - count);
            }
        }

        const isFull = emptyCount === 0 && foreignCount === 0 && partialCount <= 1;
        const missingEffective = isFull ? 0 : missing;
        return {
            isFull,
            missing,
            missingEffective,
            emptyCount,
            partialCount,
            foreignCount
        };
    }

    _countItemsInInventory(itemNames) {
        const inv = Player.openInventory();
        const slotInfo = this._getSlotRanges(inv);
        const count = this._countItemsInSlots(inv, slotInfo.playerSlots, itemNames);
        inv.closeAndDrop();
        return count;
    }

    _getInventoryCapacity(itemNames, inv = null, playerSlots = null) {
        const shouldClose = !inv;
        if (!inv) {
            inv = Player.openInventory();
        }

        const slotInfo = playerSlots ? { playerSlots } : this._getSlotRanges(inv);
        const slots = slotInfo.playerSlots || [];
        const targetSet = this._buildTargetSet(itemNames);
        let capacity = 0;

        for (const slotIndex of slots) {
            const item = inv.getSlot(slotIndex);
            if (!item || item.isEmpty()) {
                capacity += this._maxStack;
                continue;
            }

            if (!this._isTargetItem(item, targetSet)) {
                continue;
            }

            const maxStack = item.getMaxCount ? item.getMaxCount() : this._maxStack;
            if (item.getCount() < maxStack) {
                capacity += (maxStack - item.getCount());
            }
        }

        if (shouldClose) {
            inv.closeAndDrop();
        }

        return capacity;
    }

    _findItemSlot(inv, slotIndexes, itemNames) {
        const targetSet = this._buildTargetSet(itemNames);
        for (const slotIndex of slotIndexes) {
            const item = inv.getSlot(slotIndex);
            if (!item || item.isEmpty()) {
                continue;
            }
            if (this._isTargetItem(item, targetSet)) {
                return slotIndex;
            }
        }
        return -1;
    }

    _countItemsInSlots(inv, slotIndexes, itemNames) {
        const targetSet = this._buildTargetSet(itemNames);
        let total = 0;

        for (const slotIndex of slotIndexes) {
            const item = inv.getSlot(slotIndex);
            if (!item || item.isEmpty()) {
                continue;
            }
            if (this._isTargetItem(item, targetSet)) {
                total += item.getCount();
            }
        }

        return total;
    }

    _buildTargetSet(itemNames) {
        const names = Array.isArray(itemNames) ? itemNames : [itemNames];
        const normalized = [];
        for (const name of names) {
            const cleaned = this._normalizeTargetName(name);
            if (cleaned) {
                normalized.push(cleaned);
            }
        }
        return new Set(normalized);
    }

    _isTargetItem(item, targetSet) {
        const displayName = this._safeGetDisplayName(item);
        if (!displayName) {
            return false;
        }
        return targetSet.has(this._normalizeItemName(displayName));
    }

    _safeGetDisplayName(item) {
        if (!item) {
            return '';
        }
        try {
            return item.getName().getString();
        } catch (error) {
            return '';
        }
    }

    _normalizeItemName(name) {
        if (!name) {
            return '';
        }
        const withoutColor = String(name).replace(/§[0-9A-FK-OR]/gi, '');
        return withoutColor.replace(/[^0-9a-zA-Z\u4e00-\u9fa5]+/g, '').toLowerCase();
    }

    _normalizeTargetName(name) {
        if (!name) {
            return '';
        }
        const raw = String(name);
        const withoutNamespace = raw.includes(":") ? raw.split(":").pop() : raw;
        return this._normalizeItemName(withoutNamespace);
    }
}

module.exports = SupplyCheckService;
