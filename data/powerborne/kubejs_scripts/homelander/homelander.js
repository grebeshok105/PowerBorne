let HomelanderCoreVec3 = Java.loadClass('net.minecraft.world.phys.Vec3');

const HOMELANDER_SUPER_PUNCH_COOLDOWN_TICKS = 30;
const HOMELANDER_SUPER_PUNCH_DAMAGE = 18;
const HOMELANDER_SUPER_PUNCH_RANGE = 3.75;
const HOMELANDER_SUPER_PUNCH_HIT_GIVE = 1.0;

PlayerEvents.tick((event) => {
  const player = event.player;
  if (!abilityUtil.hasPower(player, 'powerborne:homelander')) return;

  global.handleSpaceBreathing(player, 'powerborne:homelander');
  global.handleFlightBoost(player, 'powerborne:homelander');
  global.handleSpeedFood(player, 'powerborne:homelander');

  if (player.isOnFire()) {
    player.setRemainingFireTicks(0);
  }

  let punchCooldown = palladium.getProperty(player, 'super_punch_cooldown') || 0;
  if (punchCooldown > 0) {
    palladium.setProperty(player, 'super_punch_cooldown', punchCooldown - 1);
  }
});

function canAffectHomelanderTarget(targetEntity) {
  if (!targetEntity.isLiving() || !targetEntity.isAlive()) return false;
  if (targetEntity.isPlayer() && targetEntity.isCreative()) return false;
  return true;
}

function getHomelanderConeTargets(player, range, dotThreshold, inflateXZ, inflateY) {
  let eyePos = new HomelanderCoreVec3(player.x, player.y + player.getEyeHeight(), player.z);
  let lookAngle = player.getLookAngle();
  let targetAABB = player.getBoundingBox()
    .expandTowards(lookAngle.scale(range))
    .inflate(inflateXZ, inflateY, inflateXZ);

  let entries = [];
  player.level.getEntitiesWithin(targetAABB).forEach(function(targetEntity) {
    if (targetEntity === player || !canAffectHomelanderTarget(targetEntity)) return;

    let entityCenter = new HomelanderCoreVec3(targetEntity.x, targetEntity.y + targetEntity.getBbHeight() * 0.5, targetEntity.z);
    let toEntity = entityCenter.subtract(eyePos);
    let distance = toEntity.length();
    if (distance > range) return;

    if (distance >= 0.001) {
      let dotProduct = lookAngle.dot(toEntity.normalize());
      if (dotProduct <= dotThreshold) return;
    }
    if (!player.hasLineOfSight(targetEntity)) return;

    entries.push({ entity: targetEntity, distance: distance });
  });

  return entries;
}

function knockHomelanderTargetAway(player, targetEntity, strength, height) {
  let dx = targetEntity.x - player.x;
  let dz = targetEntity.z - player.z;
  let planarDistance = Math.sqrt(dx * dx + dz * dz) || 1;
  let knockbackX = dx / planarDistance;
  let knockbackZ = dz / planarDistance;

  targetEntity.knockback(strength, -knockbackX, -knockbackZ);
  targetEntity.addMotion(0, height * strength, 0);
}

PlayerEvents.tick((event) => {
  const player = event.player;
  if (!abilityUtil.hasPower(player, 'powerborne:homelander')) return;

  if (abilityUtil.isEnabled(player, 'powerborne:homelander', 'sonic_scream')) {
    global.sound(player, 'minecraft:entity.warden.sonic_boom', 1.0, 1.15);
    player.level.spawnParticles('minecraft:poof', true, player.x, player.y + 1.2, player.z, 0.2, 0.2, 0.2, 10, 0.08);

    let targets = getHomelanderConeTargets(player, 13, 0.35, 4.5, 3);
    targets.forEach(function(entry) {
      let target = entry.entity;
      target.attack(player.damageSources().playerAttack(player), 1.0);
      target.potionEffects.add('minecraft:slowness', 70, 4, false, true);
      target.potionEffects.add('minecraft:weakness', 70, 1, false, true);
      target.potionEffects.add('minecraft:blindness', 35, 0, false, true);
      target.potionEffects.add('minecraft:darkness', 45, 0, false, true);
      knockHomelanderTargetAway(player, target, 1.2, 0.08);
    });

    if (targets.length > 0) {
      global.levelingSystem.awardXPForAbility(player, 'powerborne:homelander', 'sonic_scream', { entitiesHit: targets.length });
    }
  }
});

PlayerEvents.tick((event) => {
  const player = event.player;
  if (!abilityUtil.hasPower(player, 'powerborne:homelander')) return;

  let abilityInstance = abilityUtil.getInstance(player, 'powerborne:homelander', 'super_punch_timer');
  if (abilityInstance && !abilityInstance.isEnabled() && abilityInstance.getPropertyByName('prev_value') == 40) {
    player.swing();
    player.level.spawnParticles('minecraft:poof', true, player.x, player.y + 1, player.z, 0, 0, 0, 3, 0.05);

    let eyePos = new HomelanderCoreVec3(player.x, player.y + player.getEyeHeight(), player.z);
    let lookAngle = player.getLookAngle();
    player.setMotion(lookAngle.x() * 0.4, 0, lookAngle.z() * 0.4);
    player.hurtMarked = true;

    let targetAABB = player.getBoundingBox().expandTowards(lookAngle.scale(HOMELANDER_SUPER_PUNCH_RANGE));
    let coneCandidates = [];

    player.level.getEntitiesWithin(targetAABB).forEach(entity => {
      if (!entity.isLiving() || entity === player || !entity.isAlive()) return;

      let entityCenter = new HomelanderCoreVec3(entity.x, entity.y + entity.getBbHeight() * 0.5, entity.z);
      let toEntity = entityCenter.subtract(eyePos);
      let distance = toEntity.length();
      if (distance > HOMELANDER_SUPER_PUNCH_RANGE) return;

      if (distance >= 0.001) {
        let toEntityNorm = toEntity.normalize();
        let dotProduct = lookAngle.dot(toEntityNorm);
        if (dotProduct <= 0.3) return;
      }
      if (!player.hasLineOfSight(entity)) return;

      coneCandidates.push({ entity: entity, distance: distance });
    });

    coneCandidates.sort((a, b) => a.distance - b.distance);

    let hitRange = coneCandidates.length > 0 ? coneCandidates[0].distance + HOMELANDER_SUPER_PUNCH_HIT_GIVE : 0;
    let coneEntities = coneCandidates.filter(function(e) { return e.distance <= hitRange; }).map(function(e) { return e.entity; });

    coneEntities.forEach(entity => {
      entity.attack(player.damageSources().playerAttack(player), HOMELANDER_SUPER_PUNCH_DAMAGE);
      player.level.spawnParticles('powerborne:white_boom', true, entity.x, entity.y + entity.getBbHeight() * 0.5, entity.z, 0.3, 0.3, 0.3, 1, 0.05);

      let dx = entity.x - player.x;
      let dz = entity.z - player.z;
      let planarDistance = Math.sqrt(dx * dx + dz * dz);

      if (planarDistance > 0.001) {
        let knockbackX = dx / planarDistance;
        let knockbackZ = dz / planarDistance;
        entity.addMotion(knockbackX * 2, 0, knockbackZ * 2);
      }
    });

    if (coneEntities.length > 0) {
      subBloodVCharge(player, HOMELANDER_BLOOD_V.SUPER_PUNCH_COST);
      palladium.setProperty(player, 'super_punch_cooldown', HOMELANDER_SUPER_PUNCH_COOLDOWN_TICKS);
      global.sound(player, 'powerborne:super_punch', 1, 1.0, 0.1);
      global.levelingSystem.awardXPForAbility(player, 'powerborne:homelander', 'super_punch', { entitiesHit: coneEntities.length });
    } else {
      global.sound(player, 'minecraft:entity.player.attack.nodamage', 1, 1.0);
    }
  }
});

EntityEvents.death(event => {
  const entity = event.entity;
  if (entity.isPlayer()) {
    if (!abilityUtil.hasPower(entity, 'powerborne:homelander')) return;
    if (palladium.getProperty(entity, 'energy_bar_blood_v') > 20) {
      palladium.setProperty(entity, 'energy_bar_blood_v', 20);
    } else {
      palladium.setProperty(entity, 'energy_bar_blood_v', 0);
    }
  }
});
