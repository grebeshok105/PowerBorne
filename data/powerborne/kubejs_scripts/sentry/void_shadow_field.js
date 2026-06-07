// area_effect_cloud spawn helper
function spawnAreaEffectCloud(level, x, y, z, nbtJson) {
  level.server.runCommandSilent(
    `execute in ${level.dimension.toString()} run summon minecraft:area_effect_cloud ${x} ${y} ${z} ${nbtJson}`
  );
}

function createShadowField(server, level, centerX, centerY, centerZ, stage) {
  if (!server || !level) return;
  let x = Math.floor(centerX);
  let y = Math.floor(centerY) - 1;
  let z = Math.floor(centerZ);

  if (stage === 0) {
    level.playSound(null, x, y, z, 'entity.husk.converted_to_zombie', 'ambient', 2.5, 0);
    let aecGrowNBT = `{Color:0,RadiusPerTick:0.15f,Radius:0.5f,Duration:30,
    Effects:[{Id:33,Duration:30,Amplifier:2,ShowParticles:0b,ShowIcon:1b},
    {Id:2,Duration:30,Amplifier:5,ShowParticles:0b,ShowIcon:1b}]}`;
    spawnAreaEffectCloud(level, x + 0.5, y + 1.05, z + 0.5, aecGrowNBT);

    for (let dx = -1; dx <= 2; dx++) {
      let checkX = x + dx;
      let block = level.getBlock(checkX, y, z);
      if (block && block.getBlockState().canBeReplaced()) {
        block.set("powerborne:void_block");
      }
    }
    server.scheduleInTicks(5, () => {
      createShadowField(server, level, centerX, centerY, centerZ, 1);
    });
    return;
  }

  let maxRadius = 5;
  let currentRadius = Math.min(stage, maxRadius);
  if (currentRadius > maxRadius) return;

  let blocksToRemove = [];
  if (currentRadius > 1) {
    let prevRadius = currentRadius - 1;
    let prevRadiusMinSq = (prevRadius - 0.5) * (prevRadius - 0.5);
    let prevRadiusMaxSq = (prevRadius + 0.5) * (prevRadius + 0.5);
    let checkRadius = Math.ceil(prevRadius + 1);
    for (let dx = -checkRadius; dx <= checkRadius; dx++) {
      for (let dz = -checkRadius; dz <= checkRadius; dz++) {
        let horizontalDistSq = dx * dx + dz * dz;
        let maxYOffset = Math.floor(Math.sqrt(Math.max(0, (prevRadius + 1) * (prevRadius + 1) - horizontalDistSq)));
        for (let dy = 0; dy <= maxYOffset; dy++) {
          let distanceSq = dx * dx + dy * dy + dz * dz;
          if (distanceSq >= prevRadiusMinSq && distanceSq <= prevRadiusMaxSq) {
            let checkX = x + dx;
            let checkY = y + dy;
            let checkZ = z + dz;
            if (checkY > level.maxBuildHeight || checkY < level.minBuildHeight) continue;
            blocksToRemove.push({ x: checkX, y: checkY, z: checkZ });
          }
        }
      }
    }
  }

  let blocksToPlace = [];
  let currentRadiusMinSq = (currentRadius - 0.5) * (currentRadius - 0.5);
  let currentRadiusMaxSq = (currentRadius + 0.5) * (currentRadius + 0.5);

  for (let dx = -currentRadius; dx <= currentRadius; dx++) {
    for (let dz = -currentRadius; dz <= currentRadius; dz++) {
      let horizontalDistSq = dx * dx + dz * dz;
      if (horizontalDistSq > currentRadiusMaxSq) continue;
      let maxYOffset = Math.floor(Math.sqrt(Math.max(0, currentRadiusMaxSq - horizontalDistSq)));
      for (let dy = 0; dy <= maxYOffset; dy++) {
        let distanceSq = dx * dx + dy * dy + dz * dz;
        if (distanceSq >= currentRadiusMinSq && distanceSq <= currentRadiusMaxSq) {
          let checkX = x + dx;
          let checkY = y + dy;
          let checkZ = z + dz;
          if (checkY > level.maxBuildHeight || checkY < level.minBuildHeight) continue;
          blocksToPlace.push({ x: checkX, y: checkY, z: checkZ });
        }
      }
    }
  }

  blocksToRemove.forEach(blockPos => {
    let block = level.getBlock(blockPos.x, blockPos.y, blockPos.z);
    if (block && block.id === "powerborne:void_block") {
      block.set("minecraft:air");
    }
  });

  blocksToPlace.forEach(blockPos => {
    let block = level.getBlock(blockPos.x, blockPos.y, blockPos.z);
    if (block && block.getBlockState().canBeReplaced()) {
      block.set("powerborne:void_block");
    }
  });

  if (currentRadius < maxRadius) {
    server.scheduleInTicks(3, () => {
      createShadowField(server, level, centerX, centerY, centerZ, stage + 1);
    });
  } else {
    // max radius spawn full aec
    let aecFieldNBT = `{Color:0,Radius:4.5f,Duration:1200,
    Effects:[{Id:33,Duration:30,Amplifier:2,ShowParticles:0b,ShowIcon:1b},
    {Id:2,Duration:30,Amplifier:5,ShowParticles:0b,ShowIcon:1b}],
    Tags:["powerborne.shadow_field_marker"]}`;
    spawnAreaEffectCloud(level, x + 0.5, y + 1.05, z + 0.5, aecFieldNBT);
    spawnShadowHusk(level, x, y, z);
    spawnShadowHusk(level, x, y, z);
    level.playSound(null, x, y, z, 'minecraft:entity.squid.death', 'ambient', 2, 0);
  }
}

// shadow field cleanup
LevelEvents.tick(event => {
  let level = event.level;
  if (level.isClientSide()) return;
  
  if (level.time % 20 !== 0) return;
  
  level.getEntities().forEach(entity => {
    if (entity.type === "minecraft:area_effect_cloud" && 
        entity.getTags().contains("powerborne.shadow_field_marker")) {
      
      let nbt = entity.nbt;
      if (!nbt) return;
      
      let age = nbt.getInt("Age");
      if (age >= 1180) {
        let centerX = entity.x;
        let centerY = entity.y;
        let centerZ = entity.z;
        
        removeShadowField(level.server, level, centerX, centerY, centerZ, 5);
        entity.tags.remove("powerborne.shadow_field_marker");
      }
    }
  });
});

function spawnShadowHusk(level, x, y, z) {
  let husk = level.createEntity("minecraft:husk");
  let randOffsetX = Math.floor(Math.random() * 3) - 1;
  let randOffsetZ = Math.floor(Math.random() * 3) - 1;
  husk.setPosition(x + randOffsetX, y + 1, z + randOffsetZ);
  
  husk.getAttribute("minecraft:generic.max_health").setBaseValue(35);
  husk.setHealth(35);
  
  husk.mergeNbt({ DeathLootTable: "minecraft:empty", Tags: ["powerborne.shadow_field_husk"], Silent:1, PersistenceRequired:1, Palladium: { Powers: { "powerborne:shadow_entity": {} }, Properties: { superpowers: ["powerborne:shadow_entity"] } } });
  level.spawnParticles('minecraft:squid_ink', true, x, y + 1, z, 0.25, 1.5, 0.25, 5, 0);
  husk.spawn();
}

global.hasNearbyAreaEffectCloud = (entity, range) => {
  if (range === undefined) range = 1;
  let nearbyEntities = entity.getLevel().getEntitiesWithin(entity.getBoundingBox().inflate(range));
  return nearbyEntities.some(nearbyEntity => {
      return nearbyEntity.type === "minecraft:area_effect_cloud" && nearbyEntity.isAlive();
  });
};

PlayerEvents.tick(event => {
  let player = event.player;
  let inShadowField = global.hasNearbyAreaEffectCloud(player, 1);
  // for void
  if (abilityUtil.hasPower(player, "powerborne:void") && inShadowField) {
    if (player.hasEffect("minecraft:slowness") && player.hasEffect("minecraft:darkness")) {
      player.removeEffect("minecraft:slowness");
    }
  }
  
  // apply no jump to players affected by shadow field
  let shouldBlockJump = inShadowField && player.hasEffect("minecraft:slowness") && player.hasEffect("minecraft:darkness");
  if (shouldBlockJump) {
    player.modifyAttribute('palladium:jump_power', "shadow_field", -1, "multiply_base");
  } else {
    player.removeAttribute('palladium:jump_power', "shadow_field");
  }
});

EntityEvents.death(event => {
  let entity = event.entity;
  if (entity.getTags().contains("powerborne.shadow_field_husk")) {
    entity.getLevel().spawnParticles('minecraft:squid_ink', true, entity.x, entity.y + 0.5, entity.z, 0.25, 0.8, 0.25, 5, 0);
  }
});

function removeShadowField(server, level, centerX, centerY, centerZ, radius) {
  if (!server || !level) return;
  let x = Math.floor(centerX);
  let y = Math.floor(centerY) - 1;
  let z = Math.floor(centerZ);

  if (radius === 5) {
    level.playSound(null, x, y, z, 'minecraft:entity.squid.squirt', 'ambient', 2, 0);
  }

  if (radius === 0) {
    for (let dx = -1; dx <= 2; dx++) {
      let checkX = x + dx;
      let block = level.getBlock(checkX, y, z);
      if (block && block.id === "powerborne:void_block") {
        block.set("minecraft:air");
      }
    }
    return;
  }

  let radiusMinSq = (radius - 0.5) * (radius - 0.5);
  let radiusMaxSq = (radius + 0.5) * (radius + 0.5);

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      let horizontalDistSq = dx * dx + dz * dz;
      if (horizontalDistSq > radiusMaxSq) continue;
      let maxYOffset = Math.floor(Math.sqrt(Math.max(0, radiusMaxSq - horizontalDistSq)));
      for (let dy = 0; dy <= maxYOffset; dy++) {
        let distanceSq = dx * dx + dy * dy + dz * dz;
        if (distanceSq >= radiusMinSq && distanceSq <= radiusMaxSq) {
          let checkX = x + dx;
          let checkY = y + dy;
          let checkZ = z + dz;
          if (checkY > level.maxBuildHeight || checkY < level.minBuildHeight) continue;
          let block = level.getBlock(checkX, checkY, checkZ);
          if (block && block.id === "powerborne:void_block") {
            block.set("minecraft:air");
          }
        }
      }
    }
  }

  if (radius > 1) {
    let innerRadius = radius - 1;
    let innerRadiusMinSq = (innerRadius - 0.5) * (innerRadius - 0.5);
    let innerRadiusMaxSq = (innerRadius + 0.5) * (innerRadius + 0.5);

    for (let dx = -innerRadius; dx <= innerRadius; dx++) {
      for (let dz = -innerRadius; dz <= innerRadius; dz++) {
        let horizontalDistSq = dx * dx + dz * dz;
        if (horizontalDistSq > innerRadiusMaxSq) continue;
        let maxYOffset = Math.floor(Math.sqrt(Math.max(0, innerRadiusMaxSq - horizontalDistSq)));
        for (let dy = 0; dy <= maxYOffset; dy++) {
          let distanceSq = dx * dx + dy * dy + dz * dz;
          if (distanceSq >= innerRadiusMinSq && distanceSq <= innerRadiusMaxSq) {
            let checkX = x + dx;
            let checkY = y + dy;
            let checkZ = z + dz;
            if (checkY > level.maxBuildHeight || checkY < level.minBuildHeight) continue;
            let block = level.getBlock(checkX, checkY, checkZ);
            if (block && block.getBlockState().canBeReplaced()) {
              block.set("powerborne:void_block");
            }
          }
        }
      }
    }
    server.scheduleInTicks(3, () => {
      removeShadowField(server, level, centerX, centerY, centerZ, radius - 1);
    });
  } else if (radius === 1) {
    for (let dx = -1; dx <= 2; dx++) {
      let checkX = x + dx;
      let block = level.getBlock(checkX, y, z);
      if (block && block.getBlockState().canBeReplaced()) {
        block.set("powerborne:void_block");
      }
    }
    server.scheduleInTicks(3, () => {
      removeShadowField(server, level, centerX, centerY, centerZ, 0);
    });
  }
}

// collision handler: checks for projectile hit
PalladiumEvents.customProjectileTick(event => {
  let projectile = event.getProjectile();

  if (projectile.getTags().contains("powerborne.shadow_field_projectile")) {
    let level = projectile.level;
    if (level.isClientSide()) return;

    let x = projectile.x;
    let y = projectile.y;
    let z = projectile.z;

    let motion = projectile.getDeltaMovement();
    let motionX = motion.get("x") || 0;
    let motionY = motion.get("y") || 0;
    let motionZ = motion.get("z") || 0;

    let currentBlockX = Math.floor(x);
    let currentBlockY = Math.floor(y);
    let currentBlockZ = Math.floor(z);

    let lookAhead = 0.2;
    let aheadX = Math.floor(x + motionX * lookAhead);
    let aheadY = Math.floor(y + motionY * lookAhead);
    let aheadZ = Math.floor(z + motionZ * lookAhead);

    let blocksToCheck = [
      { x: currentBlockX, y: currentBlockY, z: currentBlockZ },
      { x: aheadX, y: aheadY, z: aheadZ },
      { x: currentBlockX, y: currentBlockY - 1, z: currentBlockZ },
      { x: aheadX, y: aheadY - 1, z: aheadZ }
    ];

    for (let check of blocksToCheck) {
      let block = level.getBlock(check.x, check.y, check.z);
      if (block && !block.getBlockState().canBeReplaced() && block.id !== "powerborne:void_block") {
        // Hit a solid block, create shadow field at impact position
        createShadowField(level.server, level, check.x + 0.5, check.y + 1, check.z + 0.5, 0);
        projectile.kill();
        return;
      }
    }
  }
});