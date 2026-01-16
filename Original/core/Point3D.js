/**
 * @file Point3D.js
 * @description Immutable 3D coordinate class with utility methods
 * @version 3.0.0
 */

class Point3D {
    /**
     * @param {number} x 
     * @param {number} y 
     * @param {number} z 
     */
    constructor(x, y, z) {
        this._x = Math.floor(x);
        this._y = Math.floor(y);
        this._z = Math.floor(z);
        this._hashCode = null;
    }

    get x() { return this._x; }
    get y() { return this._y; }
    get z() { return this._z; }

    /**
     * Create Point3D from array [x, y, z]
     * @param {number[]} arr 
     * @returns {Point3D|null}
     */
    static from(arr) {
        if (!arr || arr.length < 3) return null;
        return new Point3D(arr[0], arr[1], arr[2]);
    }

    /**
     * Create Point3D from Minecraft block object
     * @param {Object} block 
     * @returns {Point3D}
     */
    static fromBlock(block) {
        return new Point3D(block.getX(), block.getY(), block.getZ());
    }

    /**
     * Convert to array format
     * @returns {number[]}
     */
    toArray() {
        return [this._x, this._y, this._z];
    }

    /**
     * Get center coordinate for movement (block center = +0.5)
     * @returns {{x: number, y: number, z: number}}
     */
    toCenter() {
        return {
            x: this._x + 0.5,
            y: this._y + 0.5,
            z: this._z + 0.5
        };
    }

    /**
     * Calculate Euclidean distance to another point
     * @param {Point3D} other 
     * @returns {number}
     */
    distanceTo(other) {
        const dx = this._x - other._x;
        const dy = this._y - other._y;
        const dz = this._z - other._z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * Create a new point with offset
     * @param {number} dx 
     * @param {number} dy 
     * @param {number} dz 
     * @returns {Point3D}
     */
    add(dx, dy, dz) {
        return new Point3D(this._x + dx, this._y + dy, this._z + dz);
    }

    /**
     * Get block center coordinate (alias of toCenter)
     * @returns {{x: number, y: number, z: number}}
     */
    toBlockCenter() {
        return this.toCenter();
    }

    /**
     * Calculate Manhattan distance (faster, no sqrt)
     * @param {Point3D} other 
     * @returns {number}
     */
    manhattanDistanceTo(other) {
        return Math.abs(this._x - other._x) + 
               Math.abs(this._y - other._y) + 
               Math.abs(this._z - other._z);
    }


    /**
     * Check equality with another point
     * @param {Point3D} other 
     * @returns {boolean}
     */
    equals(other) {
        if (!other) return false;
        return this._x === other._x && this._y === other._y && this._z === other._z;
    }

    /**
     * Get hash code for use in Map/Set
     * @returns {string}
     */
    hashCode() {
        if (this._hashCode === null) {
            this._hashCode = `${this._x},${this._y},${this._z}`;
        }
        return this._hashCode;
    }

    /**
     * Create offset point
     * @param {number} dx 
     * @param {number} dy 
     * @param {number} dz 
     * @returns {Point3D}
     */
    offset(dx, dy, dz) {
        return new Point3D(this._x + dx, this._y + dy, this._z + dz);
    }

    toString() {
        return `Point3D(${this._x}, ${this._y}, ${this._z})`;
    }
}

module.exports = Point3D;
