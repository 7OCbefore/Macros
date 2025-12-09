var blist;
var player = Player.getPlayer()
blist = World.getWorldScanner().withStringBlockFilter().contains("minecraft:chest").build().scanAroundPlayer(16);
Hud.clearDraw3Ds()
for(let i = 0;i < blist.size();i++){
    Hud.createDraw3D().register().addBox(blist[i].getX()+0.25, blist[i].getY()+0.25, blist[i].getZ()+0.25, blist[i].getX()+0.75, blist[i].getY()+0.75, blist[i].getZ()+0.75, 6749952, 0, true)
    //Hud.createDraw3D().register().addTraceLine(blist[i].getX()+0.5, blist[i].getY()+0.5, blist[i].getZ()+0.5, 6749952)
    //跟踪线
    }