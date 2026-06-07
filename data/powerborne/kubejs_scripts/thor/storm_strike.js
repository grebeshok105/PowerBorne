const STORM_STRIKE = {
    POWER: "powerborne:god_of_thunder",
    ABILITY: "storm_strike",
    COOLDOWN_TICKS: 260,
    RADIUS: 6,
    MAX_DAMAGE: 17,
    MIN_DAMAGE: 7,
    BASE_KNOCKBACK: 1.5,
    GOD_MODE_DAMAGE_MULTIPLIER: 1.4,
    TAG_AIRBORNE: "powerborne.storm_strike_airborne",
    TAG_PRE_ANIM: "powerborne.storm_strike_pre",
    TAG_LAND_ANIM: "powerborne.storm_strike_animation",
    DATA_PREV_ON_GROUND: "stormStrikePrevOnGround",
    JUMP_VELOCITY_THRESHOLD: 1
};

function stormStrikeDistanceValue(distance, maxValue, minValue, radius) {
    if (distance <= 1.0) return maxValue;
    let t = Math.max(0, Math.min(1, (distance - 1.0) / (radius - 1.0)));
    return maxValue - t * (maxValue - minValue);
}

function spawnStormStrikeSlamParticles(player) {
    let radius = STORM_STRIKE.RADIUS;
    let cx = player.x;
    let cy = player.y;
    let cz = player.z;

    let blockPos = player.blockPosition().below();
    let blockState = player.level.getBlockState(blockPos);
    if (blockState && !blockState.isAir()) {
        let blockId = String(blockState.getBlock().id);
        player.level.spawnParticles("block " + blockId, true, cx, cy + 0.05, cz,
            radius * 0.35, 0.05, radius * 0.35, 70, 0.0);
        player.level.spawnParticles("block " + blockId, true, cx, cy + 0.05, cz,
            radius * 0.55, 0.02, radius * 0.55, 32, 0.0);
    }

    player.level.spawnParticles("powerborne:lightning", true, cx, cy + 0.1, cz,
        radius * 0.32, 0.04, radius * 0.32, 70, 0.0);
    player.level.spawnParticles("powerborne:lightning", true, cx, cy + 0.08, cz,
        radius * 0.55, 0.02, radius * 0.55, 45, 0.0);
    player.level.spawnParticles("powerborne:lightning", true, cx, cy + 0.2, cz,
        radius * 0.12, 0.55, radius * 0.12, 30, 0.0);
    
    player.level.spawnParticles("minecraft:electric_spark", true, cx, cy + 0.15, cz,
        radius * 0.45, 0.1, radius * 0.45, 55, 0.0);
    player.level.spawnParticles("minecraft:electric_spark", true, cx, cy + 0.45, cz,
        radius * 0.15, 0.7, radius * 0.15, 24, 0.22);
    
    player.level.spawnParticles("dust_color_transition 0.18 0.5 1.0 1.45 1.0 1.0 1.0", true, cx, cy + 0.1, cz,
        radius * 0.5, 0.06, radius * 0.5, 40, 0.0);
    player.level.spawnParticles("dust_color_transition 0.5 0.82 1.0 1.2 1.0 1.0 1.0", true, cx, cy + 0.22, cz,
        radius * 0.25, 0.18, radius * 0.25, 22, 0.0);
    player.level.spawnParticles("dust_color_transition 0.12 0.35 0.9 1.6 0.85 0.92 1.0", true, cx, cy + 0.18, cz,
        radius * 0.62, 0.1, radius * 0.62, 14, 0.0);
    
    player.level.spawnParticles("minecraft:cloud", true, cx, cy + 0.08, cz,
        radius * 0.5, 0.06, radius * 0.5, 30, 0.0);
    
    player.level.spawnParticles("minecraft:end_rod", true, cx, cy + 0.6, cz,
        radius * 0.18, 1.1, radius * 0.18, 26, 0.08);
    player.level.spawnParticles("minecraft:end_rod", true, cx, cy + 0.3, cz,
        radius * 0.36, 0.5, radius * 0.36, 14, 0.05);
    
    player.level.spawnParticles("minecraft:flash", true, cx, cy + 0.25, cz, 0, 0, 0, 1, 0);
    player.level.spawnParticles("minecraft:flash", true, cx, cy + 1.2, cz, 0, 0, 0, 1, 0);

    let look = player.getLookAngle();
    let lx = look.x();
    let lz = look.z();
    let hLen = Math.sqrt(lx * lx + lz * lz);
    if (hLen > 0) {
        lx /= hLen;
        lz /= hLen;
    }
    player.level.spawnLightning(cx + lx, player.y, cz + lz, false);
}

function performStormStrikeSlam(player) {
    let cx = player.x;
    let cy = player.y + player.getBbHeight() * 0.25;
    let cz = player.z;
    let radius = STORM_STRIKE.RADIUS;
    global.breakReplaceableInRadius(player.level, player, cx, cy, cz, radius - 2);

    player.level.playSound(null, cx, cy, cz, "powerborne:storm_strike", player.getSoundSource(), 1.0, 1.0);
    player.level.playSound(null, cx, cy, cz, "minecraft:entity.generic.explode", player.getSoundSource(), 0.55, 1.35);
    spawnStormStrikeSlamParticles(player);
    player.sendData("screen_shake", { ticks: 10, base_intensity: 1.2, max_intensity: 3 });
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

        let damage = stormStrikeDistanceValue(dist, STORM_STRIKE.MAX_DAMAGE, STORM_STRIKE.MIN_DAMAGE, radius);
        if (abilityUtil.isEnabled(player, STORM_STRIKE.POWER, "god_mode")) {
            damage *= STORM_STRIKE.GOD_MODE_DAMAGE_MULTIPLIER;
        }
        let knockback = stormStrikeDistanceValue(dist, STORM_STRIKE.BASE_KNOCKBACK * 2.0, STORM_STRIKE.BASE_KNOCKBACK, radius);
        entity.attack(player.damageSources().playerAttack(player), damage);
        entity.knockback(knockback, -dx, -dz);
        entity.setSecondsOnFire(6);
    });

    player.resetFallDistance();
    player.removeTag(STORM_STRIKE.TAG_AIRBORNE);
    player.removeTag(STORM_STRIKE.TAG_PRE_ANIM);
    player.addTag(STORM_STRIKE.TAG_LAND_ANIM);
    player.persistentData.stormStrikeAnimTimer = 10;

    player.potionEffects.add("minecraft:slowness", 10, 4, false, false);
    player.setMotion(0, 0, 0);
    player.hurtMarked = true;
}

PlayerEvents.tick(event => {
    let player = event.player;
    if (!player || !player.isAlive()) return;

    if (player.getTags().contains(STORM_STRIKE.TAG_AIRBORNE)) {
        if (player.getMainHandItem().id !== "powerborne:stormbreaker" || palladium.getProperty(player, 'energy_bar_lightning') < 3) {
            player.removeTag(STORM_STRIKE.TAG_AIRBORNE);
            player.removeTag(STORM_STRIKE.TAG_PRE_ANIM);
        }
    }

    if (player.getTags().contains(STORM_STRIKE.TAG_LAND_ANIM)) {
        let t = player.persistentData.stormStrikeAnimTimer || 0;
        t--;
        if (t <= 0) {
            player.removeTag(STORM_STRIKE.TAG_LAND_ANIM);
            player.persistentData.remove("stormStrikeAnimTimer");
        } else {
            player.persistentData.stormStrikeAnimTimer = t;
        }
    }

    let cooldown = palladium.getProperty(player, "storm_strike_cooldown") || 0;
    if (
        cooldown > 0 &&
        !player.getTags().contains(STORM_STRIKE.TAG_PRE_ANIM)
    ) {
        palladium.setProperty(player, "storm_strike_cooldown", cooldown - 1);
    }

    let prevOnGround = player.persistentData[STORM_STRIKE.DATA_PREV_ON_GROUND];
    if (prevOnGround === undefined || prevOnGround === null) prevOnGround = player.onGround();
    let isOnGround = player.onGround();

    let airborne = player.getTags().contains(STORM_STRIKE.TAG_AIRBORNE);

    if (!airborne) {
        if (abilityUtil.hasPower(player, STORM_STRIKE.POWER)
            && abilityUtil.isEnabled(player, STORM_STRIKE.POWER, STORM_STRIKE.ABILITY)
            && prevOnGround && !isOnGround
            && player.getDeltaMovement().y() > 0.7) {

            player.level.playSound(null, player.x, player.y, player.z,
                "powerborne:lightning_jump", player.getSoundSource(), 1, Math.random() * 0.2 + 0.9);

            if (player.getDeltaMovement().y() > STORM_STRIKE.JUMP_VELOCITY_THRESHOLD) {
                player.addTag(STORM_STRIKE.TAG_AIRBORNE);
                player.addTag(STORM_STRIKE.TAG_PRE_ANIM);
                palladium.setProperty(player, "storm_strike_cooldown", STORM_STRIKE.COOLDOWN_TICKS);
            }
        }
    } else {
        if (!isOnGround) {
            player.addTag(STORM_STRIKE.TAG_PRE_ANIM);
        } else {
            player.removeTag(STORM_STRIKE.TAG_PRE_ANIM);
            performStormStrikeSlam(player);
        }
    }

    player.persistentData[STORM_STRIKE.DATA_PREV_ON_GROUND] = isOnGround;
});