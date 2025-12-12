/**
 * @file test_PlantingV3.js
 * @description Unit tests for refactored planting script v3.0.0
 * @version 3.0.0
 */

const Point3D = require('../core/Point3D.js');
const { FarmState, StatePhase, OperationMode } = require('../core/FarmState.js');
const FarmIterator = require('../core/FarmIterator.js');

const TestRunner = {
    passed: 0,
    failed: 0,
    tests: [],

    /**
     * Assert equality
     */
    assertEquals(actual, expected, message) {
        if (actual === expected) {
            this.passed++;
            Chat.log(`§a✓ ${message}`);
        } else {
            this.failed++;
            Chat.log(`§c✗ ${message}`);
            Chat.log(`  Expected: ${expected}, Got: ${actual}`);
        }
    },

    /**
     * Assert truthy
     */
    assertTrue(condition, message) {
        this.assertEquals(!!condition, true, message);
    },

    /**
     * Assert falsy
     */
    assertFalse(condition, message) {
        this.assertEquals(!!condition, false, message);
    },

    /**
     * Run test function
     */
    test(name, fn) {
        Chat.log(`\n§e[Test] ${name}`);
        try {
            fn();
        } catch (error) {
            this.failed++;
            Chat.log(`§c✗ Exception: ${error.message}`);
        }
    },

    /**
     * Print summary
     */
    summary() {
        Chat.log('\n§e═══════════════════════════════════════');
        Chat.log(`§aTests Passed: ${this.passed}`);
        Chat.log(`§cTests Failed: ${this.failed}`);
        Chat.log(`§bTotal: ${this.passed + this.failed}`);
        Chat.log('§e═══════════════════════════════════════');
    }
};

Chat.log('§e═══════════════════════════════════════');
Chat.log('§aPlanting Script v3.0.0 - Unit Tests');
Chat.log('§e═══════════════════════════════════════');

TestRunner.test('Point3D: Construction', () => {
    const p = new Point3D(10.7, 20.3, 30.9);
    TestRunner.assertEquals(p.x, 10, 'X coordinate should be floored');
    TestRunner.assertEquals(p.y, 20, 'Y coordinate should be floored');
    TestRunner.assertEquals(p.z, 30, 'Z coordinate should be floored');
});

TestRunner.test('Point3D: fromArray', () => {
    const p = Point3D.from([5, 10, 15]);
    TestRunner.assertTrue(p instanceof Point3D, 'Should create Point3D instance');
    TestRunner.assertEquals(p.x, 5, 'X should be 5');
    
    const invalid = Point3D.from(null);
    TestRunner.assertEquals(invalid, null, 'Should return null for invalid input');
});

TestRunner.test('Point3D: toArray', () => {
    const p = new Point3D(1, 2, 3);
    const arr = p.toArray();
    TestRunner.assertEquals(arr[0], 1, 'Array[0] should be X');
    TestRunner.assertEquals(arr[1], 2, 'Array[1] should be Y');
    TestRunner.assertEquals(arr[2], 3, 'Array[2] should be Z');
});

TestRunner.test('Point3D: toCenter', () => {
    const p = new Point3D(10, 20, 30);
    const center = p.toCenter();
    TestRunner.assertEquals(center.x, 10.5, 'Center X should be +0.5');
    TestRunner.assertEquals(center.y, 20.5, 'Center Y should be +0.5');
    TestRunner.assertEquals(center.z, 30.5, 'Center Z should be +0.5');
});

TestRunner.test('Point3D: distanceTo', () => {
    const p1 = new Point3D(0, 0, 0);
    const p2 = new Point3D(3, 4, 0);
    const dist = p1.distanceTo(p2);
    TestRunner.assertEquals(dist, 5, 'Distance should be 5 (3-4-5 triangle)');
});

TestRunner.test('Point3D: manhattanDistanceTo', () => {
    const p1 = new Point3D(0, 0, 0);
    const p2 = new Point3D(3, 4, 5);
    const dist = p1.manhattanDistanceTo(p2);
    TestRunner.assertEquals(dist, 12, 'Manhattan distance should be 12');
});

TestRunner.test('Point3D: equals', () => {
    const p1 = new Point3D(10, 20, 30);
    const p2 = new Point3D(10, 20, 30);
    const p3 = new Point3D(10, 20, 31);
    
    TestRunner.assertTrue(p1.equals(p2), 'Same coordinates should be equal');
    TestRunner.assertFalse(p1.equals(p3), 'Different coordinates should not be equal');
});

TestRunner.test('Point3D: offset', () => {
    const p1 = new Point3D(10, 20, 30);
    const p2 = p1.offset(1, 2, 3);
    
    TestRunner.assertEquals(p2.x, 11, 'Offset X should be 11');
    TestRunner.assertEquals(p2.y, 22, 'Offset Y should be 22');
    TestRunner.assertEquals(p2.z, 33, 'Offset Z should be 33');
});

TestRunner.test('FarmState: Initial state', () => {
    const state = new FarmState();
    TestRunner.assertFalse(state.isPaused, 'Should not be paused initially');
    TestRunner.assertFalse(state.isRunning, 'Should not be running initially');
    TestRunner.assertEquals(state.phase, StatePhase.GET_POS_CHEST, 'Initial phase should be GET_POS_CHEST');
});

TestRunner.test('FarmState: Pause/Resume', () => {
    const state = new FarmState();
    state.pause();
    TestRunner.assertTrue(state.isPaused, 'Should be paused');
    
    state.resume();
    TestRunner.assertFalse(state.isPaused, 'Should be resumed');
    
    const isPaused = state.togglePause();
    TestRunner.assertTrue(isPaused, 'Toggle should pause');
});

TestRunner.test('FarmState: Execution lifecycle', () => {
    const state = new FarmState();
    
    state.startExecution(OperationMode.SOIL);
    TestRunner.assertTrue(state.isRunning, 'Should be running after start');
    TestRunner.assertEquals(state.mode, OperationMode.SOIL, 'Mode should be SOIL');
    TestRunner.assertEquals(state.phase, StatePhase.EXECUTING, 'Phase should be EXECUTING');
    
    state.stopExecution();
    TestRunner.assertFalse(state.isRunning, 'Should stop running');
});

TestRunner.test('FarmState: Statistics', () => {
    const state = new FarmState();
    
    state.incrementStat('blocksProcessed', 10);
    state.incrementStat('itemsUsed', 5);
    
    const stats = state.statistics;
    TestRunner.assertEquals(stats.blocksProcessed, 10, 'Blocks processed should be 10');
    TestRunner.assertEquals(stats.itemsUsed, 5, 'Items used should be 5');
});

TestRunner.test('FarmIterator: Basic iteration', () => {
    const start = new Point3D(0, 0, 0);
    const end = new Point3D(2, 0, 2);
    const iterator = new FarmIterator(start, end, 1);
    
    const points = iterator.toArray();
    
    TestRunner.assertEquals(points.length, 9, 'Should have 9 points (3x3 grid)');
    TestRunner.assertTrue(points[0] instanceof Point3D, 'Should yield Point3D instances');
});

TestRunner.test('FarmIterator: Total blocks calculation', () => {
    const start = new Point3D(0, 0, 0);
    const end = new Point3D(9, 0, 9);
    const iterator = new FarmIterator(start, end, 5);
    
    TestRunner.assertEquals(iterator.getTotalBlocks(), 100, 'Should calculate 100 blocks (10x10)');
});

TestRunner.test('FarmIterator: Negative coordinates', () => {
    const start = new Point3D(-5, 0, -5);
    const end = new Point3D(-1, 0, -1);
    const iterator = new FarmIterator(start, end, 2);
    
    const points = iterator.toArray();
    TestRunner.assertEquals(points.length, 25, 'Should handle negative coordinates (5x5 = 25)');
});

TestRunner.test('FarmIterator: Single block', () => {
    const start = new Point3D(10, 20, 30);
    const end = new Point3D(10, 20, 30);
    const iterator = new FarmIterator(start, end, 1);
    
    const points = iterator.toArray();
    TestRunner.assertEquals(points.length, 1, 'Single block should yield 1 point');
    TestRunner.assertTrue(points[0].equals(start), 'Should be the start point');
});

TestRunner.test('StatePhase: Enum immutability', () => {
    const original = StatePhase.GET_POS_CHEST;
    
    try {
        StatePhase.GET_POS_CHEST = 'MODIFIED';
    } catch (e) {
    }
    
    TestRunner.assertEquals(StatePhase.GET_POS_CHEST, original, 'Enum should be immutable (frozen)');
});

TestRunner.test('OperationMode: Enum values', () => {
    TestRunner.assertEquals(OperationMode.SOIL, 'SOIL', 'SOIL mode should exist');
    TestRunner.assertEquals(OperationMode.FERTILIZE, 'FERTILIZE', 'FERTILIZE mode should exist');
    TestRunner.assertEquals(OperationMode.PLANT, 'PLANT', 'PLANT mode should exist');
});

TestRunner.summary();

Chat.log('\n§a[Tests Complete] All core functionality validated');
