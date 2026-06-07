const SHIELD_RUSH = {
	SPEED: 1.4,
	FALL_SCALE: 0.5,
	DAMAGE: 10,
	KNOCKBACK: 3.0
};

PlayerEvents.tick((event) => {
	let player = event.player;
	let pData = player.persistentData;

	if (!abilityUtil.hasPower(player, CAP_POWER)) {
		pData.remove('shieldRushActive');
		pData.remove('shieldRushHitEntities');
		pData.remove('shieldRushHx');
		pData.remove('shieldRushHz');
		return;
	}

	let rushOn = abilityUtil.isEnabled(player, CAP_POWER, 'shield_rush') || abilityUtil.isEnabled(player, CAP_POWER, 'shield_rush_u3');
	let validShield = isShieldFunctional(player.mainHandItem);
	let isRushing = rushOn && validShield;

	if (isRushing) {
		if (!pData.shieldRushActive) {
			let look = player.getLookAngle();
			let hLen = Math.sqrt(look.x() * look.x() + look.z() * look.z()) || 1;
			pData.shieldRushHx = look.x() / hLen;
			pData.shieldRushHz = look.z() / hLen;
			pData.shieldRushHitEntities = '';
			pData.shieldRushActive = true;

			player.level.playSound(null, player.x, player.y, player.z, 'minecraft:entity.player.attack.knockback', player.getSoundSource(), 0.78, 1.0);
		}

		let vy = player.getDeltaMovement().y();
		if (vy < 0) vy *= SHIELD_RUSH.FALL_SCALE;
		player.setMotion(pData.shieldRushHx * SHIELD_RUSH.SPEED, vy, pData.shieldRushHz * SHIELD_RUSH.SPEED);
		player.hurtMarked = true;

		let hitBox = player.getBoundingBox().move(pData.shieldRushHx, 0.4, pData.shieldRushHz).inflate(0.5);
		player.level.getEntitiesWithin(hitBox).forEach(target => {
			if (target.uuid == player.uuid || !target.isLiving() || !target.isAlive()) return;

			let uuidStr = `|${target.uuid}|`;
			if (pData.shieldRushHitEntities.indexOf(uuidStr) !== -1) return;

			target.persistentData.capLastHitAbility = 'shield_rush';
			target.persistentData.capLastHitTick = Number(target.level.gameTime);
			target.attack(player.damageSources().playerAttack(player), SHIELD_RUSH.DAMAGE);
			target.knockback(SHIELD_RUSH.KNOCKBACK, -pData.shieldRushHx, -pData.shieldRushHz);
			pData.shieldRushHitEntities += uuidStr;

			player.level.playSound(null, target.x, target.y, target.z, 'powerborne:shield_hit', player.getSoundSource(), 0.7, 1.0);
		});
	} else {
		pData.remove('shieldRushActive');
		pData.remove('shieldRushHitEntities');
		pData.remove('shieldRushHx');
		pData.remove('shieldRushHz');
	}
});