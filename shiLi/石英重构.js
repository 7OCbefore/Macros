let player = Player.getPlayer()
let emeraldCount2 = 0
let count = 0
let lastday = -1
// 返回ktown
function home() {
    Chat.say('/res tp Ktown')
    Time.sleep(5000)
}

//获取当前世界是第多少天，以及目前是几点
function getTime() {
    var totalTicks = World.getTimeOfDay(); // 获取当前时间
    var ticksToday = totalTicks % 24000; // 获取当天过去的 ticks
    var hours = Math.floor(ticksToday / 1000 + 6) % 24; // 计算当前小时
    var days = Math.floor(totalTicks / 24000); // 计算当前天数
    return { hour: hours, day: days }
}

//获取当前世界是否下雨
function isRain() {
    return World.isRaining()
}

//利用bearitone使玩家移动
function move(x, y, z) {
    Chat.say(`goto ${x} ${y} ${z}`)
    return { x: x, y: y, z: z }
}

//获取玩家当前坐标
function player_pos() {
    let player_pos = player.getPos()//需要确定返回坐标格式3
    let player_x = player_pos.getX()
    let player_y = player_pos.getY()
    let player_z = player_pos.getZ()
    return { x: player_x, y: player_y, z: player_z }
}

//是否移动到位
function isMoveDone(x, y, z, maxtime = 10) {
    targetPos = move(x, y, z)
    while (maxtime--) {
        Time.sleep(1000)
        let currentPos = player_pos(); // 获取玩家当前位置
        // 计算每个轴的差值
        let deltaX = Math.abs(currentPos.x - targetPos.x)
        let deltaZ = Math.abs(currentPos.z - targetPos.z)
        let deltaY = Math.abs(currentPos.y - targetPos.y)
        if (deltaX <= 2 && deltaY == 0 && deltaZ <= 2) {
            return true
        }
    }
    return false
}


//获取玩家周围5格内的所有村民
function getVillageList() {
    return World.getEntities(7, 'minecraft:villager')
}

//获取玩家当前界面下的容器标题
function get_title() {
    return Player.openInventory().getContainerTitle()
}

//判断是否是玩家规定的容器标题
function is_title(title) {
    return get_title().includes(title)
}

//判断在规定时间内是否判断到玩家规定的容器标题
function waitTitle(title, maxtime) {
    while (maxtime--) {
        Client.waitTick(1)
        if (is_title(title)) {
            return Player.openInventory()
        }
    }
    return false
}

//村民交易
function villagerTrade(params) {

    for (let i = 0; i < getVillageList().length; i++) { // 遍历村民并交互
        player.interactEntity(getVillageList()[i], true);
        inv = waitTitle('石匠', 10)
        if (inv) {
            for (let j = 0; j < inv.getTrades().length; j++) { // 遍历村民交易项 并判断是否为需要的交易项 完成交易
                if (inv.getTrades()[j].getOutput().getItemID() == 'minecraft:quartz_block') { // 获取当前索引是否为石英
                    inv.selectTrade(j);
                    inv.quick(2);
                    inv.close();
                    break;
                }
            }
        }
    }
}

//交易条件
function can_trade() {
    let Time = getTime()
    return Time.hour >= 6 && lastday !== Time.day && !isRain()
}

//存放石英和拿取绿宝石
function SaveAndFetch() {
    Time.sleep(500);
    isMoveDone(-295186, 75, 289599)
    player.interactBlock(-295187, 77, 289602, 'up', false, true); // 石英存放的潜影盒位置
    inv = waitTitle("潜影盒", 10)
    for (let i = 27; i < 63; i++) {
        let slotId = inv.getSlot(i).getItemId(); // 获取物品槽中的物品ID
        if (slotId == 'minecraft:quartz_block') {
            inv.quick(i); // 快速移动物品
        }
    }
    inv.close();
    Time.sleep(1500);

    player.interactBlock(-295187, 77, 289602, 'up', false, true); // 石英存放的潜影盒位置
    inv = waitTitle("潜影盒", 10)
    for (let i = 27; i < 63; i++) {
        let slotId = inv.getSlot(i).getItemId(); // 获取物品槽中的物品ID
        if (slotId == 'minecraft:quartz_block') {
            inv.quick(i); // 快速移动物品
        }
    }
    inv.close();

    Time.sleep(500);
    inv = Player.openInventory();
    let emeraldCount = inv.getItemCount().get("minecraft:emerald"); // 获取背包当前绿宝石的数量
    while (emeraldCount <= 1728) { // 运行直到背包绿宝石数量大于等于1728
        player.interactBlock(-295186, 77, 289602, 'up', false, true); // 打开绿宝石存放的箱子
        inv = waitTitle("潜影盒", 10) // 等待物品栏加载
        emeraldCount2 += 64
        for (let i = 0; i < 27; i++) {
            let slotId = inv.getSlot(i).getItemId(); // 获取物品槽中的物品ID
            if (slotId == 'minecraft:emerald') {
                inv.quick(i); // 快速移动物品
                emeraldCount += 64; // 每次移动64个绿宝石
                inv.close();
                Time.sleep(1500);
                break;
            }
        }
    }
    Chat.say('/res tp Ktown');
    Time.sleep(5000)
    count += 1;
    Chat.log(`完成兑换石英第${count}次`);
    Chat.log(`本次拿取绿宝石${emeraldCount2}个`)
    emeraldCount2 = 0
}

//判断时间是否可以睡觉
function can_sleep() {
    let Time = getTime()
    return Time.hour >= 19 || Time.hour <= 4
}

//执行睡觉
function sleep() {
    home()
    player.interactBlock(-295193, 75, 289597, 'up', false, true)
    while (getTime().hour <= 5 || getTime().hour >= 19) {
        Time.sleep(100)
    }
}

//到位检测+交易
function trade_move(x, y, z, maxtime = 10) {
    if (isMoveDone(x, y, z, maxtime)) {
        villagerTrade()
    }

}

//执行所有交易点位
function tradeList() {
    home()
    trade_move(-295177, 78, 289591)
    trade_move(-295193, 78, 289591)
    trade_move(-295193, 78, 289608)
    trade_move(-295208, 78, 289608)
}

function startVillage() {
    villList = getVillageList()
    for (let i = 0; i < villList.length; i++) { // 遍历村民并交互
        player.interactEntity(villList[i], true);
        inv = waitTitle("石匠", 15)
    }
    Time.sleep(200)
    inv.close()
}

function start_move(x, y, z, maxtime = 10) {
    isMoveDone(x, y, z, maxtime)
    startVillage()
}

function startList() {
    home()
    start_move(-295177, 78, 289591)
    start_move(-295193, 78, 289591)
    start_move(-295193, 78, 289608)
    start_move(-295208, 78, 289608)
}

while (1) {
    if (can_trade()) {
        tradeList()
        SaveAndFetch()
        while (getTime().hour < 8) {
            Time.sleep(100)
        }
        if (!isRain() && getTime().hour <= 8) {
            startList()
            tradeList()
            SaveAndFetch()
        }
        lastday = getTime().day
    }
    if (can_sleep()) {
        sleep()
    }
}
