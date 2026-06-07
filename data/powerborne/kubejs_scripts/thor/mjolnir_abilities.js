const calculateMjolnirStats = (chargeTime) => {
    const chargePower = Math.min(Math.max(Math.floor(chargeTime / 2), 8), 16);
    const damage = chargePower;
    const speed = 1.0 + (chargePower / 20) * 2.26;

    return { chargePower: chargePower, damage: damage, speed: speed };
};

const getThrowMode = (player) => {
    return parseInt(palladium.getProperty(player, 'mjolnir_throw_mode') || 0);
};

const MJOLNIR_ID = 'powerborne:mjolnir';

function copyMjolnirItemData(itemstack) {
    if (!itemstack || itemstack.isEmpty()) return { id: MJOLNIR_ID, Count: 1, tag: { Unbreakable: 1, RepairCost: Integer.valueOf("2147483647") } };
    
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

function snapshotMjolnirDataForPlayer(itemData) {
    let safe = { id: MJOLNIR_ID, Count: 1 };
    if (!itemData) return safe;
    safe.id = String(itemData.id || MJOLNIR_ID);
    safe.Count = itemData.Count ?? 1;
    let sourceTag = itemData.tagSnbt ? itemData.tagSnbt : itemData.tag;
    if (sourceTag !== undefined && sourceTag !== null) {
        try { safe.tagSnbt = String(sourceTag); } catch (_) { }
    }
    return safe;
}

function createMjolnirItemFromSavedData(itemData) {
    if (!itemData) return Item.of(MJOLNIR_ID);
    if (itemData.tagSnbt) return Item.of(itemData.id, String(itemData.tagSnbt));
    if (itemData.tag) return Item.of(itemData.id, itemData.tag);
    return Item.of(itemData.id);
}

function giveSavedMjolnirToPlayer(player, itemData) {
    let item = createMjolnirItemFromSavedData(itemData);
    if (player.getMainHandItem().isEmpty()) player.setMainHandItem(item);
    else if (!player.inventory.add(item)) player.drop(item, true);
    global.playSoundLocal(player, 'powerborne:mjolnir_grab', 'players', 1, 1);
}

global.copyMjolnirItemData = copyMjolnirItemData;
global.snapshotMjolnirDataForPlayer = snapshotMjolnirDataForPlayer;
global.createMjolnirItemFromSavedData = createMjolnirItemFromSavedData;
global.giveSavedMjolnirToPlayer = giveSavedMjolnirToPlayer;

global.createMjolnirItem = () => Item.of('powerborne:mjolnir', { Unbreakable: 1, RepairCost: Integer.valueOf("2147483647") });
global.giveMjolnirToPlayer = (player) => {
    if (player.getMainHandItem().isEmpty()) {
        player.setMainHandItem(global.createMjolnirItem());
    } else if (!player.inventory.add(global.createMjolnirItem())) {
        player.drop('powerborne:mjolnir', true);
    }
    global.playSoundLocal(player, 'powerborne:mjolnir_grab', 'players', 1, 1);
};
global.calculateMjolnirDamage = (chargeTime) => Math.min(Math.max(Math.floor(chargeTime / 2), 8), 16);

const createMjolnirProjectile = (player, config) => {
    if (!config) config = {};

    const x = config.x || player.x;
    const y = config.y || (player.y + (player.isCrouching() ? 0.6 : 1));
    const z = config.z || player.z;
    const chargeTime = config.chargeTime || 0;
    const throwMode = config.throwMode || 0;
    const playerRide = config.playerRide || false;
    const customNbt = config.customNbt || {};
    const savedMjolnirItem = config.savedMjolnirItem;

    const stats = calculateMjolnirStats(chargeTime);

    let projectile = player.level.createEntity('palladium:custom_projectile');
    projectile.setOwner(player);
    projectile.x = x;
    projectile.y = y;
    projectile.z = z;

    projectile.shootFromRotation(player, player.pitch, player.yaw, 0, stats.speed, 0);
    if (!player.onGround()) {
        let entityMotion = player.getDeltaMovement();
        projectile.addMotion(0, -entityMotion.y(), 0);
    }

    projectile.persistentData.ChargeTime = chargeTime;
    projectile.addTag("powerborne.mjolnir_projectile");
    if (playerRide) {
        projectile.addTag("powerborne.mjolnir_jump");
    }

    let appearances = [{
        "Type": "renderLayer",
        "RenderLayer": "powerborne:mjolnir_item"
    }];

    if (throwMode === 1 || throwMode === 2) { // Lightning or Jump mode
        appearances.push({
            "Type": "trail",
            "Trail": "powerborne:lightning_trail"
        });
    }

    let kubePersistent = {
        "ReturnTicks": 0,
        "ChargeTime": chargeTime,
        "OwnerUsername": player.username
    };
    if (savedMjolnirItem !== undefined && savedMjolnirItem !== null) {
        kubePersistent.SavedMjolnirItem = savedMjolnirItem;
    }

    let nbtConfig = {
        "Damage": stats.damage,
        "Gravity": playerRide ? 0.08 : 0.01,
        "DieOnEntityHit": false,
        "DieOnBlockHit": false,
        "Size": 0.5,
        "Lifetime": 99999,
        "Tags": ["powerborne.mjolnir_projectile"],
        "PreventShooterInteraction": 1,
        "KubeJSPersistentData": kubePersistent,
        "Appearances": appearances,
        "CustomName": '{"text":"' + player.username + '\'s Mjolnir"}'
    };

    for (let key in customNbt) {
        nbtConfig[key] = customNbt[key];
    }

    if (throwMode === 1) { // Lightning mode
        nbtConfig.CommandOnBlockHit = "function powerborne:mjolnir_lightning_strike";
        nbtConfig.CommandOnEntityHit = "function powerborne:mjolnir_lightning_strike";
        nbtConfig.Tags.push("powerborne.mjolnir_lightning");
    } else if (throwMode === 2) { // Jump mode
        nbtConfig.CommandOnBlockHit = "function powerborne:mjolnir_jump_hit";
        nbtConfig.CommandOnEntityHit = "function powerborne:mjolnir_jump_hit_entity";
        nbtConfig.Tags.push("powerborne.mjolnir_jump");
    } else { // Default mode
        nbtConfig.CommandOnBlockHit = "data merge entity @s {KubeJSPersistentData:{ReturnTicks:1}}";
        nbtConfig.CommandOnEntityHit = "data merge entity @s {KubeJSPersistentData:{ReturnTicks:1}}";
    }

    projectile.mergeNbt(nbtConfig);
    projectile.spawn();

    return projectile;
};

global.throwMjolnir = (itemstack, level, entity, animationTicks) => {
    if (animationTicks <= 4) return;

    let savedItem = copyMjolnirItemData(itemstack);
    itemstack.shrink(1);

    const projectile = createMjolnirProjectile(entity, {
        chargeTime: animationTicks,
        throwMode: getThrowMode(entity),
        savedMjolnirItem: savedItem
    });
    entity.persistentData.MjolnirThrownItem = snapshotMjolnirDataForPlayer(savedItem);

    global.sound(entity, 'powerborne:mjolnir_throw', 0.8, 1.0, 0.15);
    entity.swing();
    entity.addItemCooldown("powerborne:mjolnir", 30);
};

let MJOLNIR_STANDS_KEY = "MjolnirStands";
let $StringTag = Java.loadClass('net.minecraft.nbt.StringTag');

const mjolnirStandList = global.mjolnirStandList = {
    add(player, uuid) {
        let list = player.persistentData.getList(MJOLNIR_STANDS_KEY, 8);
        list.add($StringTag.valueOf(uuid));
        player.persistentData.put(MJOLNIR_STANDS_KEY, list);
    },
    remove(player, uuid) {
        let list = player.persistentData.getList(MJOLNIR_STANDS_KEY, 8);
        for (let i = list.size() - 1; i >= 0; i--) {
            if (list.getString(i) === uuid) { list.remove(i); break; }
        }
        player.persistentData.put(MJOLNIR_STANDS_KEY, list);
    },
    getUUIDs(player) {
        let list = player.persistentData.getList(MJOLNIR_STANDS_KEY, 8);
        let uuids = [];
        for (let i = 0; i < list.size(); i++) uuids.push(list.getString(i));
        return uuids;
    },
    getStands(player) {
        return this.getUUIDs(player)
            .map(u => player.level.getEntity(u))
            .filter(e => e && e.isAlive() && e.type === 'minecraft:armor_stand');
    },
    getClosest(player, maxDistance) {
        let best = null;
        let bestDist = maxDistance * maxDistance;
        this.getStands(player).forEach(stand => {
            let d = player.distanceToSqr(stand);
            if (d <= bestDist) { bestDist = d; best = stand; }
        });
        return best;
    },
    recoverLostStands(player) {
        let knownIds = new Set(this.getUUIDs(player));
        let level = player.level;
        let tag = "powerborne.mjolnir_" + player.username;
        level.getEntities().forEach(e => {
            if (e && e.type === "minecraft:armor_stand" && e.isAlive() && e.getTags().contains(tag) && !knownIds.has(e.uuid.toString())) {
                this.add(player, e.uuid.toString());
            }
        });
    }
};

function spawnMjolnirStandAt(level, x, y, z, ownerUsername, playerForList, savedItem) {
    let itemForHand = savedItem || { id: MJOLNIR_ID, Count: 1 };
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
        CustomName: '{"text":"Mjolnir"}',
        HandItems: [itemForHand, {}],
        Tags: ["powerborne.mjolnir", `powerborne.mjolnir_${ownerUsername}`],
        "pehkui:scale_data_types": {
            "pehkui:interaction_box_height": { "scale": 0.1 }
        }
    });
    armorStand.setYaw(Math.random() * 360);
    armorStand.spawn();

    let interaction = level.createEntity('minecraft:interaction');
    interaction.x = x;
    interaction.y = y - 0.6;
    interaction.z = z;
    interaction.mergeNbt({
        height: -0.75,
        width: 0.5,
        Tags: ["powerborne.mjolnir", `powerborne.mjolnir_${ownerUsername}`]
    });
    interaction.spawn();
    interaction.startRiding(armorStand);

    if (mjolnirStandList) {
        if (playerForList) {
            mjolnirStandList.add(playerForList, armorStand.uuid.toString());
        } else if (ownerUsername !== "unknown" && level.getServer()) {
            let player = level.getServer().getPlayerList().getPlayerByName(ownerUsername);
            if (player && player.isAlive()) {
                mjolnirStandList.add(player, armorStand.uuid.toString());
            }
        }
    }
}
global.spawnMjolnirStandAt = spawnMjolnirStandAt;

// Mjolnir worthiness check
PlayerEvents.tick((event) => {
    const player = event.player;
    let worthy = player.isAdvancementDone('powerborne:worthiness/worthy');
    if (player.age % 20 == 0 && !worthy) {
        let main = player.mainHandItem;
        let off = player.offHandItem;
        if (main.id === 'powerborne:mjolnir') {
            let toDrop = main.copy(); // preserve NBT
            main.shrink(1);
            player.drop(toDrop, true);
            player.sendData('status_message', { message: 'messages.powerborne.not_worthy' });
        } else if (off.id === 'powerborne:mjolnir') {
            let toDrop = off.copy();
            off.shrink(1);
            player.drop(toDrop, true);
            player.sendData('status_message', { message: 'messages.powerborne.not_worthy' });
        }
    }
});

// Mjolnir armor stand setup when dropped
EntityEvents.spawned('minecraft:item', event => {
    let itemEntity = event.entity;
    let itemStack = itemEntity.item;
    if (itemStack.id !== 'powerborne:mjolnir') return;

    if (!itemEntity.owner && (!itemStack.nbt || !itemStack.nbt.getBoolean('Unbreakable'))) return;

    let ownerUsername = itemEntity.persistentData.MjolnirOwner ||
        (itemEntity.owner ? itemEntity.owner.username : "unknown");
    let saved = copyMjolnirItemData(itemStack);

    spawnMjolnirStandAt(
        itemEntity.level,
        itemEntity.x, itemEntity.y, itemEntity.z,
        ownerUsername,
        itemEntity.owner || null,
        saved
    );
    event.cancel();
});

// Mjolnir stand setup when death
EntityEvents.death(event => {
    const entity = event.entity;
    if (!entity.isPlayer()) return;
    const gameRules = event.server.getOverworld().getGameRules();
    const items = entity.inventory.items;
    if (gameRules.get("keepInventory").get()) return;
    items.forEach(item => {
        if (item.id === 'powerborne:mjolnir') {
            let toDrop = item.copy();
            item.shrink(1);
            entity.drop(toDrop, true);
        }
    });
});

function recoverMjolnirStandsForPlayer(player) {
    mjolnirStandList.recoverLostStands(player);
}

PlayerEvents.loggedIn(event => recoverMjolnirStandsForPlayer(event.player));
PlayerEvents.respawned(event => recoverMjolnirStandsForPlayer(event.player));
LevelEvents.loaded(event => {
    let players = event.level.players;
    if (players) players.forEach(player => recoverMjolnirStandsForPlayer(player));
});


const tryPickupMjolnir = (player, target) => {
    if (!target || target.getType() != "minecraft:interaction" ||
        !target.getTags().contains("powerborne.mjolnir")) {
        return false;
    }

    let worthy = player.isAdvancementDone('powerborne:worthiness/worthy');

    if (target.getTags().contains("powerborne.fresh")) {
        let nearbyEntities = target.getLevel().getEntitiesWithin(target.getBoundingBox().inflate(1));
        let armorStand = nearbyEntities.find(entity =>
            entity.getType() == "minecraft:armor_stand" &&
            entity.getTags().contains("powerborne.mjolnir") &&
            entity.getTags().contains("powerborne.fresh")
        );

        if (!armorStand) return false;

        if (!worthy) {
            player.sendData('status_message', { message: 'messages.powerborne.not_worthy' });
            target.startRiding(armorStand);
            armorStand.mergeNbt({ Marker: 0 });
            return false;
        }

        if (global.hasLockArmorEnabled(player)) {
            player.sendData('status_message', { message: 'messages.powerborne.cant_do_this_now' });
            return false;
        }

        if (player.getMainHandItem().isEmpty()) {
            let playerChest = player.getEquipment('chest');
            player.setItemSlot(4, Item.of('powerborne:thor_suit', { RepairCost: Integer.valueOf("2147483647") }));
            global.sound(player, 'minecraft:item.trident.thunder');

            let lightning = player.level.createEntity('minecraft:lightning_bolt');
            lightning.x = player.x;
            lightning.y = player.y;
            lightning.z = player.z;
            lightning.setVisualOnly(true);
            lightning.spawn();

            player.setMainHandItem(global.createMjolnirItem());
            player.give(Item.of(playerChest.id));
            player.unlockAdvancement('powerborne:thor_origin');

            global.playSoundLocal(player, 'powerborne:mjolnir_grab', 'players', 1, 1);

            armorStand.kill();
            target.kill();
            return true;
        } else {
            player.sendData('status_message', { message: 'messages.powerborne.cant_do_this_now' });
            return false;
        }
    } else {
        let isUnclaimed = target.getTags().contains("powerborne.mjolnir_unknown");
    
        if (!isUnclaimed && !target.getTags().contains(`powerborne.mjolnir_${player.username}`)) {
            player.sendData('status_message', { message: 'messages.powerborne.not_owned_weapon' });
            return false;
        }
        if (!worthy) {
            player.sendData('status_message', { message: 'messages.powerborne.not_worthy' });
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
                giveMjolnirToPlayer(player);
            }
            stand.kill();
        }
        target.kill();
        return true;
    }
};

// Mjolnir pickup interaction (right-click)
ItemEvents.entityInteracted(event => {
    const { player, target } = event;
    tryPickupMjolnir(player, target);
    tryPickupStormbreaker(player, target);
});

// Mjolnir pickup by crouching on it (Alien Evo compatibility)
// PlayerEvents.tick(event => {
//     const player = event.player;
//     if (!player.isCrouching() || player.age % 5 !== 0) return;

//     let entities = player.level.getEntitiesWithin(player.getBoundingBox());
//     for (let entity of entities) {
//         if (entity.getType && entity.getType() === "minecraft:interaction") {
//             if (entity.getTags && entity.getTags().contains("powerborne.mjolnir")) {
//                 if (tryPickupMjolnir(player, entity)) return;
//             }
//             if (entity.getTags && entity.getTags().contains("powerborne.stormbreaker")) {
//                 if (tryPickupStormbreaker(player, entity)) return;
//             }
//         }
//     }
// });

// Recall thrown Mjolnir
PlayerEvents.tick(event => {
    const player = event.player;
    if (!abilityUtil.isEnabled(player, "powerborne:god_of_thunder", "mjolnir_call_projectile")) return;
    let abilityInstance = abilityUtil.getInstance(player, "powerborne:god_of_thunder", "mjolnir_call_projectile");
    if (!abilityInstance || abilityInstance.getEnabledTicks() !== 1) return;

    if (!global.mjolnirProjectiles) return;
    let ownerKey = String(player.uuid);
    let tracked = global.mjolnirProjectiles.get(ownerKey);
    if (!tracked || tracked.size === 0) return;

    let uuids = [];
    tracked.forEach(function(u) { uuids.push(u); });
    let recalled = false;
    for (let i = 0; i < uuids.length; i++) {
        let proj = null;
        player.server.allLevels.forEach(function(l) {
            if (!proj) proj = l.getEntity(uuids[i]);
        });
        if (!proj || proj.removed) continue;
        if (proj.getTags().contains('powerborne.mjolnir_jump')) continue;
        proj.persistentData.ReturnTicks = 3;
        proj.mergeNbt({
            "CommandOnBlockHit": "",
            "CommandOnEntityHit": ""
        });
        recalled = true;
    }

    if (recalled) {
        global.playSoundLocal(player, 'powerborne:mjolnir_hum', 'players', 1, 1);
    }
});

// Summon weapon from stand 
PlayerEvents.tick(event => {
    const player = event.player;
    if (!abilityUtil.isEnabled(player, "powerborne:god_of_thunder", "mjolnir_call_stand")) return;
    let abilityInstance = abilityUtil.getInstance(player, "powerborne:god_of_thunder", "mjolnir_call_stand");
    if (!abilityInstance || abilityInstance.getEnabledTicks() !== 1) return;

    let weaponStand = mjolnirStandList.getClosest(player, 200);
    if (!weaponStand) return;

    let handStack = weaponStand.getMainHandItem ? weaponStand.getMainHandItem() : null;
    let isStormbreaker = handStack && !handStack.isEmpty() && handStack.id === STORMBREAKER_ID;

    let savedItem, tags, renderLayer, customName, damage;

    if (isStormbreaker) {
        savedItem = copyStormbreakerItemData(handStack);
        player.persistentData.StormbreakerThrownItem = snapshotStormbreakerDataForPlayer(savedItem);
        tags = ["powerborne.stormbreaker_projectile"];
        renderLayer = "powerborne:stormbreaker";
        customName = player.username + "'s Stormbreaker";
        damage = STORMBREAKER_DAMAGE;
    } else {
        savedItem = copyMjolnirItemData(handStack);
        player.persistentData.MjolnirThrownItem = snapshotMjolnirDataForPlayer(savedItem);
        tags = ["powerborne.mjolnir_projectile"];
        renderLayer = "powerborne:mjolnir_item";
        customName = player.username + "'s Mjolnir";
        damage = 8;
    }

    let kubePersistentData = { "ReturnTicks": 3, "OwnerUsername": player.username };
    kubePersistentData[isStormbreaker ? "SavedStormbreakerItem" : "SavedMjolnirItem"] = savedItem;

    let projectile = player.level.createEntity("palladium:custom_projectile");
    projectile.x = weaponStand.x;
    projectile.y = weaponStand.y;
    projectile.z = weaponStand.z;
    projectile.setOwner(player);
    projectile.mergeNbt({
        "Damage": damage,
        "Gravity": 0,
        "DieOnEntityHit": false,
        "DieOnBlockHit": false,
        "Size": 0.5,
        "Lifetime": 99999,
        "Tags": tags,
        "KubeJSPersistentData": kubePersistentData,
        "Appearances": [{ "Type": "renderLayer", "RenderLayer": renderLayer }],
        "CustomName": '{"text":"' + customName + '"}'
    });
    projectile.spawn();
    if (isStormbreaker) {
        let stand = player.level.createEntity('minecraft:armor_stand');
        stand.x = weaponStand.x;
        stand.y = weaponStand.y;
        stand.z = weaponStand.z;
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
    }
    global.playSoundLocal(player, 'powerborne:mjolnir_hum', 'players', 1, 1);

    weaponStand.passengers.forEach(passenger => {
        if (passenger.type === "minecraft:interaction") passenger.kill();
    });
    mjolnirStandList.remove(player, weaponStand.uuid.toString());
    weaponStand.kill();
});

// Mjolnir use ability
PlayerEvents.tick(event => {
    const player = event.player;

    if (!abilityUtil.hasPower(player, "powerborne:god_of_thunder")) {
        return;
    }

    let abilityInstance = abilityUtil.getInstance(player, "powerborne:god_of_thunder", "mjolnir_use");
    if (!abilityInstance) {
        return;
    }

    let animationTicks = global.getAbilityAnimationTicks(player, "powerborne:god_of_thunder", "mjolnir_use", true);
    let isEnabled = abilityInstance.isEnabled();
    let isFlying = abilityUtil.isEnabled(player, "powerborne:god_of_thunder", "is_flying");
    let isFastFlying = abilityUtil.isEnabled(player, "powerborne:god_of_thunder", "is_fast_flying");
    let isFlightUnlocked = global.isAbilityUnlockedOrAutoMaxed(player, "powerborne:god_of_thunder", "flight_buy");
    let handler = player.palladium$getFlightHandler();
    let wasFlyingLastTick = handler && handler.prevFlightBoost > 0;

    if (isEnabled) {
        global.setPehkuiScale(player, {
            "pehkui:motion": 0.3
        });

        if (abilityUtil.isEnabled(player, "powerborne:god_of_thunder", "is_hovering_or_flying")) {
            global.setPehkuiScale(player, {
                "pehkui:motion": 1.0
            });
        }

        palladium.setProperty(player, "mjolnir_charge", animationTicks);
        if (player.age % 4 == 0) {
            global.playSoundLocal(player, 'powerborne:mjolnir_spin', 'players', 0.3, player.getRandom().nextFloat() * 0.4 + 0.8);
        }
        if (animationTicks > 10) {
            let chargeLevel = global.clamp(animationTicks / 2, 2, 20);
            if (chargeLevel >= 20 && player.onGround() && player.age % 5 == 0) {
                player.level.spawnParticles("minecraft:poof",
                    true,
                    player.x,
                    player.y,
                    player.z,
                    0.2, 0, 0.2,
                    1,
                    0.1
                );
            }
        }
    }

    if (!isEnabled) {
        let mjCharge = palladium.getProperty(player, "mjolnir_charge") || 0;
        if (mjCharge > 0) {
            global.setPehkuiScale(player, {
                "pehkui:motion": 1.0
            });
        }
        if (mjCharge > 10) {
            if ((isFlying && !wasFlyingLastTick && !isFlightUnlocked) || isFastFlying) {
                palladium.setProperty(player, "mjolnir_charge", 0);
            } else {
                const current = getLightningCharge(player) || 0
                if (!abilityUtil.isEnabled(player, "powerborne:god_of_thunder", "lightning_charge_timer")
                    && player.mainHandItem.id === 'powerborne:mjolnir') {

                    const throwMode = getThrowMode(player);

                    if (throwMode === 2) { // Jump mode
                        if (current >= 20 * getDrainMultiplier(player)) {
                            let savedItem = copyMjolnirItemData(player.mainHandItem);
                            player.mainHandItem.shrink(1);
                            player.persistentData.MjolnirThrownItem = snapshotMjolnirDataForPlayer(savedItem);
                            player.swimming = true;

                            const projectile = createMjolnirProjectile(player, {
                                chargeTime: mjCharge,
                                throwMode: throwMode,
                                playerRide: true,
                                savedMjolnirItem: savedItem
                            });

                            player.startRiding(projectile);

                            global.sound(player, 'powerborne:mjolnir_throw', 0.8, 1.0, 0.15);
                            player.swing();
                            player.addItemCooldown("powerborne:mjolnir", 30);
                            subLightningCharge(player, 20 * getDrainMultiplier(player));
                        } else {
                            global.sound(player, 'powerborne:mjolnir_fail', 1, 1);
                        }

                    } else if (throwMode === 1) { // Lightning mode
                        if (current >= 15 * getDrainMultiplier(player)) {
                            global.throwMjolnir(player.mainHandItem, player.level, player, mjCharge);

                            subLightningCharge(player, 15 * getDrainMultiplier(player));
                        } else {
                            global.sound(player, 'powerborne:mjolnir_fail', 1, 1);
                        }
                    } else { // Default mode
                        global.throwMjolnir(player.mainHandItem, player.level, player, mjCharge);
                    }
                }
                palladium.setProperty(player, "mjolnir_charge", 0);
            }
        }
    }
});

// Mjolnir Vortex ability
PlayerEvents.tick(event => {
    const player = event.player;

    if (!abilityUtil.hasPower(player, "powerborne:god_of_thunder")) {
        return;
    }

    if (abilityUtil.isEnabled(player, "powerborne:god_of_thunder", "mjolnir_vortex")) {
        let animationTicks = global.getAbilityAnimationTicks(player, "powerborne:god_of_thunder", "mjolnir_vortex", true);

        if (animationTicks > 4) {
            let { x, y, z } = player;
            let radius = 1.2;
            let damage = 7;
            let knockbackStrength = 1.0;
            player.setSprinting(true);
            global.breakReplaceableInRadius(player.level, player, x, y, z, 1);

            let victims = event.level.getEntitiesWithin(player.getBoundingBox().inflate(radius, 2.0, radius));

            let entitiesToProcess = [];
            victims.forEach(entity => {
                if (!entity.is(player) && entity.isAlive() && entity.isLiving()) {
                    entitiesToProcess.push(entity);
                }
            });

            if (player.age % 2 === 0) {
                entitiesToProcess.forEach(entity => {
                    if (entity && entity.isAlive()) {
                        let dx = entity.x - player.x;
                        let dy = entity.y - player.y;
                        let dz = entity.z - player.z;
                        let distance = player.distanceToEntity(entity);

                        if (distance < 0.1) return;

                        if (entity.hurtTime == 0) {
                            entity.attack(player.damageSources().playerAttack(player), damage);

                            let ndx = dx / distance;
                            let ndy = Math.max(dy / distance, 0.5);
                            let ndz = dz / distance;

                            entity.addMotion(ndx * knockbackStrength, ndy * knockbackStrength, ndz * knockbackStrength);

                            if (!entity.isAlive()) {
                                global.levelingSystem.awardXP(player, "powerborne:god_of_thunder", "mjolnir_vortex", 3);
                            }
                        }

                        entity.hurtMarked = true;
                    }
                });
                player.level.playSound(null, x, y, z, 'entity.player.attack.sweep', 'players', 0.8, 0.9);
            }

            if (player.age % 2 === 0) {
                player.level.spawnParticles("minecraft:sweep_attack",
                    false,
                    x, y + 1, z,
                    0.5, 0.5, 0.5,
                    1, 0.1
                );

                player.level.spawnParticles("minecraft:poof",
                    false,
                    x + (Math.random() - 0.5),
                    y + 0.5 + Math.random() * 1.5,
                    z + (Math.random() - 0.5),
                    0.1, 0.3, 0.1,
                    2, 0.08
                );
            }

            if (player.age % 12 === 0) {
                player.level.spawnParticles("powerborne:white_boom",
                    false,
                    x + (Math.random() - 0.5), y + 1, z + (Math.random() - 0.5),
                    0.1, 0.1, 0.1,
                    1, 0.1
                );
            }
        }
    }
});

function isMjolnirProjectile(entity) {
    return entity &&
        entity.type === 'palladium:custom_projectile' &&
        entity.getTags &&
        entity.getTags().contains('powerborne.mjolnir_projectile');
}

function awardMjolnirXP(player) {
    if (!player || !abilityUtil.hasPower(player, "powerborne:god_of_thunder")) return;
    global.levelingSystem.awardXPForAbility(player, "powerborne:god_of_thunder", "mjolnir_use");
}

EntityEvents.death(event => {
    const source = event.source;
    let projectile = source ? source.immediate : null;
    if (!projectile || projectile.type !== 'palladium:custom_projectile')
        projectile = source ? source.actual : null;

    if (isMjolnirProjectile(projectile)) {
        if (projectile.getTags().contains('powerborne.mjolnir_lightning') || projectile.getTags().contains('powerborne.mjolnir_jump')) {
            return;
        }

        const owner = projectile.getOwner();
        awardMjolnirXP(owner);
        return;
    }

});

EntityEvents.hurt(event => {
    const source = event.source;
    let projectile = source ? source.immediate : null;
    if (!projectile || projectile.type !== 'palladium:custom_projectile')
        projectile = source ? source.actual : null;
    if (!isMjolnirProjectile(projectile)) return;
    if (!projectile.getTags().contains('powerborne.mjolnir_lightning')) return;

    const owner = projectile.getOwner();
    if (!owner || !abilityUtil.hasPower(owner, "powerborne:god_of_thunder")) return;

    const target = event.entity;
    if (!target) return;
    const currentTick = owner.level.gameTime;
    const lightningKey = `${owner.uuid}:${currentTick}`;
    if (target.persistentData.mjolnirLightningXpKey === lightningKey) return;

    target.persistentData.mjolnirLightningXpKey = lightningKey;
    global.levelingSystem.awardXPForAbility(owner, "powerborne:god_of_thunder", "mjolnir_use");
});

// Mjolnir vortex damage immunity
EntityEvents.hurt(event => {
    const entity = event.entity;

    if (entity.isPlayer() && abilityUtil.isEnabled(entity, "powerborne:god_of_thunder", "mjolnir_vortex")) {
        event.cancel();
        return;
    }
});

// Custom command for Mjolnir explosion
ServerEvents.commandRegistry(event => {
    const { commands: Commands } = event;

    event.register(
        Commands.literal("mjolnir_explosion")
            .requires(source => !source.isPlayer() && source.hasPermission(2))
            .executes(ctx => {
                const source = ctx.source;
                const pos = source.position;
                const x = pos.x();
                const y = pos.y();
                const z = pos.z();

                let exploder = null;
                if (source.getType && source.getType() === 'palladium:custom_projectile') {
                    exploder = source.getOwner();
                }

                source.level
                    .createExplosion(x, y, z)
                    .strength(3.0)
                    .explosionMode("none")
                    .exploder(exploder)
                    .explode();

                return 1;
            })
    );
});
