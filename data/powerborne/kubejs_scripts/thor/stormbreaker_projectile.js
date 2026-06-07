function isStormbreakerProjectile(entity) {
    return entity &&
        entity.type === 'palladium:custom_projectile' &&
        entity.getTags &&
        entity.getTags().contains('powerborne.stormbreaker_projectile');
}

function killStormbreakerStand(projectile) {
    if (!projectile.getPassengers) return;
    projectile.getPassengers().forEach(passenger => {
        if (passenger.type === "minecraft:armor_stand") {
            passenger.kill();
        }
    });
}

function sweepStormbreakerHits(projectile, owner, lastX, lastY, lastZ) {
    let dx = projectile.x - lastX;
    let dy = projectile.y - lastY;
    let dz = projectile.z - lastZ;
    
    let cur = projectile.getBoundingBox();
    let sweepBB = AABB.of(
        Math.min(cur.minX, cur.minX - dx),
        Math.min(cur.minY, cur.minY - dy),
        Math.min(cur.minZ, cur.minZ - dz),
        Math.max(cur.maxX, cur.maxX - dx),
        Math.max(cur.maxY, cur.maxY - dy),
        Math.max(cur.maxZ, cur.maxZ - dz)
    );

    let candidates = projectile.level.getEntitiesWithin(sweepBB);

    let dmgSrc = owner.damageSources().thrown(projectile, owner);

    candidates.forEach(entity => {
        if (entity.uuid == projectile.uuid) return;
        if (entity.uuid == owner.uuid) return;
        if (!entity.isAlive() || !entity.isLiving() || !entity.attackable()) return;
        if (entity.hurtTime > 0) return;

        entity.attack(dmgSrc, STORMBREAKER_DAMAGE);

        let mag = Math.sqrt(dx * dx + dz * dz);
        if (mag > 0) {
            entity.knockback(0.6, -(dx / mag), -(dz / mag));
        }

        projectile.level.playSound(
            null, entity.x, entity.y, entity.z,
            'powerborne:mjolnir_hit', 'ambient', 0.7, 1
        );
    });
}

PalladiumEvents.customProjectileTick(event => {
    const projectile = event.getProjectile();
    if (!projectile || projectile.level.isClientSide()) return;
    if (!isStormbreakerProjectile(projectile)) return;

    projectile.remainingFireTicks = 0;

    let projUuid = String(projectile.uuid);
    let owner = projectile.getOwner();

    if (!owner || !owner.isPlayer() || !owner.isAlive()) {
        let ownerUsername = projectile.persistentData.OwnerUsername;
        let server = projectile.level.getServer();

        if (server && ownerUsername) {
            let crossDimOwner = server.getPlayerList().getPlayerByName(ownerUsername);
            if (crossDimOwner && crossDimOwner.isAlive()) {
                let saved = projectile.persistentData.SavedStormbreakerItem;
                if (saved) {
                    giveSavedStormbreakerToPlayer(crossDimOwner, snapshotStormbreakerDataForPlayer(saved));
                } else {
                    crossDimOwner.inventory.add(Item.of(STORMBREAKER_ID));
                }
                crossDimOwner.persistentData.remove('StormbreakerThrownItem');
                if (global.mjolnirProjectiles) global.mjolnirProjectiles.forEach(p => p.delete(projUuid));
                killStormbreakerStand(projectile);
                projectile.kill();
                return;
            }
        }

        let returnTicks = projectile.persistentData.ReturnTicks || 0;
        if (returnTicks > 0) {
            spawnStormbreakerStandAt(
                projectile.level,
                projectile.x, projectile.y, projectile.z,
                ownerUsername || "unknown",
                null,
                projectile.persistentData.SavedStormbreakerItem
            );
            if (global.mjolnirProjectiles) global.mjolnirProjectiles.forEach(p => p.delete(projUuid));
            killStormbreakerStand(projectile);
            projectile.kill();
        }
        return;
    }

    let ownerKey = String(owner.uuid);
    if (!global.mjolnirProjectiles.has(ownerKey)) global.mjolnirProjectiles.set(ownerKey, new Set());
    global.mjolnirProjectiles.get(ownerKey).add(projUuid);

    let returnTicks = projectile.persistentData.ReturnTicks || 0;
    let distance = owner.distanceToEntity(projectile);

    let lastX = projectile.persistentData.LastX ?? projectile.x;
    let lastY = projectile.persistentData.LastY ?? projectile.y;
    let lastZ = projectile.persistentData.LastZ ?? projectile.z;

    sweepStormbreakerHits(projectile, owner, lastX, lastY, lastZ);

    projectile.persistentData.LastX = projectile.x;
    projectile.persistentData.LastY = projectile.y;
    projectile.persistentData.LastZ = projectile.z;

    returnTicks = projectile.persistentData.ReturnTicks || 0;

    if (returnTicks > 0 || distance > 3.0) {
        let nearbyEntities = projectile.level.getEntitiesWithin(
            projectile.getBoundingBox().inflate(0.6)
        );
        nearbyEntities.forEach(nearby => {
            if (!nearby.isPlayer() || nearby.username !== owner.username) return;
            if (!nearby.isAlive()) return;

            let saved = projectile.persistentData.SavedStormbreakerItem;
            if (saved) {
                giveSavedStormbreakerToPlayer(nearby, snapshotStormbreakerDataForPlayer(saved));
            } else {
                nearby.inventory.add(Item.of(STORMBREAKER_ID));
            }
            nearby.persistentData.remove('StormbreakerThrownItem');
            let projectiles = global.mjolnirProjectiles.get(String(nearby.uuid));
            if (projectiles) projectiles.delete(projUuid);
            killStormbreakerStand(projectile);
            projectile.kill();
        });
    }

    if (distance > 90 && returnTicks === 0) {
        projectile.persistentData.ReturnTicks = 1;
        projectile.mergeNbt({ "CommandOnBlockHit": "", "CommandOnEntityHit": "" });
        returnTicks = 1;
    }

    if (returnTicks > 0) {
        projectile.persistentData.ReturnTicks = returnTicks + 1;

        if (returnTicks === 1) {
            projectile.mergeNbt({ "CommandOnBlockHit": "", "CommandOnEntityHit": "" });
        }

        let dx = owner.x - projectile.x;
        let dy = owner.y + 1 - projectile.y;
        let dz = owner.z - projectile.z;

        if (returnTicks === 3) {
            global.playSoundLocal(owner, 'powerborne:mjolnir_hum', 'players', 1, 1);
            projectile.setMotion(0, 0, 0);
        }

        if (returnTicks >= 3 || distance > 30) {
            let returnSpeed = Math.min(Math.max(distance / 5, 0.5), 2.2);
            if (projectile.isInWater()) returnSpeed *= 1.3;
            projectile.setMotion(
                dx / distance * returnSpeed,
                dy / distance * returnSpeed,
                dz / distance * returnSpeed
            );
        }
    }

    if (returnTicks === 0 && distance < 90 && projectile.isInWater()) {
        let motion = projectile.getDeltaMovement();
        let mag = Math.sqrt(
            motion.get("x") * motion.get("x") +
            motion.get("y") * motion.get("y") +
            motion.get("z") * motion.get("z")
        );
        if (mag > 0.1) {
            projectile.addMotion(
                (motion.get("x") / mag) * (mag / 5),
                (motion.get("y") / mag) * (mag / 5),
                (motion.get("z") / mag) * (mag / 5)
            );
        }
    }
});