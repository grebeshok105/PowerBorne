let $MinecraftClient = Java.loadClass("net.minecraft.client.Minecraft");
let $MinecraftClient_BetterCombat;
if (Platform.isLoaded("bettercombat")) {
	$MinecraftClient_BetterCombat = Java.loadClass("net.bettercombat.api.MinecraftClient_BetterCombat");
}

if ($MinecraftClient_BetterCombat) {
	let lastBcSwingSent = -1;

	ClientEvents.tick((event) => {
		let player = event.player;
		if (!player || !player.isAlive()) return;

		let client = $MinecraftClient.getInstance();
		if (!client || !client.player) return;
		if (!(client instanceof $MinecraftClient_BetterCombat)) return;

		let bcSwing = client.isWeaponSwingInProgress() ? 1 : 0;
		if (bcSwing !== lastBcSwingSent) {
			lastBcSwingSent = bcSwing;
			player.sendData("vibranium_shield_bc_swing", { bcSwing: bcSwing });
		}
	});
}
