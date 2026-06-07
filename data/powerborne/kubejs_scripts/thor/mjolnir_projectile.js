const THUNDER_JUMPER_TARGET = 25;

function resetThunderJumper(player) {
    player.persistentData.thunderJumperCount = 0;
    player.persistentData.thunderJumperLastHitId = -1;
}

// Thunder Jumper advancement
EntityEvents.hurt(event => {
    const entity = event.entity;
    const source = event.source;
    let projectile = source.immediate;
    if (!projectile || projectile.type !== 'palladium:custom_projectile') projectile = source.actual;
    if (!projectile || projectile.type !== 'palladium:custom_projectile') return;
    if (!projectile.getTags().contains('powerborne.mjolnir_projectile') || !projectile.getTags().contains('powerborne.mjolnir_jump')) return;

    let owner = projectile.getOwner();
    if (!owner || !owner.isPlayer() || !entity.isLiving() || entity === owner) return;
    if (!projectile.hasPassenger || !projectile.hasPassenger(owner)) return;

    let count = owner.persistentData.thunderJumperCount || 0;
    let lastId = owner.persistentData.thunderJumperLastHitId;
    let entityId = entity.getId();
    if (entityId !== lastId) {
        count++;
        owner.persistentData.thunderJumperCount = count;
        owner.persistentData.thunderJumperLastHitId = entityId;
        if (count >= THUNDER_JUMPER_TARGET) {
            owner.unlockAdvancement('powerborne:thunder_jumper');
            resetThunderJumper(owner);
        }
    }
});

PlayerEvents.tick(event => {
    let player = event.player;
    let count = player.persistentData.thunderJumperCount || 0;
    if (count === 0) return;

    if (player.onGround()) {
        resetThunderJumper(player);
        return;
    }

    let handler = player.palladium$getFlightHandler();
    if (handler && handler.getFlightType().isNotNull()) {
        resetThunderJumper(player);
    }
});

// Handle knockback and hit effects
EntityEvents.hurt(event => {
    const entity = event.entity;
    const source = event.source;
    let projectile = source.immediate;
    if (!projectile || projectile.type !== 'palladium:custom_projectile') projectile = source.actual;
    if (entity.hurtTime >= 2) {
        return;
    }
    if (
        projectile &&
        projectile.type === 'palladium:custom_projectile' &&
        projectile.getTags().contains('powerborne.mjolnir_projectile')
    ) {
        let motion = projectile.getDeltaMovement();
        let motionMagnitude = Math.sqrt(motion.get("x") * motion.get("x") + motion.get("z") * motion.get("z"));
        if (motionMagnitude > 0) {
            let normalizedMotionX = motion.get("x") / motionMagnitude;
            let normalizedMotionZ = motion.get("z") / motionMagnitude;
            entity.knockback(0.5, -normalizedMotionX, -normalizedMotionZ);
        }
        let owner = projectile.getOwner();
        if (owner && owner.level) {
            owner.level.playSound(null, entity.x, entity.y, entity.z, 'powerborne:mjolnir_hit', 'ambient', 0.7, 1);
        }
    }
});

function spawnReturningMjolnir(projectile, owner, damage) {
    let newMjolnir = projectile.level.createEntity('palladium:custom_projectile');
    newMjolnir.setOwner(owner);
    newMjolnir.x = projectile.x;
    newMjolnir.y = projectile.y;
    newMjolnir.z = projectile.z;

    newMjolnir.persistentData.ChargeTime = projectile.persistentData.ChargeTime;
    newMjolnir.persistentData.ReturnTicks = 1;
    newMjolnir.persistentData.OwnerUsername = owner.username;
    let savedFromProj = projectile.persistentData.SavedMjolnirItem;
    if (savedFromProj) newMjolnir.persistentData.SavedMjolnirItem = savedFromProj;
    newMjolnir.addTag("powerborne.mjolnir_projectile");

    newMjolnir.mergeNbt({
        "Damage": damage,
        "Gravity": 0.01,
        "DieOnEntityHit": false,
        "DieOnBlockHit": false,
        "Size": 0.5,
        "Lifetime": 99999,
        "PreventShooterInteraction": 1,
        "CommandOnBlockHit": "",
        "CommandOnEntityHit": "",
        "Appearances": [{
            "Type": "renderLayer",
            "RenderLayer": "powerborne:mjolnir_item"
        }],
        "CustomName": '{"text":"' + owner.username + '\'s Mjolnir"}'
    });

    newMjolnir.spawn();
    let projectiles = global.mjolnirProjectiles.get(String(owner.uuid));
    if (projectiles) projectiles.delete(String(projectile.uuid));
    projectile.kill();
}

global.triggerMjolnirReturnAfterShieldClash = function (projectile) {
    if (!projectile || !projectile.isAlive()) return;
    let owner = projectile.getOwner();
    if (!owner || !owner.isPlayer()) return;
    let chargeTime = projectile.persistentData.ChargeTime || 0;
    let damage = global.calculateMjolnirDamage(chargeTime);
    if (
        projectile.getTags().contains("powerborne.mjolnir_jump") &&
        (!projectile.getPassengers || projectile.getPassengers().length === 0)
    ) {
        spawnReturningMjolnir(projectile, owner, damage);
        return;
    }
    projectile.persistentData.ReturnTicks = 1;
    projectile.mergeNbt({
        CommandOnBlockHit: "",
        CommandOnEntityHit: ""
    });
};

if (!global.mjolnirProjectiles) global.mjolnirProjectiles = new Map();
if (!global.mjolnirHandled) global.mjolnirHandled = new Set();

PalladiumEvents.customProjectileTick(event => {
    const projectile = event.getProjectile();
    if (!projectile || projectile.level.isClientSide()) return;
    if (!projectile.getTags().contains('powerborne.mjolnir_projectile')) return;

    projectile.remainingFireTicks = 0;

    let projUuidEarly = String(projectile.uuid);
    if (global.mjolnirHandled.has(projUuidEarly)) {
        global.mjolnirHandled.delete(projUuidEarly);
        projectile.kill();
        return;
    }

    let owner = projectile.getOwner();
    if (!owner || !owner.isPlayer() || !owner.isAlive()) {
        let ownerUsername = projectile.persistentData.OwnerUsername || (owner && owner.username);
        let server = projectile.level.getServer();
        if (server && ownerUsername) {
            let crossDimOwner = server.getPlayerList().getPlayerByName(ownerUsername);
            if (crossDimOwner && crossDimOwner.isAlive()) {
                let saved = projectile.persistentData.SavedMjolnirItem;
                if (saved) {
                    global.giveSavedMjolnirToPlayer(crossDimOwner, global.snapshotMjolnirDataForPlayer(saved));
                } else {
                    global.giveMjolnirToPlayer(crossDimOwner);
                }
                crossDimOwner.persistentData.remove('MjolnirThrownItem');
                if (global.mjolnirProjectiles) {
                    global.mjolnirProjectiles.forEach(function(projectiles) {
                        projectiles.delete(String(projectile.uuid));
                    });
                }
                projectile.kill();
                return;
            }
        }

        let returnTicks = projectile.persistentData.ReturnTicks || 0;
        if (returnTicks > 0) {
            let ownerUsernameResolved = ownerUsername || "unknown";
            global.spawnMjolnirStandAt(
                projectile.level,
                projectile.x,
                projectile.y,
                projectile.z,
                ownerUsernameResolved,
                null,
                projectile.persistentData.SavedMjolnirItem
            );
            if (global.mjolnirProjectiles) {
                global.mjolnirProjectiles.forEach(function(projectiles) {
                    projectiles.delete(String(projectile.uuid));
                });
            }
            projectile.kill();
        }
        return;
    }

    let chargeTime = projectile.persistentData.ChargeTime || 0;
    let damage = global.calculateMjolnirDamage(chargeTime);

    let ownerKey = String(owner.uuid);
    let projUuid = String(projectile.uuid);
    if (!global.mjolnirProjectiles.has(ownerKey)) global.mjolnirProjectiles.set(ownerKey, new Set());
    global.mjolnirProjectiles.get(ownerKey).add(projUuid);

    if (projectile.getTags().contains('powerborne.mjolnir_jump')) {
        if (projectile.persistentData.JumpImpact === 1 && projectile.persistentData.JumpImpactAwarded !== 1) {
            if (abilityUtil.hasPower(owner, "powerborne:god_of_thunder")) {
                global.levelingSystem.awardXP(owner, "powerborne:god_of_thunder", "mjolnir_jump", 3);
            }
            projectile.persistentData.JumpImpactAwarded = 1;
        }

    }

    projectile.mergeNbt({ Damage: damage });

    let returnTicks = projectile.persistentData.ReturnTicks || 0;
    let projectileAge = projectile.age || 0;

    if (
        projectile.getTags().contains('powerborne.mjolnir_jump') &&
        (!projectile.getPassengers || projectile.getPassengers().length === 0)
    ) {
        spawnReturningMjolnir(projectile, owner, damage);
        return;
    }

    if (returnTicks > 0 || projectileAge > 10) {
        if (
            (projectile.getTags().contains('powerborne.mjolnir_lightning') || projectile.getTags().contains('powerborne.mjolnir_jump')) &&
            returnTicks === 1
        ) {
            if (projectile.getTags().contains('powerborne.mjolnir_jump') && projectile.getPassengers && projectile.getPassengers().length > 0) {
                let needsRescue = false;
                projectile.getPassengers().forEach(p => {
                    if (p === owner && p.isInWall()) needsRescue = true;
                });

                if (needsRescue) {
                    let level = projectile.level;
                    let bpX = Math.floor(projectile.x);
                    let bpZ = Math.floor(projectile.z);
                    let baseY = Math.floor(projectile.y);
                    projectile.getPassengers().forEach(passenger => {
                        if (passenger === owner) {
                            passenger.stopRiding();
                            let safeY = baseY;

                            for (let i = 0; i <= 8; i++) {
                                let checkY = baseY - i;
                                if (checkY < level.minBuildHeight) break;
                                let block = level.getBlockState(new BlockPos(bpX, checkY, bpZ));
                                let blockAboveCheck = level.getBlockState(new BlockPos(bpX, checkY + 1, bpZ));
                                if (block.isAir() && blockAboveCheck.isAir()) {
                                    safeY = checkY + 0.5;
                                    break;
                                }
                            }

                            if (safeY === baseY) {
                                for (let i = 1; i <= 8; i++) {
                                    let checkY = baseY + i;
                                    let block = level.getBlockState(new BlockPos(bpX, checkY, bpZ));
                                    let blockAboveCheck = level.getBlockState(new BlockPos(bpX, checkY + 1, bpZ));
                                    if (block.isAir() && blockAboveCheck.isAir()) {
                                        safeY = checkY + 0.5;
                                        break;
                                    }
                                }
                            }

                            passenger.setPosition(projectile.x, safeY, projectile.z);
                        }
                    });
                }
            }
            spawnReturningMjolnir(projectile, owner, damage);
            return;
        }

        // Check if player is riding (jump mode)
        let isPlayerRiding = false;
        if (projectile.getPassengers && projectile.getPassengers().length > 0) {
            projectile.getPassengers().forEach(passenger => {
                if (passenger.isPlayer() && passenger.username === owner.username) {
                    isPlayerRiding = true;
                }
            });
        }

        if (!isPlayerRiding) {
            let nearbyEntities = projectile.level.getEntitiesWithin(projectile.getBoundingBox().inflate(0.5));
            let entitiesToProcess = [];
            nearbyEntities.forEach(nearby => {
                if (nearby.isPlayer() && nearby.username === owner.username) {
                    entitiesToProcess.push(nearby);
                }
            });

            entitiesToProcess.forEach(nearby => {
                if (nearby && nearby.isAlive()) {
                    let saved = projectile.persistentData.SavedMjolnirItem;
                    if (saved) {
                        global.giveSavedMjolnirToPlayer(nearby, global.snapshotMjolnirDataForPlayer(saved));
                    } else {
                        global.giveMjolnirToPlayer(nearby);
                    }
                    nearby.persistentData.remove('MjolnirThrownItem');
                    let projectiles = global.mjolnirProjectiles.get(String(nearby.uuid));
                    if (projectiles) projectiles.delete(String(projectile.uuid));
                    projectile.kill();
                }
            });
        }
    }

    let dx = owner.x - projectile.x;
    let dy = owner.y + 1 - projectile.y;
    let dz = owner.z - projectile.z;
    let distance = owner.distanceToEntity(projectile);

    // Water speed boost
    if (returnTicks === 0 && distance < 90 && projectile.isInWater()) {
        let motion = projectile.getDeltaMovement();
        let motionMagnitude = Math.sqrt(
            motion.get("x") * motion.get("x") +
            motion.get("y") * motion.get("y") +
            motion.get("z") * motion.get("z")
        );

        if (motionMagnitude > 0.1) {
            let nx = motion.get("x") / motionMagnitude;
            let ny = motion.get("y") / motionMagnitude;
            let nz = motion.get("z") / motionMagnitude;
            let speed = motionMagnitude / 5;
            projectile.addMotion(nx * speed, ny * speed, nz * speed);
        }
    }

    // Return motion logic
    if (returnTicks > 0 || distance > 90) {
        if (returnTicks === 0) {
            projectile.persistentData.ReturnTicks = 1;
            projectile.mergeNbt({
                "CommandOnBlockHit": "",
                "CommandOnEntityHit": ""
            });
        } else if (returnTicks > 0) {
            projectile.persistentData.ReturnTicks = returnTicks + 1;

            if (returnTicks === 1) {
                projectile.mergeNbt({
                    "CommandOnBlockHit": "",
                    "CommandOnEntityHit": ""
                });
            }
        }

        if (projectile.persistentData.ReturnTicks === 3) {
            global.playSoundLocal(owner, 'powerborne:mjolnir_hum', 'players', 3, 1);
            projectile.setMotion(0, 0, 0);
        }

        if (projectile.persistentData.ReturnTicks >= 3 || distance > 30) {
            let returnSpeed = Math.min(Math.max(distance / 5, 0.5), 2.0);
            if (projectile.isInWater()) {
                returnSpeed *= 1.3;
            }

            let vx = dx / distance * returnSpeed;
            let vy = dy / distance * returnSpeed;
            let vz = dz / distance * returnSpeed;
            projectile.setMotion(vx, vy, vz);
        }
    }
});

function giveWeaponBack(owner) {
    if (!owner) return;
    if (owner.persistentData.StormbreakerThrownItem) {
        let saved = snapshotStormbreakerDataForPlayer(owner.persistentData.StormbreakerThrownItem);
        giveSavedStormbreakerToPlayer(owner, saved);
        owner.persistentData.remove('StormbreakerThrownItem');
        return;
    }
    if (owner.persistentData.MjolnirThrownItem) {
        let saved = snapshotMjolnirDataForPlayer(owner.persistentData.MjolnirThrownItem);
        giveSavedMjolnirToPlayer(owner, saved);
        owner.persistentData.remove('MjolnirThrownItem');
    } else {
        giveMjolnirToPlayer(owner);
    }
}

// Detect when Mjolnir projectile is removed
ServerEvents.tick(event => {
    if (global.mjolnirProjectiles.size === 0) return;
    if (event.server.tickCount % 20 !== 0) return;

    global.mjolnirProjectiles.forEach(function(projectiles, ownerUuid) {
        let toDelete = [];
        projectiles.forEach(function(projUuid) {
            let projectile = null;
            event.server.allLevels.forEach(function(l) {
                if (!projectile) projectile = l.getEntity(projUuid);
            });
            if (projectile && projectile.removed) projectile = null;
            if (!projectile) toDelete.push(projUuid);
        });

        toDelete.forEach(function(projUuid) {
            projectiles.delete(projUuid);
            let owner = null;
            event.server.allLevels.forEach(function(l) {
                if (!owner) owner = l.getEntity(ownerUuid);
            });
            if (owner && owner.isPlayer()) {
                global.mjolnirHandled.add(projUuid);
                giveWeaponBack(owner);
            }
        });

        if (projectiles.size === 0) global.mjolnirProjectiles.delete(ownerUuid);
    });
});
