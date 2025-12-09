var delay = 0
function main(){
    if(!World.isWorldLoaded())return
    var inv = Player.openInventory()
    if(inv.getType() != "Grindstone") return
    var t = 0
    for(let i=3; i<39; i++){
        let slot = inv.getSlot(i)
        if((slot.isEnchanted()||slot.getItemId()=="minecraft:enchanted_book")&&slot.getRepairCost()<1){
            inv.quick(i)
            inv.quick(2)
            //Client.waitTick(delay)
            while((inv.getSlot(0).getItemId() != "minecraft:air"||inv.getSlot(2).getItemId() != "minecraft:air")&&inv.getContainerTitle() == "附魔"){
                Client.waitTick(1)
            }
            t++
        }
        Client.waitTick(delay)
    }
    if(t>0)Chat.actionbar("成功祛魔"+t+"个物品")
    else Chat.actionbar("没有匹配的物品")
    inv.close()
}
main()