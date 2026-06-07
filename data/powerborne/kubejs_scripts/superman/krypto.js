let FlyingAnimal = Java.loadClass("net.minecraft.world.entity.animal.FlyingAnimal");
let FlyingMob = Java.loadClass("net.minecraft.world.entity.FlyingMob");
let AbstractSkeleton = Java.loadClass("net.minecraft.world.entity.monster.AbstractSkeleton");
let BlockPos = Java.loadClass("net.minecraft.core.BlockPos");

const FLYING_MOBS = [
    "minecraft:ghast",
    "minecraft:phantom",
    "minecraft:bee",
    "minecraft:parrot",
    "minecraft:allay",
    "minecraft:wither",
    "minecraft:bat",
    "minecraft:blaze",
    "minecraft:vex"
];

PalladiumEvents.registerProperties((event) => {
    if (event.getEntityType() === "minecraft:wolf") {
        event.registerProperty("krypto_freeze_breath", 'integer', 0);
    }
});

function toRadians(degrees) {
    return degrees * JavaMath.PI / 180;
}

function toDegrees(radians) {
    return radians * 180 / JavaMath.PI;
}

const MountTypes = {
    ALLAY: {
        entityType: 'minecraft:allay',
        tag: 'powerborne.wolf_mount_allay',
        speed: { normal: 2.5, fast: 5, combat: 2 },
        teleportConditions: (level, pos) => {
            let blockState = level.getBlockState(pos);
            return blockState.isAir();
        }
    },
    TURTLE: {
        entityType: 'minecraft:turtle',
        tag: 'powerborne.wolf_mount_turtle',
        speed: { normal: 2, fast: 10, combat: 6 },
        teleportConditions: (level, pos) => {
            let fluidState = level.getFluidState(pos);
            return fluidState && fluidState.isSource() && fluidState.is("minecraft:water");
        },
        extraNbt: { "Age": -2147483640 }
    }
};

function isKryptoMount(entity) {
    if (!entity || !entity.getTags()) return false;
    return entity.getTags().contains("powerborne.wolf_mount_allay") || 
           entity.getTags().contains("powerborne.wolf_mount_turtle");
}

const KryptoWolf = {
    dataTag: "KryptoUUID",

    create(player, server) {
        let spawnPos = this.findArrivalSpawnPos(player);
        
        const wolf = player.level.createEntity('minecraft:wolf');
        wolf.x = spawnPos.x;
        wolf.y = spawnPos.y;
        wolf.z = spawnPos.z;
        wolf.setOwnerUUID(player.uuid);
        wolf.mergeNbt({ 
            "Tags": [`powerborne.krypto_${player.username}`],
            "CustomName": '{"translate":"entity.powerborne.krypto"}',
            "Palladium": {
                "Properties": {
                    "superpowers": ["powerborne:krypto"]
                }
            }
        });
        wolf.spawn();
        
        let uuid = wolf.uuid.toString();
        player.persistentData.putString(KryptoWolf.dataTag, uuid);
        
        wolf.persistentData.putBoolean("krypto_arriving", true);
        wolf.persistentData.putInt("krypto_arrival_timer", 150);
        
        server.scheduleInTicks(5, () => {
            global.sound(wolf, 'minecraft:entity.wolf.ambient', 2, 1);
        });

        player.level.spawnParticles("minecraft:flash", true, spawnPos.x, spawnPos.y, spawnPos.z, 0, 0, 0, 1, 0.1);
        
        let mount = player.level.createEntity('minecraft:allay');
        mount.x = spawnPos.x;
        mount.y = spawnPos.y;
        mount.z = spawnPos.z;
        mount.mergeNbt({
            "pehkui:scale_data_types": {
                "pehkui:hitbox_height": { "scale": 0 },
                "pehkui:hitbox_width": { "scale": 0 }
            },
            "Tags": [MountTypes.ALLAY.tag],
            "Silent": true,
            "Invulnerable": true
        });
        mount.spawn();
        
        wolf.startRiding(mount);
    },
    
    findArrivalSpawnPos(player) {
        let level = player.level;
        
        for (let attempt = 0; attempt < 10; attempt++) {
            let angle = Math.random() * 2 * JavaMath.PI;
            let spawnDistance = 15 + Math.random() * 10;
            
            let spawnX = player.x + Math.cos(angle) * spawnDistance;
            let spawnZ = player.z + Math.sin(angle) * spawnDistance;
            let bpX = Math.floor(spawnX);
            let bpZ = Math.floor(spawnZ);
            
            // Start from desired height and scan up to find open air
            let startY = Math.floor(player.y) + 6;
            
            for (let dy = 0; dy < 30; dy++) {
                let bpY = startY + dy;
                let block1 = level.getBlockState(new BlockPos(bpX, bpY, bpZ));
                let block2 = level.getBlockState(new BlockPos(bpX, bpY + 1, bpZ));
                
                if (!block1.isSolid() && !block2.isSolid()) {
                    return { x: spawnX, y: bpY, z: spawnZ };
                }
            }
        }
        
        // Fallback: directly above player, scan up until clear
        let bpX = Math.floor(player.x);
        let bpZ = Math.floor(player.z);
        for (let dy = 3; dy < 50; dy++) {
            let bpY = Math.floor(player.y) + dy;
            let block1 = player.level.getBlockState(new BlockPos(bpX, bpY, bpZ));
            let block2 = player.level.getBlockState(new BlockPos(bpX, bpY + 1, bpZ));
            
            if (!block1.isSolid() && !block2.isSolid()) {
                return { x: player.x, y: bpY, z: player.z };
            }
        }
        
        // Ultimate fallback
        return { x: player.x, y: player.y + 10, z: player.z };
    },

    handleArrivalFlight(wolf, player, server) {
        if (!wolf.persistentData.getBoolean("krypto_arriving")) return false;
        
        // Countdown timer
        let timer = wolf.persistentData.getInt("krypto_arrival_timer");
        timer--;
        wolf.persistentData.putInt("krypto_arrival_timer", timer);
        
        if (timer <= 0) {
            // Timed out, remove mount and cancel arrival
            this.removeMount(wolf, 'ALLAY');
            wolf.persistentData.remove("krypto_arriving");
            wolf.persistentData.remove("krypto_arrival_timer");
            return false;
        }
        
        let mountInfo = this.getMountInfo(wolf);
        if (!mountInfo || mountInfo.type !== 'ALLAY') {
            if (!this.hasMount(wolf)) return true;
            wolf.persistentData.remove("krypto_arriving");
            wolf.persistentData.remove("krypto_arrival_timer");
            return false;
        }
        
        let vehicle = mountInfo.vehicle;
        let navigation = vehicle.getNavigation();
        let distanceSqr = wolf.distanceToSqr(player);
        
        navigation.moveTo(player, 2);
        
        if (distanceSqr < 16) {
            let level = player.getLevel();
            let x = Math.floor(wolf.x);
            let baseY = Math.floor(wolf.y);
            let z = Math.floor(wolf.z);
            
            let canLand = false;
            for (let i = 0; i <= 10; i++) {
                let blockBelow = level.getBlock(x, baseY - i, z);
                if (blockBelow && blockBelow.getBlockState().isSolid()) {
                    canLand = true;
                    break;
                }
            }
            
            if (canLand) {
                this.removeMount(wolf, 'ALLAY');
                wolf.persistentData.remove("krypto_arriving");
                wolf.persistentData.remove("krypto_arrival_timer");
                return false;
            }
        }
        
        return true;
    },

    get(player) {
        let kryptoUUID = player.persistentData.getString(KryptoWolf.dataTag);
        if (!kryptoUUID) return null;
        
        let wolf = player.level.getEntity(kryptoUUID);
        return (wolf && wolf.isAlive() && wolf.type == "minecraft:wolf") ? wolf : null;
    },

    // Generic mount management
    getMountInfo(wolf) {
        let vehicle = wolf.getVehicle();
        if (!vehicle) return null;

        for (let key in MountTypes) {
            let config = MountTypes[key];
            if (vehicle.type == config.entityType && 
                vehicle.getTags() && vehicle.getTags().contains(config.tag)) {
                return { type: key, vehicle: vehicle, config: config };
            }
        }
        return null;
    },

    hasMount(wolf, mountType) {
        let mountInfo = this.getMountInfo(wolf);
        if (!mountInfo) return false;
        if (mountType) {
            return mountInfo.type == mountType;
        }
        return true;
    },

    removeMount(wolf, mountType) {
        let mountInfo = this.getMountInfo(wolf);
        if (mountInfo) {
            if (!mountType || mountInfo.type == mountType) {
                mountInfo.vehicle.discard();
            }
        }
    },

    createMount(wolf, server, level, mountType) {
        const config = MountTypes[mountType];
        if (!config) return;

        if (wolf.getVehicle()) return;

        let mount = level.createEntity(config.entityType);
        if (!mount) return;
        
        mount.x = wolf.x;
        mount.y = wolf.y;
        mount.z = wolf.z;
        
        let nbtData = {
            "pehkui:scale_data_types": {
                "pehkui:hitbox_height": { "scale": 0 },
                "pehkui:hitbox_width": { "scale": 0 }
            },
            "Tags": [config.tag],
            "Silent": true,
            "Invulnerable": true
        };
        
        if (config.extraNbt) {
            for (let key in config.extraNbt) {
                nbtData[key] = config.extraNbt[key];
            }
        }
        
        mount.mergeNbt(nbtData);
        mount.spawn();
        
        if (!wolf.startRiding(mount)) {
            mount.discard();
        }
    },

    abilityFindTarget(player, wolf, level) {
        if (level.time % 30 == 0 && !wolf.target && !wolf.isOrderedToSit()) {
            let nearbyEntities = player.level.getEntitiesWithin(player.getBoundingBox().inflate(16));
            let closestEnemy = null;
            let closestDistance = 256;
            
            for (let entity of nearbyEntities) {
                if (entity && entity.isLiving() && entity.target && entity !== wolf) {
                    let entityTarget = entity.getTarget();
                    if (entityTarget && entityTarget.uuid.equals(player.uuid)) {
                        let distanceSq = entity.distanceToSqr(player);
                        if (distanceSq < closestDistance) {
                            closestDistance = distanceSq;
                            closestEnemy = entity;
                        }
                    }
                }
            }
            
            if (closestEnemy) {
                wolf.setTarget(closestEnemy);
            }
        }
    },

    abilityFreezeBreath(wolf) {
        if (wolf.isOrderedToSit()) {
            palladium.setProperty(wolf, "krypto_freeze_breath", 0);
            wolf.persistentData.putInt("freezeBreathTicks", 0);
            return false;
        }
    
        let target = wolf.target;
        if (!target || !target.isAlive()) {
            palladium.setProperty(wolf, "krypto_freeze_breath", 0);
            wolf.persistentData.putInt("freezeBreathTicks", 0);
            return false;
        }
        
        let distanceSq = wolf.distanceToSqr(target);
        if (distanceSq > 36 && distanceSq < 232 && 
            (!target.getEffect("powerborne:frozen") || target.getEffect("powerborne:frozen").getDuration() < 100)) {
            
            let ticks = wolf.persistentData.getInt("freezeBreathTicks") + 1;
            wolf.persistentData.putInt("freezeBreathTicks", ticks);
            
            if (ticks > 40) {
                palladium.setProperty(wolf, "krypto_freeze_breath", 0);
                wolf.persistentData.putInt("freezeBreathTicks", 0);
                wolf.persistentData.freezeCooldown = 200;
                return false;
            }
            
            let look = wolf.getLookControl();
            let tx = target.x;
            let ty = target.y + target.getEyeHeight();
            let tz = target.z;
    
            look.setLookAt(tx, ty, tz);
    
            let dx = tx - wolf.x;
            let dy = ty - (wolf.y + wolf.getEyeHeight());
            let dz = tz - wolf.z;
            let distXZ = Math.sqrt(dx * dx + dz * dz);
    
            let yaw = -toDegrees(Math.atan2(dx, dz));
            let pitch = -toDegrees(Math.atan2(dy, distXZ));
    
            wolf.setYaw(yaw);
            wolf.setPitch(pitch);
    
            palladium.setProperty(wolf, "krypto_freeze_breath", 1);
            wolf.setMotion(0, 0, 0);
            
            return true;
        } else {
            palladium.setProperty(wolf, "krypto_freeze_breath", 0);
            wolf.persistentData.putInt("freezeBreathTicks", 0);
            return false;
        }
    },

    isWolfStuck(wolf) {  
        const vehicle = wolf.getVehicle();  
        if (!vehicle) return false;  
        const vel = vehicle.deltaMovement;  
        if (vel) {  
            const speed = Math.sqrt(vel.x() * vel.x() + vel.y() * vel.y() + vel.z() * vel.z());  
            if (speed > 0.01) return false;  
        }  

        return wolf.isInWall();
    },

    canTeleportMountTo(vehicle, x, y, z, mountType, owner) {
        let level = vehicle.level;
        let pos = new BlockPos(x, y, z);
        let config = MountTypes[mountType];

        // Don't teleport too close to owner
        if (owner) {
            let dx = Math.abs(x - owner.x);
            let dz = Math.abs(z - owner.z);
            if (dx < 2 && dz < 2) return false;
        }

        // Check mount-specific conditions
        if (!config.teleportConditions(level, pos)) return false;

        // Check collision at the new position
        let bb = vehicle.getBoundingBox().move(x + 0.5 - vehicle.x, y - vehicle.y, z + 0.5 - vehicle.z);
        return level.noCollision(vehicle, bb);
    },

    isFlyingMob(entity) {
        if (!entity) return false;
        
        // Check by entity type string
        let isFlyingByType = FLYING_MOBS.includes(entity.type);
        
        // Check by Java class inheritance
        let isFlyingByClass = entity instanceof FlyingAnimal || entity instanceof FlyingMob;
        
        return isFlyingByType || isFlyingByClass;
    },

    getTeleportPos(player, isValidPosition) {
        let ownerPos = player.blockPosition ? player.blockPosition() : { 
            getX: () => Math.floor(player.x), 
            getY: () => Math.floor(player.y), 
            getZ: () => Math.floor(player.z) 
        };

        // Try up to 10 random positions near the owner
        for (let i = 0; i < 10; ++i) {
            let dx = Math.floor(Math.random() * 7) - 3;
            let dy = Math.floor(Math.random() * 3) - 1;
            let dz = Math.floor(Math.random() * 7) - 3;
            let tryX = ownerPos.getX() + dx;
            let tryY = ownerPos.getY() + dy;
            let tryZ = ownerPos.getZ() + dz;

            if (isValidPosition(tryX, tryY, tryZ)) {
                return { x: tryX + 0.5, y: tryY, z: tryZ + 0.5 };
            }
        }
        return null;
    },

    teleportToOwner(wolf, player) {
        let owner = wolf.getOwner();
        if (!owner) return false;

        let pos = this.getTeleportPos(player, (x, y, z) => {
            let blockState = player.level.getBlockState(new BlockPos(x, y, z));
            return blockState.isAir();
        });

        if (pos) {
            wolf.setPos(pos.x, pos.y, pos.z);
            wolf.persistentData.teleportCooldown = 73;
            return true;
        }
        return false;
    },

    teleportMountToOwner(wolf, player, mountType) {
        let vehicle = wolf.getVehicle();
        if (!vehicle) return false;
        let owner = wolf.getOwner();
        if (!owner) return false;

        let pos = this.getTeleportPos(player, (x, y, z) => {
            return this.canTeleportMountTo(vehicle, x, y, z, mountType, owner);
        });

        if (pos) {
            vehicle.setPos(pos.x, pos.y, pos.z);
            let passenger = vehicle.getFirstPassenger();
            if (passenger && passenger.isAlive()) {
                passenger.setPos(pos.x, pos.y, pos.z);
            }
            
            let navigation = vehicle.getNavigation();
            if (navigation) navigation.stop();
            wolf.persistentData.teleportCooldown = 73;
            
            return true;
        }
        return false;
    },

    handleNavigation(wolf, player, mountInfo) {
        let vehicle = mountInfo.vehicle;
        let config = mountInfo.config;
        let navigation = vehicle.getNavigation();
        let target = wolf.target;
        let distanceSqr = wolf.distanceToSqr(player);
        let owner = wolf.getOwner();
        
        // If using freeze breath, don't navigate
        if (palladium.getProperty(wolf, "krypto_freeze_breath") == 1) {
            wolf.getNavigation().stop();
            return;
        }

        if (target) {
            if (isKryptoMount(target)) {
                wolf.setTarget(null);
            }

            navigation.moveTo(target, config.speed.combat);
            if (wolf.isPassenger() && wolf.distanceToSqr(target) <= 4) {
                wolf.getLookControl().setLookAt(target.getX(), target.getEyeY(), target.getZ());
            }
        } else if (distanceSqr <= 200 && !wolf.getSensing().hasLineOfSight(owner)) {
            let speed;
            if (mountInfo.type == 'ALLAY') {
                speed = config.speed.normal;
            } else if (mountInfo.type == 'TURTLE') {
                speed = config.speed.fast;
            }
            navigation.moveTo(player, speed);
        } else if (distanceSqr > 200) {
            let speed = config.speed.normal;
            if (mountInfo.type == 'TURTLE') {
                speed = config.speed.fast;
            } else if (distanceSqr > 300) {
                let handler = player.palladium$getFlightHandler();  
                let flyingSpeed = handler.getFlightAnimation(0);

                speed = flyingSpeed > 1 ? 
                       config.speed.fast : config.speed.normal;
            }
            navigation.moveTo(player, speed);
        }
    },

    handleMovement(player, wolf) {
        if (this.handleArrivalFlight(wolf, player, player.server)) {
            return;
        }
        
        if (wolf.persistentData.getBoolean("krypto_arriving")) {
            return;
        }
    
        let mountInfo = this.getMountInfo(wolf);
        if (!mountInfo) return;
    
        let vehicle = mountInfo.vehicle;
    
        if (this.isWolfStuck(wolf) || wolf.distanceToSqr(player) > 2048 && !wolf.target) {
            if (!wolf.persistentData.teleportCooldown || wolf.persistentData.teleportCooldown == 0) {
                this.teleportMountToOwner(wolf, player, mountInfo.type);
            }
        }
    
        let passenger = vehicle.getFirstPassenger();
        if (passenger && passenger.isAlive()) {
            this.handleNavigation(wolf, player, mountInfo);
        }
    },

    manageMounts(player, wolf, server, level) {
        if (wolf.persistentData.getBoolean("krypto_arriving")) return;
        
        let handler = player.palladium$getFlightHandler();  
        let isFlying = handler.getFlightType().isNotNull();

        if (!player.isInWater()) {
            // Flying mode: prioritize allay mount
            let target = wolf.target;
            let isTargetFlying = this.isFlyingMob(target);

            if (isFlying || isTargetFlying) {
                if (!this.hasMount(wolf, 'ALLAY') && !wolf.isOrderedToSit()) {
                    this.createMount(wolf, server, level, 'ALLAY');
                }
            }
            if (this.hasMount(wolf, 'TURTLE')) {
                this.removeMount(wolf, 'TURTLE');
            }
            // Remove ALLAY if wolf is in water but player is not flying
            if (wolf.vehicle && wolf.vehicle.isInWater() && !isFlying && this.hasMount(wolf, 'ALLAY')) {
                this.removeMount(wolf, 'ALLAY');
            }
            // Remove ALLAY if wolf has no target and block y-2 below wolf is solid
            if (!isFlying && this.hasMount(wolf, 'ALLAY') && !wolf.target) {
                let x = Math.floor(wolf.x);
                let baseY = Math.floor(wolf.y);
                let z = Math.floor(wolf.z);
                
                let checkBlocks = 6;
                for (let i = 1; i <= checkBlocks; i++) {
                    let blockBelow = level.getBlock(x, baseY - i, z);
                    if (blockBelow && blockBelow.getBlockState().isSolid()) {
                        this.removeMount(wolf, 'ALLAY');
                        break;
                    }
                }
            }
        } else {
            if (wolf.isInWater()) {
                if (!this.hasMount(wolf, 'TURTLE')) {
                    this.createMount(wolf, server, level, 'TURTLE');
                }
                // Remove ALLAY if wolf is in water and player is not flying
                if (!isFlying && this.hasMount(wolf, 'ALLAY')) {
                    this.removeMount(wolf, 'ALLAY');
                }
            } else {
                if (!wolf.isInWall()) {
                    if (wolf.vehicle && !wolf.vehicle.isInWater()) {
                        this.removeMount(wolf, 'TURTLE');
                    }
                }
            }
        }
    }
};


ItemEvents.rightClicked('powerborne:kryptonian_whistle', event => {
    let player = event.player;
    let existingKrypto = KryptoWolf.get(player);
    let item = event.item;  
    
    let isOffhand = player.getOffhandItem().is(item);
    let eventId = isOffhand ? 48 : 47;
      
    event.level.broadcastEntityEvent(player, eventId);  
    event.server.scheduleInTicks(2, () => {  
        item.shrink(1);
    });  
    
    if (!existingKrypto) {
        KryptoWolf.create(player, event.server);
        player.unlockAdvancement('powerborne:krypto_summon');
    } else {
        let mountInfo = KryptoWolf.getMountInfo(existingKrypto);
        if (mountInfo) {
            KryptoWolf.teleportMountToOwner(existingKrypto, player, mountInfo.type);
        } else {
            KryptoWolf.teleportToOwner(existingKrypto, player);
        }
    }
});

PlayerEvents.tick(event => {
    let player = event.player;
    let wolf = KryptoWolf.get(player);
    if (!wolf) return;
    wolf.remainingFireTicks = 0;

    if (wolf.persistentData.teleportCooldown > 0) {
        wolf.persistentData.teleportCooldown--;
    }
    if (wolf.persistentData.freezeCooldown > 0) {
        wolf.persistentData.freezeCooldown--;
    }

    KryptoWolf.abilityFindTarget(player, wolf, event.level);
    
    // Check for freeze breath ability before handling movement
    let target = wolf.target;
    if (target instanceof AbstractSkeleton) {
        if (!wolf.isOrderedToSit()) {
            wolf.potionEffects.add("minecraft:speed", 20, 1);
        }
    }
    if (target && wolf.getSensing().hasLineOfSight(target) && !wolf.isUnderWater() &&
        (!wolf.persistentData.freezeCooldown|| wolf.persistentData.freezeCooldown == 0)
    ) {
        KryptoWolf.abilityFreezeBreath(wolf);
    } else {
        palladium.setProperty(wolf, "krypto_freeze_breath", 0);
    }
    
    KryptoWolf.manageMounts(player, wolf, event.server, event.level);
    KryptoWolf.handleMovement(player, wolf);
});

EntityEvents.hurt(event => {
    let entity = event.entity;
    let player = event.source.actual;
    if (player && player.isPlayer()) {
        let wolf = KryptoWolf.get(player);
        if (!wolf) return;
        if (!wolf.target && entity.isAlive()) {
            if (entity != wolf && entity != player) {
                wolf.setTarget(entity);
            }
        }
    }
});

EntityEvents.death(event => {
    let entity = event.entity;
    if (!entity || entity.type != "minecraft:wolf") return;
    
    let mountInfo = KryptoWolf.getMountInfo(entity);
    if (mountInfo) {
        mountInfo.vehicle.discard();
    }
    
    let wolfUUID = entity.uuid.toString();
    let owner = entity.getOwner();
    if (owner) {
        let kryptoUUID = owner.persistentData.getString(KryptoWolf.dataTag);
        if (kryptoUUID == wolfUUID) {
            owner.persistentData.remove(KryptoWolf.dataTag);
        }
    }
});

// EntityEvents.spawned(event => {  
//     if (event.entity.type === 'minecraft:wolf') {  
//       let wolff = event.entity;
//       wolff.removeAllGoals(goal => goal.toString() === 'FollowOwnerGoal');
//     }  
//   });