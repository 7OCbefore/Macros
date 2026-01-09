/**
 * @file 作物自动售货机.js
 * @description 自动售货机 + Jacko 售卖（架构重构版）
 * @version 2.1.0
 */

const ConfigLoader = require('../core/ConfigLoader.js');
const Point3D = require('../core/Point3D.js');

const VendingInventoryOps = require('./services/VendingInventoryOps.js');
const VendingMovementOps = require('./services/VendingMovementOps.js');
const VendingBasketService = require('./services/VendingBasketService.js');
const VendingAuctionService = require('./services/VendingAuctionService.js');
const VendingJackoService = require('./services/VendingJackoService.js');
const VendingScheduler = require('./services/VendingScheduler.js');
const { DEFAULT_MESSAGES, normalizeName, ActionGuard } = require('./services/VendingUtils.js');

const DEFAULTS = Object.freeze({
    scriptConfig: {
        closeKey: "key.keyboard.x",
        defaultSellAmount: 64,
        defaultAuctionPrice: 800,
        safeMode: true
    },
    timings: {
        splitSwapWait: 8,
        splitClickWait: 3,
        splitRightClickWait: 3,
        splitAdjustWait: 1,
        splitConfirmWait: 8,
        auctionSwapWait: 10,
        auctionCommandWait: 8,
        queueWait: 10,
        moveTick: 1,
        moveTimeout: 500,
        containerWaitTimeout: 100,
        containerOpenWait: 4,
        basketSwapWait: 6,
        basketQuickWait: 14,
        jackoInteractWait: 14,
        jackoSecondInteractWait: 6,
        teleportWait: 134,
        postSellWait: 34,
        scheduleAfterSellWait: 168,
        scheduleTickInterval: 2134,
        adMinDelay: 60,
        adMaxDelay: 1666
    },
    thresholds: {
        moveDistance: 5,
        jackoDistance: 1
    },
    jackoMessages: DEFAULT_MESSAGES
});

class VendingState {
    constructor() {
        this.isProcessingQueue = false;
        this.isJackoMode = false;
        this.queue = [];
        this.defaultAuctionPriceDynamic = null;
        this.scheduleCompensationTicks = 0;
        this.nextCheckTicks = 0;
    }
}

class VendingApplication {
    constructor() {
        this._config = null;
        this._state = new VendingState();
        this._listeners = {};
        this._cropList = [];
        this._cropMap = new Map();
        this._cropNameMap = new Map();
        this._guard = null;
        this._inventoryOps = null;
        this._movementOps = null;
        this._basketService = null;
        this._auctionService = null;
        this._jackoService = null;
        this._scheduler = null;
    }

    initialize() {
        try {
            this._loadConfig();
            this._buildCropIndex();
            this._initializeServices();
            this._registerEvents();
            this._announceStartup();
            this._scheduler.initialize();
            return true;
        } catch (error) {
            Chat.log(`§c[启动失败] ${error.message}`);
            Chat.log(`§7${error.stack}`);
            return false;
        }
    }

    shutdown() {
        for (const key in this._listeners) {
            JsMacros.off(this._listeners[key]);
        }
        this._listeners = {};
        Chat.log('§a自动售货机下线了');
    }

    _loadConfig() {
        const rawConfig = ConfigLoader.load('../config/vendingConfig.json');
        if (!rawConfig) {
            throw new Error('Failed to load vendingConfig.json');
        }

        const scriptConfig = Object.assign({}, DEFAULTS.scriptConfig, rawConfig.scriptConfig || {});
        const timings = Object.assign({}, DEFAULTS.timings, rawConfig.timings || {});
        const thresholds = Object.assign({}, DEFAULTS.thresholds, rawConfig.thresholds || {});
        const jackoData = Object.assign({}, rawConfig.jackoData || {});

        const safeMode = Boolean(scriptConfig.safeMode || scriptConfig.dryRun);
        scriptConfig.safeMode = safeMode;
        scriptConfig.dryRun = safeMode;

        jackoData.sellTime = Object.assign({ hour: 7, minute: 0 }, jackoData.sellTime || {});
        jackoData.teleportCommand = jackoData.teleportCommand || "/balloon yellow-balloon";
        jackoData.returnCommand = jackoData.returnCommand || "/realm tp 7OCbefore";
        jackoData.messages = (jackoData.messages && jackoData.messages.length > 0)
            ? jackoData.messages
            : DEFAULTS.jackoMessages;

        if (!jackoData.pos1 || !jackoData.pos2) {
            throw new Error('jackoData.pos1/pos2 missing in config');
        }

        if (!rawConfig.cropData || Object.keys(rawConfig.cropData).length === 0) {
            throw new Error('cropData missing in config');
        }

        jackoData.pos1Point = Point3D.from(jackoData.pos1);
        jackoData.pos2Point = Point3D.from(jackoData.pos2);
        const interactPos = Array.isArray(jackoData.interactPos) ? jackoData.interactPos : jackoData.pos2;
        jackoData.interactPosPoint = Point3D.from(interactPos);

        this._config = {
            scriptConfig,
            timings,
            thresholds,
            jackoData,
            cropData: rawConfig.cropData
        };

        this._validateConfig();
    }

    _validateConfig() {
        const config = this._config;
        if (!config || !config.scriptConfig) {
            throw new Error('scriptConfig missing in config');
        }

        if (typeof config.scriptConfig.closeKey !== 'string') {
            throw new Error('scriptConfig.closeKey must be a string');
        }

        if (typeof config.scriptConfig.safeMode !== 'boolean') {
            throw new Error('scriptConfig.safeMode must be a boolean');
        }

        if (!Number.isFinite(config.scriptConfig.defaultSellAmount) || config.scriptConfig.defaultSellAmount <= 0) {
            throw new Error('scriptConfig.defaultSellAmount must be a positive number');
        }

        if (!Number.isFinite(config.scriptConfig.defaultAuctionPrice) || config.scriptConfig.defaultAuctionPrice <= 0) {
            throw new Error('scriptConfig.defaultAuctionPrice must be a positive number');
        }

        if (!config.jackoData || !Array.isArray(config.jackoData.pos1) || !Array.isArray(config.jackoData.pos2)) {
            throw new Error('jackoData.pos1/pos2 must be coordinate arrays');
        }

        if (config.jackoData.interactPos && (!Array.isArray(config.jackoData.interactPos) || config.jackoData.interactPos.length < 3)) {
            throw new Error('jackoData.interactPos must be [x,y,z]');
        }


        if (!config.jackoData.sellTime || !Number.isFinite(config.jackoData.sellTime.hour)) {
            throw new Error('jackoData.sellTime.hour must be a number');
        }

        if (!Number.isFinite(config.jackoData.sellTime.minute)) {
            throw new Error('jackoData.sellTime.minute must be a number');
        }

        if (!config.cropData || Object.keys(config.cropData).length === 0) {
            throw new Error('cropData missing in config');
        }

        for (const cropKey in config.cropData) {
            const crop = config.cropData[cropKey];
            if (!crop || typeof crop.name !== 'string' || typeof crop.basket !== 'string') {
                throw new Error(`cropData.${cropKey} requires name and basket`);
            }
            if (!Array.isArray(crop.chestPos) || crop.chestPos.length < 3) {
                throw new Error(`cropData.${cropKey}.chestPos must be [x,y,z]`);
            }
            if (!Number.isFinite(crop.sellForJackoPrice)) {
                throw new Error(`cropData.${cropKey}.sellForJackoPrice must be a number`);
            }
        }
    }

    _buildCropIndex() {
        this._cropList = [];
        this._cropMap = new Map();
        this._cropNameMap = new Map();

        for (const cropKey in this._config.cropData) {
            const cropInfo = Object.assign({}, this._config.cropData[cropKey]);
            cropInfo.chestPos = Point3D.from(cropInfo.chestPos);
            this._cropList.push(cropInfo);
            this._cropMap.set(cropInfo.name, cropInfo);
            this._cropNameMap.set(normalizeName(cropInfo.name), cropInfo);
        }
    }

    _initializeServices() {
        this._guard = new ActionGuard(this._config.scriptConfig);
        this._inventoryOps = new VendingInventoryOps(this._config.timings);
        this._movementOps = new VendingMovementOps(this._config.timings, this._config.thresholds, this._guard);
        this._basketService = new VendingBasketService(this._config, this._inventoryOps, this._movementOps, this._guard);
        this._auctionService = new VendingAuctionService(
            this._config,
            this._state,
            this._inventoryOps,
            this._basketService,
            this._cropMap,
            this._guard
        );
        this._jackoService = new VendingJackoService(
            this._config,
            this._state,
            this._inventoryOps,
            this._movementOps,
            this._basketService,
            this._cropList,
            this._cropMap,
            this._cropNameMap,
            this._guard
        );
        this._scheduler = new VendingScheduler(
            this._config,
            this._state,
            this._jackoService,
            () => this._processQueue()
        );
    }

    _registerEvents() {
        this._listeners.key = JsMacros.on("Key", JavaWrapper.methodToJava((event) => {
            try {
                if (event.key === this._config.scriptConfig.closeKey) {
                    this.shutdown();
                    JavaWrapper.stop();
                }
            } catch (error) {
                Chat.log(`§c[KeyError] ${error.message}`);
            }
        }));

        this._listeners.msg = JsMacros.on('RecvMessage', JavaWrapper.methodToJava((event) => {
            try {
                this._handleSaleMessage(event);
            } catch (error) {
                Chat.log(`§c[MessageError] ${error.message}`);
            }
        }));

        this._listeners.tick = JsMacros.on('Tick', JavaWrapper.methodToJava(() => {
            try {
                this._scheduler.tick();
            } catch (error) {
                Chat.log(`§c[ScheduleError] ${error.message}`);
            }
        }));
    }

    _announceStartup() {
        Chat.log('§a自动售货机(光顾Jacko版)(架构优化版)已上线');
        Chat.log('§7按 X 停止脚本');
        if (this._guard && this._guard.isSafeMode()) {
            Chat.log('[DryRun] Safe mode enabled: no movement or interactions.');
        }
    }

    _handleSaleMessage(event) {
        const message = event.text?.getString();
        if (!message || !message.includes("bought your")) {
            return;
        }

        const parsed = this._parseSaleMessage(message);
        const amount = parsed.amount || this._config.scriptConfig.defaultSellAmount;
        const price = parsed.price || this._config.scriptConfig.defaultAuctionPrice;
        let cropName = parsed.cropName;

        if (!cropName) {
            cropName = this._findCropFromMessage(message);
        }

        if (this._state.defaultAuctionPriceDynamic === null && price) {
            this._state.defaultAuctionPriceDynamic = price;
            Chat.log(`§a首次监听到的价格：${price} rubies，已设置为默认价格`);
        }

        if (!cropName) {
            return;
        }

        this._state.queue.push({ crop: cropName, amount });
        if (!this._state.isJackoMode && !this._state.isProcessingQueue) {
            this._processQueue();
        }
    }

    _parseSaleMessage(message) {
        const match = message.match(/bought your (\d+)x ([\w\s]+) for (\d+) rubies/);
        if (!match) {
            return { cropName: "", amount: 0, price: 0 };
        }

        return {
            amount: parseInt(match[1], 10),
            cropName: match[2].trim(),
            price: parseInt(match[3], 10)
        };
    }

    _findCropFromMessage(message) {
        for (const cropInfo of this._cropList) {
            if (message.includes(cropInfo.name)) {
                return cropInfo.name;
            }
        }
        return "";
    }

    _processQueue() {
        if (this._state.isProcessingQueue || this._state.isJackoMode) {
            return;
        }

        this._state.isProcessingQueue = true;
        try {
            while (this._state.queue.length > 0 && !this._state.isJackoMode) {
                const cropMessage = this._state.queue.shift();
                this._auctionService.handleCropSold(cropMessage.crop, cropMessage.amount);
                Client.waitTick(this._config.timings.queueWait);
            }
        } finally {
            this._state.isProcessingQueue = false;
        }
    }
}

try {
    const app = new VendingApplication();
    if (!app.initialize()) {
        Chat.log('§c[System] Application failed to start');
        throw new Error('Initialization failed');
    }
} catch (error) {
    Chat.log('§c[Critical Error] ' + error.message);
    Chat.log('§7' + error.stack);
}

