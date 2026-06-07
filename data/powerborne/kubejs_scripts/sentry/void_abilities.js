let $Merchant = Java.loadClass('net.minecraft.world.item.trading.Merchant')
let $StringTag = Java.loadClass('net.minecraft.nbt.StringTag')
let $CompoundTag = Java.loadClass('net.minecraft.nbt.CompoundTag');
let $ScaleTypes = null
if (Platform.isLoaded("pehkui")) {
  $ScaleTypes = Java.loadClass("virtuoel.pehkui.api.ScaleTypes");
}

function showBanishmentFeedback(player, entity, currentDuration) {
  const maxDuration = 50;
  const progress = Math.min(currentDuration / maxDuration, 1.0);
  const squaresFilled = Math.floor(progress * 5);

  let spread = 0.1 + progress * 0.3;
  let size = Math.max(0.0, Math.min(1.0, progress));

  player.level.spawnParticles(
    `minecraft:dust 0 0 0 ${size}`,
    true,
    entity.x, entity.y + entity.getBbHeight() / 2, entity.z,
    spread, spread, spread,
    squaresFilled, 0.01
  );

  let bar = '';
  for (let i = 0; i < 5; i++) {
    bar += i < squaresFilled ? '§0■' : '§7■';
  }
  player.setStatusMessage("§7|" + bar + "§7|");
}

function findGroundedY(level, x, y, z) {
  let searchStartY = Math.floor(y);
  let groundY = searchStartY;
  let searchCount = 0;
  let maxSearchDepth = Math.min(50, searchStartY - level.minBuildHeight);

  while (groundY >= level.minBuildHeight && searchCount < maxSearchDepth) {
    let checkPos = new BlockPos(Math.floor(x), groundY, Math.floor(z));
    let blockState = level.getBlockState(checkPos);
    if (blockState.blocksMotion()) {
      let topY = groundY + 1.0;
      try {
        let shape = blockState.getCollisionShape(level, checkPos);
        if (shape && !shape.isEmpty()) {
          let bounds = shape.bounds();
          if (bounds) topY = groundY + bounds.maxY;
        }
      } catch (e) { }
      return topY;
    }
    groundY--;
    searchCount++;
  }
  return y;
}

function banishPlayer(target, caster) {
  let groundY = findGroundedY(target.getLevel(), target.x, target.y, target.z);

  if (palladium.hasProperty(target, "watch")) {
    let watch = palladium.getProperty(target, "watch");
    target.persistentData.putString('powerborne_banish_watch', watch);
  }

  target.persistentData.putDouble('powerborne_banish_x', target.x);
  target.persistentData.putDouble('powerborne_banish_y', groundY);
  target.persistentData.putDouble('powerborne_banish_z', target.z);
  target.persistentData.putString('powerborne_banish_dimension', target.getLevel().dimension.toString());
  target.persistentData.putString('powerborne_banish_gamemode', target.gameMode.getGameModeForPlayer().toString().toLowerCase());

  let fullNbt = new $CompoundTag();
  target.saveWithoutId(fullNbt);
  if (fullNbt.contains("Palladium")) {
    let palData = fullNbt.getCompound("Palladium");
    if (palData.contains("Properties")) {
      let props = palData.getCompound("Properties");
      if (props.contains("superpowers")) {
        let powersList = props.getList("superpowers", 8);
        target.persistentData.put("powerborne_banish_superpowers", powersList.copy());
        for (let i = 0; i < powersList.size(); i++) {
          let power = powersList.getString(i);
          superpowerUtil.removeSuperpower(target, power);
        }
      }
    }
  }
  let invList = [];
  let inventory = target.inventory;
  for (let i = 0; i < inventory.containerSize; i++) {
    let item = inventory.getItem(i);
    if (!item.isEmpty()) {
      invList.push({ slot: i, id: item.id, count: item.count, nbt: item.nbt });
    }
  }
  target.persistentData.put("powerborne_banish_inventory", invList);
  inventory.clearContent();

  let skeleton = target.getLevel().createEntity('minecraft:wither_skeleton');
  skeleton.x = target.x;
  skeleton.y = target.y;
  skeleton.z = target.z;
  skeleton.addTag('powerborne.banish_skeleton');
  skeleton.setCustomName(Text.of(target.username));
  skeleton.setCustomNameVisible(false);
  skeleton.potionEffects.add("powerborne:void_banishment", 99999999, 0, false, false);
  try { skeleton.setPose('sleeping'); } catch (e) { }
  skeleton.mergeNbt({
    "Palladium": {
      "Properties": {
        "superpowers": ["powerborne:shadow"]
      }
    }
  });
  skeleton.spawn();
  customRandomTeleport(skeleton, skeleton.x, skeleton.y, skeleton.z);

  target.persistentData.putString('powerborne_banish_skeleton_uuid', skeleton.uuid.toString());
  target.addTag('powerborne.void_banished_player');

  let voidEffect = caster.getEffect("powerborne:void");
  let voidDuration = voidEffect ? voidEffect.getDuration() : 36000;
  target.potionEffects.add("powerborne:void_banishment", voidDuration, 0, false, false);

  let banishedList = caster.persistentData.getList('powerborne_banished_uuids', 8);
  banishedList.add($StringTag.valueOf(target.uuid.toString()));
  caster.persistentData.put('powerborne_banished_uuids', banishedList);

  global.sound(caster, 'powerborne:void_banishment', 1, 1);
  global.levelingSystem.awardXPForAbility(caster, "powerborne:void", "void_banishment");
  palladium.setProperty(caster, "void_banishment_cooldown", 400);

  target.server.scheduleInTicks(2, () => {
    if (target && target.isAlive()) {
      let speedModifierUUID = 'e0f4e796-3d3d-11ee-be56-0242ac183754';
      target.removeAttribute('minecraft:generic.movement_speed', speedModifierUUID);
      target.teleportTo('powerborne:void_dimension', 156, 10, 23, 90, 0);
      target.setGameMode("adventure");
    }
  });
}

function restoreBanishedPlayer(player) {
  let dimension = player.persistentData.getString('powerborne_banish_dimension');
  let skeletonUUID = player.persistentData.getString('powerborne_banish_skeleton_uuid');

  if (skeletonUUID) {
    let skeleton = null;
    player.server.allLevels.forEach(level => {
      if (!skeleton) {
        let found = level.getEntity(skeletonUUID);
        if (found) skeleton = found;
      }
    });
    if (skeleton && skeleton.isAlive()) {
      skeleton.removeEffect("powerborne:void_banishment");
      skeleton.discard();
      global.entitiesWithVoidEffect.delete(String(skeletonUUID));
    }
  }

  let x = player.persistentData.getDouble('powerborne_banish_x');
  let y = player.persistentData.getDouble('powerborne_banish_y');
  let z = player.persistentData.getDouble('powerborne_banish_z');

  if (dimension) {
    player.teleportTo(dimension, x, y, z, 0, 0);
  }

  let gamemode = player.persistentData.getString('powerborne_banish_gamemode');
  if (gamemode) {
    player.setGameMode(gamemode);
  }

  if (player.persistentData.contains("powerborne_banish_inventory")) {
    let invList = player.persistentData.get("powerborne_banish_inventory");
    let inventory = player.inventory;
    if (invList) {
      invList.forEach(savedItem => {
        let itemStack = Item.of(savedItem.id, savedItem.count, savedItem.nbt);
        inventory.setItem(savedItem.slot, itemStack);
      });
    }
  }

  if (player.persistentData.contains("powerborne_banish_superpowers")) {
    let savedPowers = player.persistentData.getList("powerborne_banish_superpowers", 8);
    let powersArray = [];
    for (let i = 0; i < savedPowers.size(); i++) {
      powersArray.push(savedPowers.getString(i));
    }
    player.mergeNbt({
      "Palladium": {
        "Properties": {
          "superpowers": powersArray
        }
      }
    });
    player.persistentData.remove("powerborne_banish_superpowers");
  }

  if (player.persistentData.contains("powerborne_banish_watch")) {
    let watch = player.persistentData.getString('powerborne_banish_watch');
    palladium.setProperty(player, "watch", watch);
    player.persistentData.remove('powerborne_banish_watch');
  }

  player.potionEffects.add("minecraft:darkness", 30, 0, false, false);
  player.potionEffects.add("minecraft:blindness", 20, 0, false, false);

  player.persistentData.remove('powerborne_banish_x');
  player.persistentData.remove('powerborne_banish_y');
  player.persistentData.remove('powerborne_banish_z');
  player.persistentData.remove('powerborne_banish_dimension');
  player.persistentData.remove('powerborne_banish_gamemode');
  player.persistentData.remove('powerborne_banish_inventory');
  player.persistentData.remove('powerborne_banish_skeleton_uuid');
  player.persistentData.remove('powerborne_banish_superpowers');
  player.tags.remove('powerborne.void_banished_player');
}

PlayerEvents.tick(event => {
  const player = event.player;

  if (!abilityUtil.isEnabled(player, 'powerborne:void', 'void_banishment')) return;

  const rayTrace = global.advancedRayTrace(player, player.level, 20, false, 0.25);
  if (!rayTrace || !rayTrace.entity) return;

  const entity = rayTrace.entity;
  if (!entity || !entity.isAlive()) return;
  if (typeof entity.getEffect !== "function" || !entity.attackable()) return;

  let existing = entity.getEffect("powerborne:void_banishment");
  let currentDuration = existing ? existing.getDuration() : 0;
  let newDuration = Math.min(currentDuration + 3, 50);
  entity.potionEffects.add("powerborne:void_banishment", newDuration, 0, false, false);

  showBanishmentFeedback(player, entity, newDuration);
  if (entity.isPlayer() && newDuration >= 35) {
    entity.potionEffects.add("minecraft:darkness", 60, 0, false, false);
  }
  if (newDuration >= 50 && currentDuration < 50 && entity.isLiving()) {
    if (entity.isPlayer()) {
      banishPlayer(entity, player);
    } else {
      let widthScaleData = $ScaleTypes.WIDTH.getScaleData(entity);
      widthScaleData.setScaleTickDelay(40);
      widthScaleData.setTargetScale(1.1);

      global.sound(player, 'powerborne:void_banishment', 1, 1);
      if (entity instanceof $Merchant) {
        entity.setTradingPlayer(player);
      }
      global.levelingSystem.awardXPForAbility(player, "powerborne:void", "void_banishment");

      let banishedList = player.persistentData.getList('powerborne_banished_uuids', 8);
      banishedList.add($StringTag.valueOf(entity.uuid.toString()));
      player.persistentData.put('powerborne_banished_uuids', banishedList);

      let voidEffect = player.getEffect("powerborne:void");
      let voidDuration = voidEffect ? voidEffect.getDuration() : 36000;
      entity.potionEffects.add("powerborne:void_banishment", voidDuration, 0, false, false);
      palladium.setProperty(player, "void_banishment_cooldown", 400);
      customRandomTeleport(entity, entity.getX(), entity.getY(), entity.getZ());
    }
  }
});

PlayerEvents.tick(event => {
  const player = event.player;
  if (player.age % 20 == 0) return;

  if (!abilityUtil.isEnabled(player, "powerborne:sentry", "void_transform")) return;

  let banishmentCooldown = palladium.getProperty(player, "void_banishment_cooldown");
  if (banishmentCooldown > 0) {
    banishmentCooldown--;
    palladium.setProperty(player, "void_banishment_cooldown", banishmentCooldown);
  }

  const mobs = getNearbyMobs(player, 15);

  mobs.forEach(mob => {
    const isTargetingPlayer = mob.target && mob.target == player;
    const within = mob.distanceToSqr(player) <= 36;
    let canBeAffected = global.canBeAffectedByEffects(mob);
    if (isTargetingPlayer && within) return;
    if (!canBeAffected) return;
    if (mob.getTags().contains('powerborne.shadow_field_husk')) return;

    if (mob.getSensing().hasLineOfSight(player)) {
      const dx = mob.x - player.x;
      const dz = mob.z - player.z;
      const targetX = mob.x + dx;
      const targetZ = mob.z + dz;
      const speed = mob.getAttribute("minecraft:generic.movement_speed").getBaseValue();
      const speedMultiplier = 0.35 / speed;
      mob.getNavigation().moveTo(targetX, mob.y, targetZ, speedMultiplier);
    }
  });
});

PlayerEvents.tick(event => {
  let player = event.player;
  if (!player.tags.contains('powerborne.void_banished_player')) return;

  let hasEffect = player.getEffect("powerborne:void_banishment");
  if (hasEffect && hasEffect.getDuration() > 0) return;

  restoreBanishedPlayer(player);
});

EntityEvents.hurt(event => {
  let entity = event.entity;
  if (!entity.isPlayer()) return;
  if (!entity.tags.contains('powerborne.void_banished_player')) return;
  if (entity.getLevel().dimension.toString() !== 'powerborne:void_dimension') return;

  let sourceType = event.source.type;
  if (sourceType === 'genericKill' || sourceType === 'outOfWorld') return;

  event.cancel();
});

PlayerEvents.tick(event => {
  let player = event.player;
  if (!player.tags.contains('powerborne.void_banished_player')) return;
  if (player.level.dimension.toString() !== 'powerborne:void_dimension') return;

  if (player.foodData.foodLevel < 20) {
    player.foodData.foodLevel = 20;
  }
});

function getNearbyMobs(player, range) {
  if (range === undefined) range = 16;
  return player.level.getEntitiesWithin(player.getBoundingBox().inflate(range))
    .filter(function (e) {
      return !e.isPlayer() && e.isAlive() && e.isLiving() && e.attackable();
    });
}

function customRandomTeleport(entity, targetX, targetY, targetZ) {
  if (!entity || !entity.getLevel()) return false;

  const level = entity.getLevel();
  const blockX = Math.floor(targetX);
  const blockZ = Math.floor(targetZ);

  let searchStartY = Math.floor(targetY);
  if (searchStartY < level.minBuildHeight || searchStartY > level.maxBuildHeight) return false;

  let targetPos = new BlockPos(blockX, searchStartY, blockZ);
  if (!level.hasChunkAt(targetPos)) return false;

  let groundY = searchStartY;
  const maxSearchDepth = Math.min(50, searchStartY - level.minBuildHeight);
  let searchCount = 0;
  let foundBlockY = null;

  while (groundY >= level.minBuildHeight && searchCount < maxSearchDepth) {
    let checkPos = new BlockPos(blockX, groundY, blockZ);
    let blockState = level.getBlockState(checkPos);
    if (blockState.blocksMotion()) {
      foundBlockY = groundY;
      break;
    }
    groundY--;
    searchCount++;
  }

  if (foundBlockY === null || foundBlockY <= level.minBuildHeight) return false;

  let blockPos = new BlockPos(blockX, foundBlockY, blockZ);
  let blockState = level.getBlockState(blockPos);
  let topY = foundBlockY + 1.0;

  try {
    let shape = blockState.getCollisionShape(level, blockPos);
    if (shape && !shape.isEmpty()) {
      let bounds = shape.bounds();
      if (bounds) {
        topY = foundBlockY + bounds.maxY;
      }
    }
  } catch (e) {
    topY = foundBlockY + 1.0;
  }

  let finalY = Math.max(topY - 0.001, foundBlockY + 0.1);

  let abovePos = new BlockPos(blockX, Math.floor(finalY), blockZ);
  let aboveState = level.getBlockState(abovePos);
  if (aboveState.blocksMotion() && Math.floor(finalY) > foundBlockY) {
    finalY = Math.floor(finalY) - 0.001;
  }

  entity.teleportTo(targetX, finalY, targetZ);
  return true;
}