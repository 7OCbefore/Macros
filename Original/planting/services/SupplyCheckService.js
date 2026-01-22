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

        let trips = 0;
        while (trips < this._maxTrips) {
            const status = this._getChestStatus(chestConfig.supply, itemNames, state);
            if (!status) {
                return false;
            }
            if (status.foreignCount > 0) {
                Chat.log(`§c[Supply] ${label} chest contains non-target items.`);
                return false;
            }
            if (status.isFull) {
                Chat.log(`§a[Supply] ${label} chest is full.`);
                return true;
            }

            const capacity = this._getInventoryCapacity(itemNames);
            if (capacity <= 0) {
                Chat.log(`§c[Supply] Inventory has no capacity for ${label}.`);
                return false;
            }

            const purchaseAmount = Math.min(status.missing, capacity);
            Chat.log(`§e[Supply] ${label} missing ${status.missing}. Buying ${purchaseAmount}...`);

            if (!purchaseHandler(itemNames, purchaseAmount, state)) {
                Chat.log(`§c[Supply] Failed to purchase ${label}.`);
                return false;
            }

            this._inventoryService.transferToChest(
                Point3D.from(chestConfig.supply),
                itemNames,
                this._movementService
            );

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

        if (itemSlot < 0) {
            if (this._clickNextPage(shopInv, slotInfo.containerSlots, npcConfig?.nextPageName)) {
                Client.waitTick(6);
                slotInfo = this._getSlotRanges(shopInv);
                itemSlot = this._findItemSlot(shopInv, slotInfo.containerSlots, itemNames);
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
            Client.waitTick(1);

            const newCount = this._countItemsInSlots(inv, playerSlots, itemNames);
            const delta = Math.max(0, newCount - currentCount);
            if (delta <= 0) {
                break;
            }

            purchasedAny = true;
            remaining -= delta;
            currentCount = newCount;
        }

        return purchasedAny;
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

    _openNpcShop(npcConfig, state) {
        if (!npcConfig) {
            Chat.log('§c[Supply] NPC config missing.');
            return null;
        }

        this._teleport(npcConfig.teleportCommand);

        if (npcConfig.pos1) {
            this._movementService.moveTo(Point3D.from(npcConfig.pos1), state);
            Client.waitTick(4);
        }
        if (npcConfig.pos2) {
            this._movementService.moveTo(Point3D.from(npcConfig.pos2), state);
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

    _lookAtBlockCenter(player, pos) {
        const target = Point3D.from(pos);
        if (!target) {
            return;
        }
        const center = target.toCenter();
        player.lookAt(center.x, center.y, center.z);
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
            return {
                containerSlots: this._buildRange(0, mainStart),
                playerSlots: [...map.main]
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
        return {
            isFull,
            missing,
            emptyCount,
            partialCount,
            foreignCount
        };
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
            const cleaned = this._normalizeName(name);
            if (cleaned) {
                normalized.push(cleaned);
            }
        }
        return new Set(normalized);
    }

    _isTargetItem(item, targetSet) {
        const displayName = item.getName?.().getString?.() || '';
        const itemId = item.getItemId?.() || '';
        return targetSet.has(this._normalizeName(displayName)) || targetSet.has(this._normalizeName(itemId));
    }

    _normalizeName(name) {
        if (!name) {
            return '';
        }
        const withoutColor = String(name).replace(/§[0-9A-FK-OR]/gi, '');
        return withoutColor.replace(/[^0-9a-zA-Z\u4e00-\u9fa5]+/g, '').toLowerCase();
    }
}

module.exports = SupplyCheckService;
