const SPINNING = {
    RADIUS_MIN: 1,
    RADIUS_MAX: 4.0,
    RADIUS_DEFAULT: 2.0,
    ENTITY_SCAN_RANGE: 5.0,
    RADIUS_LERP_SPEED: 0.45,
    ANGULAR_SPEED: 1.3,
    DAMAGE_PER_HIT: 8.5,
    HIT_RADIUS_H: 1.1,
    HIT_RADIUS_V: 1.3,
    HIT_COOLDOWN_TICKS: 8
};

function spinShieldOrbitY(entity) {
    return entity.y + entity.getBbHeight() * 0.7;
}

function spinShieldClampHorizontal(vx, vz, maxLen) {
    let h2 = vx * vx + vz * vz;
    if (h2 <= maxLen * maxLen) return { x: vx, z: vz };
    let h = Math.sqrt(h2);
    return { x: vx * maxLen / h, z: vz * maxLen / h };
}

function getEntityHorizontalAimXZ(entity) {
    let bb = entity.getBoundingBox();
    if (!bb) return { x: entity.x, z: entity.z };
    let minX = typeof bb.minX === 'function' ? bb.minX() : bb.minX;
    let maxX = typeof bb.maxX === 'function' ? bb.maxX() : bb.maxX;
    let minZ = typeof bb.minZ === 'function' ? bb.minZ() : bb.minZ;
    let maxZ = typeof bb.maxZ === 'function' ? bb.maxZ() : bb.maxZ;
    return { x: (minX + maxX) * 0.5, z: (minZ + maxZ) * 0.5 };
}

function findNearestAttackableEntity(player) {
    let r = SPINNING.ENTITY_SCAN_RANGE;
    let nearbyEntities = player.level.getEntitiesWithin(AABB.of(
        player.x - r, player.y - r * 0.8, player.z - r,
        player.x + r, player.y + r * 1.2, player.z + r
    ));

    let nearestDist = null;
    nearbyEntities.forEach(entity => {
        if (entity.uuid === player.uuid) return;
        if (String(entity.type).indexOf('projectile') !== -1) return;
        if (!entity.isAlive() || !entity.isLiving() || !entity.attackable()) return;

        let aim = getEntityHorizontalAimXZ(entity);
        let dx = aim.x - player.x;
        let dz = aim.z - player.z;
        let dist = Math.sqrt(dx * dx + dz * dz);

        if (nearestDist === null || dist < nearestDist) nearestDist = dist;
    });
    return nearestDist;
}

function calculateTargetRadius(player, projectile) {
    let tick = projectile.persistentData.SpinTick || 0;
    if (tick !== 0 && tick % 3 !== 0) {
        return projectile.persistentData.TargetRadius || SPINNING.RADIUS_DEFAULT;
    }
    let nearestDist = findNearestAttackableEntity(player);
    let targetRadius = nearestDist === null
        ? SPINNING.RADIUS_DEFAULT
        : Math.max(SPINNING.RADIUS_MIN, Math.min(SPINNING.RADIUS_MAX, nearestDist));

    projectile.persistentData.TargetRadius = targetRadius;
    return targetRadius;
}

function updateDynamicRadius(projectile, targetRadius) {
    let current = projectile.persistentData.CurrentRadius;
    if (current === undefined) current = targetRadius;
    let newRadius = current + (targetRadius - current) * SPINNING.RADIUS_LERP_SPEED;
    newRadius = Math.max(0.125, Math.min(SPINNING.RADIUS_MAX, newRadius));
    projectile.persistentData.CurrentRadius = newRadius;
    return newRadius;
}

function canHitSpinningShield(entity) {
    return entity && entity.isAlive() && entity.isLiving() && entity.attackable() && entity.hurtTime <= 1;
}

function sweepShieldPathForEntities(projectile, owner, lastX, lastY, lastZ, currentX, currentY, currentZ) {
    if (!owner || !owner.isAlive()) return;
    let dx = currentX - lastX;
    let dy = currentY - lastY;
    let dz = currentZ - lastZ;
    let pathLength = Math.sqrt(dx * dx + dy * dy + dz * dz);

    let rH = SPINNING.HIT_RADIUS_H;
    let rV = SPINNING.HIT_RADIUS_V;

    let minX = Math.min(lastX, currentX) - rH;
    let maxX = Math.max(lastX, currentX) + rH;
    let minY = Math.min(lastY, currentY) - rV;
    let maxY = Math.max(lastY, currentY) + rV;
    let minZ = Math.min(lastZ, currentZ) - rH;
    let maxZ = Math.max(lastZ, currentZ) + rH;

    let candidates = projectile.level.getEntitiesWithin(AABB.of(minX, minY, minZ, maxX, maxY, maxZ));
    if (!candidates || candidates.length === 0) return;

    let tick = projectile.persistentData.SpinTick || 0;
    let hitLog = projectile.persistentData.SpinHitLog || {};
    let steps = Math.max(2, Math.min(16, Math.ceil(pathLength / 0.35) + 1));
    let dmgSrc = owner.damageSources().thrown(projectile, owner)

    candidates.forEach(entity => {
        if (entity.uuid === owner.uuid || entity.uuid === projectile.uuid) return;
        if (entity.isPlayer() && entity.isSpectator()) return;
        if (!canHitSpinningShield(entity)) return;

        let key = String(entity.uuid);
        let lastHitTick = hitLog[key] || -9999;
        if (tick - lastHitTick < SPINNING.HIT_COOLDOWN_TICKS) return;

        let bb = entity.getBoundingBox();
        if (!bb) return;
        let inflated = bb.inflate(rH, rV, rH);

        let hit = false;
        for (let i = 0; i <= steps; i++) {
            let t = steps === 0 ? 0 : i / steps;
            let sx = lastX + dx * t;
            let sy = lastY + dy * t;
            let sz = lastZ + dz * t;
            if (inflated.contains(sx, sy, sz)) {
                hit = true;
                break;
            }
        }

        if (hit) {
            let before = entity.health;
            entity.attack(dmgSrc, SPINNING.DAMAGE_PER_HIT);
            hitLog[key] = tick;

            if (entity.health < before || !entity.isAlive()) {
                projectile.level.playSound(null, entity.x, entity.y, entity.z, 'powerborne:shield_hit', 'players', 0.5, 0.95 + Math.random() * 0.1);
                entity.level.spawnParticles('minecraft:crit', true,
                    entity.x, entity.y + entity.getBbHeight() * 0.5, entity.z,
                    0.3, 0.3, 0.3, 8, 0.08);

                let kdx = entity.x - owner.x;
                let kdz = entity.z - owner.z;
                let kdist = Math.sqrt(kdx * kdx + kdz * kdz) || 1;
                let motion = entity.getDeltaMovement();
                entity.setMotion(
                    motion.x() + (kdx / kdist) * 0.35,
                    motion.y() + 0.15,
                    motion.z() + (kdz / kdist) * 0.35
                );
                entity.hurtMarked = true;

                if (owner.isPlayer()) {
                    damageThrownShieldOnImpact(projectile, owner);
                }
            }
        }
    });

    projectile.persistentData.SpinHitLog = hitLog;
}

function createSpinningShieldProjectile(player, itemstack) {
    let savedItem = copyShieldItemData(itemstack);
    let oy = spinShieldOrbitY(player);
    let nearestDist = findNearestAttackableEntity(player);
    let initialRadius = nearestDist === null
        ? SPINNING.RADIUS_DEFAULT
        : Math.max(SPINNING.RADIUS_MIN, Math.min(SPINNING.RADIUS_MAX, nearestDist));

    let projectile = player.level.createEntity('palladium:custom_projectile');
    projectile.setOwner(player);
    projectile.x = player.x + initialRadius;
    projectile.y = oy;
    projectile.z = player.z;

    projectile.addTag("powerborne.vibranium_shield_projectile");
    projectile.addTag("powerborne.spinning_shield");

    projectile.mergeNbt({
        "Damage": 0,
        "Gravity": 0,
        "DieOnEntityHit": false,
        "DieOnBlockHit": false,
        "Size": -0.3,
        "Lifetime": 1200,
        "PreventShooterInteraction": 1,
        "KubeJSPersistentData": {
            "OwnerUsername": player.username,
            "LastX": projectile.x,
            "LastY": projectile.y,
            "LastZ": projectile.z,
            "SavedShieldItem": savedItem,
            "SpinTick": 0,
            "CurrentRadius": initialRadius,
            "TargetRadius": initialRadius
        },
        "Appearances": [
            { "Type": "item", "Item": savedItem },
            { "Type": "trail", "Trail": "powerborne:shield_trail" },
            { "Type": "trail", "Trail": "powerborne:shield_trail2" },
            {
                "Type": "particles",
                "ParticleType": "minecraft:soul_fire_flame",
                "Amount": 1,
                "Spread": 0.25
            }
        ],
        "CustomName": '{"text":"' + player.username + '\'s Vibranium Shield"}'
    });

    let pv = player.getDeltaMovement();
    let tSpeed = Math.min(SPINNING.ANGULAR_SPEED * initialRadius, 2.1);
    let clamped = spinShieldClampHorizontal(tSpeed + pv.x(), pv.z(), 2.6);
    setProjectileMotion(projectile, clamped.x, 0, clamped.z);

    projectile.spawn();
    applyShieldProjectileColors(projectile, itemstack);
    player.persistentData.SpinningShieldItem = snapshotShieldDataForPlayer(savedItem);
    player.persistentData.SpinningShieldActive = 1;
    addShieldProjectileTracking(player, projectile);

    return projectile;
}

function handleSpinningShieldProjectileTick(projectile, owner) {
    if (!owner || !owner.isAlive() || !owner.isPlayer()) {
        removeShieldProjectileTracking(projectile);
        projectile.kill();
        return;
    }

    if (!abilityUtil.hasPower(owner, CAP_POWER) || !abilityUtil.isEnabled(owner, CAP_POWER, 'spinning_shield')) {
        finishSpinningShieldCatch(owner, projectile);
        return;
    }

    let tick = (projectile.persistentData.SpinTick || 0) + 1;
    projectile.persistentData.SpinTick = tick;

    let soundTimer = projectile.persistentData.SpinSoundTimer || 0;
    if (soundTimer <= 0) {
        projectile.level.playSound(
            null,
            projectile.x,
            projectile.y,
            projectile.z,
            'powerborne:shield_spin',
            'master',
            1.0,
            0.9
        );
        projectile.persistentData.SpinSoundTimer = 15;
    } else {
        projectile.persistentData.SpinSoundTimer = soundTimer - 1;
    }

    let lastX = projectile.persistentData.LastX || projectile.x;
    let lastY = projectile.persistentData.LastY || projectile.y;
    let lastZ = projectile.persistentData.LastZ || projectile.z;

    let targetRadius = calculateTargetRadius(owner, projectile);
    let currentRadius = updateDynamicRadius(projectile, targetRadius);

    let ox = owner.x;
    let oy = spinShieldOrbitY(owner);
    let oz = owner.z;

    let px = projectile.x - ox;
    let pz = projectile.z - oz;
    let actualDist = Math.sqrt(px * px + pz * pz);

    let lockR = Math.max(currentRadius, 0.15);
    if (actualDist < 0.15) {
        let angle = tick * SPINNING.ANGULAR_SPEED;
        px = Math.cos(angle);
        pz = Math.sin(angle);
        actualDist = 1;
    }

    let rx = px / actualDist;
    let rz = pz / actualDist;
    let tx = -rz;
    let tz = rx;

    let speedScale = lockR >= 2.6 ? 1.0 : 0.42 + (1.0 - 0.42) * ((lockR - 0.25) / 2.35);
    let tangentialSpeed = Math.min(SPINNING.ANGULAR_SPEED * lockR, 2.1) * speedScale;

    let pv = owner.getDeltaMovement();
    let pvx = pv.x();
    let pvy = pv.y();
    let pvz = pv.z();

    let currentAngle = Math.atan2(pz, px);
    let angularStep = tangentialSpeed / lockR;
    let nextAngle = currentAngle + angularStep;

    let targetX = ox + pvx + Math.cos(nextAngle) * lockR;
    let targetZ = oz + pvz + Math.sin(nextAngle) * lockR;
    let targetY = projectile.y + (oy - projectile.y) * 0.38 + pvy * 0.5;

    let mx = targetX - projectile.x;
    let mz = targetZ - projectile.z;
    let my = targetY - projectile.y;
    let clamped = spinShieldClampHorizontal(mx, mz, 2.6);

    setProjectileMotion(projectile, clamped.x, my, clamped.z);

    sweepShieldPathForEntities(projectile, owner, lastX, lastY, lastZ, targetX, targetY, targetZ);

    projectile.persistentData.LastX = targetX;
    projectile.persistentData.LastY = targetY;
    projectile.persistentData.LastZ = targetZ;
}

function finishSpinningShieldCatch(owner, projectile) {
    if (owner && owner.isPlayer()) {
        global.playSoundLocal(owner, 'minecraft:entity.item.pickup', 'players', 0.2, 2);
        giveSavedShieldToPlayer(owner, getShieldProjectileItemData(projectile));
        owner.persistentData.remove('SpinningShieldItem');
        owner.persistentData.SpinningShieldActive = 0;
    }
    removeShieldProjectileTracking(projectile);
    projectile.kill();
}

PlayerEvents.tick((event) => {
    let player = event.player;
    if (!player || !player.isAlive() || !abilityUtil.hasPower(player, CAP_POWER)) return;

    let spinOn = abilityUtil.isEnabled(player, CAP_POWER, 'spinning_shield');
    let wasOn = player.persistentData.spinningShieldAbilityWasOn || 0;

    if (!spinOn) {
        if (wasOn) player.persistentData.spinningShieldThrownThisActivation = 0;
        player.persistentData.spinningShieldAbilityWasOn = 0;
        return;
    }

    player.persistentData.spinningShieldAbilityWasOn = 1;

    let abilityInstance = abilityUtil.getInstance(player, CAP_POWER, 'spinning_shield');
    let enabledTicks = abilityInstance ? abilityInstance.getEnabledTicks() : 0;

    if (enabledTicks > 1 || player.persistentData.spinningShieldThrownThisActivation) return;

    let item = player.mainHandItem;
    if (!item || item.isEmpty() || item.id !== CAP_SHIELD_ID) return;
    if (player.persistentData.SpinningShieldActive) return;

    player.persistentData.spinningShieldThrownThisActivation = 1;

    createSpinningShieldProjectile(player, item);
    item.shrink(1);
    player.swing();
    player.addItemCooldown(CAP_SHIELD_ID, 20);

    player.level.playSound(null, player.x, player.y + 1.0, player.z, 'powerborne:shield_throw', player.getSoundSource(), 0.65, 0.92 + Math.random() * 0.08);
});