const MJOLNIR_CLASH = {
	RADIUS: 6,
	COOLDOWN_TICKS: 250,
	KNOCKBACK: 0.6,
	MAX_DAMAGE: 20,
	MIN_DAMAGE: 10
};

function calculateDistanceBasedValue(distance, maxValue, minValue, maxRadius) {
	if (distance <= 1.0) return maxValue;
	let t = Math.max(0, Math.min(1, (distance - 1.0) / (maxRadius - 1.0)));
	return maxValue - t * (maxValue - minValue);
}

global.runShieldMjolnirClash = function (shieldPlayer, anchorEntity, mjolnirUser, projectile) {
	if (!shieldPlayer || !shieldPlayer.isPlayer() || !shieldPlayer.isAlive()) return;
	if (!anchorEntity || !anchorEntity.isAlive()) return;

	let level = shieldPlayer.level;
	let ox = anchorEntity.x;
	let oy = anchorEntity.y;
	let oz = anchorEntity.z;

	level.spawnParticles("minecraft:flash", true, ox, oy, oz, 1, 0, 1, 3, 0.1);
	level.spawnParticles('minecraft:firework', true, ox, oy, oz, 0.6, 0.6, 0.6, 40, 0.1);
	level.spawnParticles('minecraft:explosion', true, ox, oy + 0.6, oz, 0, 0, 0, 1, 0);

	level.getEntitiesOfClass(Java.loadClass("net.minecraft.world.entity.player.Player"), anchorEntity.getBoundingBox().inflate(64))
	.forEach((player) => {
		player.sendData("shield_block_particles", { x: ox, y: oy, z: oz });
	});

	level.playSound(null, ox, oy, oz, "powerborne:shield_mjolnir_hit", "players", 1.5, 1);
	if (shieldPlayer.isPlayer()) {
		shieldPlayer.addItemCooldown(CAP_SHIELD_ID, MJOLNIR_CLASH.COOLDOWN_TICKS);
		shieldPlayer.stopUsingItem();
	}
	if (mjolnirUser && mjolnirUser.isPlayer()) {
		mjolnirUser.addItemCooldown("powerborne:mjolnir", 100);
		mjolnirUser.addItemCooldown("powerborne:stormbreaker", 100);
	}
	global.breakReplaceableInRadius(level, shieldPlayer, ox, oy, oz, MJOLNIR_CLASH.RADIUS);

	let area = anchorEntity.getBoundingBox().inflate(MJOLNIR_CLASH.RADIUS);
	let str = MJOLNIR_CLASH.KNOCKBACK;
	let dmgSrc = shieldPlayer.damageSources().playerAttack(shieldPlayer);

	level.getEntitiesWithin(area).forEach((entity) => {
		if (entity && entity.isPlayer() && entity.isAlive()) {
			entity.sendData("screen_shake", { ticks: 20, base_intensity: 1, max_intensity: 3 });
		}

		if (!entity || !entity.isLiving() || !entity.isAlive()) return;

		let isMjolnirUser = mjolnirUser && mjolnirUser.isAlive() && entity.uuid === mjolnirUser.uuid;
		let isShieldOwner = entity.uuid === shieldPlayer.uuid;

		if (!projectile && isShieldOwner) return;

		let applyClashDamage = projectile || !isMjolnirUser;
		if (applyClashDamage) {
			let dx = entity.x - ox;
			let dy = entity.y + entity.getBbHeight() * 0.5 - oy;
			let dz = entity.z - oz;
			let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
			let damage = calculateDistanceBasedValue(
				dist,
				MJOLNIR_CLASH.MAX_DAMAGE,
				MJOLNIR_CLASH.MIN_DAMAGE,
				MJOLNIR_CLASH.RADIUS
			);
			entity.attack(dmgSrc, damage);
			if (!entity.isAlive()) return;
		}

		let dx = entity.x - ox;
		let dz = entity.z - oz;
		entity.setMotion(dx * str, 0.5, dz * str);
		entity.hurtMarked = true;
	});
};
