let speedModifierUUID = 'e0f4e796-3d3d-11ee-be56-0242ac183754';

LevelEvents.tick(event => {
    let level = event.level;
    if (!global.entitiesWithVoidEffect || global.entitiesWithVoidEffect.size === 0) return;

    let uuids = Array.from(global.entitiesWithVoidEffect);
    let entities = [];

    uuids.forEach(function(uuid) {
        let entity = level.getEntity(uuid);
        if (entity) {
            entities.push([entity, uuid]);
        } else {
            global.entitiesWithVoidEffect.delete(String(uuid));
        }
    });

    entities.forEach(([ entity, uuid ]) => {
        if (!entity || !entity.isAlive()) {
            global.entitiesWithVoidEffect.delete(String(uuid));
            return;
        }

        let hasVoidEffect = false;
        entity.activeEffects.forEach(effect => {
            if (effect.descriptionId === "effect.powerborne.void_banishment") hasVoidEffect = true;
        });

        if (!hasVoidEffect) {
            entity.removeAttribute('minecraft:generic.movement_speed', speedModifierUUID);
            if (entity instanceof $Merchant) {
                entity.setTradingPlayer(null)
            }
            if (entity.isPlayer()) return;
            entity.setNoAi(false);
            entity.setSilent(false);
            entity.setInvulnerable(false);
            try { entity.setPose('standing'); } catch (e) {}
            try { global.setPehkuiScale(entity, { "pehkui:height": 1.0, "pehkui:width": 1.0 }); } catch (e) {}
            if (superpowerUtil && superpowerUtil.hasSuperpower(entity, "powerborne:shadow")) {
                superpowerUtil.removeSuperpower(entity, "powerborne:shadow");
            }

            try {
                if (entity.persistentData.getBoolean('powerborne_void_equipment_saved')) {
                    let slots = ['mainhand','offhand','head','chest','legs','feet'];
                    slots.forEach(slot => {
                        const key = `powerborne_void_${slot}`;
                        if (entity.persistentData.contains(key)) {
                            const saved = entity.persistentData.get(key);
                            if (saved && saved.id) {
                                let stack = Item.of(String(saved.id));
                                if (saved.tag) stack = stack.withNBT(saved.tag);
                                const cnt = (saved.count || saved.Count || 1);
                                if (cnt > 1) stack = stack.withCount(cnt);
                                entity.setItemSlot(slot, stack);
                            }
                            entity.persistentData.remove(key);
                        }
                    });
                    entity.persistentData.remove('powerborne_void_equipment_saved');
                }
            } catch (e) {}
            global.entitiesWithVoidEffect.delete(String(uuid));
        }
    });
});