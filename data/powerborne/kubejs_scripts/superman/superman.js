const SUPER_PUNCH_COOLDOWN_TICKS = 30;

PlayerEvents.tick((event) => {
  const player = event.player;
  if (!abilityUtil.hasPower(player, "powerborne:superman")) return;
  global.handleSpaceBreathing(player, "powerborne:superman");
  global.handleFlightBoost(player, "powerborne:superman");
  global.handleSpeedFood(player, "powerborne:superman");

  if(player.isOnFire()) {
    player.setRemainingFireTicks(0);
  }

  let punchCooldown = palladium.getProperty(player, "super_punch_cooldown") || 0;
  if (punchCooldown > 0) {
    palladium.setProperty(player, "super_punch_cooldown", punchCooldown - 1);
  }
});

const SUPER_PUNCH_DAMAGE = 18;
const SUPER_PUNCH_RANGE = 3.75;
const SUPER_PUNCH_HIT_GIVE = 1.0;

// super punch
PlayerEvents.tick((event) => {
  const player = event.player;
  if (!abilityUtil.hasPower(player, "powerborne:superman")) return;

  let abilityInstance = abilityUtil.getInstance(player, "powerborne:superman", "super_punch_timer");
  if (abilityInstance && !abilityInstance.isEnabled() && abilityInstance.getPropertyByName("prev_value") == 40) {
    player.swing();
    player.level.spawnParticles("minecraft:poof", true, player.x, player.y + 1, player.z, 0, 0, 0, 3, 0.05);

    let superPunchRange = SUPER_PUNCH_RANGE;
    let eyePos = new Vec3(player.x, player.y + player.getEyeHeight(), player.z);
    let lookAngle = player.getLookAngle();
    player.setMotion(lookAngle.x() * 0.4, 0, lookAngle.z() * 0.4);
    player.hurtMarked = true;

    let targetAABB = player.getBoundingBox()
      .expandTowards(lookAngle.scale(superPunchRange))

    let coneCandidates = [];
    player.level.getEntitiesWithin(targetAABB).forEach(entity => {
      if (!entity.isLiving() || entity === player || !entity.isAlive()) return;

      let entityCenter = new Vec3(entity.x, entity.y + entity.getBbHeight() * 0.5, entity.z);
      let toEntity = entityCenter.subtract(eyePos);
      let distance = toEntity.length();
      if (distance > superPunchRange) return;

      if (distance >= 0.001) {
        let toEntityNorm = toEntity.normalize();
        let dotProduct = lookAngle.dot(toEntityNorm);
        if (dotProduct <= 0.3) return;
      }
      if (!player.hasLineOfSight(entity)) return;

      coneCandidates.push({ entity: entity, distance: distance });
    });

    coneCandidates.sort((a, b) => a.distance - b.distance);

    let hitRange = coneCandidates.length > 0 ? coneCandidates[0].distance + SUPER_PUNCH_HIT_GIVE : 0;
    let coneEntities = coneCandidates.filter(function(e) { return e.distance <= hitRange; }).map(function(e) { return e.entity; });

    coneEntities.forEach(entity => {
      entity.attack(player.damageSources().playerAttack(player), SUPER_PUNCH_DAMAGE);
      player.level.spawnParticles("powerborne:white_boom", true, entity.x, entity.y + entity.getBbHeight() * 0.5, entity.z, 0.3, 0.3, 0.3, 1, 0.05);

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
      subSolarCharge(player, SOLAR.SUPER_PUNCH_COST);
      palladium.setProperty(player, "super_punch_cooldown", SUPER_PUNCH_COOLDOWN_TICKS);
      global.sound(player, 'powerborne:super_punch', 1, 1.0, 0.1);
      global.levelingSystem.awardXPForAbility(player, "powerborne:superman", "super_punch", { entitiesHit: coneEntities.length });
    } else {
      global.sound(player, 'minecraft:entity.player.attack.nodamage', 1, 1.0);
    }
  }
});

EntityEvents.death(event => {
  const entity = event.entity;
  if (entity.isPlayer()) {
    if (!abilityUtil.hasPower(entity, "powerborne:superman")) return;
    if (palladium.getProperty(entity, 'energy_bar_solar') > 20) {
      palladium.setProperty(entity, 'energy_bar_solar', 20);
    } else {
      palladium.setProperty(entity, 'energy_bar_solar', 0);
    }
  }
});