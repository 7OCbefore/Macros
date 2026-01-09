const DEFAULT_MESSAGES = [
    "/ad profit crops in my ah",
    "/ad cheap 3-star crops in my ah",
    "/ad anyone need some crops check my ah"
];

function normalizeName(name) {
    if (!name) return "";
    return name.replace(/[^a-zA-Z]+/g, "").trim();
}

function getRandomNumber(min = 60, max = 2666) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

class ActionGuard {
    constructor(scriptConfig) {
        this._safeMode = Boolean(scriptConfig && scriptConfig.safeMode);
    }

    isSafeMode() {
        return this._safeMode;
    }

    run(label, fn, fallback) {
        if (!this._safeMode) {
            return fn();
        }
        if (label) {
            Chat.log(`[DryRun] ${label}`);
        }
        return fallback;
    }
}

module.exports = {
    DEFAULT_MESSAGES,
    normalizeName,
    getRandomNumber,
    ActionGuard
};
