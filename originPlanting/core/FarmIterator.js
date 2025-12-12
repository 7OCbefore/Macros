/**
 * @file FarmIterator.js
 * @description Memory-efficient generator-based farm area traversal
 * @version 3.0.0
 */

const Point3D = require('./Point3D.js');

class FarmIterator {
    /**
     * @param {Point3D} startPos - Starting position
     * @param {Point3D} endPos - Ending position
     * @param {number} stepSize - Strip width for snake pattern
     */
    constructor(startPos, endPos, stepSize = 5) {
        if (!(startPos instanceof Point3D) || !(endPos instanceof Point3D)) {
            throw new TypeError('startPos and endPos must be Point3D instances');
        }

        this._startPos = startPos;
        this._endPos = endPos;
        this._stepSize = Math.max(1, Math.floor(stepSize));
        
        this._xStep = Math.sign(endPos.x - startPos.x) || 1;
        this._zStepInitial = Math.sign(endPos.z - startPos.z) || 1;
        
        this._totalBlocks = this._calculateTotalBlocks();
    }

    /**
     * Calculate total number of blocks to process
     * @private
     * @returns {number}
     */
    _calculateTotalBlocks() {
        const xRange = Math.abs(this._endPos.x - this._startPos.x) + 1;
        const zRange = Math.abs(this._endPos.z - this._startPos.z) + 1;
        return xRange * zRange;
    }

    /**
     * Get total blocks count
     * @returns {number}
     */
    getTotalBlocks() {
        return this._totalBlocks;
    }

    /**
     * Generator yielding Point3D for each block in snake pattern
     * Memory-efficient: O(1) space instead of O(n) for pre-allocated arrays
     * @generator
     * @yields {Point3D}
     */
    *iterate() {
        let currentX = this._startPos.x;
        let stripIndex = 0;

        while (this._isXInRange(currentX)) {
            const isForwardPass = (stripIndex % 2 === 0);
            const zStart = isForwardPass ? this._startPos.z : this._endPos.z;
            const zEnd = isForwardPass ? this._endPos.z : this._startPos.z;
            const zStep = isForwardPass ? this._zStepInitial : -this._zStepInitial;

            for (let z = zStart; this._isZInRange(z, zEnd, zStep); z += zStep) {
                const stripEndX = currentX + (this._stepSize - 1) * this._xStep;
                
                for (let localX = currentX; 
                     this._isLocalXInStrip(localX, stripEndX); 
                     localX += this._xStep) {
                    
                    yield new Point3D(localX, this._startPos.y, z);
                }
            }

            currentX += this._stepSize * this._xStep;
            stripIndex++;
        }
    }

    /**
     * Check if X coordinate is within range
     * @private
     */
    _isXInRange(x) {
        return this._xStep > 0 ? x <= this._endPos.x : x >= this._endPos.x;
    }

    /**
     * Check if Z coordinate is within range
     * @private
     */
    _isZInRange(z, end, step) {
        return step > 0 ? z <= end : z >= end;
    }

    /**
     * Check if local X is within current strip
     * @private
     */
    _isLocalXInStrip(localX, stripEnd) {
        if (this._xStep > 0) {
            return localX <= stripEnd && localX <= this._endPos.x;
        } else {
            return localX >= stripEnd && localX >= this._endPos.x;
        }
    }

    /**
     * Convert iterator to array (for debugging, avoid in production)
     * @returns {Point3D[]}
     */
    toArray() {
        return Array.from(this.iterate());
    }
}

module.exports = FarmIterator;
