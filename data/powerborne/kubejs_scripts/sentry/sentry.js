const FORCEFIELD_REGEN_CD_TICKS = 300;

EntityEvents.hurt(event => {
    const entity = event.entity;
    const source = event.source;
    const attacker = source.immediate;
    
    // Photon forcefield damage immunity
    if (entity.isPlayer() && abilityUtil.isEnabled(entity, "powerborne:sentry", "photon_forcefield")) {
        event.cancel();
        return;
    }
});

PlayerEvents.tick(event => {
  const player = event.player;
  if (!abilityUtil.hasPower(player, "powerborne:sentry")) return;

  let regenCd = palladium.getProperty(player, "forcefield_regen_cooldown") || 0;
  if (regenCd > 0) {
    palladium.setProperty(player, "forcefield_regen_cooldown", regenCd - 1);
  }

  let ffInst = abilityUtil.getInstance(player, "powerborne:sentry", "photon_forcefield");
  if (ffInst && ffInst.isEnabled() && ffInst.getEnabledTicks() === 1) {
    let cdNow = palladium.getProperty(player, "forcefield_regen_cooldown") || 0;
    if (cdNow <= 0) {
      palladium.setProperty(player, "forcefield_regen_cooldown", FORCEFIELD_REGEN_CD_TICKS);
    }
  }

  global.handleSpeedFood(player, "powerborne:sentry");
  global.handleFlightBoost(player, "powerborne:sentry");
  global.handleSpaceBreathing(player, "powerborne:sentry");

  if(player.isOnFire()) {
    player.setRemainingFireTicks(0);
  }

  if (player.age % 1201 === 0) {
    if (player.getAbsorptionAmount() < 20) {
      player.mergeNbt({AbsorptionAmount: 20.0});
      global.sound(player, "minecraft:block.sculk.charge", 1.5, 1);
    }
  }
});

EntityEvents.spawned(event => {  
    let entity = event.entity;
    if (entity.type == "minecraft:potion") {  
        let itemStack = entity.getItem();  
        if (itemStack.nbt && itemStack.nbt.get("Potion") == "powerborne:golden_serum") {  
            entity.discard(); 
        }  
    }  
});

ItemEvents.rightClicked(event => {
  let player = event.player;
  let item = event.item;
  if (item.id == "minecraft:splash_potion" || item.id == "minecraft:lingering_potion") {
    if (item.nbt.get("Potion") == "powerborne:golden_serum") {
      player.setHeldItem(event.hand, Item.of('minecraft:potion', '{Potion:"powerborne:golden_serum"}'));
      event.cancel();
    }
  }
});

// Energy Shield push and bob
PlayerEvents.tick(event => {
  let player = event.player;
  if (abilityUtil.isEnabled(player, "powerborne:sentry", "photon_forcefield")) {
      player.setNoGravity(true);
      player.modifyAttribute("palladium:flight_speed", "photon_forcefield", -10, "multiply_base");
  
      let bobSpeed = 10.0;
      let bobHeight = 0.01;
      let verticalMotion = Math.sin(event.level.time / bobSpeed) * bobHeight;
      let currentMotion = player.getDeltaMovement();
      player.setMotion(
          currentMotion.x() * 0.95,
          verticalMotion,
          currentMotion.z() * 0.95
      );
      player.hurtMarked = true;
  
      let pushStrength = 0.5;
      let radius = 2.5;
      let victims = event.level.getEntitiesWithin(player.getBoundingBox().inflate(radius, 1.5, radius));
      
      
      let entitiesToProcess = [];
      victims.forEach(entity => {
          if (!entity.is(player)) {
              entitiesToProcess.push(entity);
          }
      });
      
      entitiesToProcess.forEach(entity => {
          if (entity && entity.isAlive()) {
              let dx = entity.x - player.x;
              let dy = entity.y - player.y;
              let dz = entity.z - player.z;
              let distance = player.distanceToEntity(entity);
              if (distance < 0.1) return;
              let ndx = dx / distance;
              let ndy = dy / distance;
              let ndz = dz / distance;
              entity.addMotion(ndx * pushStrength, ndy * pushStrength, ndz * pushStrength);
              entity.hurtMarked = true;
          }
      });
  } else {
    player.setNoGravity(false);
    player.removeAttribute("palladium:flight_speed", "photon_forcefield");
  }
});