let Integer = Java.loadClass('java.lang.Integer')

PalladiumEvents.customProjectileTick((event) => {  
    let projectile = event.getProjectile();
    
    if (projectile.getTags().contains("powerborne.freeze_breath_projectile")) {
        let owner = projectile.getOwner();
        if (owner && owner.type != "minecraft:wolf") {
            freezeWater(projectile.level, projectile.x, projectile.y, projectile.z);
            freezeLava(projectile.level, projectile.x, projectile.y, projectile.z);
        }
        
        let nearbyEntities = projectile.level.getEntitiesWithin(projectile.getBoundingBox().inflate(0.25));
        nearbyEntities.forEach(target => {
            if (
                target.isLiving() && target.attackable() &&
                !abilityUtil.hasPower(target, "powerborne:superman") &&
                !abilityUtil.hasPower(target, "powerborne:hb") &&
                !abilityUtil.hasPower(target, "powerborne:krypto") &&
                owner != target &&
                !target.getTags().contains("powerborne.wolf_mount_allay") &&
                !target.getTags().contains("powerborne.wolf_mount_turtle")
            ) {
                // Only check getOwner() if owner is a wolf
                if (owner && owner.type == "minecraft:wolf" && owner.getOwner && owner.getOwner() == target) return;
                let existingEffect = target.getEffect("powerborne:frozen");
                let currentDuration = existingEffect ? existingEffect.getDuration() : 0;
        
                let newDuration = Math.min(currentDuration + 20, 200);
                target.potionEffects.add("powerborne:frozen", newDuration, 0, true, true);
                
                // Award XP for freezing mob (when effect reaches 100+ ticks, which is "fully frozen")
                if (newDuration >= 100 && currentDuration < 100 && owner && owner.isPlayer() && !target.persistentData.getBoolean('powerborne_freeze_xp_awarded')) {
                    global.levelingSystem.awardXPForAbility(owner, "powerborne:superman", "freeze_breath");
                    target.persistentData.putBoolean('powerborne_freeze_xp_awarded', true);
                }

                if (newDuration >= 100 && owner && owner.type == "minecraft:wolf") {
                    owner.persistentData.freezeCooldown = 400;
                }
                projectile.kill();
            }
        });
    }
});

function freezeWater(level, centerX, centerY, centerZ) {
    let radius = 1;
    for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
            if (dx * dx + dz * dz > radius * radius) continue;
            let x = Math.floor(centerX + dx);
            let y = Math.floor(centerY - 1);
            let z = Math.floor(centerZ + dz);

            let above = level.getBlock(x, y + 1, z);
            let target = level.getBlock(x, y, z);

            if (above.blockState.isAir()) {
                if (
                    target.id === "minecraft:frosted_ice" ||
                    (target.id === "minecraft:water" && target.toString().includes("level=0"))
                ) {
                    target.set("minecraft:frosted_ice");
                }
            }
        }
    }
}

function freezeLava(level, centerX, centerY, centerZ) {
    let x = Math.floor(centerX);
    let y = Math.floor(centerY - 0.5);
    let z = Math.floor(centerZ);

    let above = level.getBlock(x, y + 1, z);
    let target = level.getBlock(x, y, z);

    if (above.blockState.isAir()) {
        if (target.id === "minecraft:lava" && target.toString().includes("level=0")) {
            target.set("minecraft:obsidian");
        }
    }
}

// 16-20 seconds
function getRandomDelay() {
    return Math.floor(Math.random() * (400 - 320 + 1)) + 320;
}

// Schedule a block to remove or decrease snow layers after a delay
function scheduleSnowRemoval(server, level, x, y, z, delay) {
    if (!server) return;
    
    server.scheduleInTicks(delay, () => {
        if (!level) return;
        
        let block = level.getBlock(x, y, z);
        
        if (block && block.id === "minecraft:snow") {
            let blockState = block.getBlockState();
            let currentLayers = blockState.getValue(BlockProperties.LAYERS);
            
            if (currentLayers > 1) {
                let newLayers = currentLayers - 1;
                let newBlockState = blockState.setValue(BlockProperties.LAYERS, Integer.valueOf(newLayers.toString()));
                level.setBlock(new BlockPos(x, y, z), newBlockState, 3);
                scheduleSnowRemoval(server, level, x, y, z, Math.floor(delay * 0.7));
            } else {
                if (Math.random() < 0.5) {
                    level.destroyBlock(new BlockPos(x, y, z), false);
                } else {
                    block.set("minecraft:air");
                }
            }
        }
    });
}

ServerEvents.commandRegistry(event => {
    const { commands: Commands } = event;

    event.register(
        Commands.literal("schedule_snow_removal")
        .requires(source => !source.isPlayer() && source.hasPermission(2))
        .executes(ctx => {
            const source = ctx.source;
            const pos = source.position;
            const x = Math.floor(pos.x());
            const y = Math.floor(pos.y());
            const z = Math.floor(pos.z());
            scheduleSnowRemoval(source.server, source.level, x, y, z, getRandomDelay());
            
            return 1;
        })
    );
});

// Check for frozen effect removal
LevelEvents.tick(event => {
    let level = event.level;
    let uuidsToCheck = Array.from(global.entitiesWithFrozenEffect);
    
    let entitiesToProcess = [];
    uuidsToCheck.forEach(uuidString => {
        let entity = level.getEntity(uuidString);
        if (entity) {
            entitiesToProcess.push({ entity: entity, uuid: uuidString });
        }
    });
    
    
    entitiesToProcess.forEach(item => {
        let entity = item.entity;
        let uuid = item.uuid;
        if (!entity || !entity.isAlive()) return;

        if (entity.type == "minecraft:block_display") {
            if (entity.getVehicle() == null) {
                entity.kill();
                global.entitiesWithFrozenEffect.delete(String(entity.uuid.toString()));
            }
            return;
        }

        let hasFrozenEffect = false;
        entity.activeEffects.forEach(effect => {
            if (effect.descriptionId === "effect.powerborne.frozen") {
                hasFrozenEffect = true;
            }
        });

        if (!hasFrozenEffect) {
            global.entitiesWithFrozenEffect.delete(String(entity.uuid.toString()));
            entity.persistentData.remove('powerborne_freeze_xp_awarded');
            entity.removeAttribute('minecraft:generic.movement_speed', 'e0f4e796-3d3d-11ee-be56-0242ac183754');
            entity.removeAttribute('palladium:jump_power', 'f2a5b7e8-3d3d-11ee-be56-0242ac183754');
            superpowerUtil.removeSuperpower(entity, "powerborne:frozen_entity");
            if (entity.isPlayer() && superpowerUtil.hasSuperpower(entity, "powerborne:afrozen")) {
                superpowerUtil.removeSuperpower(entity, "powerborne:afrozen");
                global.spawnIceBreakEffect(entity);
                entity.setTicksFrozen(140);
            } else {
                entity.passengers.forEach(passenger => {
                    if (
                        passenger.type === "minecraft:block_display" &&
                        passenger.getTags().contains('powerborne.frozen_ice_display')
                    ) {
                        global.spawnIceBreakEffect(entity);
                        passenger.kill();
                        entity.setNoAi(false);
                        entity.setTicksFrozen(140);
                        global.entitiesWithFrozenEffect.delete(String(entity.uuid.toString()));
                        global.entitiesWithFrozenEffect.delete(String(passenger.uuid.toString()));
                    } else {
                        passenger.vehicle.setNoAi(false);
                        passenger.vehicle.setTicksFrozen(140);
                    }
                });
            }
        }
    });
});

EntityEvents.death(event => {
    const entity = event.entity;
    if (entity.type == 'minecraft:slime' || entity.type == 'minecraft:magma_cube') {
        if (entity.isNoAi()) {
            entity.setNoAi(false);
        }
    }
    
    entity.passengers.forEach(passenger => {
        if (passenger.type === "minecraft:block_display" && 
            passenger.getTags().contains('powerborne.frozen_ice_display')) {
            global.spawnIceBreakEffect(entity);
            global.entitiesWithFrozenEffect.delete(String(entity.uuid.toString()));
        }
        
        if (passenger.type === "minecraft:block_display") {
            passenger.kill();
            global.entitiesWithFrozenEffect.delete(String(passenger.uuid.toString()));
        }
    });
});

let $Creeper = Java.loadClass('net.minecraft.world.entity.monster.Creeper');

EntityEvents.hurt(event => {
    const attacker = event.source.actual;
    if (attacker && attacker.isPlayer() && superpowerUtil.hasSuperpower(attacker, "powerborne:afrozen")) {
        event.cancel();
    }
});

LevelEvents.beforeExplosion(event => {
    if (!event.exploder || event.exploder.type != "minecraft:creeper") return;
    let creeper = event.exploder;
    if (creeper instanceof $Creeper) {
        creeper.removeEffect("powerborne:frozen");
        creeper.removeEffect("powerborne:void_banishment");
    }
});