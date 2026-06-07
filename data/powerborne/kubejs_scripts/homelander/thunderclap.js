let HomelanderThunderVec3 = Java.loadClass('net.minecraft.world.phys.Vec3');

const HOMELANDER_THUNDERCLAP_RANGE = 11;
const HOMELANDER_THUNDERCLAP_DAMAGE_MAX = 15;
const HOMELANDER_THUNDERCLAP_DAMAGE_MIN = 3;
const HOMELANDER_THUNDERCLAP_KNOCKBACK_STRENGTH = 4.0;
const HOMELANDER_THUNDERCLAP_KNOCKBACK_HEIGHT = 0.15;
const HOMELANDER_THUNDERCLAP_RADIUS = 1.5;

const HOMELANDER_THUNDERCLAP_PARTICLES = {
  'Damage': 0,
  'Gravity': 0,
  'Lifetime': 8,
  'DieOnEntityHit': false,
  'Appearances': [
    {
      'Type': 'particles',
      'ParticleType': 'powerborne:white_boom',
      'Spread': 0
    }
  ]
};

function getHomelanderThunderclapDamage(distance) {
  const clamped = Math.max(0, Math.min(distance, HOMELANDER_THUNDERCLAP_RANGE));
  const t = clamped / HOMELANDER_THUNDERCLAP_RANGE;
  return HOMELANDER_THUNDERCLAP_DAMAGE_MAX + (HOMELANDER_THUNDERCLAP_DAMAGE_MIN - HOMELANDER_THUNDERCLAP_DAMAGE_MAX) * t;
}

function applyHomelanderThunderclapEffect(player, targetEntity, distance) {
  let dx = targetEntity.x - player.x;
  let dz = targetEntity.z - player.z;
  let planarDistance = Math.sqrt(dx * dx + dz * dz) || 1;
  let knockbackX = dx / planarDistance;
  let knockbackZ = dz / planarDistance;
  const damage = getHomelanderThunderclapDamage(distance);
  targetEntity.attack(player.damageSources().playerAttack(player), damage);
  targetEntity.knockback(HOMELANDER_THUNDERCLAP_KNOCKBACK_STRENGTH, -knockbackX, -knockbackZ);
  targetEntity.addMotion(0, HOMELANDER_THUNDERCLAP_KNOCKBACK_HEIGHT * HOMELANDER_THUNDERCLAP_KNOCKBACK_STRENGTH, 0);
}

PlayerEvents.tick(function(event) {
  let player = event.player;
  let timer = global.getAbilityAnimationTicks(player, 'powerborne:homelander', 'thunderclap_kjs_anim', true);
  let prevTimer = player.persistentData.homelanderThunderclapPrevTimer || 0;
  player.persistentData.homelanderThunderclapPrevTimer = timer;

  if (prevTimer > 0 && timer == 0) {
    global.setPehkuiScale(player, { 'pehkui:motion': 1.0 });
  }
  if (timer == 1) {
    global.sound(player, 'powerborne:thunderclap', 1, 1);
    global.setPehkuiScale(player, { 'pehkui:motion': 0.2 });
  }

  if (abilityUtil.isEnabled(player, 'powerborne:homelander', 'thunderclap')) {
    let projectile_particles = global.createProjectile(player, 1, HOMELANDER_THUNDERCLAP_PARTICLES, 1, 1);
    projectile_particles.spawn();
    player.level.spawnParticles('minecraft:poof', true, player.x, player.y + 1, player.z, 0, 0, 0, 3, 0.1);
    global.breakReplaceableInRadius(player.level, player, player.x, player.y, player.z, 4);

    let eyePos = new HomelanderThunderVec3(player.x, player.y + player.getEyeHeight(), player.z);
    let lookAngle = player.getLookAngle();
    let affectedEntities = new Set();
    let targetAABB = player.getBoundingBox().expandTowards(lookAngle.scale(HOMELANDER_THUNDERCLAP_RANGE)).inflate(4, 3, 4);
    let coneEntities = [];

    player.level.getEntitiesWithin(targetAABB).forEach(function(targetEntity) {
      if (!targetEntity.isLiving() || targetEntity === player || !targetEntity.isAlive()) return;
      let entityCenter = new HomelanderThunderVec3(targetEntity.x, targetEntity.y + targetEntity.getBbHeight() * 0.5, targetEntity.z);
      let toEntity = entityCenter.subtract(eyePos);
      let distance = toEntity.length();
      if (distance > HOMELANDER_THUNDERCLAP_RANGE) return;
      if (distance >= 0.001) {
        let toEntityNorm = toEntity.normalize();
        let dotProduct = lookAngle.dot(toEntityNorm);
        if (dotProduct <= 0.5) return;
      }
      if (!player.hasLineOfSight(targetEntity)) return;
      coneEntities.push({ entity: targetEntity, distance: distance });
    });

    coneEntities.forEach(function(entry) {
      applyHomelanderThunderclapEffect(player, entry.entity, entry.distance);
      affectedEntities.add(entry.entity.getId());
    });

    let radiusEntities = player.level.getEntitiesWithin(player.getBoundingBox().inflate(HOMELANDER_THUNDERCLAP_RADIUS));
    let radiusHitCount = 0;
    radiusEntities.forEach(function(targetEntity) {
      if (!targetEntity.isLiving() || targetEntity === player || !targetEntity.isAlive()) return;
      if (affectedEntities.has(targetEntity.getId())) return;
      let entityCenter = new HomelanderThunderVec3(targetEntity.x, targetEntity.y + targetEntity.getBbHeight() * 0.5, targetEntity.z);
      let distance = eyePos.distanceTo(entityCenter);
      applyHomelanderThunderclapEffect(player, targetEntity, distance);
      affectedEntities.add(targetEntity.getId());
      radiusHitCount++;
    });

    let totalHit = coneEntities.length + radiusHitCount;
    if (totalHit > 0) {
      global.levelingSystem.awardXPForAbility(player, 'powerborne:homelander', 'thunderclap', { entitiesHit: totalHit });
    }
    global.setPehkuiScale(player, { 'pehkui:motion': 1.0 });
  }
});
