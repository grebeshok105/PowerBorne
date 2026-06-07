let $BlockPos = Java.loadClass("net.minecraft.core.BlockPos");
let Integer = Java.loadClass('java.lang.Integer');
let AllEffects = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries').MOB_EFFECT

PlayerEvents.tick(event => {
    let player = event.player;
    let pd = player.persistentData;
    let hasSolarAscension = player.getEffect("powerborne:solar_ascension");
    let hasUnstableRadiance = player.getEffect("powerborne:unstable_radiance");

    if (!hasSolarAscension || !hasUnstableRadiance) {
        if (pd.getInt("beacon_x")) {
            pd.remove("beacon_x");
            pd.remove("beacon_y");
            pd.remove("beacon_z");
            pd.remove("beacon_charge_timer");
            player.setNoGravity(false);
        }
        return;
    }

    if (global.hasLockArmorEnabled(player)) {
        if (pd.getInt("beacon_x")) {
            pd.remove("beacon_x");
            pd.remove("beacon_y");
            pd.remove("beacon_z");
            pd.remove("beacon_charge_timer");
            player.setNoGravity(false);
        }
        return;
    }

    if (!pd.getInt("beacon_x")) {
        if (player.age % 20 != 0) return;

        let center = player.blockPosition();
        let lesser = center.north(20).west(20).below(20);
        let greater = center.south(20).east(20).above(20);

        let found = $BlockPos.betweenClosedStream(lesser, greater)
            .filter(bpos => {
                let block = player.level.getBlock(bpos.x, bpos.y, bpos.z);
                if (!block || block.id !== "minecraft:beacon") return false;
                let nbt = block.entityData;
                let primary = nbt.getInt("Primary");
                let effect = primary > 0 ? AllEffects.byId(primary) : null;
                return nbt && nbt.getInt("Levels") >= 3 && effect && effect.getDescriptionId().includes("solar_ascension");
            })
            .findFirst();

        if (!found.isPresent()) return;

        let beaconPos = found.get();
        pd.putInt("beacon_x", beaconPos.x);
        pd.putInt("beacon_y", beaconPos.y);
        pd.putInt("beacon_z", beaconPos.z);
    }

    let bx = pd.getInt("beacon_x");
    let by = pd.getInt("beacon_y");
    let bz = pd.getInt("beacon_z");

    // Verify beacon
    let block = player.level.getBlock(bx, by, bz);
    if (!block || block.id !== "minecraft:beacon") {
        pd.remove("beacon_x");
        pd.remove("beacon_y");
        pd.remove("beacon_z");
        pd.remove("beacon_charge_timer");
        player.setNoGravity(false);
        return;
    }
    let nbt = block.entityData;
    let primary = nbt.getInt("Primary");
    let effect = primary > 0 ? AllEffects.byId(primary) : null;
    if (!nbt || nbt.getInt("Levels") < 3 || !effect || !effect.getDescriptionId().includes("solar_ascension")) {
        pd.remove("beacon_x");
        pd.remove("beacon_y");
        pd.remove("beacon_z");
        pd.remove("beacon_charge_timer");
        player.setNoGravity(false);
        return;
    }

    player.setNoGravity(true);

    let dx = (bx + 0.5) - player.x;
    let dy = (by + 3.0) - player.y; // Hover slightly above it
    let dz = (bz + 0.5) - player.z;
    let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    let steps = Math.floor(dist * 0.5); 
    for(let i = 0; i <= steps; i++) {
        let t = i / steps;
        let pxLine = player.x + dx * t;
        let pyLine = (player.y + 1.0) + (dy - 4.0) * t; 
        let pzLine = player.z + dz * t;
        let color = new Vector3f(1.0, 0.9, 0.0);
        player.level.sendParticles(  
            "ambient_entity_effect",  
            pxLine, pyLine, pzLine, 0,  
            color.x(), color.y(), color.z(), 1  
        );
    }

    let chargeTimer = pd.getInt("beacon_charge_timer");

    if (dist <= 1.25 || chargeTimer > 0) {
        if (chargeTimer == 0) chargeTimer = 1;
        let chargeDuration = 10;
        let progress = chargeTimer / chargeDuration;

        player.hurtMarked = true;

        // pitch sound
        let interval = Math.max(2, Math.floor(10 * (1 - progress)));
        if (chargeTimer % interval == 0) {
            let pitch = 0.5 + progress * 1.5;
            global.sound(player, "minecraft:block.beacon.ambient", 10.0, pitch, 0);
        }

        let particleCount = Math.floor(1 + progress * 8);
        player.level.spawnParticles("minecraft:end_rod", false, bx + 0.5, by, bz + 0.5, 0.3, 0.5, 0.3, particleCount, 0.02);

        if (chargeTimer >= chargeDuration) {
            let beacon = player.level.getBlock(bx, by, bz);
            if (beacon) {
                player.level.destroyBlock(beacon, false);
            }
            player.removeEffect("powerborne:unstable_radiance");

            player.level.createExplosion(bx, by, bz)
                .strength(4)
                .explosionMode("block")
                .exploder(player)
                .explode();

            global.sound(player, "minecraft:entity.generic.explode", 2.0, 0.5, 0);
            global.sound(player, 'minecraft:item.totem.use', 1.0, 1.0, 0);

            pd.remove("beacon_x");
            pd.remove("beacon_y");
            pd.remove("beacon_z");
            pd.remove("beacon_charge_timer");

            pd.putInt("sentry_ascension_timer", 33);
            player.setNoGravity(true);
        } else {
            pd.putInt("beacon_charge_timer", chargeTimer + 1);
        }
    } else {
        let speed = Math.max(0.1, Math.min(1.0, dist * 0.015));
        player.setMotion((dx / dist) * speed, ((dy - 1) / dist) * speed, (dz / dist) * speed);
        player.hurtMarked = true;

        if (player.age % 10 == 0) {
            let pullPitch = 0.5 + (2.0 / Math.max(1, dist));
            global.sound(player, "minecraft:block.beacon.ambient", 10.0, pullPitch, 0);
        }
    }
});

// Phase 2
PlayerEvents.tick(event => {
    let player = event.player
    let level = event.level;
    let pd = player.persistentData;
    let { x, y, z } = player;

    let ascensionTimer = pd.getInt("sentry_ascension_timer");
    if (ascensionTimer > 0) {
        player.setNoGravity(true);

        player.setMotion(0, 6, 0); // Fast up
        player.hurtMarked = true;
        event.level.spawnParticles("minecraft:end_rod", false, x, y, z, 0.5, 0.5, 0.5, 5, 0.05);
        pd.putInt("sentry_ascension_timer", ascensionTimer - 1);

        if (ascensionTimer == 1) { // Last tick
            pd.putInt("sentry_pause_timer", 15);
            player.setMotion(0, 0, 0);
        }
    }

    let pauseTimer = pd.getInt("sentry_pause_timer");
    if (pauseTimer > 0) {
        player.setNoGravity(true);
        player.setMotion(0, 0.25, 0);
        player.hurtMarked = true;

        if (pauseTimer == 15) {
            player.addTag("powerborne.becoming_sentry");
            global.sound(player, "minecraft:block.beacon.activate", 1.5, 1.2, 0);
            global.sound(player, 'minecraft:item.totem.use', 1.0, 1.5, 0);
            event.level.spawnParticles("minecraft:flash", false, x, y, z, 1, 0, 0, 0, 0);
            level.spawnParticles('minecraft:wax_on', true, x, y, z, 1.0, 1.5, 1.0, 80, 0.4);
            level.spawnParticles('minecraft:flame', true, x, y, z, 0.5, 0.5, 0.5, 60, 0.25);
            level.spawnParticles('minecraft:lava', true, x, y, z, 1.0, 1.0, 1.0, 10, 0);

            let playerChest = player.getEquipment('chest');
            player.setItemSlot(4, Item.of('powerborne:sentry_suit', { RepairCost: Integer.valueOf("2147483647") }));
            if (playerChest.id != "minecraft:air") {
                player.give(Item.of(playerChest.id));
            }
        }

        pd.putInt("sentry_pause_timer", pauseTimer - 1);

        if (pauseTimer == 1) {
            let attributeID = Platform.isForge() ? 'forge:entity_gravity' : 'porting_lib:entity_gravity';
            player.modifyAttribute(attributeID, "photonic_strike", 6, "addition");
            player.addTag("powerborne.photonic_strike");
            player.addTag("powerborne.photonic_strike_land");
            player.addTag("powerborne.sentry_land_effect_pending");
            player.removeTag("powerborne.becoming_sentry");
            player.setNoGravity(false);
            global.sound(player, "powerborne:sentry_fly_start", 2, 0.8, 0);
        }
    }

    if (player.tags.contains("powerborne.sentry_land_effect_pending")) {
        if (!player.tags.contains("powerborne.photonic_strike_land")) {
            let effectTimer = pd.getInt("sentry_land_effect_timer");
            if (effectTimer == 0) {
                pd.putInt("sentry_land_effect_timer", 60);
            } else if (effectTimer > 1) {
                pd.putInt("sentry_land_effect_timer", effectTimer - 1);
            } else {
                player.potionEffects.add("minecraft:darkness", 40, 0, false, false);
                global.sound(player, 'minecraft:block.sculk_catalyst.bloom', 100, 0.2);
                global.sound(player, 'minecraft:entity.warden.heartbeat', 0.5, 1);
                
                player.removeTag("powerborne.sentry_land_effect_pending");
                pd.remove("sentry_land_effect_timer");
            }
        }
    }
});
