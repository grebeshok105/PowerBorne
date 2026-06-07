let IronManVec3 = Java.loadClass('net.minecraft.world.phys.Vec3');

const IRON_MAN = {
  POWER: 'powerborne:iron_man',
  MAX_ENERGY: 1000,
  REGEN_PER_TICK: 3 / 20,
  TARGETING_DRAIN_PER_TICK: 3 / 20,
  FLIGHT_DRAIN_PER_TICK: 2 / 20,
  FAST_FLIGHT_DRAIN_PER_TICK: 5 / 20,
  SUPERSONIC_COST: 75,
  REPULSOR_COST: 35,
  REPULSOR_DAMAGE: 7,
  REPULSOR_RANGE: 24,
  UNIBEAM_REQUIRED: 200,
  UNIBEAM_DRAIN_PER_TICK: 12 / 20,
  UNIBEAM_CHARGE_TICKS: 40,
  UNIBEAM_DAMAGE: 3,
  UNIBEAM_RANGE: 24,
  REACTOR_ITEM: 'powerborne:iron_man_reactor',
  REACTOR_SWAP_TICKS: 100,
  REACTOR_SWAP_THRESHOLD: 100,
  MANUAL_REACTOR_GAIN: 500
};

function ironManHasPower(player) {
  return abilityUtil.hasPower(player, IRON_MAN.POWER);
}

function ironManEnabled(player, ability) {
  return abilityUtil.isEnabled(player, IRON_MAN.POWER, ability);
}

function ironManGetEnergy(player) {
  return palladium.getProperty(player, 'energy_bar_arc') || 0;
}

function ironManSetEnergy(player, value) {
  let max = palladium.getProperty(player, 'energy_bar_arc_max') || IRON_MAN.MAX_ENERGY;
  let clamped = Math.max(0, Math.min(max, Math.round(value)));
  palladium.setProperty(player, 'energy_bar_arc', clamped);
}

function ironManAddEnergy(player, amount) {
  ironManSetEnergy(player, ironManGetEnergy(player) + amount);
}

function ironManSubEnergy(player, amount) {
  ironManSetEnergy(player, ironManGetEnergy(player) - amount);
}

function ironManAccumulate(player, key, amount, applyWhole) {
  let accum = player.persistentData.getFloat(key) + amount;
  let whole = Math.floor(accum);
  if (whole > 0) {
    applyWhole(whole);
    accum -= whole;
  }
  player.persistentData.putFloat(key, accum);
}

function ironManDrain(player, key, amount) {
  ironManAccumulate(player, key, amount, spent => ironManSubEnergy(player, spent));
}

function ironManCanAffect(entity) {
  if (!entity || !entity.isLiving() || !entity.isAlive()) return false;
  if (entity.isPlayer() && (entity.isCreative() || entity.isSpectator())) return false;
  return true;
}

function ironManDamageSource(player, typeId) {
  if (global.getDamageSource) {
    try {
      return global.getDamageSource(player.level, typeId);
    } catch (e) { }
  }
  return player.damageSources().playerAttack(player);
}

function ironManConeTargets(player, range, dotThreshold, inflateXZ, inflateY) {
  let eyePos = new IronManVec3(player.x, player.y + player.getEyeHeight(), player.z);
  let look = player.getLookAngle();
  let area = player.getBoundingBox().expandTowards(look.scale(range)).inflate(inflateXZ, inflateY, inflateXZ);
  let targets = [];

  player.level.getEntitiesWithin(area).forEach(entity => {
    if (entity === player || !ironManCanAffect(entity)) return;

    let center = new IronManVec3(entity.x, entity.y + entity.getBbHeight() * 0.5, entity.z);
    let toEntity = center.subtract(eyePos);
    let distance = toEntity.length();
    if (distance > range) return;

    if (distance >= 0.001 && look.dot(toEntity.normalize()) <= dotThreshold) return;
    if (!player.hasLineOfSight(entity)) return;
    targets.push({ entity: entity, distance: distance });
  });

  targets.sort((a, b) => a.distance - b.distance);
  return targets;
}

function ironManClosestTarget(player, range, dotThreshold, inflateXZ, inflateY) {
  let targets = ironManConeTargets(player, range, dotThreshold, inflateXZ, inflateY);
  return targets.length > 0 ? targets[0].entity : null;
}

function ironManKnockAway(player, entity, strength, yBoost) {
  let dx = entity.x - player.x;
  let dz = entity.z - player.z;
  let planar = Math.sqrt(dx * dx + dz * dz) || 1;
  entity.addMotion((dx / planar) * strength, yBoost, (dz / planar) * strength);
  entity.hurtMarked = true;
}

function ironManFindReactorStack(player) {
  let inv = player.inventory;
  if (inv && inv.items) {
    let found = null;
    inv.items.forEach(stack => {
      if (!found && stack && !stack.isEmpty() && stack.id === IRON_MAN.REACTOR_ITEM) found = stack;
    });
    if (found) return found;
  }

  let hands = player.handSlots;
  if (hands) {
    return hands.find(stack => stack && !stack.isEmpty() && stack.id === IRON_MAN.REACTOR_ITEM) || null;
  }
  return null;
}

function ironManConsumeReactor(player) {
  let stack = ironManFindReactorStack(player);
  if (!stack) return false;
  if (!player.isCreative()) stack.shrink(1);
  return true;
}

function ironManIsStandingStill(player) {
  let pd = player.persistentData;
  let prevX = pd.getDouble('iron_man_prev_x') || player.x;
  let prevY = pd.getDouble('iron_man_prev_y') || player.y;
  let prevZ = pd.getDouble('iron_man_prev_z') || player.z;
  let dx = player.x - prevX;
  let dy = player.y - prevY;
  let dz = player.z - prevZ;
  pd.putDouble('iron_man_prev_x', player.x);
  pd.putDouble('iron_man_prev_y', player.y);
  pd.putDouble('iron_man_prev_z', player.z);
  return dx * dx + dy * dy + dz * dz < 0.0004;
}

function ironManStopFlight(player) {
  try {
    let handler = player.palladium$getFlightHandler();
    handler.flightBoost = 0.0;
    handler.setFlightType(handler.getFlightType().NONE);
    player.refreshDimensions();
  } catch (e) { }
  player.setSprinting(false);
  player.removeAttribute('palladium:flight_speed', 'flight_boost');
}

function ironManResetState(player) {
  palladium.setProperty(player, 'iron_man_reactor_swap_ticks', 0);
  palladium.setProperty(player, 'iron_man_reactor_status', 0);
  player.persistentData.putFloat('iron_man_energy_accum', 0);
  player.persistentData.putFloat('iron_man_drain_accum', 0);
  player.persistentData.putFloat('iron_man_unibeam_drain_accum', 0);
  player.persistentData.putBoolean('iron_man_repulsor_prev', false);
  player.persistentData.putBoolean('iron_man_supersonic_prev', false);
  player.persistentData.putBoolean('iron_man_unibeam_started', false);
}

function ironManTickTargetingHud(player) {
  if (!ironManEnabled(player, 'targeting_hud')) return false;
  if (ironManGetEnergy(player) <= 0) return true;

  ironManDrain(player, 'iron_man_drain_accum', IRON_MAN.TARGETING_DRAIN_PER_TICK);
  if (player.age % 10 !== 0) return true;

  player.level.getEntitiesWithin(player.getBoundingBox().inflate(28)).forEach(entity => {
    if (entity === player || !ironManCanAffect(entity)) return;
    if (player.distanceTo(entity) > 28) return;
    if (!player.hasLineOfSight(entity)) return;
    entity.potionEffects.add('minecraft:glowing', 25, 0, false, false);
  });
  return true;
}

function ironManTickRepulsor(player) {
  let active = ironManEnabled(player, 'repulsor_blast') || ironManEnabled(player, 'repulsor_blast_timer');
  let prev = player.persistentData.getBoolean('iron_man_repulsor_prev');

  if (active && !prev) {
    if (ironManGetEnergy(player) >= IRON_MAN.REPULSOR_COST) {
      ironManSubEnergy(player, IRON_MAN.REPULSOR_COST);
      player.swing();
      global.sound(player, 'minecraft:entity.blaze.shoot', 0.9, 1.45, 0.15);

      let target = ironManClosestTarget(player, IRON_MAN.REPULSOR_RANGE, 0.82, 1.6, 1.4);
      if (target) {
        target.attack(ironManDamageSource(player, 'powerborne:repulsor'), IRON_MAN.REPULSOR_DAMAGE);
        ironManKnockAway(player, target, 0.8, 0.15);
        player.level.spawnParticles('minecraft:flash', true, target.x, target.y + target.getBbHeight() * 0.5, target.z, 0, 0, 0, 1, 0.05);
        global.levelingSystem.awardXPForAbility(player, IRON_MAN.POWER, 'repulsor_blast', { entitiesHit: 1 });
      } else {
        player.level.spawnParticles('minecraft:crit', true, player.x, player.y + 1.2, player.z, 0.25, 0.15, 0.25, 6, 0.2);
      }
    } else {
      global.playSoundLocal(player, 'minecraft:block.note_block.bass', 'players', 0.6, 0.7);
    }
  }

  player.persistentData.putBoolean('iron_man_repulsor_prev', active);
}

function ironManTickSupersonicBoost(player) {
  let active = ironManEnabled(player, 'supersonic_boost');
  let prev = player.persistentData.getBoolean('iron_man_supersonic_prev');

  if (active && !prev) {
    if (ironManGetEnergy(player) >= IRON_MAN.SUPERSONIC_COST) {
      ironManSubEnergy(player, IRON_MAN.SUPERSONIC_COST);
      global.levelingSystem.awardXPForAbility(player, IRON_MAN.POWER, 'supersonic_boost');
    } else {
      global.playSoundLocal(player, 'minecraft:block.note_block.bass', 'players', 0.6, 0.7);
    }
  }

  player.persistentData.putBoolean('iron_man_supersonic_prev', active);
}

function ironManTickUnibeam(player) {
  let ticks = global.getAbilityAnimationTicks(player, IRON_MAN.POWER, 'unibeam_timer', true);
  let active = ticks > 0 || ironManEnabled(player, 'unibeam_timer');
  let started = player.persistentData.getBoolean('iron_man_unibeam_started');

  if (!active) {
    player.persistentData.putBoolean('iron_man_unibeam_started', false);
    player.persistentData.putFloat('iron_man_unibeam_drain_accum', 0);
    return false;
  }

  if (!started) {
    started = ironManGetEnergy(player) >= IRON_MAN.UNIBEAM_REQUIRED;
    player.persistentData.putBoolean('iron_man_unibeam_started', started);
    global.sound(player, started ? 'powerborne:unibeam_charge' : 'minecraft:block.note_block.bass', 0.8, started ? 1.0 : 0.65, 0.1);
  }

  if (!started) return true;

  ironManDrain(player, 'iron_man_unibeam_drain_accum', IRON_MAN.UNIBEAM_DRAIN_PER_TICK);
  if (ironManGetEnergy(player) <= 0) {
    ironManStopFlight(player);
    return true;
  }

  if (ticks >= IRON_MAN.UNIBEAM_CHARGE_TICKS && ticks <= IRON_MAN.UNIBEAM_CHARGE_TICKS + 80) {
    if (player.age % 6 === 0) global.sound(player, 'powerborne:unibeam_beam', 0.7, 1.05, 0.08);
    let targets = ironManConeTargets(player, IRON_MAN.UNIBEAM_RANGE, 0.92, 1.0, 1.0);
    let hitCount = 0;
    targets.forEach(entry => {
      let target = entry.entity;
      target.attack(ironManDamageSource(player, 'powerborne:unibeam'), IRON_MAN.UNIBEAM_DAMAGE);
      ironManKnockAway(player, target, 0.25, 0.04);
      hitCount++;
    });
    if (hitCount > 0 && player.age % 10 === 0) {
      global.sound(player, 'powerborne:unibeam_blast', 0.9, 1.0, 0.1);
      global.levelingSystem.awardXPForAbility(player, IRON_MAN.POWER, 'unibeam', { entitiesHit: hitCount });
    }
  }

  return true;
}

function ironManTickReactorSwap(player, isFastFlying, isChannelingUnibeam) {
  let ticks = palladium.getProperty(player, 'iron_man_reactor_swap_ticks') || 0;
  let canStart = ironManGetEnergy(player) < IRON_MAN.REACTOR_SWAP_THRESHOLD
    && !player.isSprinting()
    && !isFastFlying
    && !isChannelingUnibeam
    && ironManIsStandingStill(player)
    && ironManFindReactorStack(player);

  if (ticks <= 0 && canStart) {
    ticks = IRON_MAN.REACTOR_SWAP_TICKS;
    palladium.setProperty(player, 'iron_man_reactor_status', 1);
    global.playSoundLocal(player, 'minecraft:block.beacon.activate', 'players', 0.6, 1.4);
  }

  if (ticks > 0) {
    let stillValid = !player.isSprinting() && !isFastFlying && !isChannelingUnibeam && ironManIsStandingStill(player) && ironManFindReactorStack(player);
    if (!stillValid) {
      palladium.setProperty(player, 'iron_man_reactor_swap_ticks', 0);
      palladium.setProperty(player, 'iron_man_reactor_status', 0);
      return;
    }

    ticks--;
    palladium.setProperty(player, 'iron_man_reactor_swap_ticks', ticks);
    if (ticks === 0 && ironManConsumeReactor(player)) {
      ironManSetEnergy(player, IRON_MAN.MAX_ENERGY);
      palladium.setProperty(player, 'iron_man_reactor_status', 2);
      global.playSoundLocal(player, 'minecraft:block.beacon.power_select', 'players', 0.8, 1.6);
    }
  } else if (palladium.getProperty(player, 'iron_man_reactor_status') !== 2) {
    palladium.setProperty(player, 'iron_man_reactor_status', 0);
  }
}

PlayerEvents.tick(event => {
  const player = event.player;
  if (!player || !player.isAlive()) return;

  if (!ironManHasPower(player)) {
    ironManResetState(player);
    return;
  }

  if ((palladium.getProperty(player, 'energy_bar_arc_max') || 0) !== IRON_MAN.MAX_ENERGY) {
    palladium.setProperty(player, 'energy_bar_arc_max', IRON_MAN.MAX_ENERGY);
  }
  ironManSetEnergy(player, ironManGetEnergy(player));

  global.handleFlightBoost(player, IRON_MAN.POWER, 'supersonic_boost');
  ironManTickSupersonicBoost(player);

  let energy = ironManGetEnergy(player);
  let isFlying = ironManEnabled(player, 'is_flying') || ironManEnabled(player, 'flight_check') || ironManEnabled(player, 'is_hovering_or_flying');
  let isFastFlying = ironManEnabled(player, 'is_fast_flying');
  let isChannelingUnibeam = ironManTickUnibeam(player);
  let draining = isChannelingUnibeam;

  if (energy > 0) {
    if (isFastFlying) {
      ironManDrain(player, 'iron_man_drain_accum', IRON_MAN.FAST_FLIGHT_DRAIN_PER_TICK);
      draining = true;
    } else if (isFlying) {
      ironManDrain(player, 'iron_man_drain_accum', IRON_MAN.FLIGHT_DRAIN_PER_TICK);
      draining = true;
    }
  }

  if (ironManTickTargetingHud(player)) draining = true;
  ironManTickRepulsor(player);

  if (!draining && ironManGetEnergy(player) > 0) {
    ironManAccumulate(player, 'iron_man_energy_accum', IRON_MAN.REGEN_PER_TICK, gained => ironManAddEnergy(player, gained));
    player.persistentData.putFloat('iron_man_drain_accum', 0);
  } else {
    player.persistentData.putFloat('iron_man_energy_accum', 0);
  }

  if (ironManGetEnergy(player) <= 0) {
    ironManStopFlight(player);
    palladium.setProperty(player, 'iron_man_reactor_status', 3);
  }

  ironManTickReactorSwap(player, isFastFlying, isChannelingUnibeam);
});

ItemEvents.rightClicked(IRON_MAN.REACTOR_ITEM, event => {
  const player = event.player;
  const itemStack = event.item;
  if (!player || !itemStack || itemStack.isEmpty()) return;
  if (!ironManHasPower(player)) return;

  let current = ironManGetEnergy(player);
  let max = palladium.getProperty(player, 'energy_bar_arc_max') || IRON_MAN.MAX_ENERGY;
  if (current >= max) {
    global.playSoundLocal(player, 'minecraft:block.glass.hit', 'players', 0.6, 0.8);
    event.cancel();
    return;
  }

  ironManAddEnergy(player, IRON_MAN.MANUAL_REACTOR_GAIN);
  palladium.setProperty(player, 'iron_man_reactor_status', 2);
  global.playSoundLocal(player, 'minecraft:block.beacon.power_select', 'players', 0.8, 1.6);
  player.addItemCooldown(IRON_MAN.REACTOR_ITEM, 20);
  if (!player.isCreative()) itemStack.shrink(1);
  event.cancel();
});
