const { getRandomNumber } = require('./VendingUtils.js');

class VendingJackoService {
    constructor(config, state, inventoryOps, movementOps, basketService, cropList, cropMap, cropNameMap, guard) {
        this._config = config;
        this._state = state;
        this._inventory = inventoryOps;
        this._movement = movementOps;
        this._basketService = basketService;
        this._cropList = cropList;
        this._cropMap = cropMap;
        this._cropNameMap = cropNameMap;
        this._jacko = config.jackoData;
        this._messages = config.jackoData.messages;
        this._guard = guard;
    }

    sellToJacko() {
        if (this._state.isJackoMode) {
            return false;
        }

        try {
            Chat.log("Starting Jacko sale flow...");
            this._state.isJackoMode = true;

            const targetAmount = 64 * 3;
            if (!this._checkCropQuantities(targetAmount)) {
                if (!this._replenishCropBaskets(targetAmount)) {
                    this._returnToRealm();
                    return false;
                }
            }

            this._teleportToBalloon();
            Client.waitTick(4);

            if (!this._moveToJacko()) {
                this._returnToRealm();
                return false;
            }
            Client.waitTick(4);

            if (!this._interactWithJacko()) {
                this._returnToRealm();
                return false;
            }
            Client.waitTick(4);

            if (!this._processJackoInventory()) {
                this._returnToRealm();
                return false;
            }

            Chat.log("Jacko sale complete.");
            this._returnToRealm();
            return true;
        } catch (error) {
            Chat.log(`Jacko sale error: ${error.message}`);
            this._returnToRealm();
            return false;
        } finally {
            this._state.isJackoMode = false;
        }
    }

    _checkCropQuantities(targetAmount) {
        const inventory = Player.openInventory();

        for (const cropInfo of this._cropList) {
            const totalCount = this._inventory.countItemByName(inventory, cropInfo.name);
            if (totalCount < targetAmount) {
                Chat.log(`Inventory low for ${cropInfo.name} (${totalCount}/${targetAmount}); refill needed.`);
                return false;
            }
        }

        Chat.log('Inventory has enough crops; no refill needed.');
        return true;
    }

    _replenishCropBaskets(targetAmount) {
        for (const cropInfo of this._cropList) {
            const inventory = Player.openInventory();
            const totalCount = this._inventory.countItemByName(inventory, cropInfo.name);

            if (totalCount < targetAmount) {
                Chat.log(`Refilling basket for ${cropInfo.name}...`);
                if (!this._basketService.pullBasket(cropInfo.basket, cropInfo.chestPos)) {
                    Chat.log(`Failed to fetch basket for ${cropInfo.name}; aborting Jacko flow.`);
                    return false;
                }

                if (!this._basketService.openBasketInInventory(cropInfo.basket)) {
                    Chat.log(`Basket ${cropInfo.basket} not found in inventory.`);
                    return false;
                }

                Chat.log(`Refilled and opened basket for ${cropInfo.name}.`);
            }
        }

        return true;
    }

    _teleportToBalloon() {
        if (this._guard && this._guard.isSafeMode()) {
            Chat.log(`[DryRun] Teleport via ${this._jacko.teleportCommand}`);
            return;
        }
        Chat.say(this._jacko.teleportCommand);
        Client.waitTick(this._config.timings.teleportWait);
    }

    _returnToRealm() {
        if (this._guard && this._guard.isSafeMode()) {
            Chat.log(`[DryRun] Return via ${this._jacko.returnCommand}`);
            return;
        }
        Client.waitTick(this._config.timings.postSellWait);
        Chat.say(this._jacko.returnCommand);
        Client.waitTick(this._config.timings.teleportWait);
    }

    _moveToJacko() {
        const pos1 = this._jacko.pos1Point;
        const pos2 = this._jacko.pos2Point;

        if (!this._movement.moveTo(pos1, this._config.thresholds.jackoDistance)) {
            return false;
        }
        Client.waitTick(this._config.timings.jackoSecondInteractWait);

        if (!this._movement.moveTo(pos2, this._config.thresholds.jackoDistance)) {
            return false;
        }
        Client.waitTick(this._config.timings.jackoSecondInteractWait);
        return true;
    }

    _interactWithJacko() {
        if (this._guard && this._guard.isSafeMode()) {
            Chat.log("[DryRun] Interact with Jacko");
            return true;
        }

        const jackoEntity = World.getEntities(2, "clock")[0];
        if (!jackoEntity) {
            Chat.log("Jacko NPC not found.");
            return false;
        }
        Player.getInteractionManager().interactEntity(jackoEntity, false);
        Client.waitTick(this._config.timings.jackoInteractWait);
        Player.getInteractionManager().interactEntity(jackoEntity, false);
        Client.waitTick(this._config.timings.jackoSecondInteractWait);
        return true;
    }

    _processJackoInventory() {
        if (this._guard && this._guard.isSafeMode()) {
            Chat.log("[DryRun] Process Jacko inventory");
            return true;
        }

        if (!this._waitForContainer()) {
            Chat.log("Failed to open Jacko UI.");
            return false;
        }

        const jackoInv = Player.openInventory();
        const itemSlots = this._findItemByConditions(jackoInv);

        if (itemSlots.length === 0) {
            Chat.log("No sellable items in Jacko inventory.");
            jackoInv.close();
            return false;
        }

        for (const slot of itemSlots) {
            jackoInv.quick(slot);
        }
        jackoInv.closeAndDrop();
        Chat.log("Sold items from Jacko inventory.");
        return true;
    }

    _waitForContainer() {
        let ticks = 0;
        while (!Hud.isContainer() && ticks < this._config.timings.containerWaitTimeout) {
            Client.waitTick(1);
            ticks++;
        }
        return Hud.isContainer();
    }

    _findItemByConditions(inventory) {
        const totalSlots = inventory.getTotalSlots();
        const matchedSlots = [];

        for (let i = 0; i < totalSlots; i++) {
            const item = inventory.getSlot(i);
            if (!item || typeof item.getName !== 'function') continue;

            const rawName = item.getName().getString();
            const itemName = this._inventory.normalizeName(rawName);
            const stackSize = item.getCount();
            const cropInfo = this._cropNameMap.get(itemName);

            if (cropInfo && stackSize === cropInfo.sellForJackoPrice) {
                matchedSlots.push(i);
                const delay = getRandomNumber(
                    this._config.timings.adMinDelay,
                    this._config.timings.adMaxDelay
                );
                const randomMessage = this._messages[getRandomNumber(0, this._messages.length - 1)];

                if (this._guard && this._guard.isSafeMode()) {
                    this._state.scheduleCompensationTicks = 0;
                    Chat.log(`[DryRun] Ad message: ${randomMessage}`);
                } else {
                    this._state.scheduleCompensationTicks = delay;
                    Client.waitTick(delay);
                    Chat.say(randomMessage);
                }
            }

            if (itemName.includes("Golden")) {
                matchedSlots.push(i);
            }
        }

        return matchedSlots;
    }
}

module.exports = VendingJackoService;
