/**
 * @file CropRegistry.js
 * @description Unified crop registry and quality resolution
 */

const ItemNameParser = require('./ItemNameParser.js');

class CropRegistry {
    constructor(cropsConfig, logger) {
        this._config = cropsConfig || {};
        this._logger = logger || null;
        this._variants = this._config.variants || {};
        this._crops = this._config.crops || {};
        this._parser = new ItemNameParser(this._variants);

        this._displayNameMap = new Map();
        this._seedMap = new Map();

        this._buildIndexes();
    }

    normalizeDisplayName(name) {
        return this._parser.normalizeDisplayName(name);
    }

    parseItemName(name) {
        const parsed = this._parser.parse(name);
        const baseNameKey = this.normalizeDisplayName(parsed.baseName);
        const cropId = this._displayNameMap.get(baseNameKey) || null;

        return {
            cropId,
            quality: parsed.quality,
            baseName: parsed.baseName,
            displayName: cropId ? this._crops[cropId]?.displayName : null
        };
    }

    getItemName(cropId, quality) {
        const crop = this._crops[cropId];
        if (!crop) {
            return '';
        }
        const prefix = quality ? this._variants?.[quality]?.prefix : '';
        return `${prefix || ''}${crop.displayName}`.trim();
    }

    getCropDisplayName(cropId) {
        return this._crops[cropId]?.displayName || '';
    }

    getSeedItems() {
        const seeds = [];
        for (const cropId of Object.keys(this._crops)) {
            const crop = this._crops[cropId];
            if (!crop?.seedItems) {
                continue;
            }
            for (const seedName of crop.seedItems) {
                if (seedName) {
                    seeds.push(seedName);
                }
            }
        }
        return seeds;
    }

    getCropIds() {
        return Object.keys(this._crops);
    }

    getBasketInfo(cropId, quality) {
        const crop = this._crops[cropId];
        return crop?.vending?.basket?.[quality] || null;
    }

    getJackoPrice(cropId, quality) {
        return this._crops[cropId]?.vending?.jackoPrice?.[quality];
    }

    canSellQuality(quality) {
        return quality === 'star3' || quality === 'golden';
    }

    _buildIndexes() {
        for (const cropId of Object.keys(this._crops)) {
            const crop = this._crops[cropId];
            const displayName = this.normalizeDisplayName(crop?.displayName);
            if (displayName) {
                this._displayNameMap.set(displayName, cropId);
            }

            const seeds = Array.isArray(crop?.seedItems) ? crop.seedItems : [];
            for (const seed of seeds) {
                const seedKey = this.normalizeDisplayName(seed);
                if (seedKey) {
                    this._seedMap.set(seedKey, cropId);
                }
            }
        }
    }
}

module.exports = CropRegistry;
