                //id, craftAll = true
function craft(id, craftAll = true) {

    let inv = Player.openInventory();//打开工作台后需要刷新背包
    if (!!inv.getCraftableRecipes()) {//确认可以合成某些物品
        if (!inv.getCraftableRecipes().toString().includes(61)) {//如果可合成物品没有包含需要合成物品的ID
            inv.close();//关闭工作台
            return false;//返回
        }
    }

    const recipe = inv.getCraftableRecipes()?.find(r => (r.getOutput().getItemId() === id));//获得合成配方

    if (!recipe) {//如果合成配方不存在
        inv.close();//关闭工作台
        return false;//返回
    }

    while (recipe.getCraftableAmount()) {//当可合成数量不为0
        recipe.craft(craftAll);//合成（是否全部合成）
        inv.quick(0);//将输出框物品全部取出到背包
        Client.waitTick(5);//等待1tick
    }
    inv.close();//关闭工作台

    while (Hud.getOpenScreenName()) {//当还有Hud在前台显示（即仍未关闭工作台）时 进行等待
        Client.waitTick();
    }

    return true;//完成合成 退出函数
}