const CAP_POWER = 'powerborne:captain_america';
const CAP_SHIELD_ID = 'powerborne:vibranium_shield';
const CAPA = {
	DOUBLE_JUMP_CD: 50,
	EXHAUSTION_GAIN_FACTOR: 0.5,
	IMMUNE_EFFECTS: [
		'minecraft:poison',
		'minecraft:hunger',
		'minecraft:nausea',
		'minecraft:weakness'
	]
};

PlayerEvents.tick((event) => {
	let player = event.player;	
	let food = player.getFoodData();
	let currentExhaustion = food.getExhaustionLevel();
	let cooldown = player.persistentData.doubleJumpCd || 0;
	if (cooldown > 0) {
		player.resetFallDistance();
		player.persistentData.doubleJumpCd = cooldown - 1;
	}

	if (!abilityUtil.hasPower(player, CAP_POWER)) {
		player.persistentData.capPrevExhaustion = currentExhaustion;
		return;
	}

	CAPA.IMMUNE_EFFECTS.forEach((effectId) => {
		if (player.hasEffect(effectId)) {
			player.removeEffect(effectId);
		}
	});
	let prevExhaustion = player.persistentData.capPrevExhaustion ?? currentExhaustion;
	if (currentExhaustion > prevExhaustion) {
		let gainedExhaustion = currentExhaustion - prevExhaustion;
		let adjustedExhaustion = prevExhaustion + gainedExhaustion * CAPA.EXHAUSTION_GAIN_FACTOR;
		food.setExhaustion(adjustedExhaustion);
		currentExhaustion = food.getExhaustionLevel();
	}

	player.persistentData.capPrevExhaustion = currentExhaustion;
});

NetworkEvents.dataReceived('captain_america_double_jump', (event) => {
	let player = event.player;
	if (!player || !abilityUtil.hasPower(player, CAP_POWER)) return;
	if (player.onGround()) return;

	let cd = player.persistentData.doubleJumpCd || 0;
	if (cd > 0) return;

	if (Platform.isForge()) {
		player.jumpFromGround();
	} else {
		player['method_6043']();
	}
	player.hurtMarked = true;
	player.persistentData.doubleJumpCd = CAPA.DOUBLE_JUMP_CD;
	player.level.playSound(
		null,
		player.x,
		player.y,
		player.z,
		'minecraft:entity.goat.long_jump',
		player.getSoundSource(),
		0.5,
		0.8 + Math.random() * 0.1
	);

	player.level.spawnParticles(
		'minecraft:poof',
		true,
		player.x,
		player.y + 0.15,
		player.z,
		0.08,
		0.06,
		0.08,
		2,
		0.015
	);

	global.levelingSystem.awardXPForAbility(player, CAP_POWER, 'super_soldier_u1');
});
