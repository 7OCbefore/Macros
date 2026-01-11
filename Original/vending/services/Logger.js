/**
 * @file Logger.js
 * @description Consistent logging utility for vending macros
 */

const LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

class Logger {
    constructor(config) {
        const logging = config.logging || {};
        const level = (logging.level || 'info').toLowerCase();

        this._enabled = logging.enabled !== false;
        this._useColors = logging.useColors !== false;
        this._prefix = logging.prefix || 'Vending';
        this._level = LEVELS[level] !== undefined ? level : 'info';
    }

    debug(message, context) {
        this._log('debug', message, context);
    }

    info(message, context) {
        this._log('info', message, context);
    }

    warn(message, context) {
        this._log('warn', message, context);
    }

    error(message, context) {
        this._log('error', message, context);
    }

    _log(level, message, context) {
        if (!this._enabled) {
            return;
        }
        if (LEVELS[level] < LEVELS[this._level]) {
            return;
        }

        if (!this._useColors) {
            const prefix = this._formatPrefix(level, context);
            Chat.log(prefix + message);
            return;
        }

        const levelLabel = level.toUpperCase();
        const builder = Chat.createTextBuilder();
        const prefixColor = 0x55FFFF;
        const levelColor = {
            debug: 0xAAAAAA,
            info: 0x55FF55,
            warn: 0xFFFF55,
            error: 0xFF5555
        }[level] || 0xAAAAAA;

        builder.append(`[${this._prefix}]`).withColor(prefixColor);
        if (context) {
            builder.append(`[${context}]`).withColor(prefixColor);
        }
        builder.append(`[${levelLabel}] `).withColor(levelColor);
        builder.append(message).withColor(0xFFFFFF);

        Chat.log(builder.build());
    }

    _formatPrefix(level, context) {
        const levelLabel = level.toUpperCase();
        const contextLabel = context ? `[${context}]` : '';
        return `[${this._prefix}]${contextLabel}[${levelLabel}] `;
    }
}

module.exports = Logger;
