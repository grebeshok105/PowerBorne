const $LightLayer = Java.loadClass("net.minecraft.world.level.LightLayer");
const $TagKey = Java.loadClass("net.minecraft.tags.TagKey");
const $Registries = Java.loadClass("net.minecraft.core.registries.Registries");
const $ResourceLocation = Java.loadClass("net.minecraft.resources.ResourceLocation");

const SENTRY_IMMUNE_TAG = $TagKey.create($Registries.DAMAGE_TYPE, new $ResourceLocation("powerborne", "sentry_immune_to"));

const VOID = {
  POWER: 'powerborne:sentry',
  MAX: 200,
  DAMAGE_CHANCE_PER_DAMAGE: 0.05,
  DAMAGE_GAIN_BASE: 1,
  DAMAGE_BIG_THRESHOLD: 20,
  DAMAGE_BIG_BONUS: 1,
  MOB_KILL_GAIN: 1,
  PLAYER_KILL_GAIN: 15,
  TOUGH_MOB_EXTRA_THRESHOLD: 20,
  TOUGH_MOB_EXTRA_GAIN: 1,
  SPAWNER_MOB_CHANCE: 0.1,
  DARKNESS_GAIN_INTERVAL: 1200,
  DARKNESS_GAIN_AMOUNT: 2,
  LIGHT_HEAL_INTERVAL: 200,
  LIGHT_HEAL_BLOCK_MIN: 10,
  LIGHT_HEAL_AMOUNT: 1,
  PASSIVE_DECAY_INTERVAL: 1200,
  PASSIVE_DECAY_AMOUNT: 1,
  SLEEP_HEAL_AMOUNT: 50,
  CORRUPTION_THRESHOLD: 10,
  CORRUPTION_CHECK_INTERVAL: 100,
  CORRUPTION_MIN_CHANCE: 0.01,
  CORRUPTION_MAX_CHANCE: 0.2,
  VOID_FORM_DRAIN_INTERVAL: 9 * 20,
  VOID_FORM_TAG: 'powerborne.void_active',
  VOID_FORM_PERSIST_KEY: 'powerborne_void_form_active',
  VOID_EFFECT_TICKS_KEY: 'powerborne_void_effect_duration_ticks',
  VOID_EFFECT_DEFAULT_TICKS: 36000,
  ADAPT_MAX_GAINS: 8,
  ADAPT_COOLDOWN: 600
};

if (!global.voidAdaptation) global.voidAdaptation = new Map();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getVoidEnergy(player) {
  return palladium.getProperty(player, 'energy_bar_void') || 0;
}

function setVoidEnergy(player, value) {
  palladium.setProperty(player, 'energy_bar_void', clamp(Math.round(value), 0, VOID.MAX));
}

function addVoidEnergy(player, amount) {
  if (amount <= 0) return;
  setVoidEnergy(player, getVoidEnergy(player) + amount);
  global.sound(player, 'minecraft:entity.warden.heartbeat', 0.5, 0.5);
}

function subVoidEnergy(player, amount) {
  if (amount <= 0) return;
  setVoidEnergy(player, getVoidEnergy(player) - amount);
}

function hasSentry(player) {
  return abilityUtil.hasPower(player, VOID.POWER);
}

function isVoidTransformEnabled(player) {
  return abilityUtil.isEnabled(player, VOID.POWER, 'void_transform');
}

function getVoidUpgradeLevel(player) {
  if (!hasSentry(player)) return 0;
  if (global.isAbilityUnlockedOrAutoMaxed(player, VOID.POWER, 'void_upgrade_3')) return 3;
  if (global.isAbilityUnlockedOrAutoMaxed(player, VOID.POWER, 'void_upgrade_2')) return 2;
  if (global.isAbilityUnlockedOrAutoMaxed(player, VOID.POWER, 'void_upgrade_1')) return 1;
  return 0;
}

function setVoidArmorModel(player, value) {
  let chest = player.getChestArmorItem();
  if (chest && !chest.isEmpty() && chest.id === 'powerborne:sentry_suit') {
    chest.getOrCreateTag().putInt("CustomModelData", value);
  }
}

function isInDeepDarkness(player) {
  let pos = player.blockPosition();
  return player.level.getBrightness($LightLayer.SKY, pos) === 0 && player.level.getBrightness($LightLayer.BLOCK, pos) === 0;
}

function getAdaptKey(player, attacker) {
  return player.uuid.toString() + ":" + attacker.uuid.toString();
}

function getAttacker(source) {
  let direct = source.actual;
  if (direct && direct.isLiving()) return direct;
  return null;
}

function isVoidAdapted(player, attacker) {
  let key = getAdaptKey(player, attacker);
  if (!global.voidAdaptation.has(key)) return false;

  let data = global.voidAdaptation.get(key);

  if (player.server.tickCount - data.lastGainTick > VOID.ADAPT_COOLDOWN) {
    global.voidAdaptation.delete(key);
    return false;
  }

  return data.count >= VOID.ADAPT_MAX_GAINS;
}

function recordVoidGain(player, attacker) {
  let key = getAdaptKey(player, attacker);
  let currentTick = player.server.tickCount;

  if (global.voidAdaptation.has(key)) {
    let data = global.voidAdaptation.get(key);
    if (currentTick - data.lastGainTick > VOID.ADAPT_COOLDOWN) {
      data.count = 1;
      data.lastGainTick = currentTick;
    } else {
      data.count++;
      data.lastGainTick = currentTick;
    }
  } else {
    global.voidAdaptation.set(key, { count: 1, lastGainTick: currentTick });
  }
}

function cleanupVoidAdaptation(player) {
  let playerUUID = player.uuid.toString();
  let currentTick = player.server.tickCount;
  let toDelete = [];

  global.voidAdaptation.forEach((data, key) => {
    if (key.startsWith(playerUUID + ":") && currentTick - data.lastGainTick > VOID.ADAPT_COOLDOWN) {
      toDelete.push(key);
    }
  });

  toDelete.forEach(key => global.voidAdaptation.delete(key));
}

function releaseBanishedEntities(player) {
  let banishedList = player.persistentData.getList('powerborne_banished_uuids', 8);
  if (banishedList.size() === 0) return;

  let server = player.server;

  for (let i = 0; i < banishedList.size(); i++) {
    let uuid = banishedList.getString(i);
    let entity = null;

    server.allLevels.forEach(level => {
      if (!entity) {
        let found = level.getEntity(uuid);
        if (found) entity = found;
      }
    });

    if (entity && entity.isAlive()) {
      entity.removeEffect("powerborne:void_banishment");
      let randomTicks = Math.floor(Math.random() * (30 - 15 + 1)) + 15;
      entity.potionEffects.add("powerborne:void_banishment", randomTicks, 0, false, false);
    }
  }

  player.persistentData.remove('powerborne_banished_uuids');
}

function exitVoidForm(player) {
  player.tags.remove(VOID.VOID_FORM_TAG);
  player.persistentData.remove(VOID.VOID_FORM_PERSIST_KEY);
  player.persistentData.remove(VOID.VOID_EFFECT_TICKS_KEY);
  setVoidArmorModel(player, 0);
  player.tags.add('powerborne.void_cd');
  player.tags.add('powerborne.void_unlock_pending');
  player.removeEffect("powerborne:void");
  setVoidEnergy(player, VOID.MAX);
  releaseBanishedEntities(player);
}

const VOID_TRANSFORM_TIMER_MAX = 32;

function snapVoidTransformTimer(player) {
  try {
    let inst = abilityUtil.getInstance(player, VOID.POWER, 'void_transform');
    if (!inst) return;
    let valueKey = inst.getEitherPropertyByKey('value');
    if (valueKey != null) {
      inst.setProperty(valueKey, VOID_TRANSFORM_TIMER_MAX);
    }
  } catch (e) { }
}

function snapshotVoidEffectTicks(player) {
  let fx = player.getEffect('powerborne:void');
  if (fx) {
    player.persistentData.putInt(VOID.VOID_EFFECT_TICKS_KEY, fx.getDuration());
  }
}

function voidEffectTicksForReapply(player) {
  if (player.persistentData.contains(VOID.VOID_EFFECT_TICKS_KEY)) {
    let t = player.persistentData.getInt(VOID.VOID_EFFECT_TICKS_KEY);
    if (t > 0) return t;
  }
  return VOID.VOID_EFFECT_DEFAULT_TICKS;
}

function reapplyVoidFromPersist(player) {
  player.tags.add(VOID.VOID_FORM_TAG);
  setVoidArmorModel(player, 1);
  player.potionEffects.add('powerborne:void', voidEffectTicksForReapply(player), 0, false, false);
  snapshotVoidEffectTicks(player);
  snapVoidTransformTimer(player);
  if (!superpowerUtil.hasSuperpower(player, 'powerborne:void')) {
    superpowerUtil.addSuperpower(player, 'powerborne:void');
  }
}

PlayerEvents.tick(event => {
  let player = event.player;
  let voidProgress = global.getAbilityAnimationTicks(player, VOID.POWER, 'void_transform', false);
  // voidProgress now goes from 0 (not started) to 32 (fully charged)
  if (voidProgress <= 0 || voidProgress >= 29.44) return; // 0.92 * 32 = 29.44

  let offsetY = voidProgress == 32 ? 1.5 : 2.0;
  let offset = voidProgress >= 22.4 ? 0.13 : voidProgress >= 9.6 ? 0.2 : 0.13; // 0.7*32=22.4, 0.3*32=9.6

  player.level.spawnParticles(
    "minecraft:dust 0 0 0 1",
    true,
    player.x, player.y + (voidProgress/32) * offsetY, player.z,
    offset, 0, offset,
    15, 0
  );
});

PlayerEvents.tick(event => {
  let player = event.player;

  if (!hasSentry(player)) {
    if (player.tags.contains(VOID.VOID_FORM_TAG)) {
      setVoidArmorModel(player, 0);
      releaseBanishedEntities(player);
    }
    player.tags.remove(VOID.VOID_FORM_TAG);
    player.persistentData.remove(VOID.VOID_FORM_PERSIST_KEY);
    player.persistentData.remove(VOID.VOID_EFFECT_TICKS_KEY);
    return;
  }

  let age = player.age;
  let upgradeLevel = getVoidUpgradeLevel(player);
  let current = getVoidEnergy(player);
  let wasVoid = player.tags.contains(VOID.VOID_FORM_TAG);
  let voidAnim = global.getAbilityAnimationTicks(player, VOID.POWER, 'void_transform', false);

  let recoveredVoidFromPersist = false;
  if (player.persistentData.getBoolean(VOID.VOID_FORM_PERSIST_KEY) && !player.tags.contains('powerborne.void_cd')) {
    if (voidAnim <= 0 || !superpowerUtil.hasSuperpower(player, 'powerborne:void')) {
      reapplyVoidFromPersist(player);
      voidAnim = global.getAbilityAnimationTicks(player, VOID.POWER, 'void_transform', false);
      recoveredVoidFromPersist = true;
    }
  }

  wasVoid = player.tags.contains(VOID.VOID_FORM_TAG);
  let inVoidForm = isVoidTransformEnabled(player) || recoveredVoidFromPersist;

  if (age % 1200 === 0) {
    cleanupVoidAdaptation(player);
  }

  if (inVoidForm) {
    player.tags.add(VOID.VOID_FORM_TAG);
    player.persistentData.putBoolean(VOID.VOID_FORM_PERSIST_KEY, true);
    if (!wasVoid) {
      setVoidArmorModel(player, 1);
      player.potionEffects.add("powerborne:void", voidEffectTicksForReapply(player), 0, false, false);
      player.unlockAdvancement('powerborne:void_summon');
    }
    snapshotVoidEffectTicks(player);

    if (getVoidEnergy(player) <= 0) {
      exitVoidForm(player);
      return;
    }

    if (age % VOID.VOID_FORM_DRAIN_INTERVAL === 0) {
      subVoidEnergy(player, 1);
      if (getVoidEnergy(player) <= 0) {
        exitVoidForm(player);
      }
    }
    return;
  }

  if (wasVoid && !inVoidForm) {
    setVoidArmorModel(player, 0);
    releaseBanishedEntities(player);
    player.persistentData.remove(VOID.VOID_FORM_PERSIST_KEY);
    player.persistentData.remove(VOID.VOID_EFFECT_TICKS_KEY);
  }
  player.tags.remove(VOID.VOID_FORM_TAG);

  if (player.tags.contains('powerborne.void_cd')) {
    if (player.tags.contains('powerborne.void_unlock_pending')) {
      let transformTicks = global.getAbilityAnimationTicks(player, VOID.POWER, 'void_transform', false);
      if (transformTicks <= 0) {
        global.unlockAccessory(player, 'sentry_void_merged');
        player.tags.remove('powerborne.void_unlock_pending');
      }
    }

    if (getVoidEnergy(player) <= 0) {
      player.tags.remove('powerborne.void_cd');
      return;
    }

    if (age % VOID.VOID_FORM_DRAIN_INTERVAL === 0) {
      subVoidEnergy(player, 1);
      if (getVoidEnergy(player) <= 0) {
        player.tags.remove('powerborne.void_cd');
      }
    }
    return;
  }

  if (age % VOID.LIGHT_HEAL_INTERVAL === 0) {
    let blockBrightness = player.level.getBrightness($LightLayer.BLOCK, player.blockPosition());
    if (blockBrightness >= VOID.LIGHT_HEAL_BLOCK_MIN) {
      subVoidEnergy(player, VOID.LIGHT_HEAL_AMOUNT);
    }
  }

  if (age % VOID.PASSIVE_DECAY_INTERVAL === 0) {
    if (upgradeLevel >= 3 && isInDeepDarkness(player)) {
      addVoidEnergy(player, VOID.DARKNESS_GAIN_AMOUNT);
    }
    if (current < VOID.MAX) {
      subVoidEnergy(player, VOID.PASSIVE_DECAY_AMOUNT);
    }
  }

  current = getVoidEnergy(player);
  if (current >= VOID.CORRUPTION_THRESHOLD && age % VOID.CORRUPTION_CHECK_INTERVAL === 0) {
    let t = (current - VOID.CORRUPTION_THRESHOLD) / (VOID.MAX - VOID.CORRUPTION_THRESHOLD);
    t = clamp(t, 0, 1);
    let chance = VOID.CORRUPTION_MIN_CHANCE + t * (VOID.CORRUPTION_MAX_CHANCE - VOID.CORRUPTION_MIN_CHANCE);
    if (Math.random() < chance) {
      player.potionEffects.add("minecraft:darkness", 40, 0, false, false);
      global.sound(player, 'minecraft:block.sculk_catalyst.bloom', 100, 0.2);
      global.sound(player, 'minecraft:entity.warden.heartbeat', 0.5, 1);
    }
  }

  if (player.getSleepTimer() === 105) {
    subVoidEnergy(player, VOID.SLEEP_HEAL_AMOUNT);
  }
});

EntityEvents.death(event => {
  let entity = event.entity;
  let source = event.source;
  let killer = source && source.player ? source.player : null;

  if (killer && hasSentry(killer) && !isVoidTransformEnabled(killer) && !killer.tags.contains('powerborne.void_cd')) {
    let upgradeLevel = getVoidUpgradeLevel(killer);
    if (upgradeLevel >= 2) {
      let voidToAdd = 0;

      if (entity.isPlayer()) {
        voidToAdd = VOID.PLAYER_KILL_GAIN;
      } else if (entity.isLiving()) {
        voidToAdd = VOID.MOB_KILL_GAIN;
        if (entity.getMaxHealth() > VOID.TOUGH_MOB_EXTRA_THRESHOLD) {
          voidToAdd += VOID.TOUGH_MOB_EXTRA_GAIN;
        }
        if (entity.getSpawnType && entity.getSpawnType() === 'SPAWNER') {
          if (Math.random() >= VOID.SPAWNER_MOB_CHANCE) {
            voidToAdd = 0;
          }
        }
      }

      if (voidToAdd > 0) {
        addVoidEnergy(killer, voidToAdd);
      }
    }
  }

  if (entity.isPlayer() && hasSentry(entity)) {
    if (entity.tags.contains(VOID.VOID_FORM_TAG)) {
      exitVoidForm(entity);
      const gameRules = event.server.getOverworld().getGameRules();
      if (gameRules.get("doImmediateRespawn")) {
        superpowerUtil.removeSuperpower(entity, "powerborne:void");
      }
    }
    if (!entity.tags.contains('powerborne.void_cd')) {
      palladium.setProperty(entity, 'energy_bar_void', 0);
    }
  }
});

EntityEvents.hurt(event => {
  let entity = event.entity;
  let damage = event.damage;

  if (!entity.isPlayer()) return;
  if (!hasSentry(entity)) return;
  if (isVoidTransformEnabled(entity)) return;
  if (entity.tags.contains('powerborne.void_cd')) return;
  if (getVoidUpgradeLevel(entity) < 1) return;
  if (damage <= 0) return;
  if (event.source.is(SENTRY_IMMUNE_TAG)) return;

  let chance = Math.min(damage * VOID.DAMAGE_CHANCE_PER_DAMAGE, 1.0);

  if (Math.random() < chance) {
    let attacker = getAttacker(event.source);

    if (attacker && isVoidAdapted(entity, attacker)) return;

    let voidToAdd = VOID.DAMAGE_GAIN_BASE;
    if (damage > VOID.DAMAGE_BIG_THRESHOLD) {
      voidToAdd += VOID.DAMAGE_BIG_BONUS;
    }

    addVoidEnergy(entity, voidToAdd);

    if (attacker) {
      recordVoidGain(entity, attacker);
    }
  }
});

PlayerEvents.loggedOut(event => {
  let player = event.player;
  let playerUUID = player.uuid.toString();

  let toDelete = [];
  global.voidAdaptation.forEach((data, key) => {
    if (key.startsWith(playerUUID + ":")) toDelete.push(key);
  });
  toDelete.forEach(key => global.voidAdaptation.delete(key));

  if (abilityUtil.isEnabled(player, VOID.POWER, "void_transform")) {
    releaseBanishedEntities(player);
    palladium.setProperty(player, "energy_bar_void", 1);
    player.tags.remove(VOID.VOID_FORM_TAG);
    player.persistentData.remove(VOID.VOID_FORM_PERSIST_KEY);
    player.persistentData.remove(VOID.VOID_EFFECT_TICKS_KEY);
    setVoidArmorModel(player, 0);
    player.removeEffect("powerborne:void");
    superpowerUtil.removeSuperpower(player, "powerborne:void");
  }
});
