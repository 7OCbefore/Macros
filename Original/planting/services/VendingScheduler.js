class VendingScheduler {
    constructor(config, state, jackoService, onJackoComplete) {
        this._config = config;
        this._state = state;
        this._jackoService = jackoService;
        this._onJackoComplete = onJackoComplete;
        this._isScheduling = false;
    }

    initialize() {
        this._state.nextCheckTicks = this._schedule();
        return this._state.nextCheckTicks;
    }

    tick() {
        const interval = this._config.timings.scheduleTickInterval;
        if (World.getTime() % interval !== 0) return;

        this._state.nextCheckTicks -= interval;
        if (this._state.nextCheckTicks <= 0) {
            this._state.nextCheckTicks = this._schedule();
        }
    }

    _schedule() {
        if (this._isScheduling) {
            Chat.log('[jackoSchedule] Already scheduling, skipping.');
            return this._state.nextCheckTicks;
        }

        this._isScheduling = true;

        const timeInfo = this._getBossbarTime();
        if (!timeInfo) {
            Chat.log('Failed to read Bossbar time; scheduling skipped.');
            this._isScheduling = false;
            return this._state.nextCheckTicks;
        }

        const jackoSellTimeHour = this._config.jackoData.sellTime.hour;
        const jackoSellTimeMinute = this._config.jackoData.sellTime.minute;

        const currentHour24 = (timeInfo.ampm === "PM" && timeInfo.hours !== 12)
            ? timeInfo.hours + 12
            : (timeInfo.ampm === "AM" && timeInfo.hours === 12)
                ? 0
                : timeInfo.hours;

        const currentTimeMinutes = currentHour24 * 60 + timeInfo.minutes;
        const jackoSellTimeMinutes = jackoSellTimeHour * 60 + jackoSellTimeMinute;

        let delayMinutes;
        if (currentTimeMinutes >= jackoSellTimeMinutes) {
            delayMinutes = (24 * 60) - currentTimeMinutes + jackoSellTimeMinutes;
            Chat.log(`Current time past ${jackoSellTimeHour}:00 AM; executing Jacko sale and scheduling next run...`);
            this._jackoService.sellToJacko();
            Client.waitTick(this._config.timings.scheduleAfterSellWait);
            if (this._onJackoComplete) {
                this._onJackoComplete();
            }
        } else {
            delayMinutes = jackoSellTimeMinutes - currentTimeMinutes;
            const delayHours = Math.floor(delayMinutes / 60);
            const delayMinutePart = delayMinutes % 60;
            Chat.log(`Jacko sale scheduled in ~${delayHours}h ${delayMinutePart}m.`);
        }

        const delayHoursForNext = Math.floor(delayMinutes / 60);
        const compensation = this._state.scheduleCompensationTicks || 0;
        this._state.nextCheckTicks = Math.max(0, delayHoursForNext * 1200 - compensation - 1600);
        const nextCheckDelayHours = Math.floor(this._state.nextCheckTicks / 1200);
        this._state.scheduleCompensationTicks = 0;

        Chat.log(`Jacko schedule set; next run in ~${nextCheckDelayHours}h (${this._state.nextCheckTicks} ticks).`);
        this._isScheduling = false;
        return this._state.nextCheckTicks;
    }

    _getBossbarTime() {
        const bossbarInfo = World.getBossBars();
        if (!bossbarInfo) {
            Chat.log("Bossbar info empty; cannot read time.");
            return null;
        }

        let bossbarString;
        if (typeof bossbarInfo === 'string') {
            bossbarString = bossbarInfo;
        } else if (typeof bossbarInfo === 'object') {
            bossbarString = String(bossbarInfo);
        } else {
            Chat.log(`Unknown Bossbar info type: ${typeof bossbarInfo}; cannot parse time.`);
            return null;
        }

        const timeRegex = /(\d{1,2}):(\d{2}) (AM|PM)/i;
        const timeMatch = bossbarString.match(timeRegex);

        if (timeMatch && timeMatch[0]) {
            return {
                raw: timeMatch[0],
                hours: parseInt(timeMatch[1], 10),
                minutes: parseInt(timeMatch[2], 10),
                ampm: timeMatch[3].toUpperCase()
            };
        }

        Chat.log("No time info found in Bossbar.");
        return null;
    }
}

module.exports = VendingScheduler;
