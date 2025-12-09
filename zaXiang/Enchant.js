var delay = 0   //网非常卡才需要加的延时
var level = 30  //等级下限
var enchant = 3 //附魔第n个选项
var anticheat = 0//如果你发包过多被踢出了，那么这个改成1

function EnchantSlot(i){
    inv = Player.openInventory()
    inv.quick(i)
    while(inv.getSlot(0).getItemId() == "minecraft:air"&&inv.getType() == "Enchanting Table"){
        Client.waitTick(1)
        inv = Player.openInventory()
    }
    inv = Player.openInventory()
    if(inv.findFreeInventorySlot() == -1) return
    Client.waitTick(1)
    inv.doEnchant(enchant-1)
    while(!inv.getSlot(0).isEnchanted()&&inv.getType() == "Enchanting Table"&&inv.getSlot(0).getItemId() != "minecraft:enchanted_book"){
        Client.waitTick(anticheat)
        inv.doEnchant(enchant-1)
        inv = Player.openInventory()
    }
    Client.waitTick(anticheat)
    inv.quick(0)
    while(inv.getSlot(0).getItemId()!="minecraft:air"&&inv.getType() == "Enchanting Table"){
        Client.waitTick(1)
        inv = Player.openInventory()
    }
    return 
}

function main(){
    if(!World.isWorldLoaded())return
    Client.waitTick(delay)
    var inv = Player.openInventory()
    if(inv.getType() != "Enchanting Table") return
    var player = Player.getPlayer()
    if(player.getXPLevel() < level){
        Chat.actionbar("等级不够")
        inv.close()
        return
    }
    var t=0
    for(let i = 2; i < 38; i++){
        let slot = inv.getSlot(i)
        if((slot.isEnchantable() && !slot.isEnchanted()) || slot.getItemId() == "minecraft:book"){
        let Count = slot.getCount()
        for(let k = 0; k < Count; k++){
            for(let j = 2; j < 38; j++){
                if(inv.getLapis().getCount() > 5)break
                let slot = inv.getSlot(j)
                if(slot.getItemId() == "minecraft:lapis_lazuli"){
                    inv.quick(j)
                    Client.waitTick(delay)
                    if(inv.getLapis().getCount() > 5)break
                }
            }
            if(inv.getLapis().getCount() < 3){
                Chat.actionbar("青金石不够")
                inv.close()
                return
            }
            t++
            EnchantSlot(i)
            if(player.getXPLevel()<level){
                Chat.actionbar("等级不够")
                inv.close()
                return
            }
        }
        Client.waitTick(delay)
        }
        
    }
    Client.waitTick(1)
    if(t>0)Chat.actionbar("成功附魔"+t+"个物品")
    else Chat.actionbar("没有匹配的物品")
    inv.close()
}
main()
