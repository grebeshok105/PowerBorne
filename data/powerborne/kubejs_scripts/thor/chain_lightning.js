const LCHAIN = {
    PROJECTILE_TAG: 'powerborne.chain_lightning',
    DAMAGE: 7.0,
    MAX_BOUNCES: 12,
    MAX_HITS_PER_ENTITY: 4,
    SEARCH_RADIUS: 9,
    PROJECTILE_SPEED: 2.0,
    XP_CAP: 3,
};

let ClipContext = Java.loadClass('net.minecraft.world.level.ClipContext');
let HitResultType = Java.loadClass('net.minecraft.world.phys.HitResult$Type');

function hasClearLine(level, fromX, fromY, fromZ, toX, toY, toZ, contextEntity) {
    try {
        const from = new Vec3(fromX, fromY, fromZ);
        const to = new Vec3(toX, toY, toZ);

        const ctx = new ClipContext(from, to, ClipContext.Block.COLLIDER, ClipContext.Fluid.NONE, contextEntity || null);
        const hit = level.clip(ctx);

        return hit.getType() === HitResultType.MISS;
    } catch (e) {
        return true;
    }
}

function canChainSee(originEntity, targetEntity) {
    if (!originEntity || !targetEntity) return false;

    if (typeof originEntity.hasLineOfSight === 'function') {
        return originEntity.hasLineOfSight(targetEntity);
    }

    const a = getEntityCenter(originEntity);
    const b = getEntityCenter(targetEntity);
    return hasClearLine(originEntity.level, a.x, a.y, a.z, b.x, b.y, b.z, originEntity);
}

function getSafeHeight(entity) {
  if (!entity) return 1.5;
  try {
    return entity.getBoundingBox().getYsize();
  } catch (e) {
    return 1.5;
  }
}

function getEntityCenter(entity) {
    let h = getSafeHeight(entity);
    return { x: entity.x, y: entity.y + (h * 0.5), z: entity.z };
}

function normalizeVec(x, y, z) {
    let len = Math.sqrt(x * x + y * y + z * z);
    if (len <= 0.00001 || isNaN(len)) return { x: 0, y: 0, z: 0, length: 0 };
    return { x: x / len, y: y / len, z: z / len, length: len };
}

function getProjectileMotion(projectile) {
    let m = projectile.getDeltaMovement();
    return { x: m.get("x"), y: m.get("y"), z: m.get("z") };
}

function setProjectileMotion(projectile, x, y, z) {
    if (isNaN(x) || isNaN(y) || isNaN(z)) return;
    projectile.setMotion(x, y, z);
    projectile.hasImpulse = true;
}

function pickNextChainTarget(level, originEntity, owner, historyObj, searchRadius) {
    let nearby = level.getEntitiesWithin(originEntity.getBoundingBox().inflate(searchRadius));

    let visibleTargets = [];

    nearby.forEach(e => {
        if (!e) return;
        if (owner && e.uuid == owner.uuid) return;
        if (e.type === 'palladium:custom_projectile') return;
        if (!e.isLiving() || !e.isAlive() || !e.attackable()) return;

        let hitCount = historyObj[String(e.uuid)] || 0;
        if (hitCount >= LCHAIN.MAX_HITS_PER_ENTITY) return;

        const visible = canChainSee(originEntity, e);
        if (visible) visibleTargets.push(e);
    });

    let pool = visibleTargets;
    if (pool.length === 0) {
        return null;
    }

    let different = pool.filter(e => String(e.uuid) !== String(originEntity.uuid));
    let candidates = (different.length > 0) ? different : pool;

    let best = null;
    let bestDist = Infinity;
    candidates.forEach(e => {
        let d = originEntity.distanceToSqr(e);
        if (d < bestDist) {
            bestDist = d;
            best = e;
        }
    });

    return best;
}

PalladiumEvents.customProjectileTick(event => {
    let projectile = event.getProjectile();
    if (!projectile || projectile.level.isClientSide()) return;
    if (!projectile.getTags().contains(LCHAIN.PROJECTILE_TAG)) return;

    let delay = projectile.persistentData.HomingDelay || 0;
    if (delay > 0) {
        projectile.persistentData.HomingDelay = delay - 1;
        let m = getProjectileMotion(projectile);
        setProjectileMotion(projectile, m.x, m.y - 0.05, m.z);
        return;
    }

    let targetUUID = projectile.persistentData.chainTarget;

    if (targetUUID) {
        let target = projectile.level.getEntity(targetUUID);
        if (!target || !target.isAlive()) {
            if (projectile.persistentData.IsChainBounce) {
                projectile.discard();
                return;
            }
            targetUUID = null;
            projectile.persistentData.remove("chainTarget");
        }
    }

    if (targetUUID) {
        let target = projectile.level.getEntity(targetUUID);
        if (target) {
            let tc = getEntityCenter(target);
            let distToTarget = Math.sqrt(
                Math.pow(tc.x - projectile.x, 2) +
                Math.pow(tc.y - projectile.y, 2) +
                Math.pow(tc.z - projectile.z, 2)
            );
            if (distToTarget > 2.0) {
                let ok = hasClearLine(
                    projectile.level,
                    projectile.x, projectile.y + 0.25, projectile.z,
                    tc.x, tc.y, tc.z,
                    projectile
                );
                if (!ok) {
                    targetUUID = null;
                    projectile.persistentData.remove("chainTarget");
                }
            }
        }
    }

    if (!targetUUID) {
        let searchRadius = 2.0;
        let nearby = projectile.level.getEntitiesWithin(projectile.getBoundingBox().inflate(searchRadius));
        let nearest = null;
        let minDist = Infinity;

        nearby.forEach(e => {
            let owner = projectile.getOwner();
            if (owner && e.uuid == owner.uuid) return;
            if (e.type === 'palladium:custom_projectile') return;
            if (!e.isLiving() || !e.isAlive() || !e.attackable()) return;

            let tc = getEntityCenter(e);
            let ok = hasClearLine(
                projectile.level,
                projectile.x, projectile.y + 0.25, projectile.z,
                tc.x, tc.y, tc.z,
                projectile
            );
            if (!ok) return;

            let dist = projectile.distanceToSqr(e);
            if (dist < minDist) {
                minDist = dist;
                nearest = e;
            }
        });

        if (nearest) {
            targetUUID = String(nearest.uuid);
            projectile.persistentData.chainTarget = targetUUID;
        } else {
            return;
        }
    }

    let target = projectile.level.getEntity(targetUUID);
    if (!target || !target.isAlive()) {
        projectile.persistentData.remove("chainTarget");
        return;
    }

    let tc = getEntityCenter(target);
    let dx = tc.x - projectile.x, dy = tc.y - projectile.y, dz = tc.z - projectile.z;
    let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist < 1) {  
        let owner = projectile.getOwner();  
        let damageSource = projectile.level.damageSources().thrown(owner, projectile);  
        target.attack(damageSource, LCHAIN.DAMAGE);
        return;  
    }

    let desired = normalizeVec(dx, dy, dz);
    let currentMotion = getProjectileMotion(projectile);
    let currentNorm = normalizeVec(currentMotion.x, currentMotion.y, currentMotion.z);

    let turnFactor;
    if (!projectile.persistentData.IsChainBounce) {
        turnFactor = 1.0;
    } else if (dist < 1.5) {
        turnFactor = 1.0;
    } else if (dist < 2.5) {
        turnFactor = 0.55 + (2.5 - dist) / 1.0 * 0.45;
    } else {
        turnFactor = 0.55;
    }

    let nx = currentNorm.x + (desired.x - currentNorm.x) * turnFactor;
    let ny = currentNorm.y + (desired.y - currentNorm.y) * turnFactor;
    let nz = currentNorm.z + (desired.z - currentNorm.z) * turnFactor;

    let newNorm = normalizeVec(nx, ny, nz);
    setProjectileMotion(projectile, newNorm.x * LCHAIN.PROJECTILE_SPEED, newNorm.y * LCHAIN.PROJECTILE_SPEED, newNorm.z * LCHAIN.PROJECTILE_SPEED);
});

EntityEvents.hurt(event => {
    const entity = event.entity;
    const source = event.source;
    let projectile = source.immediate;

    if (!projectile || projectile.type !== 'palladium:custom_projectile') projectile = source.actual;
    if (!projectile || projectile.type !== 'palladium:custom_projectile') return;
    if (!projectile.getTags().contains(LCHAIN.PROJECTILE_TAG)) return;
    if (!entity.isLiving() || !entity.isAlive()) return;

    let owner = projectile.getOwner();
    if (!owner) return;

    if (entity.uuid === owner.uuid) {
        event.cancel();
        return;
    }

    let eUuid = String(entity.uuid);

    let lastHitUuid = projectile.persistentData.LastHitUUID;
    let lastHitTick = projectile.persistentData.LastHitTick || 0;
    if (lastHitUuid === eUuid && (projectile.age - lastHitTick) < 9) {
        return;
    }

    entity.potionEffects.add('minecraft:slowness', 100, 2, false, true);
    global.sound(entity, 'powerborne:chain_lightning_hit', 1, 1);

    entity.level.spawnParticles(
        'minecraft:firework', true,
        entity.x, entity.y + getSafeHeight(entity) / 2, entity.z,
        0.3, 0.3, 0.3, 5, 0.1
    );

    if (owner.isPlayer()) {
        let xpHits = projectile.persistentData.ChainLightningXPHits || 0;
        if (xpHits < LCHAIN.XP_CAP) {
            global.levelingSystem.awardXPForAbility(owner, "powerborne:god_of_thunder", "chain_lightning");
            projectile.persistentData.ChainLightningXPHits = xpHits + 1;
        }
    }

    projectile.persistentData.LastHitUUID = eUuid;
    projectile.persistentData.LastHitTick = projectile.age;

    let historyStr = projectile.persistentData.ChainHistory || "{}";
    let historyObj = {};
    try { historyObj = JSON.parse(historyStr); } catch(e) {}
    historyObj[eUuid] = (historyObj[eUuid] || 0) + 1;
    projectile.persistentData.ChainHistory = JSON.stringify(historyObj);

    let bouncesLeft = projectile.persistentData.BouncesLeft;
    if (isNaN(bouncesLeft) || bouncesLeft <= 0) {
        bouncesLeft = LCHAIN.MAX_BOUNCES;
    }
    bouncesLeft--;
    projectile.persistentData.BouncesLeft = bouncesLeft;

    if (bouncesLeft <= 0) {
        projectile.discard();
        return;
    }

    let nextTarget = pickNextChainTarget(entity.level, entity, owner, historyObj, LCHAIN.SEARCH_RADIUS);
    if (!nextTarget) {
        projectile.discard();
        return;
    }

    projectile.persistentData.chainTarget = String(nextTarget.uuid);
    projectile.persistentData.IsChainBounce = 1;
    projectile.mergeNbt({ "Lifetime": projectile.age + 40 });

    let isSameTarget = (String(nextTarget.uuid) === eUuid);

    let targetHurtTime = nextTarget.hurtTime || 0;
    let targetInvulnTime = nextTarget.invulnerableTime || 0;
    let hasInvulnerability = (targetHurtTime > 0 || targetInvulnTime > 0);

    if (isSameTarget || hasInvulnerability) {
        let m = getProjectileMotion(projectile);
        let curNorm = normalizeVec(m.x, m.y, m.z);

        let sign = Math.random() > 0.5 ? 1 : -1;
        let perpX = -curNorm.z * sign;
        let perpZ = curNorm.x * sign;

        let vx = (curNorm.x * 0.2) + (perpX * 0.8);
        let vy = 0.5;
        let vz = (curNorm.z * 0.2) + (perpZ * 0.8);

        let norm = normalizeVec(vx, vy, vz);
        setProjectileMotion(projectile, norm.x * LCHAIN.PROJECTILE_SPEED, norm.y * LCHAIN.PROJECTILE_SPEED, norm.z * LCHAIN.PROJECTILE_SPEED);
        projectile.persistentData.HomingDelay = 5;
    } else {
        let tc = getEntityCenter(nextTarget);
        let dx = tc.x - projectile.x;
        let dy = tc.y - projectile.y;
        let dz = tc.z - projectile.z;
        let norm = normalizeVec(dx, dy, dz);

        setProjectileMotion(projectile, norm.x * LCHAIN.PROJECTILE_SPEED, norm.y * LCHAIN.PROJECTILE_SPEED, norm.z * LCHAIN.PROJECTILE_SPEED);
        projectile.persistentData.HomingDelay = 0;
    }
});