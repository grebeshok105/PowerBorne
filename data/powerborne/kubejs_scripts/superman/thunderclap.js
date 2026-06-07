let Vec3 = Java.loadClass('net.minecraft.world.phys.Vec3');

const THUNDERCLAP_RANGE = 11;
const THUNDERCLAP_DAMAGE_MAX = 15;
const THUNDERCLAP_DAMAGE_MIN = 3;
const THUNDERCLAP_KNOCKBACK_STRENGTH = 4.0;
const THUNDERCLAP_KNOCKBACK_HEIGHT = 0.15;
const THUNDERCLAP_RADIUS = 1.5;

const data_particles = {
    "Damage": 0,
    "Gravity": 0,
    "Lifetime": 8,
    "DieOnEntityHit": false,
    "Appearances": [
        {
            "Type": "particles",
            "ParticleType": "powerborne:white_boom",
            "Spread": 0
        }
    ]
};

function getThunderclapDamage(distance) {
    const clamped = Math.max(0, Math.min(distance, THUNDERCLAP_RANGE));

    const t = clamped / THUNDERCLAP_RANGE;
    return THUNDERCLAP_DAMAGE_MAX + (THUNDERCLAP_DAMAGE_MIN - THUNDERCLAP_DAMAGE_MAX) * t;
}

function applyThunderclapEffect(player, targetEntity, distance) {
    let dx = targetEntity.x - player.x;
    let dz = targetEntity.z - player.z;
    let planarDistance = Math.sqrt(dx * dx + dz * dz) || 1;

    let knockbackX = dx / planarDistance;
    let knockbackZ = dz / planarDistance;

    const damage = getThunderclapDamage(distance);
    targetEntity.attack(player.damageSources().playerAttack(player), damage);

    targetEntity.knockback(THUNDERCLAP_KNOCKBACK_STRENGTH, -knockbackX, -knockbackZ);
    targetEntity.addMotion(0, THUNDERCLAP_KNOCKBACK_HEIGHT * THUNDERCLAP_KNOCKBACK_STRENGTH, 0);
}

PlayerEvents.tick(function(event) {
    let player = event.player;
    let timer = global.getAbilityAnimationTicks(player, "powerborne:superman", "thunderclap_kjs_anim", true);
    let prevTimer = player.persistentData.thunderclapPrevTimer || 0;
    player.persistentData.thunderclapPrevTimer = timer;

    if (prevTimer > 0 && timer == 0) {
        global.setPehkuiScale(player, {
            "pehkui:motion": 1.0
        });
    }

    if (timer == 1) {
        global.sound(player, 'powerborne:thunderclap', 1, 1);
        global.setPehkuiScale(player, {
            "pehkui:motion": 0.2
        });
    }
    if (timer == 0) {
    }

    if (abilityUtil.isEnabled(player, "powerborne:superman", "thunderclap")) {  
        let projectile_particles = global.createProjectile(player, 1, data_particles, 1, 1);  
        projectile_particles.spawn();  
        player.level.spawnParticles("minecraft:poof", true, player.x, player.y + 1, player.z, 0, 0, 0, 3, 0.1);  
        global.breakReplaceableInRadius(player.level, player, player.x, player.y, player.z, 4);
          
        let eyePos = new Vec3(player.x, player.y + player.getEyeHeight(), player.z);  
        let lookAngle = player.getLookAngle();  
          
        let affectedEntities = new Set();  

        let targetAABB = player.getBoundingBox()
            .expandTowards(lookAngle.scale(THUNDERCLAP_RANGE))
            .inflate(4, 3, 4);

        let coneEntities = [];
        player.level.getEntitiesWithin(targetAABB).forEach(function(targetEntity) {
            if (!targetEntity.isLiving() || targetEntity === player || !targetEntity.isAlive()) return;

            let entityCenter = new Vec3(targetEntity.x, targetEntity.y + targetEntity.getBbHeight() * 0.5, targetEntity.z);
            let toEntity = entityCenter.subtract(eyePos);
            let distance = toEntity.length();
            if (distance > THUNDERCLAP_RANGE) return;

            if (distance >= 0.001) {
                let toEntityNorm = toEntity.normalize();
                let dotProduct = lookAngle.dot(toEntityNorm);
                if (dotProduct <= 0.5) return;
            }
            if (!player.hasLineOfSight(targetEntity)) return;

            coneEntities.push({ entity: targetEntity, distance: distance });
        });

        coneEntities.forEach(function(entry) {
            applyThunderclapEffect(player, entry.entity, entry.distance);
            affectedEntities.add(entry.entity.getId());
        });

        let radiusEntities = player.level.getEntitiesWithin(player.getBoundingBox().inflate(THUNDERCLAP_RADIUS));
        let radiusHitCount = 0;
        radiusEntities.forEach(function(targetEntity) {
            if (!targetEntity.isLiving() || targetEntity === player || !targetEntity.isAlive()) return;
            if (affectedEntities.has(targetEntity.getId())) return;

            let entityCenter = new Vec3(targetEntity.x, targetEntity.y + targetEntity.getBbHeight() * 0.5, targetEntity.z);
            let distance = eyePos.distanceTo(entityCenter);
            applyThunderclapEffect(player, targetEntity, distance);
            affectedEntities.add(targetEntity.getId());
            radiusHitCount++;
        });

        let totalHit = coneEntities.length + radiusHitCount;
        if (totalHit > 0) {
            global.levelingSystem.awardXPForAbility(player, "powerborne:superman", "thunderclap", { entitiesHit: totalHit });
        }
        global.setPehkuiScale(player, {
            "pehkui:motion": 1.0
        });
    }
});