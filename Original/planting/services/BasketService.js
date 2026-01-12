/**
 * @file BasketService.js
 * @description Handles basket retrieval and opening
 */

class BasketService {
    constructor(config, logger, inventoryService, movementService) {
        this._config = config;
        this._logger = logger;
        this._inventoryService = inventoryService;
        this._movementService = movementService;
    }

    getBasketFromChest(basketName, chestPos) {
        this._movementService.moveToBlock(chestPos[0], chestPos[1], chestPos[2]);

        const player = Player.getPlayer();
        Player.getInteractionManager().interactBlock(
            chestPos[0],
            chestPos[1],
            chestPos[2],
            player.getFacingDirection().getName(),
            false
        );

        const timeout = this._config.timings.containerWaitTimeout;
        let ticks = 0;
        while (!Hud.isContainer()) {
            if (ticks >= timeout) {
                this._logger.warn('Chest open timed out.', 'Basket');
                return false;
            }
            Client.waitTick();
            ticks++;
        }

        Client.waitTick(this._config.timings.containerOpenWait);
        const chestInventory = Player.openInventory();
        const basketSlots = this._inventoryService.findItemSlotsByName(chestInventory, basketName);

        for (const slot of basketSlots) {
            const slotItem = chestInventory.getSlot(slot);
            if (slotItem && slotItem.getCount() === 64) {
                chestInventory.quick(slot);
                Client.waitTick(this._config.timings.containerOpenWait);
                this._logger.info(`Picked up full stack of ${basketName}.`, 'Basket');
                chestInventory.closeAndDrop();
                Client.waitTick(this._config.timings.containerOpenWait);
                return true;
            }
        }

        this._logger.warn(`No full stack found for ${basketName}.`, 'Basket');
        chestInventory.close();
        return false;
    }

    openBasketInInventory(basketName) {
        const inventory = Player.openInventory();
        const basketSlots = this._inventoryService.findItemSlotsByName(inventory, basketName);

        if (basketSlots.length === 0) {
            this._logger.warn(`Basket not found in inventory: ${basketName}`, 'Basket');
            return false;
        }

        const basketSlot = basketSlots[0];
        inventory.swap(basketSlot, 1);
        Client.waitTick(this._config.timings.basketSwapWait);
        inventory.quick(0);
        Client.waitTick(this._config.timings.basketQuickWait);

        return true;
    }
}

module.exports = BasketService;
