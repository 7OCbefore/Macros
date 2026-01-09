class VendingBasketService {
    constructor(config, inventoryOps, movementOps, guard) {
        this._config = config;
        this._timings = config.timings;
        this._thresholds = config.thresholds;
        this._inventory = inventoryOps;
        this._movement = movementOps;
        this._guard = guard;
    }

    pullBasket(basketName, chestPos) {
        if (!basketName || !chestPos) return false;

        if (this._guard && this._guard.isSafeMode()) {
            Chat.log(`[DryRun] Pull basket ${basketName} from ${chestPos}`);
            return true;
        }

        if (!this._movement.moveTo(chestPos, this._thresholds.moveDistance)) {
            Chat.log(`Failed to reach chest for ${basketName}.`);
            return false;
        }

        const player = Player.getPlayer();
        Player.getInteractionManager().interactBlock(
            chestPos.x,
            chestPos.y,
            chestPos.z,
            player.getFacingDirection().getName(),
            false
        );

        if (!this._waitForContainer()) {
            Chat.log(`Failed to open chest for ${basketName}.`);
            return false;
        }

        Client.waitTick(this._timings.containerOpenWait);
        const chestInventory = Player.openInventory();
        const basketSlots = this._inventory.findItemSlotsByName(chestInventory, basketName);

        for (const slot of basketSlots) {
            const slotItem = chestInventory.getSlot(slot);
            if (slotItem && slotItem.getCount() === 64) {
                chestInventory.quick(slot);
                Client.waitTick(this._timings.containerOpenWait);
                Chat.log(`Pulled ${basketName} from chest.`);
                chestInventory.closeAndDrop();
                Client.waitTick(this._timings.containerOpenWait);
                return true;
            }
        }

        Chat.log(`No full stack of ${basketName} found in chest.`);
        chestInventory.close();
        return false;
    }

    openBasketInInventory(basketName) {
        if (this._guard && this._guard.isSafeMode()) {
            Chat.log(`[DryRun] Open basket ${basketName}`);
            return true;
        }

        const inventory = Player.openInventory();
        const basketSlots = this._inventory.findItemSlotsByName(inventory, basketName);

        if (basketSlots.length === 0) {
            Chat.log(`Basket ${basketName} not found in inventory.`);
            return false;
        }

        const basketSlot = basketSlots[0];
        inventory.swap(basketSlot, 1);
        Client.waitTick(this._timings.basketSwapWait);
        inventory.quick(0);
        Client.waitTick(this._timings.basketQuickWait);
        return true;
    }

    _waitForContainer() {
        let ticks = 0;
        while (!Hud.isContainer() && ticks < this._timings.containerWaitTimeout) {
            Client.waitTick(1);
            ticks++;
        }
        return Hud.isContainer();
    }
}

module.exports = VendingBasketService;
