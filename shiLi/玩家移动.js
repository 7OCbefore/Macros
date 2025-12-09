var player = Player.getInteractionManager()	//返回 InteractionManagerHelper 记为player

function move(forward,sideway,yaw,pitch,jumping,sneaking,sprinting,time){//定义一个函数

    jumping=(jumping==1)
    sneaking=(sneaking==1)
    sprinting=(sprinting==1)	//把1和0转换成true和false(大概)

    if(yaw=='~')yaw=Player.getPlayer().getYaw()	//如果这里输入是字符'~'，那么把它变成玩家当前的视线角度
    if(pitch=='~')pitch=Player.getPlayer().getPitch()//getPlayer()返回 ClientPlayerEntityHelper，可以获取玩家相关信息

    for(let i=0;i<time;i++){
        Player.addInput(Player.createPlayerInput(forward,sideway,yaw,pitch,jumping,sneaking,sprinting))
			//addInput是向队列中添加一个操作，createPlayerInput是创建一个操作
	}
    Client.waitTick(time)
			//队列中的操作会在1gt中运行一个，为了保证与程序同步，加上与操作数量相当的延时
}


move(90,0,'~','~',0,0,0,4);
// move(1,0,'~','~',1,0,0,1)
// move(1,0,'~','~',0,0,0,2)
//调用函数，传入参数
