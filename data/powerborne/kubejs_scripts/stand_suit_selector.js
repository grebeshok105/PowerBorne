PalladiumEvents.registerProperties((event) => {
  if (event.getEntityType() === "minecraft:armor_stand" || 
      event.getEntityType() === "palladium:suit_stand") {
      event.registerProperty("stand_suit_variant", 'string', 'null');
  }
});

function getLookedAtArmorStand(player) {
    const result = player.rayTrace(4);
    if (result && result.entity && (result.entity.type === 'minecraft:armor_stand' || result.entity.type === 'palladium:suit_stand')) {
        return result.entity;
    }
    return null;
}

// powerborne:superman_suit' -> 'superman'
function getHeroIdFromChestplateId(itemId) {
    if (!itemId) return null;
    const match = itemId.match(/^powerborne:([a-z0-9_]+)_suit$/);
    return match ? match[1] : null;
}

function hasHeroChestplate(armorStand) {
    const chestplate = armorStand.getChestArmorItem();
    if (!chestplate || !chestplate.id) return false;
    return getHeroIdFromChestplateId(chestplate.id) !== null;
}

function getUnlockedAccessoriesForHero(player, heroId) {
    const unlocked = [heroId];
    const unlockedAccessories = player.persistentData.getCompound('unlockedAccessories');
    for (const id of global.accessoryIds) {
        if (id.startsWith(heroId + "_") && unlockedAccessories.contains(id)) unlocked.push(id);
    }
    return unlocked;
}

function getNextAccessory(current, list, direction) {
    const idx = list.indexOf(current);
    if (idx === -1) return list[0];
    return direction === 1 
        ? list[(idx + 1) % list.length]
        : list[(idx - 1 + list.length) % list.length];
}

const powerId = "powerborne:suit_stand/stand_suit_selector";

PlayerEvents.tick(event => {
    let player = event.player;
    if (!player || !player.isAlive()) return;

    let armorStand = getLookedAtArmorStand(player);
    let hasPower = superpowerUtil.hasSuperpower(player, powerId);
    let isValidStand = armorStand && hasHeroChestplate(armorStand);

    if (isValidStand) {
        if (!hasPower) {
            superpowerUtil.addSuperpower(player, powerId);
        }
    } else {
        if (hasPower) {
            superpowerUtil.removeSuperpower(player, powerId);
        }
        return;
    }

    if (!superpowerUtil.hasSuperpower(player, powerId)) return;

    let upEnabled = abilityUtil.isEnabled(player, powerId, "scroll_up");
    let downEnabled = abilityUtil.isEnabled(player, powerId, "scroll_sdown");

    if (!upEnabled && !downEnabled) return;

    let chestplate = armorStand.getChestArmorItem();
    let heroId = getHeroIdFromChestplateId(chestplate.id);
    if (!heroId) return;

    let current = palladium.getProperty(armorStand, "stand_suit_variant") || heroId;
    let unlocked = getUnlockedAccessoriesForHero(player, heroId);
    let next = upEnabled 
        ? getNextAccessory(current, unlocked, 1)
        : getNextAccessory(current, unlocked, -1);

    if (current !== next) {
        player.level.playSound(null, player.x, player.y, player.z, 'minecraft:item.armor.equip_generic', 'master', 0.35, 1.0);
    }
    
    palladium.setProperty(armorStand, "stand_suit_variant", next);
}); 