let Creeper = Java.loadClass('net.minecraft.world.entity.monster.Creeper')
let Goal = Java.loadClass('net.minecraft.world.entity.ai.goal.Goal');
let FlyingMob = Java.loadClass('net.minecraft.world.entity.FlyingMob');
let FlyingMoveControl = Java.loadClass('net.minecraft.world.entity.ai.control.FlyingMoveControl')
let $ScaleTypes = null
if (Platform.isLoaded("pehkui")) {
  $ScaleTypes = Java.loadClass("virtuoel.pehkui.api.ScaleTypes");
}
let $ParticleTypes = Java.loadClass("net.minecraft.core.particles.ParticleTypes")
let $BlockParticleOption = Java.loadClass('net.minecraft.core.particles.BlockParticleOption');

let speedModifierUUID = 'e0f4e796-3d3d-11ee-be56-0242ac183754';
let jumpModifierUUID = 'f2a5b7e8-3d3d-11ee-be56-0242ac183754';
let knockbackModifierUUID = '0198b7e1-30be-74c9-83d3-ea42d95ba32a';
let flightModifierUUID = '01989fed-4513-70bd-9edb-29861fe2966c';

StartupEvents.registry('mob_effect', event => {
    event.create('powerborne:kryptonite_poisoning')
        .effectTick((entity, lvl) => global.kryptonitePoison(entity, lvl))
        .modifyAttribute('minecraft:generic.movement_speed', speedModifierUUID, -0.35, "multiply_base")
        .modifyAttribute('palladium:flight_speed', flightModifierUUID, -10.0, "multiply_base")
        .modifyAttribute('palladium:jump_power', jumpModifierUUID, -0.1, "multiply_base")
        .color(Color.GREEN)
        .harmful();
    event.create('powerborne:solar_exhaustion')
        .effectTick((entity, lvl) => global.solarExhaustionEffectTick(entity, lvl))
        .color(0x815708)
        .modifyAttribute('minecraft:generic.movement_speed', speedModifierUUID, -0.5, "multiply_base")
        .modifyAttribute('palladium:flight_speed', flightModifierUUID, -10.0, "multiply_base")
        .modifyAttribute('palladium:jump_power', jumpModifierUUID, -0.1, "multiply_base")
        .harmful();
    event.create('powerborne:solar_ascension')
        .color(0xA58900)
        .beneficial();
    event.create('powerborne:void_banishment')
        .color(0x131313)
        .effectTick((entity, lvl) => global.voidBanishmentEffectTick(entity, lvl))
        .harmful();
    event.create('powerborne:void')
        .effectTick((entity, lvl) => global.voidEffectTick(entity, lvl))
        .color(Color.BLACK)
        .harmful();
});

global.voidEffectTick = (entity, lvl) => {
    if (entity.getLevel().clientSide) return;
    let effect = entity.getEffect("powerborne:void");
    if (Platform.isForge()) effect.setCurativeItems([]);
}

global.kryptonitePoison = (entity, lvl) => {
    if (entity.getLevel().clientSide) return;
    let effect = entity.getEffect("powerborne:kryptonite_poisoning");
    if (Platform.isForge()) effect.setCurativeItems([]);;
    entity.potionEffects.add('minecraft:poison', 10, lvl - 1, false, false);
    entity.potionEffects.add('minecraft:weakness', 10, lvl - 1, false, false);
    entity.potionEffects.add('minecraft:slowness', 10, lvl - 1, false, false);
}

global.solarExhaustionEffectTick = (entity, lvl) => {
    if (entity.getLevel().clientSide) return;
    let effect = entity.getEffect("powerborne:solar_exhaustion");
    if (Platform.isForge()) effect.setCurativeItems([]);;
    entity.potionEffects.add('minecraft:weakness', 10, lvl, false, false);
    entity.potionEffects.add('minecraft:slowness', 10, lvl - 1, false, false);
}
StartupEvents.registry('mob_effect', event => {
    event.create('powerborne:frozen')
        .harmful()
        .color(0xbcdeff)
        .effectTick((entity, lvl) => {
            global.frozenEffectTick(entity, lvl);
        })
        .modifyAttribute('minecraft:generic.movement_speed', speedModifierUUID, -0.5, "multiply_base")
        .modifyAttribute('minecraft:generic.knockback_resistance', knockbackModifierUUID, 0.9, "addition")

})

global.entitiesWithFrozenEffect = new Set();
global.entitiesWithVoidEffect = new Set();

let DyeColor = Java.loadClass('net.minecraft.world.item.DyeColor');

global.voidBanishmentEffectTick = (entity, lvl) => {
    if (!entity.isAlive()) return;
    if (entity.type == "minecraft:area_effect_cloud") return;

    if (!entity.getLevel().clientSide) {
        global.entitiesWithVoidEffect.add(String(entity.uuid.toString()));
        let effect = entity.getEffect("powerborne:void_banishment");
        if (Platform.isForge()) effect.setCurativeItems([]);
        if (!effect) return;

        let duration = effect.getDuration();
        let progress = Math.min(duration, 50) / 50;
        let speedModifier = -1.0 * progress;
        if (entity.getLevel().dimension.toString() !== 'powerborne:void_dimension') {
            entity.modifyAttribute('minecraft:generic.movement_speed', speedModifierUUID, speedModifier, "multiply_base");
        }
        if (duration >= 50 && !entity.isPlayer()) {
            entity.setNoAi(true);
            entity.setSilent(true);
            entity.setInvulnerable(true);
            entity.setYaw(0);
            entity.setPitch(0);
            if (entity.isOnFire()) entity.remainingFireTicks = 0;

            let noSleepModels = ["minecraft:cow", "minecraft:sheep", "minecraft:pig",
                "minecraft:horse", "minecraft:donkey", "minecraft:mule", "minecraft:llama",
                "minecraft:trader_llama", "minecraft:mooshroom", "minecraft:wolf",
                "minecraft:fox", "minecraft:polar_bear", "minecraft:camel", "minecraft:goat",
                "minecraft:spider", "minecraft:cave_spider", "minecraft:phantom", "minecraft:ravager",
                "minecraft:axolotl", "minecraft:chicken"];
            $ScaleTypes.HEIGHT.getScaleData(entity).setScale(0.015);
            if (!noSleepModels.includes(entity.getType())) {
                entity.setPose('sleeping');
            }

            if (!abilityUtil.hasPower(entity, "powerborne:shadow")) {
                superpowerUtil.addSuperpower(entity, "powerborne:shadow");
            }

            if (entity.getType() == 'minecraft:sheep') {
                entity.setColor(DyeColor.BLACK)
            }

            if (!entity.persistentData.getBoolean('powerborne_void_equipment_saved')) {
                let any = false;
                let slots = ['mainhand', 'offhand', 'head', 'chest', 'legs', 'feet'];
                slots.forEach(slot => {
                    try {
                        let stack = entity.getEquipment(slot);
                        if (stack && String(stack.id) !== 'minecraft:air') {
                            entity.persistentData.put(`powerborne_void_${slot}`, stack);
                            any = true;
                        }
                    } catch (e) { }
                });
                if (any) {
                    entity.persistentData.putBoolean('powerborne_void_equipment_saved', true);
                    entity.setItemSlot('mainhand', Item.of('minecraft:air'));
                    entity.setItemSlot('offhand', Item.of('minecraft:air'));
                    entity.setItemSlot('head', Item.of('minecraft:air'));
                    entity.setItemSlot('chest', Item.of('minecraft:air'));
                    entity.setItemSlot('legs', Item.of('minecraft:air'));
                    entity.setItemSlot('feet', Item.of('minecraft:air'));
                }
            }
        }
    }
}

global.frozenEffectTick = (entity, lvl) => {
    if (entity.getLevel().clientSide) return;
    if (!entity.isAlive()) return;
    if (entity.type == "minecraft:area_effect_cloud") return;

    let effect = entity.getEffect("powerborne:frozen");
    if (!effect) return;
    let duration = effect.getDuration();

    global.entitiesWithFrozenEffect.add(String(entity.uuid.toString()));
    if (!superpowerUtil.hasSuperpower(entity, "powerborne:frozen_entity")) {
        superpowerUtil.addSuperpower(entity, "powerborne:frozen_entity");
    }

    if (entity.isPlayer()) {
        if (Platform.isForge()) effect.setCurativeItems([]);

        if (superpowerUtil.hasSuperpower(entity, "powerborne:afrozen")) {
            if (entity.swinging && entity.swingTime == -1) {
                let damage = entity.getAttributeValue("generic.attack_damage");
                let currentDuration = effect.getDuration();
                if (currentDuration > 1) {
                    entity.removeEffect("powerborne:frozen");
                    entity.potionEffects.add("powerborne:frozen", currentDuration - (20 * damage), 0, false, true);
                    entity.getLevel().playSound(null, entity.x, entity.y, entity.z, 'minecraft:block.glass.hit', 'players', 1.0, 1.0);
                } else {
                    entity.removeEffect("powerborne:frozen");
                }
            }
        }
    } else {
        let hasIceDisplay = entity.passengers.some(p =>
            p.type === 'minecraft:block_display' &&
            p.getTags().contains('powerborne.frozen_ice_display') &&
            p.isAlive()
        );

        if (hasIceDisplay && entity.goalSelector) {
            let goalFlags = Platform.isForge() ? Goal.Flag : Goal.Control;
            [goalFlags.MOVE, goalFlags.LOOK, goalFlags.TARGET, goalFlags.JUMP].forEach(flag =>
                Platform.isForge() ? entity.goalSelector.disableControlFlag(flag) : entity.goalSelector.disableControl(flag)
            );
        }
    }

    if (duration >= 100) {
        entity.modifyAttribute('minecraft:generic.movement_speed', speedModifierUUID, -1, "multiply_base");
        entity.modifyAttribute('palladium:jump_power', jumpModifierUUID, -1, "multiply_base");

        let currentTicksFrozen = entity.getTicksFrozen() || 0;
        if (currentTicksFrozen < 141) {
            entity.setTicksFrozen(1000);
            if (entity.isPlayer()) {
                superpowerUtil.addSuperpower(entity, "powerborne:afrozen");
                if (entity.isOnFire()) entity.remainingFireTicks = 0;
            } else {
                if (entity.isOnFire()) entity.remainingFireTicks = 0;
                if (entity instanceof FlyingMob || entity.getMoveControl() instanceof FlyingMoveControl) {
                    entity.setNoAi(true);
                }
            }
        }

        if (entity.target) entity.setTarget(null);
        if (entity instanceof Creeper) {
            entity.setSwellDir(-1);
        }

        let createIceDisplay = (targetEntity) => {
            let width = Math.round((targetEntity.getBbWidth() + 0.5) * 100) / 100;
            let height = Math.round((targetEntity.getBbHeight() + 0.5) * 100) / 100;
            let targetScale = [width, height, width];
            let targetTranslation = [-width / 2, height - (height * 1.7), -width / 2];
            let initialTranslation = [0, (height - (height * 1.7)) + height / 2, 0];

            let iceDisplay = targetEntity.getLevel().createEntity('minecraft:block_display');
            iceDisplay.addTag('powerborne.frozen_ice_display');
            iceDisplay.x = targetEntity.x;
            iceDisplay.y = targetEntity.y;
            iceDisplay.z = targetEntity.z;

            iceDisplay.mergeNbt({
                "block_state": { "Name": "minecraft:ice" },
                "interpolation_duration": 5,
                "transformation": {
                    "left_rotation": [0.0, 0.0, 0.0, 1.0],
                    "right_rotation": [0.0, 0.0, 0.0, 1.0],
                    "scale": [0.01, 0.01, 0.01],
                    "translation": initialTranslation
                }
            });

            return {
                entity: iceDisplay,
                targetScale: targetScale,
                targetTranslation: targetTranslation
            };
        };

        let topEntity = entity;
        while (topEntity.vehicle && topEntity.vehicle.isAlive()) {
            topEntity = topEntity.vehicle;
        }

        let entitiesToProcess = [];
        let collectEntitiesWithFrozenEffect = (currentEntity) => {
            if (currentEntity.isAlive() && currentEntity.getEffect("powerborne:frozen")) {
                entitiesToProcess.push(currentEntity);
                currentEntity.passengers.forEach(passenger => {
                    if (passenger.type !== 'minecraft:block_display') {
                        collectEntitiesWithFrozenEffect(passenger);
                    }
                });
            }
        };

        collectEntitiesWithFrozenEffect(topEntity);

        entitiesToProcess.forEach(entityToProcess => {
            if (entityToProcess.isPlayer()) return;
            if (entityToProcess.type.toString().includes('monsterexpansion')) return;

            let hasNonDisplayPassengers = entityToProcess.passengers.some(p => p.type !== 'minecraft:block_display');

            if (!hasNonDisplayPassengers) {
                let iceDisplayExists = entityToProcess.passengers.some(p => p.type === 'minecraft:block_display' && p.getTags().contains('powerborne.frozen_ice_display') && p.isAlive());

                if (!iceDisplayExists) {
                    let result = createIceDisplay(entityToProcess);
                    let iceDisplay = result.entity;
                    iceDisplay.spawn();
                    global.entitiesWithFrozenEffect.add(String(iceDisplay.uuid.toString()));
                    iceDisplay.startRiding(entityToProcess);

                    entityToProcess.server.scheduleInTicks(1, () => {
                        if (iceDisplay.isAlive()) {
                            iceDisplay.mergeNbt({
                                "start_interpolation": 0,
                                "transformation": {
                                    "left_rotation": [0.0, 0.0, 0.0, 1.0],
                                    "right_rotation": [0.0, 0.0, 0.0, 1.0],
                                    "scale": result.targetScale,
                                    "translation": result.targetTranslation
                                }
                            });
                        }
                    });
                }
            }
        });
    }
}

global.spawnIceBreakEffect = (entity) => {
    const centerX = entity.x;
    const centerY = entity.y + (entity.getBbHeight() / 2);
    const centerZ = entity.z;
    const deltaX = entity.getBbWidth() / 4;
    const deltaY = entity.getBbHeight() / 5;
    const deltaZ = entity.getBbWidth() / 4;

    const volume = entity.getBbWidth() * entity.getBbHeight() * entity.getBbWidth();
    const particleCount = Math.min(300, Math.max(50, Math.round(volume * 20)));

    entity.getLevel().sendParticles(new $BlockParticleOption($ParticleTypes.BLOCK, Blocks.ICE.defaultBlockState()), centerX, centerY, centerZ, particleCount, deltaX, deltaY, deltaZ, 0.15);
    entity.getLevel().playSound(null, entity.x, entity.y, entity.z, 'minecraft:block.glass.break', 'players', 1.0, 1.0);
};

let $ResourceKey = Java.loadClass("net.minecraft.resources.ResourceKey")
let DAMAGE_TYPE = $ResourceKey.createRegistryKey("damage_type")

global.getDamageSource = (level, damageType) => {
    const resourceKey = $ResourceKey.create(DAMAGE_TYPE, Utils.id(damageType));
    const holder = level.registryAccess().registryOrThrow(DAMAGE_TYPE).getHolderOrThrow(resourceKey);
    return new DamageSource(holder);
};

