/**
 * @file JackoService.js
 * @description Handles Jacko selling flows and scheduling data
 */

const Point3D = require('../../core/Point3D.js');

class JackoService {
    constructor(config, logger, state, inventoryService, movementService, basketService, queueService, cropRegistry) {
        this._config = config;
        this._logger = logger;
        this._state = state;
        this._inventoryService = inventoryService;
        this._movementService = movementService;
        this._basketService = basketService;
        this._queueService = queueService;
        this._cropRegistry = cropRegistry;
    }

    getBossBarInfo() {
        const bossbarInfo = World.getBossBars();
        if (!bossbarInfo) {
            this._logger.warn('Bossbar info is empty.', 'Scheduler');
            return null;
        }

        const bossbarString = typeof bossbarInfo === 'string' ? bossbarInfo : String(bossbarInfo);
        const timeMatch = bossbarString.match(/(\d{1,2}):(\d{2}) (AM|PM)/i);

        if (!timeMatch || !timeMatch[0]) {
            this._logger.warn('No time found in bossbar.', 'Scheduler');
            return null;
        }

        return {
            raw: timeMatch[0],
            hours: parseInt(timeMatch[1], 10),
            minutes: parseInt(timeMatch[2], 10),
            ampm: timeMatch[3].toUpperCase()
        };
    }

    sellToJacko() {
        try {
            this._logger.info('Starting Jacko selling flow.', 'Jacko');
            this._state.isJackoMode = true;

            const requiredAmount = 64 * 3;
            const hasSellableItems = this._hasSellableItems();
            if (!this._checkCropQuantities(requiredAmount)) {
                if (!hasSellableItems) {
                    if (!this._replenishCropBaskets(requiredAmount)) {
                        this._returnToBase();
                        return false;
                    }
                } else {
                    this._logger.info('Proceeding with available sellable items.', 'Jacko');
                }
            }

            this._teleportToBalloon();
            Client.waitTick(4);

            this._moveToJacko();
            Client.waitTick(4);

            if (!this._interactWithJacko()) {
                this._returnToBase();
                return false;
            }
            Client.waitTick(4);

            if (!this._processJackoInventory()) {
                this._returnToBase();
                return false;
            }
            Client.waitTick(5);

            this._logger.info('Jacko selling completed.', 'Jacko');
            this._returnToBase();
            this._state.isJackoMode = false;
            this._queueService.processQueue();
            return true;
        } catch (error) {
            this._logger.error(`Jacko flow failed: ${error.message}`, 'Jacko');
            this._returnToBase();
            this._state.isJackoMode = false;
            this._queueService.processQueue();
            return false;
        }
    }

    _checkCropQuantities(targetAmount) {
        const inventory = Player.openInventory();

        const cropIds = this._cropRegistry.getCropIds();
        for (const cropId of cropIds) {
            const cropName = this._cropRegistry.getItemName(cropId, 'star3');
            const total = this._inventoryService.countItemsByName(inventory, cropName);
            if (total < targetAmount) {
                this._logger.warn(`Not enough ${cropName} (${total}/${targetAmount}).`, 'Jacko');
                return false;
            }
        }

        this._logger.info('All crop quantities are sufficient.', 'Jacko');
        return true;
    }

    _hasSellableItems() {
        const inventory = Player.openInventory();
        const totalSlots = inventory.getTotalSlots();

        for (let i = 0; i < totalSlots; i++) {
            const item = inventory.getSlot(i);
            if (!item) {
                continue;
            }

            const displayName = item.getName().getString();
            const parsed = this._cropRegistry.parseItemName(displayName);
            if (parsed.cropId && this._cropRegistry.canSellQuality(parsed.quality)) {
                return true;
            }
        }

        return false;
    }

    _replenishCropBaskets(requiredAmount) {
        const cropIds = this._cropRegistry.getCropIds();
        for (const cropId of cropIds) {
            const cropName = this._cropRegistry.getItemName(cropId, 'star3');
            const basketInfo = this._cropRegistry.getBasketInfo(cropId, 'star3');
            if (!basketInfo) {
                continue;
            }

            const inventory = Player.openInventory();
            const total = this._inventoryService.countItemsByName(inventory, cropName);

            if (total >= requiredAmount) {
                continue;
            }

            this._logger.info(`Restocking ${cropName} basket.`, 'Jacko');

            if (!this._basketService.getBasketFromChest(basketInfo.name, basketInfo.chestPos)) {
                this._logger.warn(`Failed to fetch ${cropName} basket.`, 'Jacko');
                return false;
            }

            if (!this._basketService.openBasketInInventory(basketInfo.name)) {
                this._logger.warn(`Failed to open ${cropName} basket.`, 'Jacko');
                return false;
            }

            this._logger.info(`Basket restock complete for ${cropName}.`, 'Jacko');
        }

        return true;
    }

    _teleportToBalloon() {
        Chat.say(this._config.jackoData.teleportCommand);
        Client.waitTick(this._config.timings.teleportWait);
    }

    _moveToJacko() {
        this._movementService.moveToBlock(
            this._config.jackoData.pos1[0],
            this._config.jackoData.pos1[1],
            this._config.jackoData.pos1[2],
            this._config.thresholds.jackoDistance
        );
        Client.waitTick(6);
        this._movementService.moveToBlock(
            this._config.jackoData.pos2[0],
            this._config.jackoData.pos2[1],
            this._config.jackoData.pos2[2],
            this._config.thresholds.jackoDistance
        );
        Client.waitTick(6);
    }

    _interactWithJacko() {
        const player = Player.getPlayer();
        const interactPos = this._config.jackoData.interactPos || this._config.jackoData.pos2;

        this._lookAtBlockCenter(player, interactPos);
        Player.getInteractionManager().interact();
        Client.waitTick(this._config.timings.jackoInteractWait);
        this._lookAtBlockCenter(player, interactPos);
        Player.getInteractionManager().interact();
        Client.waitTick(this._config.timings.jackoSecondInteractWait);

        if (!Hud.isContainer()) {
            this._logger.warn('Jacko container not found.', 'Jacko');
            return false;
        }
        return true;
    }

    _lookAtBlockCenter(player, pos) {
        const target = Point3D.from(pos);
        if (!target) {
            this._logger.warn('Invalid look target position.', 'Jacko');
            return;
        }
        const center = target.toCenter();
        player.lookAt(center.x, center.y, center.z);
    }

    _processJackoInventory() {
        const timeout = this._config.timings.containerWaitTimeout;
        let ticks = 0;
        while (!Hud.isContainer()) {
            if (ticks >= timeout) {
                this._logger.warn('Jacko container timed out.', 'Jacko');
                return false;
            }
            Client.waitTick();
            ticks++;
        }

        const jackoInventory = Player.openInventory();
        const result = this._findSellSlots(jackoInventory);

        if (result.slots.length === 0) {
            this._logger.info('No sellable items found in Jacko inventory.', 'Jacko');
            jackoInventory.close();
            return false;
        }

        for (const slot of result.slots) {
            jackoInventory.quick(slot);
        }

        jackoInventory.closeAndDrop();
        this._state.adDelayTicks = result.adDelayTicks;
        this._logger.info('Sold items from Jacko inventory.', 'Jacko');
        return true;
    }

    _findSellSlots(inventory) {
        const totalSlots = inventory.getTotalSlots();
        const matchedSlots = [];
        const messages = this._config.jackoData.messages || [];
        let adDelayTicks = 0;

        for (let i = 0; i < totalSlots; i++) {
            const item = inventory.getSlot(i);
            if (!item) {
                continue;
            }

            const displayName = item.getName().getString();
            const stackSize = item.getCount();
            const parsed = this._cropRegistry.parseItemName(displayName);
            if (!parsed.cropId || !this._cropRegistry.canSellQuality(parsed.quality)) {
                continue;
            }

            const expectedPrice = this._cropRegistry.getJackoPrice(parsed.cropId, parsed.quality);
            if (typeof expectedPrice === 'number' && stackSize !== expectedPrice) {
                continue;
            }

            matchedSlots.push(i);
            adDelayTicks = this._getRandomNumber(
                this._config.timings.adMinDelay,
                this._config.timings.adMaxDelay
            );
            if (messages.length > 0) {
                Client.waitTick(adDelayTicks);
                const randomMessage = messages[this._getRandomNumber(0, messages.length - 1)];
                // Chat.say(randomMessage);
                // Advertise the crop TODO
            }

        }

        return { slots: matchedSlots, adDelayTicks };
    }

    _getRandomNumber(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    _returnToBase() {
        Client.waitTick(this._config.timings.postSellWait);
        Chat.say(this._config.jackoData.returnCommand);
        Client.waitTick(this._config.timings.teleportWait);
        this._state.isJackoMode = false;
    }
}

module.exports = JackoService;
