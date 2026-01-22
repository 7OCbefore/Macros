/**
 * @file FarmState.js
 * @description State management for farming operations
 * @version 3.0.0
 */

const StatePhase = Object.freeze({
    GET_POS_CHEST: 'GET_POS_CHEST',
    GET_POS_START: 'GET_POS_START',
    MODE_SELECT: 'MODE_SELECT',
    EXECUTING: 'EXECUTING'
});

const OperationMode = Object.freeze({
    SOIL: 'SOIL',
    FERTILIZE: 'FERTILIZE',
    PLANT: 'PLANT',
    WATER: 'WATER'
});

class FarmState {
    constructor() {
        this._isPaused = false;
        this._isRunning = false;
        this._phase = StatePhase.GET_POS_CHEST;
        this._mode = null;
        this._seedChestPos = null;
        this._seedDumpPos = null;
        this._activeCrop = null;
        this._startPos = null;
        this._errorCount = 0;
        this._resumeCheckPending = false;
        this._statistics = {
            blocksProcessed: 0,
            itemsUsed: 0,
            refillCount: 0,
            startTime: null,
            endTime: null
        };
    }

    get isPaused() { return this._isPaused; }
    get isRunning() { return this._isRunning; }
    get phase() { return this._phase; }
    get mode() { return this._mode; }
    get seedChestPos() { return this._seedChestPos; }
    get seedDumpPos() { return this._seedDumpPos; }
    get activeCrop() { return this._activeCrop; }
    get startPos() { return this._startPos; }
    get errorCount() { return this._errorCount; }
    get statistics() { return { ...this._statistics }; }

    pause() {
        this._isPaused = true;
    }

    resume() {
        this._isPaused = false;
        this._resumeCheckPending = true;
    }

    togglePause() {
        const wasPaused = this._isPaused;
        this._isPaused = !this._isPaused;
        if (wasPaused && !this._isPaused) {
            this._resumeCheckPending = true;
        }
        return this._isPaused;
    }

    consumeResumeCheck() {
        if (!this._resumeCheckPending) {
            return false;
        }
        this._resumeCheckPending = false;
        return true;
    }

    startExecution(mode) {
        if (!OperationMode[mode]) {
            throw new Error(`Invalid operation mode: ${mode}`);
        }
        this._isRunning = true;
        this._mode = mode;
        this._phase = StatePhase.EXECUTING;
        this._statistics.startTime = Date.now();
    }

    stopExecution() {
        this._isRunning = false;
        this._statistics.endTime = Date.now();
    }

    setPhase(phase) {
        if (!StatePhase[phase]) {
            throw new Error(`Invalid phase: ${phase}`);
        }
        this._phase = phase;
    }

    setSeedChestPos(pos) {
        this._seedChestPos = pos;
    }

    setSeedDumpPos(pos) {
        this._seedDumpPos = pos;
    }

    setActiveCrop(cropId) {
        this._activeCrop = cropId;
    }

    setStartPos(pos) {
        this._startPos = pos;
    }

    incrementError() {
        this._errorCount++;
    }

    resetErrors() {
        this._errorCount = 0;
    }

    incrementStat(key, value = 1) {
        if (this._statistics.hasOwnProperty(key)) {
            this._statistics[key] += value;
        }
    }

    reset() {
        this._isPaused = false;
        this._isRunning = false;
        this._phase = StatePhase.GET_POS_CHEST;
        this._mode = null;
        this._errorCount = 0;
        this._seedDumpPos = null;
        this._activeCrop = null;
        this._resumeCheckPending = false;
        this._statistics = {
            blocksProcessed: 0,
            itemsUsed: 0,
            refillCount: 0,
            startTime: null,
            endTime: null
        };
    }

    getExecutionTime() {
        if (!this._statistics.startTime) return 0;
        const endTime = this._statistics.endTime || Date.now();
        return endTime - this._statistics.startTime;
    }

    printStatistics() {
        const execTime = this.getExecutionTime();
        const minutes = Math.floor(execTime / 60000);
        const seconds = Math.floor((execTime % 60000) / 1000);
        
        Chat.log('§e========== Statistics ==========');
        Chat.log(`§bBlocks Processed: §f${this._statistics.blocksProcessed}`);
        Chat.log(`§bItems Used: §f${this._statistics.itemsUsed}`);
        Chat.log(`§bRefill Count: §f${this._statistics.refillCount}`);
        Chat.log(`§bExecution Time: §f${minutes}m ${seconds}s`);
        Chat.log('§e================================');
    }
}

module.exports = { FarmState, StatePhase, OperationMode };
