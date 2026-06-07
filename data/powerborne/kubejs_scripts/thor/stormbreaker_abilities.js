const STORMBREAKER_ID = 'powerborne:stormbreaker';
const STORMBREAKER_POWER = 'powerborne:god_of_thunder';
const STORMBREAKER_DAMAGE = 20;
const STORMBREAKER_SPEED = 2.8;

function copyStormbreakerItemData(itemstack) {
    if (!itemstack || itemstack.isEmpty()) return { id: STORMBREAKER_ID, Count: 1, tag: { Unbreakable: 1, RepairCost: Integer.valueOf("2147483647") } };
    
    let itemData = { id: String(itemstack.id), Count: 1 };
    
    if (itemstack.nbt) {
        itemData.tag = itemstack.nbt;
    } else {
        itemData.tag = {};
    }
    
    itemData.tag.Unbreakable = 1;
    itemData.tag.RepairCost = Integer.valueOf("2147483647");
    
    return itemData;
}

function snapshotStormbreakerDataForPlayer(itemData) {
    let safe = { id: STORMBREAKER_ID, Count: 1 };
    if (!itemData) return safe;
    safe.id = String(itemData.id || STORMBREAKER_ID);
    safe.Count = itemData.Count ?? 1;
    let sourceTag = itemData.tagSnbt ? itemData.tagSnbt : itemData.tag;
    if (sourceTag !== undefined && sourceTag !== null) {
        try { safe.tagSnbt = String(sourceTag); } catch (_) {}
    }
    return safe;
}

function createStormbreakerItemFromSavedData(itemData) {
    if (!itemData) return Item.of(STORMBREAKER_ID);
    if (itemData.tagSnbt) return Item.of(itemData.id, String(itemData.tagSnbt));
    if (itemData.tag) return Item.of(itemData.id, itemData.tag);
    return Item.of(itemData.id);
}

function giveSavedStormbreakerToPlayer(player, itemData) {
    let item = createStormbreakerItemFromSavedData(itemData);
    if (player.getMainHandItem().isEmpty()) player.setMainHandItem(item);
    else if (!player.inventory.add(item)) player.drop(item, true);
    global.playSoundLocal(player, 'powerborne:mjolnir_grab', 'players', 1, 1);
}

function spawnStormbreakerStandAt(level, x, y, z, ownerUsername, playerForList, savedItem) {
    let itemForHand = savedItem || { id: STORMBREAKER_ID, Count: 1 };

    let armorStand = level.createEntity('minecraft:armor_stand');
    armorStand.x = x;
    armorStand.y = y - 0.6;
    armorStand.z = z;
    armorStand.mergeNbt({
        Invisible: 1,
        NoBasePlate: 1,
        Small: 1,
        DisabledSlots: 4144959,
        Pose: { RightArm: [92.0, 90.0, 0.0] },
        CustomName: '{"text":"Stormbreaker"}',
        HandItems: [itemForHand, {}],
        Tags: ["powerborne.stormbreaker", `powerborne.stormbreaker_${ownerUsername}`],
        "pehkui:scale_data_types": {
            "pehkui:interaction_box_height": { "scale": 0.1 },
        }
    });
    armorStand.spawn();

    let interaction = level.createEntity('minecraft:interaction');
    interaction.x = x;
    interaction.y = y - 0.6;
    interaction.z = z;
    interaction.mergeNbt({
        height: -0.75,
        width: 1.25,
        Tags: ["powerborne.stormbreaker", `powerborne.stormbreaker_${ownerUsername}`]
    });
    interaction.spawn();
    interaction.startRiding(armorStand);

    // Reuse mjolnirStandList — weapon-agnostic, tracks stand UUIDs only
    if (playerForList) {
        mjolnirStandList.add(playerForList, armorStand.uuid.toString());
    } else if (ownerUsername !== "unknown" && level.getServer()) {
        let player = level.getServer().getPlayerList().getPlayerByName(ownerUsername);
        if (player && player.isAlive()) {
            mjolnirStandList.add(player, armorStand.uuid.toString());
        }
    }
}

function recoverStormbreakerStandsForPlayer(player) {
    let knownIds = new Set(mjolnirStandList.getUUIDs(player));
    let tag = "powerborne.stormbreaker_" + player.username;
    player.level.getEntities().forEach(e => {
        if (
            e &&
            e.type === "minecraft:armor_stand" &&
            e.isAlive() &&
            e.getTags().contains(tag) &&
            !knownIds.has(e.uuid.toString())
        ) {
            mjolnirStandList.add(player, e.uuid.toString());
        }
    });
}

PlayerEvents.loggedIn(event => recoverStormbreakerStandsForPlayer(event.player));
PlayerEvents.respawned(event => recoverStormbreakerStandsForPlayer(event.player));
LevelEvents.loaded(event => {
    let players = event.level.players;
    if (players) players.forEach(player => recoverStormbreakerStandsForPlayer(player));
});

EntityEvents.spawned('minecraft:item', event => {
    let itemEntity = event.entity;
    let itemStack = itemEntity.item;
    if (itemStack.id !== STORMBREAKER_ID) return;

    if (!itemEntity.owner && (!itemStack.nbt || !itemStack.nbt.getBoolean('Unbreakable'))) return;

    let ownerUsername = itemEntity.persistentData.StormbreakerOwner ||
        (itemEntity.owner ? itemEntity.owner.username : "unknown");
    let saved = copyStormbreakerItemData(itemStack);

    spawnStormbreakerStandAt(
        itemEntity.level,
        itemEntity.x, itemEntity.y, itemEntity.z,
        ownerUsername,
        itemEntity.owner || null,
        saved
    );
    event.cancel();
});

EntityEvents.death(event => {
    const source = event.source;
    let projectile = source ? source.immediate : null;
    if (!projectile || projectile.type !== 'palladium:custom_projectile')
        projectile = source ? source.actual : null;

    if (
        projectile &&
        projectile.type === 'palladium:custom_projectile' &&
        projectile.getTags &&
        projectile.getTags().contains('powerborne.stormbreaker_projectile') &&
        !projectile.getTags().contains('powerborne.stormbreaker_lightning')
    ) {
        const owner = projectile.getOwner();
        if (owner && abilityUtil.hasPower(owner, STORMBREAKER_POWER)) {
            global.levelingSystem.awardXPForAbility(owner, STORMBREAKER_POWER, "stormbreaker_use");
        }
        return;
    }
});

EntityEvents.death(event => {
    const entity = event.entity;
    if (!entity.isPlayer()) return;
    const gameRules = event.server.getOverworld().getGameRules();
    if (gameRules.get("keepInventory").get()) return;
    entity.inventory.items.forEach(item => {
        if (item.id === STORMBREAKER_ID) {
            let toDrop = item.copy();
            item.shrink(1);
            entity.drop(toDrop, true);
        }
    });
});

function tryPickupStormbreaker(player, target) {
    if (!target) return false;
    if (target.getType() != "minecraft:interaction") return false;
    if (!target.getTags().contains("powerborne.stormbreaker")) return false;

    let isUnclaimed = target.getTags().contains("powerborne.stormbreaker_unknown");

    if (!isUnclaimed && !target.getTags().contains(`powerborne.stormbreaker_${player.username}`)) {
        player.sendData('status_message', { message: 'messages.powerborne.not_owned_weapon' });
        return false;
    }

    let stand = target.getVehicle();
    if (stand) {
        mjolnirStandList.remove(player, stand.uuid.toString());
        let hand = stand.getMainHandItem ? stand.getMainHandItem() : null;
        if (hand && !hand.isEmpty()) {
            let toGive = hand.copy();
            if (player.getMainHandItem().isEmpty()) player.setMainHandItem(toGive);
            else if (!player.inventory.add(toGive)) player.drop(toGive, true);
            global.playSoundLocal(player, 'powerborne:mjolnir_grab', 'players', 1, 1);
        } else {
            giveSavedStormbreakerToPlayer(player, { id: STORMBREAKER_ID, Count: 1 });
        }
        stand.kill();
    }
    target.kill();
    return true;
}

function createStormbreakerProjectile(player, savedItem, lightningMode) {
    let spawnY = player.y + (player.isCrouching() ? 0.6 : 1);

    let projectile = player.level.createEntity('palladium:custom_projectile');
    projectile.setOwner(player);
    projectile.x = player.x;
    projectile.y = spawnY;
    projectile.z = player.z;

    projectile.shootFromRotation(player, player.pitch, player.yaw, 0, STORMBREAKER_SPEED, 0);

    if (!player.onGround()) {
        let em = player.getDeltaMovement();
        projectile.addMotion(0, -em.y(), 0);
    }

    projectile.addTag("powerborne.stormbreaker_projectile");
    if (lightningMode) {
        projectile.addTag("powerborne.stormbreaker_lightning");
    }

    let kubePersistent = {
        "ReturnTicks": 0,
        "OwnerUsername": player.username,
        "LastX": player.x,
        "LastY": spawnY,
        "LastZ": player.z
    };
    if (savedItem) kubePersistent.SavedStormbreakerItem = savedItem;

    let appearances = [{ "Type": "renderLayer", "RenderLayer": "powerborne:stormbreaker_item" }];
    if (lightningMode) {
        appearances.push({ "Type": "trail", "Trail": "powerborne:stormbreaker_lightning_trail" });
    }

    projectile.mergeNbt({
        "Damage": 0,
        "Gravity": 0.01,
        "DieOnEntityHit": false,
        "DieOnBlockHit": false,
        "Size": 0.5,
        "Lifetime": 99999,
        "PreventShooterInteraction": 1,
        "CommandOnBlockHit": lightningMode
            ? "function powerborne:mjolnir_lightning_strike"
            : "data merge entity @s {KubeJSPersistentData:{ReturnTicks:1}}",
        "CommandOnEntityHit": lightningMode
            ? "summon lightning_bolt ~ ~ ~"
            : "",
        "KubeJSPersistentData": kubePersistent,
        "Appearances": appearances,
        "CustomName": '{"text":"' + player.username + '\'s Stormbreaker"}'
    });

    projectile.spawn();

    // Spawn stand passenger
    let stand = player.level.createEntity('minecraft:armor_stand');
    stand.x = player.x;
    stand.y = spawnY;
    stand.z = player.z;
    stand.mergeNbt({
        "Invisible": 1,
        "NoBasePlate": 1,
        "Small": 0,
        "Marker": 1,
        "NoGravity": 1,
        "Invulnerable": 1,
        "Silent": 1,
        "DisabledSlots": 4144959,
        "Rotation": [player.yaw, player.pitch],
        "Tags": ["powerborne.stormbreaker_stand_passenger"],
        "Palladium": {
            "Powers": {
                "powerborne:stormbreaker_stand": {
                    "display": {},
                    "_EnergyBars": {},
                    "stand_spin": {}
                }
            },
            "Properties": {
                "superpowers": ["powerborne:stormbreaker_stand"],
                "stand_suit_variant": "null"
            }
        }
    });
    stand.spawn();
    stand.startRiding(projectile);

    return projectile;
}

function throwStormbreaker(itemstack, player) {
    let savedItem = copyStormbreakerItemData(itemstack);
    itemstack.shrink(1);

    let lightningMode = abilityUtil.isEnabled(player, STORMBREAKER_POWER, "god_mode");
    createStormbreakerProjectile(player, savedItem, lightningMode);

    player.persistentData.StormbreakerThrownItem = snapshotStormbreakerDataForPlayer(savedItem);

    global.sound(player, 'powerborne:mjolnir_throw', 0.8, 0.8, 0.15);
    player.swing();
    player.addItemCooldown(STORMBREAKER_ID, 30);
}

PlayerEvents.tick(event => {
    const player = event.player;
    if (!abilityUtil.hasPower(player, STORMBREAKER_POWER)) return;

    let abilityInstance = abilityUtil.getInstance(player, STORMBREAKER_POWER, "stormbreaker_use");
    if (!abilityInstance) return;

    let animationTicks = global.getAbilityAnimationTicks(player, STORMBREAKER_POWER, "stormbreaker_use", true);
    let isEnabled = abilityInstance.isEnabled();
    let item = player.mainHandItem;
    let hasStormbreaker = item && !item.isEmpty() && item.id === STORMBREAKER_ID;
    let isFlying = abilityUtil.isEnabled(player, STORMBREAKER_POWER, "is_flying");
    let isFastFlying = abilityUtil.isEnabled(player, STORMBREAKER_POWER, "is_fast_flying");
    let isFlightUnlocked = global.isAbilityUnlockedOrAutoMaxed(player, STORMBREAKER_POWER, "flight_buy");
    let handler = player.palladium$getFlightHandler();
    let wasFlyingLastTick = handler && handler.prevFlightBoost > 0;

    if (isEnabled && hasStormbreaker) {
        global.setPehkuiScale(player, {
            "pehkui:motion": 0.8
        });
        if (abilityUtil.isEnabled(player, STORMBREAKER_POWER, "is_hovering_or_flying")) {
            global.setPehkuiScale(player, {
                "pehkui:motion": 1.0
            });
        }
        player.persistentData.StormbreakerHoldTicks = animationTicks;
        return;
    }

    if (!isEnabled) {
        let aimTicks = player.persistentData.StormbreakerHoldTicks || 0;
        if (aimTicks > 0) {
            global.setPehkuiScale(player, {
                "pehkui:motion": 1.0
            });
        }
        if (aimTicks > 4 && hasStormbreaker) {
            let suppressThrowForFlight =
                (isFlying && !wasFlyingLastTick && !isFlightUnlocked) || isFastFlying;
            if (!suppressThrowForFlight) {
                throwStormbreaker(item, player);
            }
        }
        player.persistentData.StormbreakerHoldTicks = 0;
    }
});
