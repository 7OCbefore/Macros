const jackoPos = { x: -57, y: 71, z: -115 };

const player = Player.getPlayer();
const facing = player.getFacingDirection().getName();
Chat.log("面向: " + facing);

Chat.log("交互: " + jackoPos.x + ", " + jackoPos.y + ", " + jackoPos.z);

// Player.getInteractionManager().attack();

Player.getInteractionManager().interact();