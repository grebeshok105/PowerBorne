const LIGHTNING = {
  MAX_CHARGE: 200,
  POWER: 'powerborne:god_of_thunder',
  // [No upgrades, U1, U2, U3]
  CHARGE_RATES: [1.1, 1.75, 2.5, 3.5],
  DRAIN_MULTIPLIERS: [0.9, 0.60, 0.30, 0.15],
  BEAM_DRAIN_PER_TICK: 1,
  CHAIN_LIGHTNING_COST: 20,
  PASSIVE_REGEN_INTERVALS: [0, 0, 60, 30],
  PASSIVE_REGEN_AMOUNT: 1,
  CHARGE_WARMUP_TICKS: 11,
  LIGHTNING_BOLT_INTERVAL: 5,
  GOD_MODE_DRAIN_PER_TICK: 200 / 1200,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getLightningCharge(player) {
  return palladium.getProperty(player, 'energy_bar_lightning') || 0;
}

function setLightningCharge(player, value) {
  palladium.setProperty(player, 'energy_bar_lightning', clamp(Math.round(value), 0, LIGHTNING.MAX_CHARGE));
}

function addLightningCharge(player, amount) {
  setLightningCharge(player, getLightningCharge(player) + amount);
}

function subLightningCharge(player, amount) {
  setLightningCharge(player, getLightningCharge(player) - amount);
}

function hasThor(player) {
  return abilityUtil.hasPower(player, LIGHTNING.POWER);
}

function isAbilityEnabled(player, ability) {
  return abilityUtil.isEnabled(player, LIGHTNING.POWER, ability);
}

function isAbilityUnlocked(player, ability) {
  return abilityUtil.isUnlocked(player, LIGHTNING.POWER, ability);
}

function getAbilityEnabledTicks(player, ability) {
  let instance = abilityUtil.getInstance(player, LIGHTNING.POWER, ability);
  return instance ? instance.getEnabledTicks() : 0;
}

function getUpgradeLevel(player) {
  if (isAbilityUnlocked(player, 'lightning_charge_upgrade_3')) return 3;
  if (isAbilityUnlocked(player, 'lightning_charge_upgrade_2')) return 2;
  if (isAbilityUnlocked(player, 'lightning_charge_upgrade_1')) return 1;
  return 0;
}

function getDrainMultiplier(player) {
  return LIGHTNING.DRAIN_MULTIPLIERS[getUpgradeLevel(player)];
}

function getChargeRate(player) {
  return LIGHTNING.CHARGE_RATES[getUpgradeLevel(player)];
}

function getPassiveRegenInterval(player) {
  return LIGHTNING.PASSIVE_REGEN_INTERVALS[getUpgradeLevel(player)];
}


function isCharging(player) {
  return isAbilityEnabled(player, 'lightning_charge_timer');
}

function isStormStrikePreActive(player) {
  return player.getTags().contains('powerborne.storm_strike_pre');
}

function isAnyDrainActive(player) {
  return isAbilityEnabled(player, 'lightning_blast_timer')
    || isAbilityEnabled(player, 'stormbreaker_blast_timer')
    || isAbilityEnabled(player, 'god_blast_timer')
    || isAbilityEnabled(player, 'lightning_burst_timer')
    || isAbilityEnabled(player, 'chain_lightning')
    || isAbilityEnabled(player, 'god_mode')
    || isStormStrikePreActive(player);
}

function isContinuousDrainActive(player) {
  return isAbilityEnabled(player, 'lightning_blast_timer')
    || isAbilityEnabled(player, 'stormbreaker_blast_timer')
    || isAbilityEnabled(player, 'god_blast_timer')
    || isAbilityEnabled(player, 'lightning_burst_timer')
    || isAbilityEnabled(player, 'god_mode')
    || isStormStrikePreActive(player);
}


function accumulateCharge(player, amount) {
  let accum = player.persistentData.getFloat('lc_charge_accum') + amount;
  let intPart = Math.floor(accum);
  if (intPart > 0) {
    addLightningCharge(player, intPart);
    accum -= intPart;
  }
  player.persistentData.putFloat('lc_charge_accum', accum);
}

function accumulateDrain(player, amount) {
  let accum = player.persistentData.getFloat('lc_drain_accum') + amount;
  let intPart = Math.floor(accum);
  if (intPart > 0) {
    subLightningCharge(player, intPart);
    accum -= intPart;
  }
  player.persistentData.putFloat('lc_drain_accum', accum);
}

function spawnChargingEffects(player, ticks) {
  player.level.spawnParticles(
    'minecraft:electric_spark', true,
    player.x, player.y + 1.0, player.z,
    0.2, 0.5, 0.2, 4, 0.01
  );

  if (ticks % LIGHTNING.LIGHTNING_BOLT_INTERVAL === 0) {
    let lightning = player.level.createEntity('minecraft:lightning_bolt');
    lightning.x = player.x;
    lightning.y = player.y + 1.95;
    lightning.z = player.z;
    lightning.setVisualOnly(true);
    lightning.spawn();

    player.level.spawnParticles(
      'powerborne:lightning', true,
      player.x, player.y + 0.5, player.z,
      0.3, 0.7, 0.3, 1, 0.01
    );
    player.level.spawnParticles(
      'minecraft:end_rod', true,
      player.x, player.y + 0.5, player.z,
      0.2, 0.5, 0.2, 2, 0.01
    );

    let nearbyEntities = player.level.getEntitiesWithin(player.getBoundingBox().inflate(1.5, 2.0, 1.5));
    nearbyEntities.forEach(entity => {
      if (entity !== player && entity.isAlive() && entity.isLiving()) {
        let distance = player.distanceToEntity(entity);
        if (distance <= 1.5) {
          entity.attack(player.damageSources().playerAttack(player), 3);
          entity.setSecondsOnFire(2);
          let dx = entity.x - player.x;
          let dz = entity.z - player.z;
          let magnitude = Math.sqrt(dx * dx + dz * dz);
          if (magnitude > 0) {
            entity.addMotion((dx / magnitude) * 0.3, 0.2, (dz / magnitude) * 0.3);
            entity.hurtMarked = true;
          }
        }
      }
    });
  }
}

PlayerEvents.tick(event => {
  let player = event.player;

  if (!hasThor(player)) return;

  let charge = getLightningCharge(player);
  let drainMult = getDrainMultiplier(player);

  if (isCharging(player)) {
    let chargeTicks = getAbilityEnabledTicks(player, 'lightning_charge_timer');

    if (chargeTicks > LIGHTNING.CHARGE_WARMUP_TICKS && charge < LIGHTNING.MAX_CHARGE) {
      accumulateCharge(player, getChargeRate(player));
      spawnChargingEffects(player, chargeTicks);
    }
  } else {
    player.persistentData.putFloat('lc_charge_accum', 0);
  }

  let godModeActive = isAbilityEnabled(player, 'god_mode');

  if (godModeActive) {
    tickGodModeAura(player);
    tickGodModeRunThrough(player);
    accumulateDrain(player, LIGHTNING.GOD_MODE_DRAIN_PER_TICK);
  } else {
    if (isAbilityEnabled(player, 'god_blast_timer')) {
      accumulateDrain(
        player,
        LIGHTNING.BEAM_DRAIN_PER_TICK * 2 * drainMult
      );
    } else if (
      isAbilityEnabled(player, 'lightning_blast_timer')
      || isAbilityEnabled(player, 'stormbreaker_blast_timer')
    ) {
      accumulateDrain(player, LIGHTNING.BEAM_DRAIN_PER_TICK * drainMult);
    }

    if (isAbilityEnabled(player, 'lightning_burst_timer')) {
      accumulateDrain(player, LIGHTNING.BEAM_DRAIN_PER_TICK * drainMult);
    }

    if (isStormStrikePreActive(player)) {
      accumulateDrain(player, LIGHTNING.BEAM_DRAIN_PER_TICK * drainMult);
    }

    if (isAbilityEnabled(player, 'chain_lightning')) {
      subLightningCharge(player, Math.round(LIGHTNING.CHAIN_LIGHTNING_COST * drainMult));
    }
  }

  if (!isContinuousDrainActive(player)) {
    player.persistentData.putFloat('lc_drain_accum', 0);
  }

  if (godModeActive) {
    palladium.setProperty(player, 'god_mode_cooldown', 3600);
  } else {
    let cooldown = palladium.getProperty(player, 'god_mode_cooldown') || 0;
    if (cooldown > 0) {
      palladium.setProperty(player, 'god_mode_cooldown', cooldown - 1);
    }
  }

  let regenInterval = getPassiveRegenInterval(player);

  if (regenInterval > 0 && !isCharging(player) && !isAnyDrainActive(player) && charge < LIGHTNING.MAX_CHARGE) {
    if (player.age % regenInterval === 0) {
      addLightningCharge(player, LIGHTNING.PASSIVE_REGEN_AMOUNT);
    }
  }
});