const SLAM = {
    GROUND_RADIUS: 2.5,
    GROUND_MAX_DAMAGE: 8.0,
    GROUND_MIN_DAMAGE: 3.0,
    GROUND_BASE_KNOCKBACK: 0.5,
    AIR_SPEED: 2.5,
    AIR_MIN_RADIUS: 3,
    AIR_MAX_RADIUS: 6,
    AIR_MAX_DAMAGE: 13.0,
    AIR_MIN_DAMAGE: 4.0,
    AIR_FALL_DISTANCE_SCALE: 0.4,
    AIR_BASE_KNOCKBACK: 1.0,
    AIR_TAG: 'powerborne.shield_slam',
    ANIMATION_TAG: 'powerborne.slam_animation',
    ANIMATION_TICKS: 10,
    ANIMATION_LEAD_BLOCKS: 8
};

function hasSolidLandingSupportAt(player, x, y, z, depth) {
    let playerBB = player.getBoundingBox();
    let movedBB = playerBB.move(x - player.x, y - player.y, z - player.z);
    let checkBB = movedBB.move(0, -depth, 0).inflate(0.25, 0, 0.25);

    return !player.level.noCollision(player, checkBB);
}

function isLandingSoon(player) {
    if (player.onGround()) return false;
    for (let depth = 1; depth <= SLAM.ANIMATION_LEAD_BLOCKS; depth++) {
        if (hasSolidLandingSupportAt(player, player.x, player.y, player.z, depth)) return true;
    }
    return false;
}

function startSlamAnimation(player) {
    if (player.getTags().contains(SLAM.ANIMATION_TAG)) return;
    player.addTag(SLAM.ANIMATION_TAG);
    player.persistentData.slamAnimationTimer = SLAM.ANIMATION_TICKS;
}

function clearShieldSlam(player) {
    player.removeTag(SLAM.AIR_TAG);
    player.persistentData.remove('shieldSlamAirStartY');
}

function damageSlamShieldOnce(player) {
    let main = player.mainHandItem;
    if (!main || main.isEmpty() || main.id !== CAP_SHIELD_ID) return;
    if (!main.isDamageableItem()) return;
    if (main.nbt && main.nbt.Unbreakable) return;
    main.hurtAndBreak(1, player, (e) => e.level.broadcastEntityEvent(e, 47));
}

function calculateDistanceBasedValue(distance, maxValue, minValue, maxRadius) {
    if (distance <= 1.0) return maxValue;
    let t = Math.max(0, Math.min(1, (distance - 1.0) / (maxRadius - 1.0)));
    return maxValue - t * (maxValue - minValue);
}

function sendSlamScreenShake(player, isAirSlam, radius) {
    if (!player || !player.isPlayer()) return;
    if (!isAirSlam) {
        player.sendData("screen_shake", { ticks: 5, base_intensity: 1, max_intensity: 1 });
        return;
    }
    let t = (radius - SLAM.AIR_MIN_RADIUS) / (SLAM.AIR_MAX_RADIUS - SLAM.AIR_MIN_RADIUS);
    t = Math.max(0, Math.min(1, t));
    player.sendData("screen_shake", {
        ticks: Math.floor(6 + 9 * t),
        base_intensity: 0.35 + 0.55 * t,
        max_intensity: 1.1 + 1.2 * t
    });
}

function spawnSlamParticles(player, radius, isAirSlam) {
    let cx = player.x;
    let cy = player.y + 0.2;
    let cz = player.z;

    let blockPos = player.blockPosition().below();
    let blockState = player.level.getBlockState(blockPos);
    let hasSolidBlock = blockState && !blockState.isAir();

    let intensity = Math.min(1.8, radius / 4.0);

    if (hasSolidBlock) {
        let blockId = String(blockState.getBlock().id);
        let blockCount = Math.floor(35 * intensity);
        player.level.spawnParticles('block ' + blockId, true, cx, cy + 0.05, cz,
            radius * 0.6, 0, radius * 0.6, blockCount, 0.15);
        player.level.spawnParticles('block ' + blockId, true, cx, cy + 0.1, cz,
            radius * 0.4, 0, radius * 0.4, Math.floor(blockCount * 0.7), 0.2);
    } else {
        player.level.spawnParticles('minecraft:crit', true, cx, cy + 0.15, cz,
            radius * 0.45, 0.2, radius * 0.45, Math.floor(20 * intensity), 0.03);
    }

    player.level.spawnParticles('minecraft:cloud', true, cx, cy + 0.05, cz,
        radius * 0.55, 0.12, radius * 0.55, Math.floor(10 * intensity), 0.04);
    player.level.spawnParticles('minecraft:crit', true, cx, cy + 0.05, cz,
        radius * 0.35, 0, radius * 0.35, Math.floor(12 * intensity), 0.02);

    let dustCount = Math.floor(18 * intensity);
    player.level.spawnParticles('dust_color_transition 0.2 0.5 1.0 1.2 1.0 1.0 1.0', true, cx, cy + 0.08, cz,
        radius * 0.55, 0.04, radius * 0.55, dustCount, 0.0);

    let innerDustCount = Math.floor(10 * intensity);
    player.level.spawnParticles('dust_color_transition 0.4 0.7 1.0 0.9 1.0 1.0 1.0', true, cx, cy + 0.12, cz,
        radius * 0.25, 0.06, radius * 0.25, innerDustCount, 0.0);

    let haloCount = Math.floor(8 * intensity);
    player.level.spawnParticles('dust_color_transition 0.55 0.75 1.0 1.4 1.0 1.0 1.0', true, cx, cy + 0.2, cz,
        radius * 0.58, 0.25, radius * 0.58, haloCount, 0.02);

    let sparkCount = Math.floor(6 * intensity);
    player.level.spawnParticles('minecraft:electric_spark', true, cx, cy + 0.1, cz,
        radius * 0.45, 0.1, radius * 0.45, sparkCount, 0.08);

    if (isAirSlam) {
        player.level.spawnParticles('minecraft:explosion', true, cx, cy + 0.6, cz, 0, 0, 0, 1, 0);

        let airDustCount = Math.floor(24 * intensity);
        player.level.spawnParticles('dust_color_transition 0.15 0.45 1.0 1.5 1.0 1.0 1.0', true, cx, cy + 0.15, cz,
            radius * 0.55, 0.18, radius * 0.55, airDustCount, 0.0);

        let moteCount = Math.floor(8 * intensity);
        player.level.spawnParticles('minecraft:end_rod', true, cx, cy + 0.3, cz,
            radius * 0.35, 0.4, radius * 0.35, moteCount, 0.04);
    }
}

function performSlam(player, radius, maxDamage, minDamage, baseKnockback, isAirSlam) {
    let cx = player.x;
    let cy = player.y + player.getBbHeight() * 0.25;
    let cz = player.z;
    global.breakReplaceableInRadius(player.level, player, cx, cy, cz, 2);

    // Air dive already has this tag; ground slam needs it only for the hit window
    let addedSlamTagForGround = !player.getTags().contains(SLAM.AIR_TAG);
    if (addedSlamTagForGround) player.addTag(SLAM.AIR_TAG);

    let vol = 1.0;
    player.level.playSound(null, cx, cy, cz, 'powerborne:shield_hit', player.getSoundSource(), vol, 0.8 + Math.random() * 0.1);
    if (isAirSlam) {
        player.level.playSound(null, cx, cy, cz, 'minecraft:entity.generic.explode', player.getSoundSource(), vol * 0.4, 1.2 + vol * 0.1);
    }

    spawnSlamParticles(player, radius, isAirSlam);
    sendSlamScreenShake(player, isAirSlam, radius);
    player.swing();

    let entities = player.level.getEntitiesWithin(AABB.of(cx - radius, cy - radius, cz - radius, cx + radius, cy + radius, cz + radius));

    entities.forEach(entity => {
        if (!entity || !entity.isLiving() || !entity.isAlive()) return;
        if (entity.uuid === player.uuid) return;
        if (entity.isPlayer() && entity.isSpectator()) return;

        let ex = entity.x;
        let ey = entity.y + entity.getBbHeight() * 0.5;
        let ez = entity.z;
        let dx = ex - cx;
        let dz = ez - cz;
        let dist = Math.sqrt(dx * dx + (ey - cy) * (ey - cy) + dz * dz);

        if (dist > radius) return;

        let damage = calculateDistanceBasedValue(dist, maxDamage, minDamage, radius);
        let knockback = calculateDistanceBasedValue(dist, baseKnockback * 2.0, baseKnockback, radius);

        entity.persistentData.capLastHitAbility = 'shield_slam';
        entity.persistentData.capLastHitTick = Number(entity.level.gameTime);
        entity.attack(player.damageSources().playerAttack(player), damage);
        entity.knockback(knockback, -dx, -dz);
    });

    if (addedSlamTagForGround) player.removeTag(SLAM.AIR_TAG);
    damageSlamShieldOnce(player);

    player.potionEffects.add("minecraft:slowness", 10, 3, false, false);
}

function performGroundSlam(player) {
    performSlam(player, SLAM.GROUND_RADIUS, SLAM.GROUND_MAX_DAMAGE, SLAM.GROUND_MIN_DAMAGE, SLAM.GROUND_BASE_KNOCKBACK, false);
}

function performAirSlam(player, verticalDropBlocks) {
    let scaledFall = verticalDropBlocks * SLAM.AIR_FALL_DISTANCE_SCALE;
    let radius = Math.max(SLAM.AIR_MIN_RADIUS, Math.min(SLAM.AIR_MAX_RADIUS, SLAM.AIR_MIN_RADIUS + scaledFall));

    performSlam(player, radius, SLAM.AIR_MAX_DAMAGE, SLAM.AIR_MIN_DAMAGE, SLAM.AIR_BASE_KNOCKBACK, true);
    clearShieldSlam(player);
}

PlayerEvents.tick((event) => {
    let player = event.player;
    if (!player || !player.isAlive()) return;
    if (player.getTags().contains(SLAM.ANIMATION_TAG)) {
        let t = player.persistentData.slamAnimationTimer;
        t -= 1;
        if (t <= 0) {
            player.removeTag(SLAM.ANIMATION_TAG);
            player.persistentData.remove('slamAnimationTimer');
        } else {
            player.persistentData.slamAnimationTimer = t;
        }
    }
    let abilityInstance = abilityUtil.getInstance(player, CAP_POWER, 'shield_slam');
    if (!abilityInstance || !abilityInstance.isEnabled()) {
        abilityInstance = abilityUtil.getInstance(player, CAP_POWER, 'shield_slam_u3');
    }
    let enabledTicks = abilityInstance ? abilityInstance.getEnabledTicks() : 0;
    if (!abilityUtil.hasPower(player, CAP_POWER)) {
        clearShieldSlam(player);
        return;
    }

    let groundSlamEnabled = abilityUtil.isEnabled(player, CAP_POWER, 'shield_slam') || abilityUtil.isEnabled(player, CAP_POWER, 'shield_slam_u3');
    if (groundSlamEnabled && enabledTicks == 2) {
        performGroundSlam(player);
        return;
    }

    let airSlamEnabled = abilityUtil.isEnabled(player, CAP_POWER, 'shield_slam_air') || abilityUtil.isEnabled(player, CAP_POWER, 'shield_slam_air_u3');
    let inAirSlamDive = player.getTags().contains(SLAM.AIR_TAG);

    if (airSlamEnabled && !inAirSlamDive) {
        player.addTag(SLAM.AIR_TAG);
        player.persistentData.shieldSlamAirStartY = player.y;
        player.setMotion(0, -SLAM.AIR_SPEED, 0);
        player.hurtMarked = true;
        if (isLandingSoon(player)) {
            startSlamAnimation(player);
        }
        player.level.playSound(null, player.x, player.y, player.z, 'minecraft:entity.player.attack.sweep', player.getSoundSource(), 0.6, 0.7 + Math.random() * 0.1);
        return;
    }

    if (inAirSlamDive) {
        player.setMotion(0, -SLAM.AIR_SPEED, 0);
        player.hurtMarked = true;

        if (isLandingSoon(player) || player.onGround()) {
            startSlamAnimation(player);
        }

        if (player.onGround()) {
            let startY = player.persistentData.shieldSlamAirStartY;
            let verticalDrop = 0;
            if (startY !== undefined && startY !== null && isFinite(startY)) {
                verticalDrop = Math.max(0, startY - player.y);
            } else {
                verticalDrop = Math.max(0, player.fallDistance);
            }
            player.resetFallDistance();
            performAirSlam(player, verticalDrop);
        }
    }
});