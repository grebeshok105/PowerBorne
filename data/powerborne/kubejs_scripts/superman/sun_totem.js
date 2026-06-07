let DustParticleOptions = Java.loadClass('net.minecraft.core.particles.DustParticleOptions');
let Vector3f = Java.loadClass("org.joml.Vector3f");
let Integer = Java.loadClass('java.lang.Integer');

ItemEvents.rightClicked(event => {
    let player = event.player;
    let item = event.item;

    if (item.id == "powerborne:sun_totem" && item.nbt.getInt("energy") >= 5000) {
        if (global.hasLockArmorEnabled(player)) return;

        player.sendData("sunTotemAnimation", { item: item.id });

        spawnSunTotemBurst(player);

        let playerChest = player.getEquipment('chest');
        player.setItemSlot(4, Item.of('powerborne:superman_suit', { RepairCost: Integer.valueOf("2147483647") }));
        player.give(Item.of(playerChest.id));
        player.unlockAdvancement('powerborne:superman_origin');
        let current = palladium.getProperty(player, "energy_bar_solar") || 0;
        let max = palladium.getProperty(player, "energy_bar_solar_max") || 100;
        palladium.setProperty(player, "energy_bar_solar", Math.min(current + 100, max));
        item.count--;
    }
});

PlayerEvents.tick(event => {
    const player = event.player;
    const level = player.level;
    if (player.age % 30 != 0) return;
    if (level.dimension !== "minecraft:overworld") return;

    if (level.isDay() && level.canSeeSky(player.blockPosition())) {
        let item = player.handSlots.find(item => item.id === "powerborne:sun_totem" && !item.isEmpty());
        if (item) {
            let nbt = item.getOrCreateTag();
            let energy = nbt.getInt("energy");
            if (energy < 5000) {
                let playerY = player.getBlockY();
                let energyGain = calculateEnergyGain(playerY);
                nbt.putInt("energy", energy + energyGain);
            }
        }
    }
});

function calculateEnergyGain(y) {
    if (y < 100) {
        return 3;
    } else if (y >= 200) {
        return 8;
    } else {
        return Math.floor(3 + (y - 100) * 0.05);
    }
}

function spawnSunTotemBurst(player) {
    let level = player.level;
    let px = player.x;
    let py = player.y + 1.2;
    let pz = player.z;

    global.sound(player, 'minecraft:item.totem.use', 1.0, 1.0, 0);
    global.sound(player, 'minecraft:entity.zombie_villager.cure', 1.0, 1.0, 0);
    global.sound(player, 'minecraft:block.beacon.activate', 1.5, 1.5, 0);

    level.spawnParticles('minecraft:flash', false, px, py, pz, 0, 0, 0, 0, 0);
    level.spawnParticles('minecraft:totem_of_undying', true, px, py, pz, 1.0, 1.5, 1.0, 80, 0.4);
    level.spawnParticles('powerborne:sparks', true, px, py, pz, -1.5, -1.0, -1.5, 100, 0.2);
    level.spawnParticles('minecraft:flame', true, px, py, pz, 0.5, 0.5, 0.5, 60, 0.25);
    level.spawnParticles('minecraft:lava', true, px, py, pz, 1.0, 1.0, 1.0, 10, 0);

    let r = 1.25;
    let color1 = new Vector3f(1.0, 0.7, 0.0);
    let color2 = new Vector3f(1.0, 0.5, 0.0);
    level.sendParticles(new DustParticleOptions(color1, 1.8), px + r, py, pz, 2, 0, 0, 0, 0);
    level.sendParticles(new DustParticleOptions(color2, 1.8), px + r * 0.707, py, pz + r * 0.707, 2, 0, 0, 0, 0);
    level.sendParticles(new DustParticleOptions(color1, 1.8), px, py, pz + r, 2, 0, 0, 0, 0);
    level.sendParticles(new DustParticleOptions(color2, 1.8), px - r * 0.707, py, pz + r * 0.707, 2, 0, 0, 0, 0);
    level.sendParticles(new DustParticleOptions(color1, 1.8), px - r, py, pz, 2, 0, 0, 0, 0);
    level.sendParticles(new DustParticleOptions(color2, 1.8), px - r * 0.707, py, pz - r * 0.707, 2, 0, 0, 0, 0);
    level.sendParticles(new DustParticleOptions(color1, 1.8), px, py, pz - r, 2, 0, 0, 0, 0);
    level.sendParticles(new DustParticleOptions(color2, 1.8), px + r * 0.707, py, pz - r * 0.707, 2, 0, 0, 0, 0);
}

