PlayerEvents.tick((event) => {
    const player = event.player;
    if (!abilityUtil.hasPower(player, "powerborne:superman")) return;

    if (abilityUtil.isEnabled(player, "powerborne:superman", "super_flare")) {
        player.modifyAttribute("palladium:flight_speed", "super_flare", -10, "multiply_base");
        let currentTick = global.getAbilityAnimationTicks(player, "powerborne:superman", "super_flare", true);
        let range = 25;
        
        player.potionEffects.add('minecraft:slowness', 1, 5, false, false);

        if (currentTick >= 50 && currentTick < 65) {
            player.level.getEntitiesWithin(player.getBoundingBox().inflate(range)).forEach(entity => {
                if (entity.isLiving() && entity !== player) {
                    entity.setSecondsOnFire(20);
                    if (currentTick == 50) {
                        let distance = player.distanceToEntity(entity);
                        let damageFalloff = 1 - (distance / range);
                        let damage = Math.max(2, Math.floor(50 * damageFalloff));
                        entity.attack(player.damageSources().playerAttack(player), damage);
                    }
                }
            });
        }

        if (currentTick == 50) {
            let px = Math.floor(player.x);
            let py = Math.floor(player.y);
            let pz = Math.floor(player.z);
            let level = player.level;

            let fireCount = 300;
            for (let i = 0; i < fireCount; i++) {
                let dx = player.getRandom().nextInt(range * 2 + 1) - range;
                let dz = player.getRandom().nextInt(range * 2 + 1) - range;

                // Circle check
                if ((dx * dx + dz * dz) > (range * range)) continue;

                let x = px + dx;
                let z = pz + dz;

                for (let dy = 5; dy >= -5; dy--) {
                    let y = py + dy;
                    let pos = new BlockPos(x, y, z);
                    let posBelow = new BlockPos(x, y - 1, z);

                    let blockState = level.getBlockState(pos);
                    let blockBelow = level.getBlockState(posBelow);
                    
                    if (blockBelow.isSolid()) {
                        level.getBlock(x, y, z).set("minecraft:fire");
                        break;
                    }
                }
            }
        }

        if (currentTick > 64) {
            player.removeAttribute("palladium:flight_speed", "super_flare");
            player.potionEffects.add("powerborne:solar_exhaustion", 600, 0);
        }
    }
});