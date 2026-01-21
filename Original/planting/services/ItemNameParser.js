/**
 * @file ItemNameParser.js
 * @description Normalizes item display names and parses quality prefixes
 */

class ItemNameParser {
    constructor(variants) {
        this._variants = variants || {};
        this._variantOrder = this._buildVariantOrder();
    }

    normalizeDisplayName(name) {
        if (!name) {
            return '';
        }
        return String(name).replace(/§[0-9A-FK-OR]/gi, '').trim();
    }

    parse(name) {
        const normalized = this.normalizeDisplayName(name);
        for (const quality of this._variantOrder) {
            const prefix = this._variants[quality]?.prefix;
            if (prefix && normalized.startsWith(prefix)) {
                return {
                    quality,
                    baseName: normalized.slice(prefix.length).trim(),
                    normalizedName: normalized
                };
            }
        }

        return {
            quality: null,
            baseName: normalized,
            normalizedName: normalized
        };
    }

    _buildVariantOrder() {
        const preferred = ['golden', 'star3', 'star2', 'star1'];
        return preferred.filter((key) => this._variants?.[key]?.prefix);
    }
}

module.exports = ItemNameParser;
