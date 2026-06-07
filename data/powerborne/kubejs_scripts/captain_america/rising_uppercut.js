const UPPERCUT = {
	RADIUS: 2.25,
	MAX_TARGETS: 3,
	PLAYER_VY: 1.1,
	ENTITY_VY: 1.1
};

PlayerEvents.tick((event) => {
	let player = event.player;
	if (!abilityUtil.hasPower(player, CAP_POWER)) return;
    let abilityInstance = abilityUtil.getInstance(player, CAP_POWER, 'rising_uppercut');
    if (!abilityInstance || !abilityInstance.isEnabled()) {
        abilityInstance = abilityUtil.getInstance(player, CAP_POWER, 'rising_uppercut_u3');
    }
    let enabledTicks = abilityInstance ? abilityInstance.getEnabledTicks() : 0;
    if (abilityInstance && abilityInstance.isEnabled() && enabledTicks == 1) {
		let mainHand = player.getMainHandItem();

		let withShield = mainHand && !mainHand.isEmpty() && mainHand.id === CAP_SHIELD_ID;
		let damage = player.getAttributeValue('minecraft:generic.attack_damage');
		if (!isFinite(damage) || damage < 0) damage = 0;

		let cx = player.x;
		let cy = player.y + player.getBbHeight() * 0.5;
		let cz = player.z;
		let r = UPPERCUT.RADIUS;

		let candidates = [];
		player.level.getEntitiesWithin(AABB.of(cx - r, cy - r, cz - r, cx + r, cy + r, cz + r)).forEach((entity) => {
			if (!entity || !entity.isLiving() || !entity.isAlive()) return;
			if (entity.uuid === player.uuid) return;
			if (entity.isPlayer() && entity.isSpectator()) return;

			let ex = entity.x;
			let ey = entity.y + entity.getBbHeight() * 0.5;
			let ez = entity.z;
			let dx = ex - cx;
			let dy = ey - cy;
			let dz = ez - cz;
			let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
			if (dist > UPPERCUT.RADIUS) return;

			candidates.push({ entity: entity, dist: dist });
		});

		candidates.sort((a, b) => a.dist - b.dist);

		let hitCount = Math.min(UPPERCUT.MAX_TARGETS, candidates.length);
		for (let i = 0; i < hitCount; i++) {
			let hit = candidates[i];
			let entity = hit.entity;
			entity.persistentData.capLastHitAbility = 'rising_uppercut';
			entity.persistentData.capLastHitTick = Number(entity.level.gameTime);
			entity.attack(player.damageSources().playerAttack(player), damage);
			entity.setMotion(entity.getDeltaMovement().x(), UPPERCUT.ENTITY_VY, entity.getDeltaMovement().z());
			entity.hurtMarked = true;

			if (withShield) {
				player.level.playSound(
					null,
					entity.x,
					entity.y,
					entity.z,
					'powerborne:shield_hit',
					player.getSoundSource(),
					0.7,
					0.95 + Math.random() * 0.1
				);
			} else {
				player.level.playSound(
					null,
					entity.x,
					entity.y,
					entity.z,
					'minecraft:entity.player.attack.strong',
					player.getSoundSource(),
					0.55,
					0.92 + Math.random() * 0.08
				);
			}

			player.level.spawnParticles(
				'minecraft:crit',
				true,
				entity.x,
				entity.y + entity.getBbHeight() * 0.5,
				entity.z,
				0.35,
				0.35,
				0.35,
				8,
				0.06
			);
		}

		if (
			hitCount > 0 &&
			mainHand &&
			!mainHand.isEmpty() &&
			mainHand.isDamageableItem() &&
			!(mainHand.nbt && mainHand.nbt.Unbreakable)
		) {
			mainHand.hurtAndBreak(1, player, (e) => e.level.broadcastEntityEvent(e, 47));
		}

		player.setMotion(0, UPPERCUT.PLAYER_VY, 0);
		player.hurtMarked = true;
		player.resetFallDistance();

		player.level.playSound(
			null,
			player.x,
			player.y,
			player.z,
			'minecraft:entity.player.attack.strong',
			player.getSoundSource(),
			0.85,
			0.85 + Math.random() * 0.1
		);
		player.level.spawnParticles('minecraft:sweep_attack', true, player.x, player.y + 1.0, player.z, 0.4, 0.35, 0.4, 6, 0.04);
		player.level.spawnParticles('minecraft:poof', true, player.x, player.y + 0.3, player.z, 0.3, 0.2, 0.3, 4, 0.03);
	}
});

EntityEvents.hurt(event => {
	let entity = event.entity;
	if (!entity.isPlayer()) return;
	if (abilityUtil.isEnabled(entity, CAP_POWER, 'rising_uppercut') || abilityUtil.isEnabled(entity, CAP_POWER, 'rising_uppercut_u3')) {
		event.cancel();
	}
});
