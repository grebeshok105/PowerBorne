const SS2_ABILITY = 'super_soldier_u2';
const SS2_ATK_SPD_MODIFIER_ID = 'powerborne:super_soldier_momentum';

const SS2 = {
	MAX_STACKS: 150,
	STACK_ON_HIT: 10,
	GRACE_TICKS: 20,
	DECAY_PER_TICK: 4,
	HIT_COOLDOWN_FRACTION: 0.99,
	TIERS: [
		{ min: 150, amp: 3, speedAdd: 1.4 },
		{ min: 110, amp: 2, speedAdd: 1.0 },
		{ min: 75,  amp: 1, speedAdd: 0.6 },
		{ min: 30,  amp: 0, speedAdd: 0.2 }
	]
};

let $AllEffects = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries').MOB_EFFECT;
let $MobEffectInstance = Java.loadClass('net.minecraft.world.effect.MobEffectInstance');

function getTierIndex(stacks) {
	for (let i = 0; i < SS2.TIERS.length; i++) {
		if (stacks >= SS2.TIERS[i].min) return i;
	}
	return -1;
}

function applyHiddenHaste(player, amp) {
	let effect = $AllEffects.get('minecraft:haste');
	if (!effect) return;
	let instance = new $MobEffectInstance(effect, 10, amp, false, false, false);
	player.addEffect(instance);
}

function clearMomentum(player) {
	player.removeAttribute('minecraft:generic.attack_speed', SS2_ATK_SPD_MODIFIER_ID);
	player.persistentData.ss2Stacks = 0;
	player.persistentData.ss2Grace = 0;
	player.persistentData.ss2TierIdx = -1;
}

PlayerEvents.tick((event) => {
	let player = event.player;
	if (!player || !player.isAlive()) return;

	let hasPower = abilityUtil.hasPower(player, CAP_POWER);
	let u2Enabled = hasPower && abilityUtil.isEnabled(player, CAP_POWER, SS2_ABILITY);

	if (!u2Enabled) {
		if ((player.persistentData.ss2Stacks || 0) > 0 || (player.persistentData.ss2TierIdx ?? -1) !== -1) {
			clearMomentum(player);
		}
		return;
	}

	player.persistentData.ss2Tick = (player.persistentData.ss2Tick || 0) + 1;

	let stacks = player.persistentData.ss2Stacks || 0;
	let grace = player.persistentData.ss2Grace || 0;

	if (grace > 0) {
		grace -= 1;
	} else if (stacks > 0) {
		stacks = Math.max(0, stacks - SS2.DECAY_PER_TICK);
	}

	let newTierIdx = getTierIndex(stacks);
	let prevTierIdx = player.persistentData.ss2TierIdx ?? -1;

	if (newTierIdx !== prevTierIdx) {
		if (newTierIdx === -1) {
			player.removeAttribute('minecraft:generic.attack_speed', SS2_ATK_SPD_MODIFIER_ID);
		} else {
			let tier = SS2.TIERS[newTierIdx];
			player.modifyAttribute('minecraft:generic.attack_speed', SS2_ATK_SPD_MODIFIER_ID, tier.speedAdd, 'addition');
		}
		player.persistentData.ss2TierIdx = newTierIdx;
	}

	if (newTierIdx !== -1) {
		applyHiddenHaste(player, SS2.TIERS[newTierIdx].amp);
	}

	player.persistentData.ss2Stacks = stacks;
	player.persistentData.ss2Grace = grace;
});

EntityEvents.hurt((event) => {
	let target = event.entity;
	let source = event.source;
	if (!target || !source) return;

	let type = source.type().msgId();
	if (type !== 'player') return;

	let attacker = source.immediate || source.player || source.entity;
	if (!attacker || !attacker.isPlayer || !attacker.isPlayer()) return;
	if (attacker === target) return;
	if (!target.isLiving || !target.isLiving()) return;

	if (!abilityUtil.hasPower(attacker, CAP_POWER)) return;
	if (!abilityUtil.isEnabled(attacker, CAP_POWER, SS2_ABILITY)) return;

	let dmg = event.damage || 0;
	if (dmg <= 1.5) return;

	let now = attacker.persistentData.ss2Tick || 0;
	let lastHitTick = attacker.persistentData.ss2LastHitTick || 0;
	let atkSpd = Math.max(0.001, attacker.getAttributeValue('minecraft:generic.attack_speed'));
	let requiredGap = Math.max(2, Math.floor((20 / atkSpd) * SS2.HIT_COOLDOWN_FRACTION));
	if (now - lastHitTick < requiredGap) {
		attacker.persistentData.ss2LastHitTick = now;
		return;
	}
	attacker.persistentData.ss2LastHitTick = now;

	let stacks = Math.min(SS2.MAX_STACKS, (attacker.persistentData.ss2Stacks || 0) + SS2.STACK_ON_HIT);
	attacker.persistentData.ss2Stacks = stacks;
	attacker.persistentData.ss2Grace = SS2.GRACE_TICKS;
});
