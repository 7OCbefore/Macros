/**
 * @file ConfigLoader.js
 * @description Configuration management module for farming scripts
 * @version 3.0.0
 */

const FS = Java.type('java.nio.file.Files');
const Paths = Java.type('java.nio.file.Paths');
const StandardCharsets = Java.type('java.nio.charset.StandardCharsets');

class ConfigLoader {
    constructor() {
        this._cache = new Map();
    }

    /**
     * Load JSON configuration file with caching
     * @param {string} relativePath - Path relative to script directory
     * @returns {Object|null} Parsed configuration object
     */
    load(relativePath) {
        if (this._cache.has(relativePath)) {
            return this._cache.get(relativePath);
        }

        try {
            const scriptDir = __dirname || FS.toAbsolutePath(Paths.get('.')).toString();
            const configPath = Paths.get(scriptDir, relativePath);

            if (!FS.exists(configPath)) {
                Chat.log(`§c[Config] File not found: ${relativePath}`);
                return null;
            }

            const content = FS.readString(configPath, StandardCharsets.UTF_8);
            const parsed = JSON.parse(content);
            
            this._cache.set(relativePath, parsed);
            return parsed;
        } catch (error) {
            Chat.log(`§c[Config] Failed to load ${relativePath}: ${error.message}`);
            return null;
        }
    }

    /**
     * Clear configuration cache
     */
    clearCache() {
        this._cache.clear();
    }

    /**
     * Reload specific configuration
     * @param {string} relativePath 
     */
    reload(relativePath) {
        this._cache.delete(relativePath);
        return this.load(relativePath);
    }
}

module.exports = new ConfigLoader();
