PlayerEvents.tick(event => {
    let player = event.player;
    let pd = player.persistentData;

    // Heat vision speed multiplier - higher values make blocks break faster
    const heatVisionSpeedMultiplier = 2.5;

    if (abilityUtil.isEnabled(player, "powerborne:homelander", "heat_vision_beam")) {
        let rayTraceResult = global.advancedRayTrace(player, player.level, 25);

        if (rayTraceResult.type === "miss" || rayTraceResult.entity) {
            return;
        }

        let blockPos = rayTraceResult.block;
        let block = player.level.getBlock(blockPos);

        if (block.id == "minecraft:fire") {
            blockPos = blockPos.below();
            block = player.level.getBlock(blockPos);
        }

        let currentTick = global.getAbilityAnimationTicks(player, "powerborne:homelander", "heat_vision_timer", true);
        let relativeMax = 60;
        let dynamicThreshold = Math.min(Math.max(currentTick / (relativeMax / 2), 1.0), 5.0);
        let destroySpeed = block.blockState.getDestroySpeed(player.level, blockPos);

        if (block.id === "minecraft:fire") {
            // Do nothing for fire blocks
        } else if (destroySpeed !== -1.0 && destroySpeed <= dynamicThreshold && currentTick > 20) {
            if (destroySpeed <= 0.1) {
                player.level.destroyBlock(blockPos, true, player);
                player.level.destroyBlockProgress(1, blockPos, -1);
                pd.remove("homelander_heat_vision_progress");
            } else {
                let totalHeatNeeded = Math.max(20, destroySpeed * 20) / heatVisionSpeedMultiplier;
                let heatProgress = pd.getInt("homelander_heat_vision_progress") || 0;
                heatProgress++;

                if (heatProgress >= totalHeatNeeded) {
                    player.level.destroyBlock(blockPos, true, player);
                    player.level.destroyBlockProgress(1, blockPos, -1);
                    pd.remove("homelander_heat_vision_progress");
                } else {
                    let crackStage = Math.floor((heatProgress / totalHeatNeeded) * 10);
                    player.level.destroyBlockProgress(1, blockPos, crackStage);
                    pd.putInt("homelander_heat_vision_progress", heatProgress);
                }
            }
        } else if (currentTick > 5) {
            lightUpHomelanderHeatBlock(player, block, blockPos);

            let blockPosAbove = blockPos.above ? blockPos.above() : new BlockPos(blockPos.x, blockPos.y + 1, blockPos.z);
            let blockAbove = player.level.getBlock(blockPosAbove);
            if (blockAbove.id === "minecraft:air" && block.blockState.isSolid()) {
                blockAbove.set("minecraft:fire");
            }
        } else {
            pd.remove("homelander_heat_vision_progress");
        }
    }
});

function lightUpHomelanderHeatBlock(player, block, blockPos) {
    const blockId = block.id;

    if (blockId === "minecraft:furnace" || blockId === "minecraft:blast_furnace" || blockId === "minecraft:smoker") { 
        block.mergeEntityData({
            BurnTime: 160
        });

        const props = block.getProperties();
        const newProps = {
            facing: props.facing,
            lit: true
        };
        block.set(block.id, newProps);
    }

    else if (blockId.includes("candle")) {
        const props = block.getProperties();
        const newProps = {
            candles: props.candles,
            waterlogged: props.waterlogged,
            lit: true
        };
        block.set(block.id, newProps);
    }
    else if (blockId === "minecraft:campfire" || blockId === "minecraft:soul_campfire") {
        const props = block.getProperties();
        const newProps = {
            facing: props.facing,
            signal_fire: props.signal_fire,
            waterlogged: props.waterlogged,
            lit: true
        };
        block.set(block.id, newProps);
    }
}