/**
 * @file Scheduler.js
 * @description Jacko scheduling based on bossbar time
 */

class Scheduler {
    constructor(config, logger, state, jackoService) {
        this._config = config;
        this._logger = logger;
        this._state = state;
        this._jackoService = jackoService;
    }

    schedule() {
        if (this._state.isScheduling) {
            this._logger.debug('Schedule already running, skipping.', 'Scheduler');
            return this._state.nextCheckTicks;
        }

        this._state.isScheduling = true;

        const timeInfo = this._jackoService.getBossBarInfo();
        if (!timeInfo) {
            this._logger.warn('Failed to read bossbar time.', 'Scheduler');
            this._state.isScheduling = false;
            return this._state.nextCheckTicks;
        }

        const currentHour24 = (timeInfo.ampm === 'PM' && timeInfo.hours !== 12)
            ? timeInfo.hours + 12
            : (timeInfo.ampm === 'AM' && timeInfo.hours === 12)
                ? 0
                : timeInfo.hours;
        const currentTimeMinutes = currentHour24 * 60 + timeInfo.minutes;
        const target = this._config.jackoData.sellTime;
        const jackoSellMinutes = target.hour * 60 + target.minute;

        let delayMinutes;
        if (currentTimeMinutes >= jackoSellMinutes) {
            delayMinutes = (24 * 60) - currentTimeMinutes + jackoSellMinutes;
            this._logger.info('Jacko time already passed, selling now.', 'Scheduler');
            this._jackoService.sellToJacko();
            Client.waitTick(this._config.timings.scheduleAfterSellWait);
        } else {
            delayMinutes = jackoSellMinutes - currentTimeMinutes;
            const delayHours = Math.floor(delayMinutes / 60);
            const delayMinutePart = delayMinutes % 60;
            this._logger.info(
                `Jacko sale in ~${delayHours}h ${delayMinutePart}m.`,
                'Scheduler'
            );
        }

        const delayHoursForNext = Math.floor(delayMinutes / 60);
        this._state.nextCheckTicks = Math.max(
            0,
            delayHoursForNext * 1200 - this._state.adDelayTicks - 1600
        );

        const nextCheckDelayHours = Math.floor(this._state.nextCheckTicks / 1200);
        this._logger.info(
            `Next check in ~${nextCheckDelayHours}h (${this._state.nextCheckTicks} ticks).`,
            'Scheduler'
        );

        this._state.adDelayTicks = 0;
        this._state.isScheduling = false;
        return this._state.nextCheckTicks;
    }

    tick() {
        const interval = this._config.timings.scheduleTickInterval;
        if (World.getTime() % interval !== 0) {
            return;
        }

        this._state.nextCheckTicks -= interval;
        if (this._state.nextCheckTicks <= 0) {
            this.schedule();
        }
    }
}

module.exports = Scheduler;
