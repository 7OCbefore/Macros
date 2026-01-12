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
        const prefixColor = '§3';
        const levelColor = {
            debug: '§7',
            info: '§b',
            warn: '§6',
            error: '§c'
        }[level] || '§7';
        const messageColor = {
            debug: '§7',
            info: '§f',
            warn: '§6',
            error: '§c'
        }[level] || '§f';
        const contextLabel = context ? `${prefixColor}[${context}]` : '';
        const prefixLabel = `${prefixColor}[${this._prefix}]${contextLabel}`;

        Chat.log(`${prefixLabel}${levelColor}[${levelLabel}] ${messageColor}${message}§r`);
    }

    _formatPrefix(level, context) {
        const levelLabel = level.toUpperCase();
        const contextLabel = context ? `[${context}]` : '';
        return `[${this._prefix}]${contextLabel}[${levelLabel}] `;
    }
}

module.exports = Logger;
