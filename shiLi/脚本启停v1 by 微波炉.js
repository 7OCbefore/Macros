//By 微波炉

var scriptName = '3';
var shouldScriptRun = !GlobalVars.getBoolean(scriptName);//取反 若新建脚本 则取得false后反转为true 将正常运行
GlobalVars.putBoolean(scriptName, shouldScriptRun);//将本次取得结果存入 ${scriptName} 的全局变量里

function resetScriptStatus() {//请务必在程序正常运行退出时执行该语句 否则会一直视为脚本还在运行
    shouldScriptRun = !GlobalVars.getBoolean(scriptName);
    GlobalVars.putBoolean(scriptName, shouldScriptRun);
}

function main() {
    //检查是否有相同脚本在运行
    if (!shouldScriptRun) {
        Chat.log('检测到本次脚本启动是由于脚本关闭键与启动键相同导致的 不需要向下运行 立即停止。');
        resetScriptStatus();//本次不是有效启动 重置脚本运行情况为false
        return 0;//如果不是放在main里（或存在异步函数）请使用JavaWrapper.stop()
    };
    //绑定按键
    var keyEvent = JsMacros.on("Key",JavaWrapper.methodToJava((e) => {
        if (e.key == "key.keyboard.x" && e.action == 1) {//绑定按键“p”，且只有在按下p时触发（若不加action判断 则脚本在正常启动后 此处会立即检测到释放了“p”键 从而导致脚本启动即关闭）
            Chat.log('脚本 关闭了。');
            // Java.type("java.lang.System").exit(0)// 停止所有脚本但是游戏会崩掉
            JavaWrapper.stop();//使用此命令等同于在GUI强制停止脚本中的所有线程
        };
    }));
    Chat.log('脚本 开始正常执行');
    //do sth...
}

main();
resetScriptStatus();//正常运行退出时执行该语句 恢复脚本运行状态为false
JavaWrapper.stop();//使用此命令是为了保险起见 不然可能会有其他异步事件而导致脚本一直在线程上没结束