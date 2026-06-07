const scrollDropTable = {
    "minecraft:wither_skeleton": 0.05,
    "minecraft:piglin_brute": 0.25,
    "minecraft:ravager": 0.35,
    "minecraft:evoker": 0.5,

    "minecraft:elder_guardian": 0.7,
    "minecraft:warden": 1.0,
    "minecraft:wither": 1.0,
    "minecraft:ender_dragon": 1.0
};

function getRandomAccessoryId() {
    if (!global.accessoryIds || global.accessoryIds.length === 0) {
        return null;
    }
    const excluded = global.scrollExcludedIds || [];
    const filtered = global.accessoryIds.filter(id => !excluded.includes(id));
    if (filtered.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * filtered.length);
    return filtered[randomIndex];
}

function createScrollItem(accessoryId) {
    return Item.of('powerborne:suit_scroll', { AccessoryID: accessoryId });
}

EntityEvents.death((event) => {
    const { entity, source } = event;
    if (source.player == null) return;
    const scrollChance = scrollDropTable[entity.type];
    if (scrollChance && Math.random() < scrollChance) {
        const randomAccessoryId = getRandomAccessoryId();
        if (randomAccessoryId) {
            const scrollItem = createScrollItem(randomAccessoryId);
            entity.block.popItemFromFace(scrollItem, "up");
        }
    }
});