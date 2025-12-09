const reverse = !GlobalVars.getBoolean("fly");
GlobalVars.putBoolean("fly", reverse);
if (reverse) {
    Chat.actionbar(Chat.createTextBuilder().append("[").withColor(0x7)
        .append("fly").withColor(0x5)
        .append("]").withColor(0x7).append(" enabled").withColor(0xc)
        .build());
    var player = Player.getPlayer()
    var d=1
    var pos = player.getPos()
    var v = pos.scale(0)
} else {
    Chat.actionbar(Chat.createTextBuilder().append("[").withColor(0x7)
        .append("fly").withColor(0x5)
        .append("]").withColor(0x7).append(" disabled").withColor(0xc)
        .build());
}


while (GlobalVars.getBoolean("fly")) {

    v = v.scale(0.5)
    pos = player.getPos()
    let keys = KeyBind.getPressedKeys()

    let yaw = player.getYaw()/180*Math.PI
    let x = -Math.sin(yaw)*d
    let z = Math.cos(yaw)*d

    if(keys.contains("key.keyboard.space")){
        v = v.add(0,d,0)
    }
    if(keys.contains("key.keyboard.left.ctrl")){
        v = v.add(0,-d,0)
    }
    if(keys.contains("key.keyboard.w")){
        v = v.add(x,0,z)
    }
    if(keys.contains("key.keyboard.a")){
        v = v.add(z,0,-x)
    }
    if(keys.contains("key.keyboard.s")){
        v = v.add(-x,0,-z)
    }
    if(keys.contains("key.keyboard.d")){
        v = v.add(-z,0,x)
    }
    if(keys.contains("key.mouse.4")){//鼠标侧键（可以自己改成别的
        if(d<10)d+=0.1  //如果d小于10(上限),加0.1
        Chat.actionbar(Chat.createTextBuilder()
        .append("speed now").withColor(0x5)
        .append(" ").withColor(0xc)
        .append(Math.floor(d*10)/10).withColor(0x5)
        .build());  //把当前速度提示发到快捷栏上方
    }
    if(keys.contains("key.mouse.5")){//鼠标侧键（可以自己改成别的
        if(d>0.1)d-=0.1 //如果d大于0.1(下限),减0.1
        Chat.actionbar(Chat.createTextBuilder()
        .append("speed now").withColor(0x5)
        .append(" ").withColor(0xc)
        .append(Math.floor(d*10)/10).withColor(0x5)
        .build());  //把当前速度提示发到快捷栏上方
    }
    
    
    if(World.getBlock(pos.add(0,v.getY(),0)).getId() != "minecraft:air")
        v = v.multiply(1,0,1).add(0,0.01,0)
    player.setVelocity(v)
    Client.waitTick(1)//等待1gt
    
}
