StartupEvents.registry('palladium:abilities', (event) => {
    event.create('powerborne:set_property')
        .addProperty('property', 'string', 'mjolnir_throw_mode', 'The property to set')
        .addProperty('value', 'integer', 0, 'The value to set')
        .firstTick((entity, entry, holder, enabled) => {
            if (enabled) {
                let propName = entry.getPropertyByName('property');
                let propValue = entry.getPropertyByName('value');
                palladium.setProperty(entity, propName, propValue);
            }
        });

    event.create('powerborne:set_stand_property')
        .icon(palladium.createItemIcon('minecraft:writable_book'))
        .addProperty('property', 'string', '', 'The property to set')
        .addProperty('value', 'string', '', 'The value to set')
        .firstTick((entity, entry, holder, enabled) => {
            if (enabled) {
                const property = entry.getPropertyByName('property');
                const value = entry.getPropertyByName('value');
                palladium.setProperty(entity, property, value);
            }
        });

    event.create('powerborne:respiration')
        .icon(palladium.createItemIcon('minecraft:water_bucket'))
        .addProperty('multiplier', 'integer', 10, 'How much slower air drains underwater')
        .tick((entity, entry, holder, enabled) => {
            if (!enabled) return;
            const player = entity;
            if (!player.isUnderWater()) return;
            const multiplier = entry.getPropertyByName('multiplier');
            if (player.getAirSupply() > 0) {
                const maxAir = player.getMaxAirSupply();
                const currentAir = player.getAirSupply();
                if (currentAir < maxAir && player.age % 20 === 0) {
                    const airToGiveBack = 20 * (1 - (1 / multiplier));
                    const airToAdd = Math.round(airToGiveBack);
                    player.setAirSupply(currentAir + airToAdd);
                }
            }
        });

    event.create('powerborne:screen_shake')
        .icon(palladium.createItemIcon('minecraft:coal'))
        .addProperty("base_intensity", "float", 1.0, "base intensity")
        .addProperty("max_intensity", "float", 5.0, "max intensity")

    event.create('powerborne:teleport')
        .icon(palladium.createItemIcon('minecraft:ender_pearl'))
        .addProperty('max_distance', 'integer', 10, 'Max distance that the player can teleport.')
        .firstTick((entity, entry, holder, enabled) => {
            if (enabled) {
                const max_distance = entry.getPropertyByName('max_distance');
                const rayResult = global.advancedRayTrace(
                    entity,
                    entity.getLevel(),
                    max_distance,
                    false
                );
                if (rayResult.block != null) {
                    const targetBlock = rayResult.block;
                    entity.teleportTo(targetBlock.x + 0.5, targetBlock.y + 1, targetBlock.z + 0.5);
                } else {
                    // fallback: teleport to max distance in look direction
                    let lookVec = entity.getLookAngle();
                    let targetX = entity.getX() + lookVec.x() * max_distance;
                    let targetY = entity.getY() + lookVec.y() * max_distance;
                    let targetZ = entity.getZ() + lookVec.z() * max_distance;
                    entity.teleportTo(targetX, targetY + 1, targetZ);
                }
            }
        });

    event.create('powerborne:shadow_entity')  
        .icon(palladium.createItemIcon('minecraft:zombie_head'))  
        .tick((entity, entry, holder, enabled) => {  
            if (enabled && !entity.isPlayer()) {
                if (entity.hasEffect("minecraft:slowness") && entity.hasEffect("minecraft:darkness")) {
                    if (global.hasNearbyAreaEffectCloud(entity, 1)) {
                        entity.removeEffect("minecraft:slowness");
                    }
                }
                
                // Spawn particle trail
                entity.getLevel().spawnParticles('minecraft:dust 0 0 0 1', true, entity.x, entity.y + 0.5, entity.z, 0.2, 0.6, 0.2, 16, 0);
                
                let isValidTarget = (target) => {
                    if (target == null) return false;
                    if (!target.isLiving()) return false;
                    if (!target.isAlive()) return false;
                    if (!target.attackable()) return false;
                    if (target.getTags().contains('powerborne.shadow_field_husk')) return false;
                    if (target.getTags().contains('powerborne.void_active')) return false;
                    // Don't target entities that are already shadow-banned
                    if (abilityUtil.hasPower(target, "powerborne:shadow")) return false;
                    // Don't target players in creative mode
                    if (target.isPlayer() && target.isCreative()) return false;
                    // Check distance (within 20 blocks)
                    let distance = target.distanceToEntity(entity);
                    if (distance > 25) return false;
                    return true;
                };
                
                // Check if current target is still valid
                if (typeof entity.getTarget !== 'function') return;
                if (entity.getTarget() == null) return;
                let currentTarget = entity.getTarget();
                if (currentTarget != null && !isValidTarget(currentTarget)) {  
                    entity.setTarget(null);  
                }  
      
                if (entity.getTarget() == null) {  
                    let nearbyEntities = entity.getLevel().getEntitiesWithin(entity.getBoundingBox().inflate(10));  
                    let priorityTargets = [];
                    let normalTargets = [];
                    
                    nearbyEntities.forEach(n => {  
                        if (isValidTarget(n)) {
                            let hasDarkness = n.hasEffect('minecraft:darkness');
                            let hasSlowness = n.hasEffect('minecraft:slowness');
                            
                            if (hasDarkness && hasSlowness) {
                                priorityTargets.push(n);
                            } else {
                                normalTargets.push(n);
                            }
                        }  
                    });
                    
                    // Prioritize targets with darkness and slowness
                    if (priorityTargets.length > 0) {
                        entity.setTarget(priorityTargets[0]);
                    } else if (normalTargets.length > 0) {
                        entity.setTarget(normalTargets[0]);
                    }
                }  
            }  
        });

    event.create('powerborne:god_mode')
        .icon(palladium.createItemIcon('minecraft:lightning_rod'))
        .firstTick((entity, entry, holder, enabled) => {
            if (!enabled || !entity.isPlayer()) return;

            const level = entity.getLevel();

            const bolt = level.createEntity('minecraft:lightning_bolt');
            bolt.x = entity.x;
            bolt.y = entity.y;
            bolt.z = entity.z;
            bolt.setVisualOnly(true);
            bolt.spawn();
            global.sound(entity, 'minecraft:item.trident.thunder');

            level.spawnParticles('minecraft:electric_spark', true, entity.x, entity.y + 1.0, entity.z, 1.5, 1.0, 1.5, 100, 0.2);
            level.spawnParticles('minecraft:end_rod',        true, entity.x, entity.y + 1.0, entity.z, 1.0, 0.8, 1.0,  40, 0.12);
            level.spawnParticles('minecraft:scrape',         true, entity.x, entity.y + 1.0, entity.z, 0.5, 0.5, 0.5,  25, 0.1);
            level.spawnParticles('minecraft:soul_fire_flame',true, entity.x, entity.y + 1.0, entity.z, 0.8, 0.6, 0.8,  20, 0.08);

            level.getEntitiesWithin(entity.getBoundingBox().inflate(3)).forEach(nearby => {
                if (nearby.isLiving() && nearby !== entity) {
                    nearby.attack(entity.damageSources().playerAttack(entity), 6);
                    level.spawnParticles('minecraft:electric_spark', true, nearby.x, nearby.y + 1.0, nearby.z, 0.3, 0.4, 0.3, 20, 0.1);
                }
            });
            let mainhand = entity.getMainHandItem();
            if (mainhand && mainhand.id === "powerborne:mjolnir") {
                mainhand.nbt.putInt("CustomModelData", 1);
            }
        });

    event.create('powerborne:entity_kill')
        .icon(palladium.createItemIcon('minecraft:zombie_head'))
        .tick((entity, entry, holder, enabled) => {
            if (enabled && !entity.isPlayer()) {
                entity.getLevel().spawnParticles('minecraft:squid_ink', true, entity.x, entity.y + 0.5, entity.z, 0.25, 0.8, 0.25, 10, 0);
                global.sound(entity, 'block.sculk.spread', 1, 0.3);
                entity.discard();
            }
        });
});