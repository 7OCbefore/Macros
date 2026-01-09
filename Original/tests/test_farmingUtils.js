// test_farmingUtils.js
const assert = require('assert');

// --- Mocks Setup ---
global.Chat = { 
    log: (msg) => {
        // Uncomment to see logs
        // console.log('[MockChat]', msg && msg.getText ? msg.getText() : msg); 
    },
    createTextBuilder: () => ({
        append: function() { return this; },
        withColor: function() { return this; },
        build: function() { return "MockText"; }
    })
};

global.Client = { 
    waitTick: (t) => {} 
};

global.Player = {
    getPlayer: () => ({
        lookAt: (x, y, z) => {},
        distanceTo: (x, y, z) => 0.5, // Always close
        getFoodLevel: () => 20,
        getInteractionManager: () => ({ interactBlock: () => {} }),
        getFacingDirection: () => ({ getName: () => "north" })
    }),
    openInventory: () => ({
        findItem: (id) => [0],
        getMap: () => ({ main: [0], hotbar: [0] }),
        getSlot: (i) => ({ 
            getCount: () => 64, 
            getItemId: () => "minecraft:dirt",
            isEmpty: () => false
        }),
        closeAndDrop: () => {},
        swapHotbar: () => {},
        getSelectedHotbarSlotIndex: () => 0,
        quick: () => {}
    }),
    getInteractionManager: () => ({ 
        interactBlock: (x, y, z, dir, sneak) => {} 
    })
};

global.KeyBind = { 
    keyBind: (key, state) => {}, 
    key: (key, state) => {} 
};

global.Hud = { 
    isContainer: () => true,
    clearDraw3Ds: () => {} 
};

global.JavaWrapper = { 
    methodToJava: (fn) => fn, 
    stop: () => console.log("JavaWrapper.stop called") 
};

global.JsMacros = { 
    on: (event, callback) => {} 
};

// --- Import Module ---
const Utils = require('../common/farmingUtils.js');

// --- Tests ---

function testSnakeWalk() {
    console.log("Running testSnakeWalk...");
    
    const start = [0, 64, 0];
    const end = [2, 64, 2]; // 3x3 area: (0,0) to (2,2)
    const chest = [10, 64, 10];
    
    let visited = [];
    let state = { isActionRunning: true, isPaused: false };
    
    // Explicitly set step size for test if needed, or rely on default (5)
    // Since area is small (width 3), step size 5 covers it in one go if logic is correct
    // Utils uses Config.STEP_SIZE which defaults to 5.
    
    Utils.snakeWalk(start, end, chest, "minecraft:dirt", (x, y, z) => {
        visited.push(`${x},${z}`);
    }, state);

    // Expected: 0,0 -> 1,0 -> 2,0 -> 2,1 -> 1,1 -> 0,1 -> 0,2 -> 1,2 -> 2,2 (Ordering depends on snake logic)
    // Our logic: 
    // Outer loop X (step 5).
    // Inner loop Z.
    // Inner-inner loop X (local).
    
    // With step 5, currentX starts at 0. 
    // xStep is 1 (endX 2 > startX 0).
    // Middle loop Z: starts 0, goes to 2.
    // Inner loop localX: 0 to 4 (limited by endX=2). So 0, 1, 2.
    
    // Z=0: localX 0, 1, 2
    // Z=1: localX 0, 1, 2
    // Z=2: localX 0, 1, 2
    // Wait, check snake logic for Z direction.
    // zStart = (group%2==0) ? startZ : endZ. group=0 -> startZ (0).
    // So Z goes 0 -> 1 -> 2.
    
    // Result should be 9 points.
    assert.strictEqual(visited.length, 9, `Expected 9 points visited, got ${visited.length}: ${visited}`);
    
    // Check specific existence
    assert.ok(visited.includes("0,0"));
    assert.ok(visited.includes("2,2"));
    
    console.log("testSnakeWalk Passed!");
}

function testConfigLoad() {
    console.log("Running testConfigLoad...");
    // Mock require for config (node will load actual file)
    const config = Utils.loadConfig('../config/plantingConfig.json');
    assert.ok(config, "Config should load successfully");
    assert.ok(config.chests, "Config should have chests defined");
    console.log("testConfigLoad Passed!");
}

// Run Tests
try {
    testConfigLoad();
    testSnakeWalk();
    console.log("All tests passed successfully.");
} catch (e) {
    console.error("Test Failed:", e);
    process.exit(1);
}
