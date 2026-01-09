// 强制暂停脚本
var closeKey = "key.keyboard.x";
JsMacros.on("Key", JavaWrapper.methodToJava((e, ctx) => {
    if (e.key == closeKey) {
        Chat.log('脚本关闭了。');
        JavaWrapper.stop(); // 使用此命令等同于在GUI强制停止脚本中的所有线程
    }
}));

// 通过name匹配查找对应物品
function findItemByName(name) {
    const inv = Player.openInventory();
    const totalSlots = inv.getTotalSlots(); // 获取容器的总槽位数
    var nameArr = [];
    
    for (let i = 0; i < totalSlots; i++) {
        const item = inv.getSlot(i); // 从每个槽位获取物品
        if (item && item.getName().getString().replace(/[^a-zA-Z]+/g, '').trim() === name) {
            nameArr.push(i); // 保存匹配的槽位索引
        }
    }
    return nameArr;
}

// 补货上架
function auction(itemName, amount = 64, price = 800) {
    const inv = Player.openInventory();

    // 查找物品
    const itemSlots = findItemByName(itemName);

    if (itemSlots.length > 0) {
        for (const slot of itemSlots) {
            const stackSize = inv.getSlot(slot).getCount();
            if (stackSize >= amount) {
                // 将找到的物品与主手物品交换
                inv.swapHotbar(slot, inv.getSelectedHotbarSlotIndex());
                Client.waitTick(14);

                // 如果需要拆分物品
                if (stackSize > amount) {
                    // 先把物品放到一个空的快捷栏位置
                    let emptyHotbarSlot = -1;
                    for (let i = 36; i < 45; i++) {  // 快捷栏的槽位范围是36-44
                        if (!inv.getSlot(i)) {
                            emptyHotbarSlot = i;
                            break;
                        }
                    }
                    
                    if (emptyHotbarSlot !== -1) {
                        // 将物品移动到空的快捷栏位置
                        inv.swapHotbar(slot, emptyHotbarSlot - 36);  // 转换为快捷栏索引(0-8)
                        Client.waitTick(10);
                        
                        // 拆分物品
                        inv.click(emptyHotbarSlot);  // 左键点击物品
                        Client.waitTick(5);
                        inv.click(emptyHotbarSlot, 1, 'right');  // 右键点击拆分
                        Client.waitTick(5);
                        
                        // 调整数量
                        for (let i = 0; i < amount; i++) {
                            inv.click(emptyHotbarSlot, 0, 'left');  // 左键增加数量
                            Client.waitTick(1);
                        }
                        
                        // 确认拆分
                        inv.click(-999);  // 点击物品栏外确认
                        Client.waitTick(10);
                        
                        // 将拆分后的物品移到主手
                        inv.swapHotbar(emptyHotbarSlot, inv.getSelectedHotbarSlotIndex());
                        Client.waitTick(10);
                    }
                }

                // 上架物品
                Chat.say(`/auction ${price}`);
                Client.waitTick(8); 
                Chat.say(`/auction ${price}`);
                Chat.log(`已将${amount}个 ${itemName} 换到主手并上架，来自槽位 ${slot}`);
                return true;
            }
        }
        Chat.log(`未找到${amount}堆叠的 ${itemName}`);
    } else {
        Chat.log(`未找到物品: ${itemName}`);
    }
    return false;
}

// 朝目标方块移动
function moveToBlock(x, y, z) {
    const player = Player.getPlayer();
    var targetX = x + 0.5; // +0.5取正中间
    var targetY = y + 0.5;
    var targetZ = z + 0.5;

    player.lookAt(targetX, targetY, targetZ);
    var distance = player.distanceTo(targetX, targetY, targetZ);
    
    while (player.distanceTo(targetX, targetY, targetZ) > 4) {
        player.lookAt(targetX, targetY, targetZ);
        distance = player.distanceTo(targetX, targetY, targetZ);
        KeyBind.keyBind("key.forward", true);
        KeyBind.keyBind("key.sprint", true);
        Client.waitTick(1);
    }
    KeyBind.keyBind("key.forward", false);
}

// 从箱子中获取篮子
function getBasketFromChest(basketName, chestPos) {
    moveToBlock(chestPos[0], chestPos[1], chestPos[2]);
    Player.getInteractionManager().interactBlock(chestPos[0], chestPos[1], chestPos[2], player.getFacingDirection().getName(), false);
    
    // 等待箱子打开
    while (!Hud.isContainer()) {
        Client.waitTick();
    }
    Client.waitTick(6);
    
    const chestInv = Player.openInventory();
    const basketSlots = findItemByName(basketName); // 使用 findItemByName 函数查找篮子
    
    for (const slot of basketSlots) {
        const slotItem = chestInv.getSlot(slot);
        if (slotItem.getCount() === 64) {
            chestInv.swapHotbar(slot, chestInv.getSelectedHotbarSlotIndex()); // 切换到主手
            Client.waitTick(6);
            Chat.log(`成功从箱子中取出 ${basketName}`);
            chestInv.closeAndDrop();
            Client.waitTick(6);
            return true;
        }
    }
    Chat.log(`箱子中没有找到64个 ${basketName}`);
    return false;
}

// 处理作物被卖出的逻辑
function handleCropSold(crop, amount = 64) {
    if (auction(crop, amount)) {
        return; // 如果上架成功，返回
    }

    let basketName, chestPos;
    switch (crop) {
        case "Apple":
            basketName = appleBasket;
            chestPos = chestPosApple;
            break;
        case "Mango":
            basketName = mangoBasket;
            chestPos = chestPosMango;
            break;
        case "Banana":
            basketName = bananaBasket;
            chestPos = chestPosBanana;
            break;
        default:
            Chat.log(`未知作物: ${crop}`);
            return;
    }

    if (getBasketFromChest(basketName, chestPos)) {
        const inv = Player.openInventory();
        inv.swapHotbar(1, inv.getSelectedHotbarSlotIndex());
        Client.waitTick(4);
        inv.quick(0);
        Client.waitTick(20);
        
        // 再次尝试上架
        if (auction(crop, amount)) {
            Chat.log(`成功上架 ${amount}个 ${crop}`);
        } else {
            Chat.log(`未能成功上架 ${crop}`);
        }
    }
}

// 全局变量标记是否正在处理队列
let isProcessing = false;

// 递归函数，用于处理作物消息队列
function processCropMessages() {
    if (cropMessage.length > 0) {
        isProcessing = true; // 标记为正在处理
        let item = cropMessage.shift(); // 处理队列中的第一个作物
        handleCropSold(item.crop, item.amount);
        // 等待一段时间后再次处理
        Client.waitTick(14);
        processCropMessages(); // 递归调用处理下一个
    } else {
        isProcessing = false; // 标记为处理完成
    }
}

// 全局变量 存储卖出去的作物信息
let cropMessage = [];

// 事件监听器，用于接收消息
JsMacros.on('RecvMessage', JavaWrapper.methodToJava(event => {
    if (event.text?.getString().includes("bought your")) {
        let crop = "";
        let amount = 64; // 默认数量
        const message = event.text.getString();
        
        // 从消息中提取数量
        const match = message.match(/bought your (\d+)/);
        if (match) {
            amount = parseInt(match[1]);
        }

        if (message.includes("Apple")) {
            crop = "Apple";
        } else if (message.includes("Mango")) {
            crop = "Mango";
        } else if (message.includes("Banana")) {
            crop = "Banana";
        }
        
        if (crop) {
            cropMessage.push({crop: crop, amount: amount});
            // 尝试处理队列，如果不在处理中
            if (!isProcessing) {
                processCropMessages();
            }
        }
    }
}));

const player = Player.getPlayer();

// 作物name用于匹配
const appleName = "Apple";
const mangoName = "Mango";
const bananaName = "Banana";
const appleBasket = "AppleBasket";
const mangoBasket = "MangoBasket";
const bananaBasket = "BananaBasket";

// chestPos变量用于取物补充背包
// 3-star
const chestPosApple = [204, 56, 394];
const chestPosMango = [204, 56, 391];
const chestPosBanana = [204, 56, 388];

//2-star
// const chestPosApple = [204, 58, 384];
// const chestPosMango = [204, 57, 384];
// const chestPosBanana = [204, 56, 384];