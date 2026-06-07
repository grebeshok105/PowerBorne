let $Projectile = Java.loadClass('net.minecraft.world.entity.projectile.Projectile');
let $AbstractHurtingProjectile = Java.loadClass('net.minecraft.world.entity.projectile.AbstractHurtingProjectile');
let $ThrowableItemProjectile = Java.loadClass('net.minecraft.world.entity.projectile.ThrowableItemProjectile');
let $AbilityUtil = Java.loadClass('net.threetag.palladium.power.ability.AbilityUtil');

const SHIELD_OVERHEAT_MAX = 250;
const SHIELD_OVERHEAT_MAX_ABSORPTION = 1000;
const SHIELD_OVERHEAT_COOLDOWN_TICKS = 150;

function hasVibraniumAbsorption(player) {
    if (!player || !player.isPlayer()) return false;
    return global.isAbilityUnlockedOrAutoMaxed(player, CAP_POWER, 'vibranium_absorption_buy');
}

function getShieldOverheatMax(player) {
    return hasVibraniumAbsorption(player) ? SHIELD_OVERHEAT_MAX_ABSORPTION : SHIELD_OVERHEAT_MAX;
}

function computeShieldDurabilityCost(damage, hasAbsorption, isBeamHit) {
    if (hasAbsorption && isBeamHit) return 0;
    if (damage <= 1) return 0;

    let divisor = damage <= 8 ? 2.0 : (1.0 + 8.0 / damage);
    let cost = damage / divisor;
    if (hasAbsorption) cost = cost / 2;

    let floored = Math.floor(cost);
    return hasAbsorption ? floored : Math.max(1, floored);
}

function triggerShieldOverheat(player) {
    palladium.setProperty(player, "shield_overheating", 0);
    palladium.setProperty(player, "is_blocking_beam", 0);
    if (player.isUsingItem()) player.stopUsingItem();
    player.level.playSound(
        null,
        player.x,
        player.y,
        player.z,
        'minecraft:entity.item.break',
        player.getSoundSource(),
        0.8,
        0.95 + Math.random() * 0.1
    );
    player.addItemCooldown(CAP_SHIELD_ID, SHIELD_OVERHEAT_COOLDOWN_TICKS);
}

PlayerEvents.tick(event => {
    let player = event.player;

    let currentBeamBlocking = palladium.getProperty(player, "is_blocking_beam") || 0;
    let wasBlockingBeam = currentBeamBlocking > 0;

    let last = player.persistentData.beamReflectLastAge ?? -1;
    if (player.age > last && wasBlockingBeam) {
        palladium.setProperty(player, "is_blocking_beam", 0);
    }

    let overheatMax = getShieldOverheatMax(player);
    let shieldOverheating = palladium.getProperty(player, "shield_overheating") || 0;

    if (wasBlockingBeam) {
        let newOverheat = Math.min(overheatMax, shieldOverheating + 1);
        if (newOverheat >= overheatMax) {
            triggerShieldOverheat(player);
        } else if (newOverheat !== shieldOverheating) {
            palladium.setProperty(player, "shield_overheating", newOverheat);
        }
    } else if (shieldOverheating > 0) {
        palladium.setProperty(player, "shield_overheating", shieldOverheating - 1);
    }

    preDeflectCustom(player);
});

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function isBlockingWithVibraniumShield(entity, source) {
    let use = entity.getUseItem();
    if (!use || use.id != CAP_SHIELD_ID) return false;
    if (!entity.isUsingItem()) return false;

    let attacker = source.immediate;
    if (!attacker || attacker.type !== 'palladium:custom_projectile')
        attacker = source.actual;
    if (!attacker) return false;

    return isInFrontArc(entity, attacker);
}

function isUsingVibraniumShield(entity) {
    let use = entity.getUseItem();
    if (!use || use.id != CAP_SHIELD_ID) return false;
    return true;
}

function isCapShieldRushBlocking(entity) {
    if (!entity.isPlayer()) return false;
    if (!abilityUtil.isEnabled(entity, CAP_POWER, 'shield_rush') && !abilityUtil.isEnabled(entity, CAP_POWER, 'shield_rush_u3')) return false;
    let main = entity.mainHandItem;
    if (!main || main.isEmpty() || main.id !== CAP_SHIELD_ID) return false;
    return true;
}

function isDirectMeleeHit(source) {
    let direct = source.immediate;
    let actual = source.actual;
    if (!direct || !direct.isLiving() || !actual || !direct.is(actual)) return false;
    return true;
}

function applyShieldKnockback(player, attacker, damage) {
    if (damage <= 0) return false;

    let dx = attacker.x - player.x;
    let dy = attacker.y - player.y;
    let dz = attacker.z - player.z;
    let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 0.01) return false;

    let strength = Math.min(2.2, 0.316 * Math.sqrt(damage));
    attacker.knockback(strength, -dx, -dz);
    attacker.hurtMarked = true;
    return true;
}

function getDeflectProjectileData(projectile) {
    let projectileNbt = projectile.nbt;

    [
        "UUID",
        "Pos",
        "Motion",
        "Rotation",
        "OnGround",
        "inGround",
        "life",
        "Life",
        "Age",
        "LeftOwner",
        "HasBeenShot",
        "ShotFromCrossbow",
        "DealtDamage"
    ].forEach(key => projectileNbt.remove(key));

    return projectileNbt;
}

const SHIELD_DEFLECT_ALLOWED_TYPES = [
    "palladium:custom_projectile"
];

const SHIELD_DEFLECT_BLOCKED_TYPES = [
    "minecraft:shulker_bullet"
];

const SHIELD_DEFLECT_BLOCKED_MODS = [
    "tacz",
    "superbwarfare"
];

function canShieldDeflectProjectile(projectile) {
    if (!projectile || !(projectile instanceof $Projectile)) return false;
    if (!projectile.isAlive()) return false;

    let projectileType = projectile.type;
    let projectileMod = projectileType.split(":")[0];
    if (SHIELD_DEFLECT_BLOCKED_TYPES.includes(projectileType)) return false;
    if (SHIELD_DEFLECT_BLOCKED_MODS.includes(projectileMod)) return false;
    if (SHIELD_DEFLECT_ALLOWED_TYPES.includes(projectileType)) return true;

    if (projectile instanceof $ThrowableItemProjectile) return false;
    if (projectile instanceof $AbstractHurtingProjectile) return false;

    return true;
}

function reflectProjectileFromShield(player, projectile) {
    let owner = projectile.getOwner ? projectile.getOwner() : null;
    if (owner && owner.is(player)) return false;

    let speed = Math.max(0.8, projectile.getDeltaMovement().length()) * 1.1;
    let projectileType = projectile.type;
    let look = player.getLookAngle();
    let spawnOffset = 1.1;
    let heightOffset = 1.5;

    if (projectileType === "palladium:custom_projectile") {
        projectile.x = player.x + spawnOffset * look.x();
        projectile.y = player.y + heightOffset + spawnOffset * look.y();
        projectile.z = player.z + spawnOffset * look.z();
        projectile.shootFromRotation(player, player.pitch, player.yaw, 0, speed, 0);
        return true;
    }

    let projectileNbt = getDeflectProjectileData(projectile);

    let reflectedProjectile = global.createProjectile(player, speed, projectileNbt, spawnOffset, heightOffset, projectileType, owner);
    if (!reflectedProjectile) return false;

    projectile.kill();
    reflectedProjectile.spawn();
    return true;
}

function isProjectileApproaching(projectile, player) {
    let motion = projectile.getDeltaMovement();
    let toPlayerX = player.x - projectile.x;
    let toPlayerY = player.eyeY - projectile.y;
    let toPlayerZ = player.z - projectile.z;
    let towardDot = motion.x() * toPlayerX + motion.y() * toPlayerY + motion.z() * toPlayerZ;
    return towardDot > 0;
}

function preDeflectCustom(player) {
    if (!isUsingVibraniumShield(player)) return;

    let nearby = player.level.getEntitiesWithin(player.getBoundingBox().inflate(1.35));
    nearby.forEach(entity => {
        if (!entity || entity.type !== "palladium:custom_projectile") return;
        if (entity.getTags().contains("powerborne.spinning_shield")) return;
        if (!canShieldDeflectProjectile(entity)) return;
        if (!isProjectileApproaching(entity, player)) return;

        reflectProjectileFromShield(player, entity);
    });
}

// deflect incoming projectiles while shield-blocking
EntityEvents.hurt(event => {
    let player = event.entity;
    if (!player.isPlayer()) return;

    let source = event.source;
    let projectile = source.immediate || source.actual;
    if (!canShieldDeflectProjectile(projectile)) return;
    if (!isUsingVibraniumShield(player)) return;
    if (projectile.type === "palladium:custom_projectile") return;
    if (!isInFrontArc(player, projectile)) return;
    reflectProjectileFromShield(player, projectile);
});

// Mjolnir projectile vs raised vibranium shield
EntityEvents.hurt(event => {
    let player = event.entity;
    if (!player.isPlayer()) return;

    let source = event.source;
    if (!isBlockingWithVibraniumShield(player, source)) return;

    let srcEntity = source.immediate;
    if (!srcEntity || srcEntity.type !== "palladium:custom_projectile") srcEntity = source.actual;
    if (!srcEntity || srcEntity.type !== "palladium:custom_projectile") return;
    if (!srcEntity.getTags().contains("powerborne.mjolnir_projectile") && !srcEntity.getTags().contains("powerborne.stormbreaker_projectile")) return;
    if (!global.runShieldMjolnirClash) return;
    if (event.damage < 15) return;

    global.runShieldMjolnirClash(player, player, srcEntity.getOwner());
    event.cancel();
});

// knockback on shield hit
EntityEvents.hurt(event => {
    let player = event.entity;
    if (!player.isPlayer()) return;

    let source = event.source;
    if (!isBlockingWithVibraniumShield(player, source)) return;
    if (!isDirectMeleeHit(source)) return;

    let attacker = source.immediate;
    if (!attacker || !attacker.isLiving() || attacker.is(player)) return;

    let isMjolnirHit = attacker.getMainHandItem().id === "powerborne:mjolnir" || attacker.getMainHandItem().id === "powerborne:stormbreaker";

    if (isMjolnirHit && event.damage >= 13.5 && !attacker.onGround()) {
        let shield = player.getUseItem();
        if (shield && shield.id === CAP_SHIELD_ID) {
            let shieldDamage = Math.floor(event.damage / 2);
            if (shieldDamage > 0) {
                let hand = player.getUsedItemHand();
                shield.hurtAndBreak(shieldDamage, player, (e) => {
                    e.level.broadcastEntityEvent(e, hand === $InteractionHand.MAIN_HAND ? 47 : 48);
                    if (e.isUsingItem()) e.stopUsingItem();
                });
            }
        }
        player.level.playSound(null, player.x, player.y, player.z, 'powerborne:shield_block', player.getSoundSource(), 0.5, 1.0);
        global.runShieldMjolnirClash(player, player, attacker);
        event.cancel();
        return;
    }
    if (player.distanceToEntity(attacker) > 2) return;

    let damageAmount = Math.floor(event.damage);
    applyShieldKnockback(player, attacker, damageAmount);
});

function isShieldFunctional(item) {
    if (!item || item.isEmpty() || item.id !== CAP_SHIELD_ID) return false;
    if (!item.isDamageableItem()) return true;
    return item.getDamageValue() < item.getMaxDamage();
}

// remove durability on hit
EntityEvents.hurt(event => {
    let { entity: victim, source, damage } = event;
    if (!victim.isLiving() || damage <= 0) return;

    let attacker = source.actual;
    if (!attacker || !attacker.isPlayer()) return;
    if (victim.uuid === attacker.uuid) return;
    if (attacker.getTags().contains('powerborne.shield_slam')) return;

    if (source.immediate !== source.actual) return;

    let main = attacker.mainHandItem;
    if (isShieldFunctional(main)) {
        if (main.id === CAP_SHIELD_ID &&
            (abilityUtil.isEnabled(attacker, CAP_POWER, 'rising_uppercut') || abilityUtil.isEnabled(attacker, CAP_POWER, 'rising_uppercut_u3'))) {
            return;
        }
    }
});

const DEFAULT_BEAM_DAMAGE_TYPE = 'palladium:energy_beam';

function getDamageTypeId(source) {
    try {
        let opt = source.typeHolder().unwrapKey();
        if (opt.isPresent()) return opt.get().location().toString();
    } catch (e) { }
    return '';
}

function isBlockingBeam(entity, source) {
    let attacker = source.actual;
    if (!attacker || !attacker.isLiving()) return false;
    let damageType = getDamageTypeId(source);
    let beamAbilities = Platform.isForge()
        ? $AbilityUtil['getEnabledInstances(net.minecraft.world.entity.LivingEntity,net.minecraft.resources.ResourceLocation)'](
            attacker, ResourceLocation.tryParse('palladium:energy_beam')
        )
        : $AbilityUtil['getEnabledInstances(net.minecraft.class_1309,net.minecraft.class_2960)'](
            attacker, ResourceLocation.tryParse('palladium:energy_beam')
        );
    let beam = beamAbilities[0];
    if (!beam) return false;
    if (!incomingDamageMatchesBeamAbility(damageType, beam)) return false;
    return isBlockingWithVibraniumShield(entity, source);
}

function incomingDamageMatchesBeamAbility(damageType, beam) {
    let beamDamageType = beam.getPropertyByName('damage_type');
    if (beamDamageType != null) {
        return damageType === beamDamageType;
    }
    return damageType === DEFAULT_BEAM_DAMAGE_TYPE;
}

// beam reflect
EntityEvents.hurt(event => {
    let entity = event.entity;
    if (!entity.isPlayer()) return;

    let source = event.source;
    let damageType = getDamageTypeId(source);
    let attacker = source.actual;
    if (!attacker || !attacker.isLiving()) return;

    let beamAbilities = Platform.isForge()
        ? $AbilityUtil['getEnabledInstances(net.minecraft.world.entity.LivingEntity,net.minecraft.resources.ResourceLocation)'](
            attacker, ResourceLocation.tryParse('palladium:energy_beam')
        )
        : $AbilityUtil['getEnabledInstances(net.minecraft.class_1309,net.minecraft.class_2960)'](
            attacker, ResourceLocation.tryParse('palladium:energy_beam')
        );
    let beam = beamAbilities[0];
    if (!beam) return;

    if (!incomingDamageMatchesBeamAbility(damageType, beam)) {
        palladium.setProperty(entity, 'is_blocking_beam', 0);
        return;
    }

    let blockingShield = isBlockingWithVibraniumShield(entity, source);

    let onFireSec = beam.getPropertyByName('set_on_fire_seconds');
    let isFireBeam = onFireSec != null && onFireSec > 0;

    if (blockingShield && isFireBeam && entity.isOnFire()) {
        entity.setRemainingFireTicks(0);
    }

    if (!blockingShield) {
        palladium.setProperty(entity, "is_blocking_beam", 0);
        return;
    }

    palladium.setProperty(entity, "is_blocking_beam", isFireBeam ? 2 : 1);
    entity.persistentData.beamReflectLastAge = entity.age;

    let beamResourceId = beam.getPropertyByName('energy_beam');
    if (beamResourceId != null && entity.isPlayer()) {
        entity.sendData('vibranium_shield_beam_color_request', {
            beamId: beamResourceId.toString(),
            attackerId: attacker.uuid.toString()
        });
    }
});

NetworkEvents.dataReceived('vibranium_shield_beam_color_response', event => {
    let player = event.player;
    if (!player) return;
    let color = event.data.getString('color');
    if (!color) return;
    palladium.setProperty(player, 'shield_reflected_glow_color', color);
});

let $InteractionHand = Java.loadClass('net.minecraft.world.InteractionHand');

EntityEvents.hurt(event => {
    let { entity, source, damage } = event;
    if (!entity.isPlayer() || !source.actual) return;

    let shield = null;
    let hand = null;

    if (entity.isUsingItem()) {
        let usingItem = entity.getUseItem();
        if (usingItem.id === CAP_SHIELD_ID) {
            shield = usingItem;
            hand = entity.getUsedItemHand();
        }
    }

    // Check Shield Rush blocking
    if (!shield && (abilityUtil.isEnabled(entity, CAP_POWER, 'shield_rush') || abilityUtil.isEnabled(entity, CAP_POWER, 'shield_rush_u3'))) {
        let main = entity.mainHandItem;
        if (main.id === CAP_SHIELD_ID) {
            shield = main;
            hand = $InteractionHand.MAIN_HAND;
        }
    }

    if (shield && isInFrontArc(entity, source.actual)) {
        let hasAbsorption = hasVibraniumAbsorption(entity);
        let isBeamHit = (palladium.getProperty(entity, "is_blocking_beam") || 0) > 0;

        let durabilityCost = computeShieldDurabilityCost(damage, hasAbsorption, isBeamHit);

        if (durabilityCost > 0) {
            shield.hurtAndBreak(durabilityCost, entity, (e) => {
                e.level.broadcastEntityEvent(e, hand === $InteractionHand.MAIN_HAND ? 47 : 48);
                if (e.isUsingItem()) e.stopUsingItem();
            });
        }

        if (palladium.getProperty(entity, "is_blocking_beam") == 0) {
            entity.level.playSound(null, entity.x, entity.y, entity.z, 'powerborne:shield_block', entity.getSoundSource(), 0.75, 1.0);
        }
        event.cancel();
    }
});

function isInFrontArc(entity, attacker) {
    let vec = { x: entity.x - attacker.x, z: entity.z - attacker.z };
    let len = Math.sqrt(vec.x * vec.x + vec.z * vec.z);
    if (len === 0) return false;
    let look = entity.getLookAngle();
    return ((vec.x / len) * look.x() + (vec.z / len) * look.z()) < 0.0;
}
