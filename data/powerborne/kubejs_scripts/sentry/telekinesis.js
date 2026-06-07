let $ClientboundSetEntityMotionPacket = Java.loadClass('net.minecraft.network.protocol.game.ClientboundSetEntityMotionPacket');
let $Projectile = Java.loadClass('net.minecraft.world.entity.projectile.Projectile');

function rayTraceEntity(player, distance, inflate) {
    let level = player.level;
    let eyePos = player.eyePosition;
    let viewVec = player.getViewVector(1);
    let endPos = eyePos.add(viewVec.x() * distance, viewVec.y() * distance, viewVec.z() * distance);
    let aabb = AABB.of(eyePos.x(), eyePos.y(), eyePos.z(), endPos.x(), endPos.y(), endPos.z());
    let ray = $ProjectileUtil.getEntityHitResult(level, player, eyePos, endPos, aabb.inflate(inflate), (e) => !e.isSpectator());
    return ray ? { entity: ray.entity } : { entity: null };
}

function calculateViewXYZ(pitch, yaw) {
    const vec = Vec3.directionFromRotation(pitch, yaw);
    return { x: vec.x(), y: vec.y(), z: vec.z() };
}

function isEntityInView(player, entity, yawThreshold, pitchThreshold) {
    let dx = entity.x - player.x;
    let dy = entity.y - player.eyeY;
    let dz = entity.z - player.z;
    
    let totalDistance = player.distanceToEntity(entity);
    if (totalDistance < 1) return false;
  
    const playerDirection = player.getViewVector(1.0);

    let entityDirection = [dx / totalDistance, dy / totalDistance, dz / totalDistance];
    let dotProduct = playerDirection.x() * entityDirection[0] + playerDirection.y() * entityDirection[1] + playerDirection.z() * entityDirection[2]; 

    if (dotProduct <= 0.1) return false;

    dotProduct = Math.max(-1, Math.min(1, dotProduct));
    let angleBetween = Math.acos(dotProduct) * (180 / JavaMath.PI);
    return angleBetween <= Math.max(yawThreshold, pitchThreshold);
}

const isProjectile = projectile => projectile instanceof $Projectile;
const isLivingEntity = entity =>
    entity.isLiving() && entity.attackable() && entity.isAlive();

function getTelekinesisPower(player) {
    if (abilityUtil.isEnabled(player, 'powerborne:sentry', 'telekinesis_timer')) {
        return 'powerborne:sentry';
    }
    if (abilityUtil.isEnabled(player, 'powerborne:void', 'telekinesis_timer')) {
        return 'powerborne:void';
    }
    return null;
}

function isTelekinesisActive(player) {
    return getTelekinesisPower(player) !== null;
}

function getTelekinesisTicks(player) {
    let power = getTelekinesisPower(player);
    if (!power) return 0;
    return global.getAbilityAnimationTicks(player, power, 'telekinesis_timer', true);
}


function shouldTargetProjectile(player, projectile) {
    const playerAABB = player.getBoundingBox().inflate(2);
    return (
        isProjectile(projectile) &&
        (!projectile.persistentData?.telekinesisHolder || projectile.persistentData.telekinesisHolder === "") &&
        (projectile.nbt.inGround == null || projectile.nbt.inGround == 0) &&
        isEntityInView(player, projectile, 48, 24) &&
        playerAABB.contains(projectile.x, projectile.y, projectile.z)
    );
}

function shouldTargetLivingEntity(player, entity) {
    return isLivingEntity(entity) &&
           entity !== player &&
           entity.persistentData?.telekinesisHolder !== player.uuid.toString();
}

function holdProjectile(projectile, player) {
    projectile.setMotion(0, 0, 0);
    projectile.mergeNbt({ NoAI: 1, life: 0, Lifetime: 0});
    projectile.setNoGravity(true);
    projectile.persistentData.telekinesisHolder = player.uuid.toString();
}

function releaseProjectile(projectile) {
    projectile.mergeNbt({ NoAI: 0 });
    projectile.setNoGravity(false);
    projectile.persistentData.telekinesisHolder = "";
}

function throwProjectiles(player) {
    const range = 15;
    const { x: dirX, y: dirY, z: dirZ } = calculateViewXYZ(player.getPitch(), player.getYaw());
    const targetX = player.x + dirX * range;
    const targetY = player.eyeY + dirY * range;
    const targetZ = player.z + dirZ * range;
    const force = 2.0;
    global.sound(player, 'minecraft:entity.egg.throw', 0.6, 1.5, 0.8);

    const playerAABB = player.getBoundingBox().inflate(9);
    let thrownAny = false;

    player.level.getEntitiesWithin(playerAABB).forEach(projectile => {
        if (isProjectile(projectile) &&
            projectile.persistentData?.telekinesisHolder === player.uuid.toString()) {

            const dx = targetX - projectile.x;
            const dy = targetY - projectile.y;
            const dz = targetZ - projectile.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (dist > 0) {
                const velocity = { x: (dx / dist) * force, y: (dy / dist) * force, z: (dz / dist) * force };

                projectile.setNoGravity(false);
                projectile.setMotion(velocity.x, velocity.y, velocity.z);

                projectile.persistentData.telekinesisHolder = "";
                projectile.persistentData.telekinesis_thrown = true;

                thrownAny = true;
            }
        }
    });

    return thrownAny;
}

function moveTelekinesisTarget(player, target) {
    const width = target.getBbWidth();
    const distance = width < 1.5 ? 3 : Math.max(3, width + 2.25);
    const { yaw: playerYaw, pitch: playerPitch, x: playerX, y: playerY, z: playerZ } = player;
    let { x, y, z } = calculateViewXYZ(playerPitch, playerYaw);
    
    let targetX = x * distance + playerX;
    let targetY = y * distance + playerY + target.getEyeHeight() / 2;
    let targetZ = z * distance + playerZ;

    target.resetFallDistance();

    if (target.isPlayer()) {
        let vx = (targetX - target.x) * 0.5;
        let vy = (targetY - target.y) * 0.5;
        let vz = (targetZ - target.z) * 0.5;

        target.setMotion(vx, vy, vz);
        target.hurtMarked = true;

        let $ClientboundSetEntityMotionPacket = Java.loadClass("net.minecraft.network.protocol.game.ClientboundSetEntityMotionPacket");
        target.connection.send(new $ClientboundSetEntityMotionPacket(target));
        
    } else {
        let direction = Vec3d(targetX - target.x, targetY - target.y, targetZ - target.z).scale(0.5);
        target.setDeltaMovement(direction);
    }
}

function throwLivingEntity(player, target) {
    const { yaw, pitch } = player;
    let { x, y, z } = calculateViewXYZ(pitch, yaw);

    let tickCounter = player.persistentData.telekinesisHoldTicks || 0;
    let force = Math.max(1, Math.min(3, (tickCounter / 100) * 3));
    if (tickCounter >= 100) force = 3;

    target.setNoGravity(false);
    target.setMotion(x * force, y * force, z * force);
    target.tags.add("powerborne.telekinesis_thrown");

    global.sound(target, 'minecraft:ui.toast.in', force, 1.5);
    if (tickCounter >= 100) {
        global.sound(target, 'powerborne:sentry_telekinesis_throw', 0.6, 0.01);
        let power = getTelekinesisPower(player);
        if (power) {
            global.levelingSystem.awardXP(player, power, "telekinesis_max_throw", 3);
        }
    }

    if (target.isPlayer()) {
        target.hurtMarked = true;
        target.connection.send(new $ClientboundSetEntityMotionPacket(target));
    }
}

function showLivingEntityFeedback(player, target) {
    let ticks = player.persistentData.telekinesisHoldTicks || 0;
    let squaresFilled = Math.floor(Math.min(100, (ticks / 100) * 100) / 20);
    let power = getTelekinesisPower(player);
    let isVoid = power === 'powerborne:void';

    if (squaresFilled === 5 && (ticks - 1) < 100) {
        global.sound(player, 'minecraft:block.note_block.bell', 0.5, 2);
    }

    let spread = 0.1 + Math.min(ticks / 100, 1) * 0.3;
    let size = Math.max(0.0, Math.min(1.0, ticks / 100));
    
    let particleColor = isVoid ? `minecraft:dust 0 0 0 ${size}` : `minecraft:dust 1 0.9 0.2 ${size}`;
    let filledSquareColor = isVoid ? '§0' : '§e';

    player.level.spawnParticles(
        particleColor,
        true,
        target.x, target.y + target.getBbHeight() / 2, target.z,
        spread, spread, spread,
        squaresFilled, 0.01
    );

    let bar = '';
    for (let i = 0; i < 5; i++) {
        bar += i < squaresFilled ? filledSquareColor + '■' : '§7■';
    }
    player.setStatusMessage("§7|" + bar + "§7|");
}

function showProjectileFeedback(projectile, player) {
    let power = player ? getTelekinesisPower(player) : null;
    let isVoid = power === 'powerborne:void';
    let particleColor = isVoid ? `minecraft:dust 0 0 0 0.5` : `minecraft:dust 1 0.9 0.2 0.5`;
    
    projectile.level.spawnParticles(
        particleColor,
        true,
        projectile.x, projectile.y, projectile.z,
        0.05, 0.05, 0.05,
        1, 0.01
    );
}

function acquireTargets(player) {
    let currentType = player.persistentData.telekinesisTargetType || "";
    let playerAABB = player.getBoundingBox().inflate(2);

    // Only allow picking projectiles if not holding a living entity
    if (currentType !== 'living') {
        let foundProjectiles = [];
        player.level.getEntitiesWithin(playerAABB).forEach(projectile => {
            if (shouldTargetProjectile(player, projectile)) {
                foundProjectiles.push(projectile);
            }
        });
        if (foundProjectiles.length > 0) {
            return { entities: foundProjectiles, type: 'projectiles' };
        }
    }

    if (currentType !== 'projectiles') {
        let result = rayTraceEntity(player, 6.5, 1);
        if (result.entity && shouldTargetLivingEntity(player, result.entity)) {
            return { entities: [result.entity], type: 'living' };
        }
    }

    return { entities: [], type: null };
}

function handleThrownEntityCollision(entity) {
    if (!entity.tags.contains("powerborne.telekinesis_thrown")) return;

    let velocity = entity.deltaMovement.length();
    let areaEntities = entity.getLevel().getEntitiesWithin(entity.getBoundingBox().inflate(0.5));
    let entitiesToProcess = [];
    areaEntities.forEach(other => {
        if (other && other.isLiving() && other.attackable() && other.isAlive() && other.id !== entity.id) {
            entitiesToProcess.push(other);
        }
    });
    entitiesToProcess.forEach(other => {
        if (other && other.isAlive()) {
            let damage = Math.max(1, Math.floor(velocity * 3));
            const damageSource = entity.damageSources().noAggroMobAttack(entity);
            other.attack(damageSource, damage);
            entity.removeTag("powerborne.telekinesis_thrown");
        }
    });

    let prevSpeed = entity.persistentData.telekinesis_prev_speed || 0;

    if (prevSpeed > 0.5 && velocity < prevSpeed * 0.3 && !entity.onGround()) {
        let selfDamage = Math.max(2, Math.min(16, Math.floor(prevSpeed * 4)));
        entity.invulnerableTime = 0;
        entity.attack(entity.damageSources().flyIntoWall(), selfDamage);
        global.sound(entity, 'minecraft:block.stone.hit', selfDamage / 3);
        entity.removeTag("powerborne.telekinesis_thrown");
        entity.persistentData.remove("telekinesis_prev_speed");
        return;
    }

    entity.persistentData.telekinesis_prev_speed = velocity;

    if (entity.onGround() || entity.getDeltaMovement().lengthSqr() < 0.01) {
        entity.removeTag("powerborne.telekinesis_thrown");
        entity.persistentData.remove("telekinesis_prev_speed");
    }
}

function clearPlayerTelekinesisState(player) {
    player.persistentData.remove("telekinesisTarget");
    player.persistentData.telekinesisTargetType = "";
    player.persistentData.telekinesisHoldTicks = 0;
}

function handleProjectileMode(player) {
    let result = acquireTargets(player);

    if (result.type === 'projectiles') {
        if (player.persistentData.telekinesisTargetType !== 'projectiles') {
            player.persistentData.telekinesisTargetType = 'projectiles';
            clearPlayerTelekinesisState(player);
            player.persistentData.telekinesisTargetType = 'projectiles';
            player.persistentData.telekinesisTarget = "projectile";
        }
        result.entities.forEach(projectile => {
            if (!projectile.persistentData?.telekinesisHolder || projectile.persistentData.telekinesisHolder === "") {
                holdProjectile(projectile, player);
            }
        });
    }

    let playerAABB = player.getBoundingBox().inflate(4);
    player.level.getEntities().forEach(projectile => {
        if (
            isProjectile(projectile) &&
            projectile.persistentData?.telekinesisHolder === player.uuid.toString() &&
            !playerAABB.contains(projectile.x, projectile.y, projectile.z)
        ) {
            releaseProjectile(projectile);
        }
    });

    if (player.persistentData.telekinesisTargetType === 'projectiles' && player.swinging && player.swingTime == -1) {
        let throwAABB = player.getBoundingBox().inflate(9);
        let hasHeld = player.level.getEntitiesWithin(throwAABB).some(projectile =>
            isProjectile(projectile) &&
            projectile.persistentData.telekinesisHolder == player.uuid.toString()
        );

        if (hasHeld && throwProjectiles(player)) {
            clearPlayerTelekinesisState(player);
            player.persistentData.telekinesisCooldown = 10;
        }
    }
}

function handleLivingEntityMode(player) {
    let targetUUID = player.persistentData.telekinesisTarget;
    let target = targetUUID ? player.level.getEntity(targetUUID) : null;
    let result = acquireTargets(player);

    if (!target && result.type === 'living') {
        let entity = result.entities[0];
        
        let canBeAffected = global.canBeAffectedByEffects(entity);
        if (!canBeAffected) return;

        player.persistentData.telekinesisTarget = entity.uuid.toString();
        player.persistentData.telekinesisTargetType = 'living';
        target = entity;
        entity.persistentData.telekinesisHolder = player.uuid.toString();
        entity.setNoGravity(true);
    }

    if (target && !target.removed && target.isAlive() && player.persistentData.telekinesisTargetType === 'living') {
        const holdWidth = target.getBbWidth();
        const maxHoldDistance = holdWidth < 1.5 ? 9 : Math.max(9, holdWidth + 7.5);
        if (player.distanceToEntity(target) > maxHoldDistance) {
            target.setNoGravity(false);
            target.persistentData.telekinesisHolder = "";
            clearPlayerTelekinesisState(player);
            return;
        }

        player.persistentData.telekinesisHoldTicks = (player.persistentData.telekinesisHoldTicks || 0) + 1;

        showLivingEntityFeedback(player, target);
        moveTelekinesisTarget(player, target);

        if (player.swinging && player.swingTime == -1) {
            throwLivingEntity(player, target);
            target.persistentData.telekinesisHolder = "";
            clearPlayerTelekinesisState(player);
            player.persistentData.telekinesisCooldown = 10;
        }
    } else if (target && (!target.isAlive() || target.removed)) {
        target.setNoGravity(false);
        target.persistentData.telekinesisHolder = "";
        clearPlayerTelekinesisState(player);
    }
}

function releaseAllTargets(player) {
    let playerAABB = player.getBoundingBox().inflate(9);
    let targetUUID = player.persistentData.telekinesisTarget;
    let target = targetUUID ? player.level.getEntity(targetUUID) : null;

    let releasedProjectiles = false;
    let projectilesToProcess = [];
    player.level.getEntitiesWithin(playerAABB).forEach(projectile => {
        if (isProjectile(projectile) && projectile.persistentData?.telekinesisHolder === player.uuid.toString()) {
            projectilesToProcess.push(projectile);
        }
    });
    
    projectilesToProcess.forEach(projectile => {
        if (projectile && projectile.isAlive()) {
            releaseProjectile(projectile);
            releasedProjectiles = true;
        }
    });

    if (target && player.persistentData.telekinesisTargetType === 'living') {
        target.setNoGravity(false);
        target.setMotion(0, 0, 0);
        target.persistentData.telekinesisHolder = "";
        if (target.isPlayer()) {
            target.connection.send(new $ClientboundSetEntityMotionPacket(target));
        }
    }

    if (releasedProjectiles || target) {
        clearPlayerTelekinesisState(player);
    }
}

LevelEvents.tick(event => {
    let entitiesToProcess = [];
    event.level.getEntities().forEach(entity => {
        if (entity.tags.contains("powerborne.telekinesis_thrown")) {
            entitiesToProcess.push(entity);
        }
    });

    entitiesToProcess.forEach(entity => {
        if (entity && entity.isAlive() && entity.tags.contains("powerborne.telekinesis_thrown")) {
            handleThrownEntityCollision(entity);
        }
    });

    event.level.players.forEach(player => {
        if (player.persistentData.telekinesisCooldown > 0) {
            player.persistentData.telekinesisCooldown--;
            return;
        }

        let telekinesisActive = isTelekinesisActive(player);

        if (telekinesisActive) {
            handleProjectileMode(player);
            handleLivingEntityMode(player);

            let heldAABB = player.getBoundingBox().inflate(9);
            let feedbackProjectiles = [];
            player.level.getEntitiesWithin(heldAABB).forEach(projectile => {
                if (
                    isProjectile(projectile) &&
                    projectile.persistentData?.telekinesisHolder === player.uuid.toString()
                ) {
                    feedbackProjectiles.push(projectile);
                }
            });
            
            feedbackProjectiles.forEach(projectile => {
                if (projectile && projectile.isAlive()) {
                    showProjectileFeedback(projectile, player);
                }
            });
        } else {
            releaseAllTargets(player);
            clearPlayerTelekinesisState(player);
        }
    });
});

EntityEvents.hurt(event => {
    let target = event.entity;
    let projectile = event.source.immediate;
    
    if (projectile && projectile.persistentData.telekinesis_thrown) {
        target.invulnerableTime = 0;
        target.server.scheduleInTicks(1, () => {
            target.invulnerableTime = 20;
        });
    }
    
    // Cancel damage from telekinesis-held living entities
    let player = event.source.immediate;
    if (player && target && player.type === 'minecraft:player' &&
        isTelekinesisActive(player) &&
        player.persistentData.telekinesisTarget === target.uuid.toString()) {
        event.cancel();
    }
});