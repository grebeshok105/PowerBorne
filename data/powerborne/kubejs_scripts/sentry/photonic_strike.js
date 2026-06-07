let $ParticleTypes = Java.loadClass("net.minecraft.core.particles.ParticleTypes")
let $BlockParticleOption = Java.loadClass('net.minecraft.core.particles.BlockParticleOption');

PlayerEvents.tick((event) => {
  const player = event.player;
  const level = event.level;
  let { x, y, z } = player;
  let attributeID = Platform.isForge() ? 'forge:entity_gravity' : 'porting_lib:entity_gravity'
  if (!abilityUtil.hasPower(player, "powerborne:sentry")) return;

  if (abilityUtil.isEnabled(player, "powerborne:sentry", "photonic_strike")) {
      let abilityInstance = abilityUtil.getInstance(player, "powerborne:sentry", "photonic_strike");
      let ticks = abilityInstance ? abilityInstance.getEnabledTicks() : 0;

      player.potionEffects.add("minecraft:levitation", 10, 90, false, false);
      player.modifyAttribute(attributeID, "photonic_strike", 6, "addition");
      player.potionEffects.add("minecraft:resistance", 38, 255, false, false);
      player.addTag("powerborne.photonic_strike");
      level.spawnParticles("minecraft:end_rod", false, x, y + 1, z, 0.5, 0.3, 0.5, 5, 0.05);
      level.spawnParticles("minecraft:flash", false, x, y + 0.5, z, 2, 0, 0, 0, 0);
      global.sound(player, "powerborne:sentry_fly_start", 2, 0.8);
  }

  if (abilityUtil.isEnabled(player, "powerborne:sentry", "is_hovering_or_flying") || player.isInWater()) {
      player.removeAttribute(attributeID, "photonic_strike");
      player.removeTag("powerborne.photonic_strike");
  }

  if (player.tags.contains("powerborne.photonic_strike") && player.getDeltaMovement().get("y") < -0.5) {
      level.spawnParticles("minecraft:electric_spark", false, x, y + 1, z, 2, 0.1, 0.1, 0.1, 0);
  }

  if (
    player.getDeltaMovement().get("y") < -5 &&
    player.onGround() &&
    player.getAttributeValue(attributeID) > 5
  ) {
    player.removeAttribute(attributeID, "photonic_strike");

    level
      .createExplosion(x, y, z)
      .strength(2.5)
      .explosionMode("none")
      .exploder(player)
      .explode();

    let radius = 6;
    global.breakReplaceableInRadius(level, player, x, y, z, radius);
    let nearbyEntities = level.getEntitiesWithin(player.getBoundingBox().inflate(radius));
    nearbyEntities.forEach(entity => {
      if (!entity.isLiving()) return;
      if (entity === player) return;
      if (!entity.isAlive() || !entity.attackable()) return;

      let distSq = entity.distanceToSqr(player);
      if (distSq > radius * radius) return;

      let dist = Math.sqrt(distSq);
      let damageFalloff = 1.0 - (dist / radius);
      let damage = 10 * damageFalloff;

      let dx = entity.x - player.x;
      let dz = entity.z - player.z;
      let horizontalDist = Math.sqrt(dx * dx + dz * dz);
      let ndx = horizontalDist > 0.1 ? dx / horizontalDist : 0;
      let ndz = horizontalDist > 0.1 ? dz / horizontalDist : 0;

      let knockbackStrength = Math.max(0.15, 1.0 * damageFalloff);

      if (entity.hurtTime == 0) {
        entity.attack(player.damageSources().playerAttack(player), damage);
      }
      entity.addMotion(ndx * knockbackStrength, knockbackStrength, ndz * knockbackStrength);
      entity.hurtMarked = true;
    });
    player.potionEffects.add("minecraft:slowness", 15, 3, false, false);

    global.sound(player, "minecraft:entity.firework_rocket.blast_far", 1.2, 1.0);
    global.sound(player, "minecraft:block.conduit.deactivate", 0.8, 1);

    level.sendParticles(player, new DustParticleOptions(new Vector3f(1.0, 0.9, 0.2), 1.5), true, x, y + 0.2, z, 400, 2.2, 0.1, 2.2, 0);

    level.spawnParticles("minecraft:flash", false, x, y + 0.5, z, 3, 0, 0, 0, 0);

    let blockBelow = level.getBlock(player.x, player.y - 1, player.z);
    event.level.sendParticles(new $BlockParticleOption($ParticleTypes.BLOCK, blockBelow.getBlockState()), x, y + 0.5, z, 150, 2.0, 1.0, 2.0, 0.5);
    global.levelingSystem.awardXPForAbility(player, "powerborne:sentry", "photonic_strike");
    level.spawnParticles('minecraft:flame', true, x, y, z, 1.0, 1.5, 1.0, 50, 0.4);
    level.spawnParticles('minecraft:lava', true, x, y, z, 1.0, 1.0, 1.0, 10, 0);
    level.sendParticles($ParticleTypes.ASH, x, y + 0.2, z, 100, 3, 0.5, 3, 0);
    if (player.tags.contains("powerborne.photonic_strike_land")) {
        player.unlockAdvancement('powerborne:sentry_origin');
    }
    player.removeTag("powerborne.photonic_strike");
    player.removeTag("powerborne.photonic_strike_land");
    player.sendData("screen_shake", { ticks: 20, base_intensity: 1, max_intensity: 3 });
  }
});