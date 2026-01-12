/**
 * @file 作物自动售货机-待优化.js
 * @description Entry point for vending macro (modularized)
 */

const VendingApplication = require('./vending/VendingApplication.js');

try {
    const app = new VendingApplication();
    if (!app.initialize()) {
        throw new Error('Initialization failed');
    }
} catch (error) {
    Chat.log(`[Vending][ERROR] Critical error: ${error.message}`);
}

//TODO
/**
- 更智能的作物上架和补货功能
 */