let start = true;
let $ProjectileUtil = Java.loadClass('net.minecraft.world.entity.projectile.ProjectileUtil')
let $ParticleTypes = Java.loadClass("net.minecraft.core.particles.ParticleTypes")
// xray vision particle

ClientEvents.tick(event => {  
    let player = event.player; 
    if (player != null) {
        let abilityInstance = abilityUtil.getInstance(player, "powerborne:superman", "super_punch_timer");
        if (abilityInstance && !abilityInstance.isEnabled()) {
            abilityInstance.setUniquePropertyByName("value", Integer.valueOf("0"));  
            abilityInstance.setUniquePropertyByName("prev_value", Integer.valueOf("0"));
        }
        let level = player.level;
        let xrayProgress = animationUtil.getAnimationTimerAbilityValue(player, "powerborne:superman", "xray_animation", 0);  
        if (level != null) {
            let mode = Client.options.getCameraType();
            if (xrayProgress > 0 && xrayProgress < 0.15 && start && mode == 'first_person') {
                let lookAngle = player.lookAngle;  
                let distance = 0.2;
                let particleX = player.x + lookAngle.x() * distance;  
                let particleY = player.y + player.getEyeHeight();  
                let particleZ = player.z + lookAngle.z() * distance;  
                  
                level.addAlwaysVisibleParticle($ParticleTypes.FLASH, particleX, particleY, particleZ, 0, 0, 0);  
                start = false;  
            } else if (xrayProgress == 0) {  
                start = true;  
            } else {
                start = false;
            }
        }  
    }  
});

PalladiumEvents.registerPropertiesClientSided((event) => {
    if (event.getEntityType() === "minecraft:player") {
        event.registerProperty("looked_entity_health", 'integer', 0);
    }
});

PalladiumEvents.registerGuiOverlays((event) => {
    event.register(
      'powerborne/xray_entity_info',
      (minecraft, gui, poseStack, partialTick, screenWidth, screenHeight) => {
        let left = screenWidth / 2 + 20
        let top = screenHeight / 2 - 5
  
        if (!abilityUtil.isEnabled(minecraft.player, "powerborne:superman", "xray_animation")) return
  
        let range = 50
        let hit = advancedRayTrace(minecraft.player, minecraft.player.level, range, true, 0.3)
        let entity = hit ? hit.entity : null
  
        if (entity != null && entity.isLiving()) {
          let hp = entity.getHealth() + entity.getAbsorptionAmount()
          palladium.setProperty(minecraft.player, "looked_entity_health", hp)
  
          guiUtil.drawString(
            poseStack,
            Component.translate("overlay.powerborne.xray.name", entity.getName()),
            left,
            top - 10,
            0xA2C8F6
          )
  
          guiUtil.drawString(
            poseStack,
            Component.translate("overlay.powerborne.xray.health", String(Math.round(hp * 10) / 10)),
            left,
            top,
            0xA2C8F6
          )
        }
      }
    )
  })

function advancedRayTrace(entity, level, distance, ignoreBlocks, lookRadius) {
    lookRadius = lookRadius || 0;
    let eyePos = entity.eyePosition;
    let viewVec = entity.getViewVector(1)
    
    let blockHitDistance = distance;
    let blockHit = null;
    
    if (!ignoreBlocks) {
        let clip = new $ClipContext(
            entity.getEyePosition(1), 
            entity.getEyePosition(1).add(entity.getLookAngle().scale(distance)), 
            'collider', 'none', 
            entity
        )
        blockHit = level.clip(clip)
        
        if (blockHit && blockHit.getBlockPos()) {
            let hitPos = blockHit.getLocation()
            blockHitDistance = eyePos.distanceTo(hitPos)
        }
    }
    
    let entityEndPos = eyePos.add(viewVec.x() * blockHitDistance, viewVec.y() * blockHitDistance, viewVec.z() * blockHitDistance)
    let aabb = AABB.of(eyePos.x(), eyePos.y(), eyePos.z(), entityEndPos.x(), entityEndPos.y(), entityEndPos.z())

    let entityHit = $ProjectileUtil.getEntityHitResult(level, entity, eyePos, entityEndPos, aabb, (e) => {
        return !e.isSpectator()
    }, lookRadius)

    if (entityHit != null && !ignoreBlocks) {
        let entityHitDistance = eyePos.distanceTo(entityHit.getLocation())
        if (entityHitDistance >= blockHitDistance) {
            entityHit = null
        }
    }
    
    return {
        block: blockHit && blockHit.getBlockPos() ? level.getBlock(blockHit.getBlockPos()) : null,
        entity: entityHit ? entityHit.entity : null
    }
};

NetworkEvents.dataReceived('sunTotemAnimation', e => Client.gameRenderer.displayItemActivation(e.data.item))
