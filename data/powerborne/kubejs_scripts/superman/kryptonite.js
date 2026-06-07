PlayerEvents.tick(event => {
    const player = event.player;
    const level = event.level;

    if (!abilityUtil.hasPower(player, "powerborne:superman")) return;

    // Poison immunity - clear poison unless weakened by kryptonite
    if (player.hasEffect("minecraft:poison") && !player.hasEffect("powerborne:kryptonite_poisoning")) {
        player.removeEffect("minecraft:poison");
    }

    if (player.age % 20 != 0) return;

    const kryptoniteCluster = 'powerborne:kryptonite_cluster';
    const kryptositeShard = 'powerborne:kryptonite_shard';
    let playerAABB = player.boundingBox.inflate(5)

    let nearbyEntities = player.level.getEntitiesWithin(playerAABB);
    nearbyEntities.forEach(entity => {
        if (entity != null && entity.isLiving()) {
            const nearbyMainHand = entity.getMainHandItem();
            const nearbyOffHand = entity.getOffHandItem();

            const hasKryptonite = (
                nearbyMainHand.id === kryptoniteCluster ||
                nearbyOffHand.id === kryptoniteCluster ||
                nearbyMainHand.id === kryptositeShard ||
                nearbyOffHand.id === kryptositeShard
            );
            const kryptoniteRadius = hasKryptonite ? 4 : 0;

            const distance = player.distanceToEntity(entity);

            if (kryptoniteRadius > 0 && distance <= kryptoniteRadius) {
                player.potionEffects.add("powerborne:kryptonite_poisoning", 100, 0);
            }
        }
    });

    let center = player.blockPosition();
    let lesser = center.north(4).west(4).below(4);
    let greater = center.south(4).east(4).above(4);

    $BlockPos.betweenClosedStream(lesser, greater)
        .filter(bpos => {
            let block = player.level.getBlock(bpos.x, bpos.y, bpos.z);
            return block && block.id === "powerborne:kryptonite_cluster";
        })
        .forEach(bpos => {
            player.potionEffects.add("powerborne:kryptonite_poisoning", 100, 0);
        });
});