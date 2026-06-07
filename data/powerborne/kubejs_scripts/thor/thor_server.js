PlayerEvents.tick(event => {
    const player = event.player;

    if (!abilityUtil.hasPower(player, "powerborne:god_of_thunder")) {
        return;
    }
    global.handleSpaceBreathing(player, "powerborne:god_of_thunder");

    if (player.isOnFire()) {
        player.setRemainingFireTicks(0);
    }

    let handler = player.palladium$getFlightHandler();
    let isFlyingType = handler.getFlightType().isNotNull();
    let isFlying = abilityUtil.isEnabled(player, "powerborne:god_of_thunder", "is_flying");
    let isFastFlying = abilityUtil.isEnabled(player, "powerborne:god_of_thunder", "is_fast_flying");
    let isFlightUnlocked = abilityUtil.isUnlocked(player, "powerborne:god_of_thunder", "flight_buy");
    let isGodMode = abilityUtil.isEnabled(player, "powerborne:god_of_thunder", "god_mode");
    let isHoveringOrFlying = abilityUtil.isEnabled(player, "powerborne:god_of_thunder", "is_hovering_or_flying");
    let horizontalSpeed = handler.getHorizontalSpeed(0);
    let mainHandId = player.getMainHandItem().id;
    let holdsMjolnirOrStormbreaker = mainHandId === 'powerborne:mjolnir' || mainHandId === 'powerborne:stormbreaker';
    if (!holdsMjolnirOrStormbreaker && !isGodMode) {
        if (isFlying && isFlyingType) {
            handler.flightBoost = 0.0;
            player.refreshDimensions();
        }
        if (isHoveringOrFlying && !player.onGround()) {
            player.setSprinting(false);
        }
    }
    if (holdsMjolnirOrStormbreaker && !isFlightUnlocked && isFastFlying && horizontalSpeed < 0.015) {
        handler.setFlightType(handler.getFlightType().NONE);
        player.refreshDimensions();
    }

    const isUsingMjolnir = abilityUtil.isEnabled(player, "powerborne:god_of_thunder", "mjolnir_use");
    const isCharging = abilityUtil.isEnabled(player, "powerborne:god_of_thunder", "lightning_charge_timer");

    if (isUsingMjolnir || isCharging) {
      player.resetFallDistance();
    }

    if (abilityUtil.isEnabled(player, "powerborne:god_of_thunder", "god_mode")) {
      let data = player.persistentData

      let prevX = data.prevX || player.x
      let prevY = data.prevY || player.y
      let prevZ = data.prevZ || player.z
    
      data.prevX = player.x
      data.prevY = player.y
      data.prevZ = player.z
    
      data.motionX = player.x - prevX
      data.motionY = player.y - prevY
      data.motionZ = player.z - prevZ

      global.handleSpeedFood(player, "powerborne:god_of_thunder");
    }
});

EntityEvents.hurt(event => {
    let source = event.source;
    let attacker = source.immediate;
    let type = source.type().msgId();
    if (attacker && type === 'player' && event.entity.hurtTime == 0 && attacker.isPlayer()) {
        let itemId = attacker.getMainHandItem().id;
        if (itemId === 'powerborne:mjolnir' || itemId === 'powerborne:stormbreaker') {
            global.playSoundToAll(event.entity, 10, 'powerborne:mjolnir_hit', 'players', 0.7, 1);
        }
    }

    if (attacker && type === 'player' && attacker.isPlayer()
        && abilityUtil.isEnabled(attacker, "powerborne:god_of_thunder", "god_mode")) {
        let entity = event.entity;
        if (Math.random() < 0.6) {
            attacker.server.scheduleInTicks(5, () => {
                if (entity && entity.isAlive()) {
                    entity.getLevel().spawnLightning(entity.x, entity.y, entity.z, false);
                }
            });
        }
    }
});

let GOD_AURA = {
    BODY_SPARK_COUNT_SPRINT: 2,
    BODY_SPARK_COUNT_IDLE: 1,
    SPARK_INTERVAL_SPRINT: 1,
    SPARK_INTERVAL_IDLE: 2,
  };
  
  function spawnBodyElectricity(player, sprinting) {
    let level = player.level;
    let interval = sprinting ? GOD_AURA.SPARK_INTERVAL_SPRINT : GOD_AURA.SPARK_INTERVAL_IDLE;
    let sparkCount = sprinting ? GOD_AURA.BODY_SPARK_COUNT_SPRINT : GOD_AURA.BODY_SPARK_COUNT_IDLE;
  
    if (player.age % interval !== 0) return;
  
    level.spawnParticles('minecraft:electric_spark', true,
      player.x, player.y + 1.0, player.z,
      0.25, 0.6, 0.25, sparkCount, 0.01
    );
  
    let chance = sprinting ? 0.15 : 0.075;
    if (Math.random() < chance) {
      level.spawnParticles('minecraft:end_rod', true,
        player.x + (Math.random() - 0.5) * 0.4,
        player.y + 0.5 + Math.random() * 1.2,
        player.z + (Math.random() - 0.5) * 0.4,
        0.01, 0.01, 0.01, 1, 0.005
      );
    }
  
    if (Math.random() < chance) {
      level.spawnParticles('powerborne:lightning', true,
        player.x + (Math.random() - 0.5) * 0.5,
        player.y + 0.3 + Math.random() * 1.5,
        player.z + (Math.random() - 0.5) * 0.5,
        0.01, 0.02, 0.01, 1, 0.005
      );
    }
  }

  function getMotion(player) {
    let data = player.persistentData
    return new Vec3d(data.motionX || 0, data.motionY || 0, data.motionZ || 0)
  }

  function tickGodModeRunThrough(player) {
    if (!player.isSprinting()) return;

    let motion = getMotion(player)
    let speed = motion.length()
    let speedBps = speed * 20
    if (speedBps < 15) return;
  
    let nearbyEntities = player.level.getEntitiesWithin(player.getBoundingBox());
  
    nearbyEntities.forEach(entity => {
      if (!entity.isLiving() || entity.is(player)) return;
  
      entity.attack(3);
  
      entity.potionEffects.add('minecraft:slowness', 30, 2, false, true);
      global.sound(entity, 'powerborne:chain_lightning_hit', 0.5, 1);

      entity.getLevel().spawnParticles(
          'minecraft:firework',
          true,
          entity.x, entity.y + entity.getBbHeight() / 2, entity.z,
          0.3, 0.3, 0.3,
          5, 0.1
      );
  
    });
  }
  
  function tickGodModeAura(player) {
    let sprinting = player.isSprinting();
    spawnBodyElectricity(player, sprinting);
  }

EntityEvents.death(event => {
    let entity = event.entity;
    if (entity.isPlayer()) {
        if (!abilityUtil.hasPower(entity, "powerborne:god_of_thunder")) return;
        if (palladium.getProperty(entity, 'energy_bar_lightning') > 0) {
            palladium.setProperty(entity, 'energy_bar_lightning', 0);
        }
    }
});