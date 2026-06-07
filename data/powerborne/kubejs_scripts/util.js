PalladiumEvents.registerProperties((event) => {
    if (event.getEntityType() === "minecraft:player") {
        event.registerProperty("energy_bar_void", 'integer', 0);
        event.registerProperty("energy_bar_lightning", 'integer', 0);
        event.registerProperty("energy_bar_solar", 'integer', 0);
        event.registerProperty("energy_bar_solar_max", 'integer', 100);
        event.registerProperty("mjolnir_throw_mode", 'integer', 0);
        event.registerProperty("flight_boost_ticks", 'integer', 0);
        event.registerProperty("screen_shake_timer", 'integer', 0);

        event.registerProperty("sentry_level", 'integer', 0);
        event.registerProperty("sentry_xp", 'integer', 0);
        event.registerProperty("sentry_skill_points", 'integer', 0);
        event.registerProperty("void_banishment_cooldown", 'integer', 0);
        event.registerProperty("forcefield_regen_cooldown", 'integer', 0);

        event.registerProperty("superman_level", 'integer', 0);
        event.registerProperty("superman_xp", 'integer', 0);
        event.registerProperty("superman_skill_points", 'integer', 0);
        event.registerProperty("super_punch_cooldown", 'integer', 0);

        event.registerProperty("thor_level", 'integer', 0);
        event.registerProperty("thor_xp", 'integer', 0);
        event.registerProperty("thor_skill_points", 'integer', 0);

        event.registerProperty("captain_america_level", 'integer', 0);
        event.registerProperty("captain_america_xp", 'integer', 0);
        event.registerProperty("captain_america_skill_points", 'integer', 0);
        event.registerProperty("god_mode_cooldown", 'integer', 0);
        event.registerProperty("storm_strike_cooldown", 'integer', 0);
        event.registerProperty("bifrost_cooldown", 'integer', 0);
        event.registerProperty("bifrost_has_point", 'integer', 0);
        event.registerProperty("hostile_killed", 'integer', 0);
        event.registerProperty("mjolnir_charge", 'integer', 0);

        event.registerProperty("is_blocking_beam", 'integer', 0);
        event.registerProperty("shield_reflected_glow_color", 'string', '#ffffff');
        event.registerProperty("shield_overheating", 'integer', 0);
        event.registerProperty("color1", 'string', '#ffffff');
        event.registerProperty("color4", 'string', '#ffffff');

        event.registerProperty("toggle_helmet", 'integer', 1);
    }
});

NetworkEvents.dataReceived("toggle_helmet", (event) => {
    let player = event.player;
    if (!player) return;
    let toggleHelmet = event.data.toggle_helmet;
    if (toggleHelmet == null) return;
    palladium.setProperty(player, "toggle_helmet", toggleHelmet);
    global.playSoundLocal(player, "minecraft:item.armor.equip_leather", "players", 0.5, 1);
});

let AllEffects = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries').MOB_EFFECT;
let $MobEffectInstance = Java.loadClass('net.minecraft.world.effect.MobEffectInstance');
let $BlockPos = Java.loadClass('net.minecraft.core.BlockPos');

ServerEvents.unloaded(() => {
    if (global.mjolnirProjectiles) global.mjolnirProjectiles.clear();
    if (global.mjolnirHandled) global.mjolnirHandled.clear();
    if (global.voidAdaptation) global.voidAdaptation.clear();
    if (global.entitiesWithVoidEffect) global.entitiesWithVoidEffect.clear();
    if (global.entitiesWithFrozenEffect) global.entitiesWithFrozenEffect.clear();
});

global.canBeAffectedByEffects = (entity) => {
    let effect = AllEffects.get("powerborne:void");
    let instance = new $MobEffectInstance(effect, 0, 1);
    return entity.addEffect(instance);
};

global.handleSpeedFood = (player, heroPower) => {
    if (abilityUtil.isEnabled(player, heroPower, "speed_trail")) {
        if (player.age % 20 === 0 && player.isSprinting()) {
            let saturation = player.getFoodData().getSaturationLevel();
            if (saturation < 5.0) {
                player.getFoodData().setSaturation(saturation + 0.1);
            }
        }
    }
};

global.handleSpaceBreathing = (player, heroPower) => {
    if (abilityUtil.isEnabled(player, heroPower, "space_breathing")) {
        player.setTicksFrozen(0);

        if (player.getLevel().dimension.toString() !== 'minecraft:overworld' && player.getAirSupply() < 300) {
            player.setAirSupply(300);
        }
    }
};

global.handleFlightBoost = (player, heroPower) => {
    let flightBoostTicks = palladium.getProperty(player, "flight_boost_ticks") || 0;

    if (flightBoostTicks <= 0) {
        player.removeAttribute("palladium:flight_speed", "flight_boost");
    }

    if (abilityUtil.isEnabled(player, heroPower, "flight_boost")) {
        if (flightBoostTicks === 0) {
            player.level.spawnParticles("minecraft:poof", true, player.x, player.y, player.z, 0, 0, 0, 3, 0.1);
            player.level.spawnParticles("minecraft:flash", true, player.x, player.y, player.z, 0, 0, 0, 1, 0.1);
            player.level.spawnParticles("powerborne:white_boom", true, player.x, player.y, player.z, 0, 0, 0, 1, 0.1);
            global.sound(player, 'powerborne:flight_boost');
            player.sendData("screen_shake", { ticks: 10, base_intensity: 1, max_intensity: 2 });
            palladium.setProperty(player, "flight_boost_ticks", 200);
        }
    }

    if (flightBoostTicks !== 0) {
        if (flightBoostTicks > 0) {
            player.modifyAttribute("palladium:flight_speed", "flight_boost", 0.55, "addition");
            flightBoostTicks--;
            if (flightBoostTicks === 0) {
                player.removeAttribute("palladium:flight_speed", "flight_boost");
                flightBoostTicks = -100;
            }
        }
        else if (flightBoostTicks < 0) {
            flightBoostTicks++;
        }
        palladium.setProperty(player, "flight_boost_ticks", flightBoostTicks);
    }
};

EntityEvents.hurt(event => {
    const entity = event.entity;
    const source = event.source;
    const attacker = source.immediate;
    if (attacker) {
        if (abilityUtil.isEnabled(entity, "powerborne:sentry", "speed_trail")) {
            event.cancel();
        }
        if (abilityUtil.isEnabled(entity, "powerborne:superman", "speed_trail")) {
            event.cancel();
        }
        if (abilityUtil.isEnabled(entity, "powerborne:god_of_thunder", "god_mode") && entity.isSprinting()) {
            event.cancel();
        }
    }
});

global.clamp = (min, max, value) => Math.max(min, Math.min(value, max));

global.breakReplaceableInRadius = (level, player, ox, oy, oz, radius) => {
    if (!level || !player || radius <= 0) return;

    let r2 = radius * radius;
    let minX = Math.floor(ox - radius);
    let maxX = Math.floor(ox + radius);
    let minY = Math.floor(oy - radius);
    let maxY = Math.floor(oy + radius);
    let minZ = Math.floor(oz - radius);
    let maxZ = Math.floor(oz + radius);

    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            for (let z = minZ; z <= maxZ; z++) {
                let dx = x + 0.5 - ox;
                let dy = y + 0.5 - oy;
                let dz = z + 0.5 - oz;
                if (dx * dx + dy * dy + dz * dz > r2) continue;

                let block = level.getBlock(x, y, z);
                if (!block) continue;
                let id = String(block.id || '');
                if (id === 'minecraft:air' || id === 'minecraft:cave_air' || id === 'minecraft:void_air') continue;

                try {
                    if (!block.hasTag('powerborne:replaceable_plants')) continue;
                    level.destroyBlock(new $BlockPos(x, y, z), true, player);
                } catch (e) { }
            }
        }
    }
};

const URU_WEAPON_MODIFIER_ID = 'powerborne:uru_weapon_damage_atk_spd';
const URU_WEAPON_SPEEDS = {
    'powerborne:mjolnir': {
        baseTotalDamage: 9,
        baseSpeedOffset: 0
    },
    'powerborne:stormbreaker': {
        baseTotalDamage: 14,
        baseSpeedOffset: 0.4
    }
};

PlayerEvents.tick((event) => {
    const player = event.player;
    if (!player || !player.isAlive()) return;
    const weaponSpeed = URU_WEAPON_SPEEDS[player.getMainHandItem().id];
    if (!weaponSpeed) {
        player.removeAttribute('minecraft:generic.attack_speed', URU_WEAPON_MODIFIER_ID);
        return;
    }
    const totalDamage = player.getAttributeValue('minecraft:generic.attack_damage');
    let extra = totalDamage - weaponSpeed.baseTotalDamage;
    extra = global.clamp(0, 3, extra);
    const speedAdd = weaponSpeed.baseSpeedOffset + (extra / 3) * 0.6;
    if (speedAdd > 0) {
        player.modifyAttribute('minecraft:generic.attack_speed', URU_WEAPON_MODIFIER_ID, speedAdd, 'addition');
    } else {
        player.removeAttribute('minecraft:generic.attack_speed', URU_WEAPON_MODIFIER_ID);
    }
});

global.sound = (entity, soundId, volume, pitch, shift) => {
    if (shift === undefined) shift = 0.2;
    if (pitch === undefined) pitch = 1;
    if (volume === undefined) volume = 1;
    const { x, y, z } = entity;
    entity.getLevel().playSound(null, x, y, z, soundId, 'ambient', global.clamp(0.5, 2, volume), global.clamp(0.5, 2, pitch - shift / 2 + Math.random() * shift));
};

let $PlayerUtil = Java.loadClass('net.threetag.palladium.util.PlayerUtil');

global.playSoundLocal = function (player, sound, category, volume, pitch) {
    if (Platform.isForge()) {
        $PlayerUtil['playSound(net.minecraft.world.entity.player.Player,double,double,double,net.minecraft.sounds.SoundEvent,net.minecraft.sounds.SoundSource,float,float)'](
            player, player.x, player.y, player.z, sound, category, volume, pitch
        );
    } else {
        $PlayerUtil['playSound(net.minecraft.class_1657,double,double,double,net.minecraft.class_3414,net.minecraft.class_3419,float,float)'](
            player, player.x, player.y, player.z, sound, category, volume, pitch
        );
    }
}

global.playSoundToAll = function (entity, range, sound, category, volume, pitch) {
    if (Platform.isForge()) {
        $PlayerUtil['playSoundToAll(net.minecraft.world.level.Level,double,double,double,double,net.minecraft.sounds.SoundEvent,net.minecraft.sounds.SoundSource,float,float)'](
            entity.getLevel(), entity.x, entity.y, entity.z, range, sound, category, volume, pitch
        );
    } else {
        $PlayerUtil['playSoundToAll(net.minecraft.class_1937,double,double,double,double,net.minecraft.class_3414,net.minecraft.class_3419,float,float)'](
            entity.getLevel(), entity.x, entity.y, entity.z, range, sound, category, volume, pitch
        );
    }
}

global.getAbilityAnimationTicks = (entity, powerId, abilityKey, requireEnabled) => {
    let abilityInstance = abilityUtil.getInstance(entity, powerId, abilityKey);
    if (abilityInstance) {
        if (requireEnabled && !abilityInstance.isEnabled()) {
            return 0;
        }

        let valueProperty = abilityInstance.getEitherPropertyByKey("value");
        if (valueProperty) {
            return abilityInstance.getProperty(valueProperty);
        }
    }
    return 0;
};

global.createProjectile = (player, speed, nbtData, forwardOffset, heightOffset, entityType, owner) => {
    let projectileType = entityType || "palladium:custom_projectile";
    let projectile = player.block.createEntity(projectileType);
    if (!projectile) return null;
    let look = player.getLookAngle();
    let fwd = forwardOffset || 0;
    let baseY = (heightOffset === undefined || heightOffset === null) ? 1 : heightOffset;

    projectile.x = player.x + fwd * look.x();
    projectile.y = player.y + baseY + fwd * look.y();
    projectile.z = player.z + fwd * look.z();

    projectile.shootFromRotation(player, player.pitch, player.yaw, 0, speed, 0);
    if (nbtData) projectile.mergeNbt(nbtData);
    if (owner === undefined) {
        projectile.setOwner(player);
    } else if (owner !== null) {
        projectile.setOwner(owner);
    }
    return projectile;
};

let $ClipContext = Java.loadClass('net.minecraft.world.level.ClipContext')
let $ProjectileUtil = Java.loadClass('net.minecraft.world.entity.projectile.ProjectileUtil')

global.advancedRayTrace = (entity, level, distance, ignoreBlocks, lookRadius) => {
    lookRadius = lookRadius || 0;
    let eyePos = entity.eyePosition;
    let viewVec = entity.getViewVector(1)

    let blockHitDistance = distance;
    let blockHit = null;

    if (!ignoreBlocks) {
        let clip = new $ClipContext(
            entity.getEyePosition(1),
            entity.getEyePosition(1).add(entity.getLookAngle().scale(distance)),
            'collider', 'none',
            entity
        )
        blockHit = level.clip(clip)

        if (blockHit && blockHit.getBlockPos()) {
            let hitPos = blockHit.getLocation()
            blockHitDistance = eyePos.distanceTo(hitPos)
        }
    }

    let entityEndPos = eyePos.add(viewVec.x() * blockHitDistance, viewVec.y() * blockHitDistance, viewVec.z() * blockHitDistance)
    let aabb = AABB.of(eyePos.x(), eyePos.y(), eyePos.z(), entityEndPos.x(), entityEndPos.y(), entityEndPos.z())

    let entityHit = $ProjectileUtil.getEntityHitResult(level, entity, eyePos, entityEndPos, aabb, (e) => {
        return !e.isSpectator()
    }, lookRadius)

    if (entityHit != null && !ignoreBlocks) {
        let entityHitDistance = eyePos.distanceTo(entityHit.getLocation())
        if (entityHitDistance >= blockHitDistance) {
            entityHit = null
        }
    }

    return {
        block: blockHit && blockHit.getBlockPos() ? level.getBlock(blockHit.getBlockPos()) : null,
        entity: entityHit ? entityHit.entity : null
    }
}

ServerEvents.commandRegistry(event => {
    let commands = event.commands;
    let Commands = commands;
    let Arguments = event.arguments;

    let PROPERTY_BOUNDS = {
        'energy_bar_void': { min: 0, max: 200 },
        'energy_bar_lightning': { min: 0, max: 200 },
        'energy_bar_solar': { min: 0, max: 500 },
        'sentry_level': { min: 0, max: 10 },
        'sentry_xp': { min: 0, max: 9999 },
        'sentry_skill_points': { min: 0, max: 99 },
        'superman_level': { min: 0, max: 10 },
        'superman_xp': { min: 0, max: 9999 },
        'superman_skill_points': { min: 0, max: 99 },
        'thor_level': { min: 0, max: 10 },
        'thor_xp': { min: 0, max: 9999 },
        'thor_skill_points': { min: 0, max: 99 },
        'captain_america_level': { min: 0, max: 10 },
        'captain_america_xp': { min: 0, max: 9999 },
        'captain_america_skill_points': { min: 0, max: 99 },
        'god_mode_cooldown': { min: 0, max: 3600 },
        'storm_strike_cooldown': { min: 0, max: 3600 },
        'bifrost_cooldown': { min: 0, max: 3600 },
        "void_banishment_cooldown": { min: 0, max: 600 }
    };

    function clampValue(value, propertyName) {
        let bounds = PROPERTY_BOUNDS[propertyName];
        if (bounds && bounds.min !== undefined && bounds.max !== undefined) {
            return Math.max(bounds.min, Math.min(bounds.max, value));
        }
        return value;
    }

    let WORTHY_ADVANCEMENT = 'powerborne:worthiness/worthy';

    function toggleWorthyAdvancement(player) {
        if (player.isAdvancementDone(WORTHY_ADVANCEMENT)) {
            player.revokeAdvancement(WORTHY_ADVANCEMENT);
            return 'Removed worthy status from ' + player.name.string;
        }
        player.unlockAdvancement(WORTHY_ADVANCEMENT);
        return 'Granted worthy status to ' + player.name.string;
    }

    function getTargetPlayerOrSendFailure(ctx, argName) {
        try {
            return Arguments.PLAYER.getResult(ctx, argName);
        } catch (e) {
            let je = e.javaException !== undefined ? e.javaException : e;
            if (je && je.getClass) {
                ctx.source.sendFailure(Text.of(String(je.getMessage())));
                return null;
            }
            throw e;
        }
    }

    let getPropertySuggestions = function (context, builder) {
        for (let property in PROPERTY_BOUNDS) {
            builder.suggest(property);
        }
        return builder.buildFuture();
    };

    let getValueSuggestions = function (context, builder) {
        let propName = null;
        try {
            propName = Arguments.STRING.getResult(context, 'property');
        } catch (e) { }
        let targetForSuggest = null;
        try {
            targetForSuggest = Arguments.PLAYER.getResult(context, 'target');
        } catch (e2) { }
        if (propName && PROPERTY_BOUNDS[propName]) {
            let b = PROPERTY_BOUNDS[propName];
            builder.suggest(String(b.min));
            builder.suggest(String(b.max));
            try {
                let srcPlayer = targetForSuggest || context.source.player;
                if (srcPlayer) {
                    let cur = palladium.getProperty(srcPlayer, propName);
                    if (cur !== null && cur !== undefined) builder.suggest(String(cur));
                }
            } catch (e3) { }
        }
        return builder.buildFuture();
    };

    event.register(
        Commands.literal('powerborne')
            .requires(function (src) { return src.hasPermission(2); })
            .then(
                Commands.literal('remove_all_accessories')
                    .then(
                        Commands.argument('target', Arguments.PLAYER.create(event))
                            .executes(ctx => {
                                let targetPlayer = getTargetPlayerOrSendFailure(ctx, 'target');
                                if (!targetPlayer) return 0;

                                targetPlayer.persistentData.remove('unlockedAccessories');

                                $Accessory.getPlayerData(targetPlayer).ifPresent(accessoryData => {
                                    accessoryData.clear(targetPlayer);
                                });

                                updateSupporterHandlerData(targetPlayer);

                                ctx.source.playerOrException.tell('Removed all accessories for ' + targetPlayer.name.string);
                                return 1;
                            })
                    )
            )
            .then(
                Commands.literal('set_property')
                    .then(
                        Commands.argument('target', Arguments.PLAYER.create(event))
                            .then(
                                Commands.argument('property', Arguments.STRING.create(event))
                                    .suggests(getPropertySuggestions)
                                    .then(
                                        Commands.argument('value', Arguments.INTEGER.create(event))
                                            .suggests(getValueSuggestions)
                                            .executes(ctx => {
                                                let targetPlayer = getTargetPlayerOrSendFailure(ctx, 'target');
                                                if (!targetPlayer) return 0;
                                                let propertyName = Arguments.STRING.getResult(ctx, 'property');
                                                let value = Arguments.INTEGER.getResult(ctx, 'value');
                                                if (!PROPERTY_BOUNDS[propertyName]) {
                                                    let availableProps = [];
                                                    for (let prop in PROPERTY_BOUNDS) {
                                                        availableProps.push(prop);
                                                    }
                                                    ctx.source.playerOrException.tell('§cUnknown property ' + propertyName + '. Available: ' + availableProps.join(', '));
                                                    return 0;
                                                }
                                                let currentValue = palladium.getProperty(targetPlayer, propertyName);
                                                if (currentValue === null || currentValue === undefined) {
                                                    currentValue = 0;
                                                }
                                                let clampedValue = clampValue(value, propertyName);
                                                palladium.setProperty(targetPlayer, propertyName, clampedValue);
                                                let newValue = palladium.getProperty(targetPlayer, propertyName);
                                                let message = 'Set property ' + propertyName + ' for ' + targetPlayer.name.string + ' to ' + newValue;

                                                // Sync leveling properties (no effects for direct set)
                                                const heroNames = ['sentry', 'superman', 'thor', 'captain_america'];
                                                let synced = false;
                                                if (propertyName.endsWith('_xp')) {
                                                    const heroName = propertyName.slice(0, -3);
                                                    if (heroNames.includes(heroName)) {
                                                        global.levelingSystem.syncLevelFromXP(targetPlayer, heroName, false);
                                                        message += ' (synced level and skill points)';
                                                        synced = true;
                                                    }
                                                } else if (propertyName.endsWith('_level')) {
                                                    const heroName = propertyName.slice(0, -6);
                                                    if (heroNames.includes(heroName)) {
                                                        global.levelingSystem.internalSetSkillPoints(targetPlayer, heroName, newValue);
                                                        global.levelingSystem.syncXPFromLevel(targetPlayer, heroName);
                                                        message += ' (synced XP and skill points)';
                                                        synced = true;
                                                    }
                                                }

                                                ctx.source.playerOrException.tell(message);
                                                return 1;
                                            })
                                    )
                            )
                    )
            )
            .then(
                Commands.literal('add_xp')
                    .then(
                        Commands.argument('target', Arguments.PLAYER.create(event))
                            .then(
                                Commands.argument('hero', Arguments.STRING.create(event))
                                    .suggests((context, builder) => {
                                        ['sentry', 'superman', 'thor', 'captain_america'].forEach(hero => {
                                            builder.suggest(hero);
                                        });
                                        return builder.buildFuture();
                                    })
                                    .then(
                                        Commands.argument('amount', Arguments.INTEGER.create(event))
                                            .executes(ctx => {
                                                let targetPlayer = getTargetPlayerOrSendFailure(ctx, 'target');
                                                if (!targetPlayer) return 0;
                                                let heroName = String(Arguments.STRING.getResult(ctx, 'hero'));
                                                let amount = Arguments.INTEGER.getResult(ctx, 'amount');

                                                if (!['sentry', 'superman', 'thor', 'captain_america'].includes(heroName)) {
                                                    ctx.source.playerOrException.tell('§cInvalid hero: ' + heroName + '. Valid heroes: sentry, superman, thor, captain_america');
                                                    return 0;
                                                }

                                                let currentXP = global.levelingSystem.getXP(targetPlayer, heroName);
                                                let newXP = currentXP + amount;
                                                global.levelingSystem.setXP(targetPlayer, heroName, newXP);

                                                let displayName = heroName.charAt(0).toUpperCase() + heroName.slice(1);
                                                let action = amount >= 0 ? 'Added ' + amount : 'Removed ' + Math.abs(amount);
                                                ctx.source.playerOrException.tell(action + ' XP to ' + displayName + ' for ' + targetPlayer.name.string);
                                                return 1;
                                            })
                                    )
                            )
                    )
            )
            .then(
                Commands.literal('worthy')
                    .executes(ctx => {
                        let targetPlayer = ctx.source.player;
                        if (!targetPlayer) {
                            return 0;
                        }
                        let msg = toggleWorthyAdvancement(targetPlayer);
                        targetPlayer.tell(msg);
                        return 1;
                    })
                    .then(
                        Commands.argument('target', Arguments.PLAYER.create(event))
                            .executes(ctx => {
                                let targetPlayer = getTargetPlayerOrSendFailure(ctx, 'target');
                                if (!targetPlayer) return 0;
                                let msg = toggleWorthyAdvancement(targetPlayer);
                                let sourcePlayer = ctx.source.player;
                                if (sourcePlayer) {
                                    sourcePlayer.tell(msg);
                                } else {
                                    console.info('[powerborne worthy] ' + msg);
                                }
                                return 1;
                            })
                    )
            )
    );
});

global.hasLockArmorEnabled = (player) => {
    if (player.isCreative()) return false;
    const powers = [
        "powerborne:god_of_thunder",
        "powerborne:superman",
        "powerborne:sentry",
        "powerborne:void"
    ];
    return powers.some(power => abilityUtil.isEnabled(player, power, "lock_armor"));
};

let $ScaleTypes = null
if (Platform.isLoaded("pehkui")) {
    $ScaleTypes = Java.loadClass("virtuoel.pehkui.api.ScaleTypes");
}
const PEHKUI_SCALE_MAP = {
    "pehkui:motion": $ScaleTypes.MOTION,
    "pehkui:falling": $ScaleTypes.FALLING,
    "pehkui:height": $ScaleTypes.HEIGHT,
    "pehkui:defense": $ScaleTypes.DEFENSE,
};

global.setPehkuiScale = (player, scaleTypes) => {
    Object.keys(scaleTypes).forEach(scaleType => {
        let scaleTypeObj = PEHKUI_SCALE_MAP[scaleType];
        if (scaleTypeObj) {
            scaleTypeObj.getScaleData(player).setScale(scaleTypes[scaleType]);
        }
    });
};

global.getPehkuiScale = (player, scaleType) => {
    try {
        let scaleTypeObj = PEHKUI_SCALE_MAP[scaleType];
        if (scaleTypeObj) {
            return scaleTypeObj.getScaleData(player).getScale();
        }
        return 1.0;
    } catch (e) {
        return 1.0;
    }
};