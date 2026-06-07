let $BlockPos = Java.loadClass("net.minecraft.core.BlockPos");
let $ItemEntity = Java.loadClass("net.minecraft.world.entity.item.ItemEntity");

let trackedBrewingStands = new Map();

function trackBrewingStand(level, x, y, z) {
    let dim = level.dimension.toString();
    if (!trackedBrewingStands.has(dim)) {
        trackedBrewingStands.set(dim, new Set());
    }
    trackedBrewingStands.get(dim).add(`${x},${y},${z}`);
}

function untrackBrewingStand(level, x, y, z) {
    let dim = level.dimension.toString();
    if (trackedBrewingStands.has(dim)) {
        trackedBrewingStands.get(dim).delete(`${x},${y},${z}`);
    }
}

function isGoldenSerumPotion(item) {
    if (item.isEmpty()) return false;
    let id = item.id;
    if (id !== 'minecraft:potion' && id !== 'minecraft:splash_potion' && id !== 'minecraft:lingering_potion') return false;
    return item.nbt.get('Potion') == 'powerborne:golden_serum';
}

function makeAwkwardVersion(item) {
    return Item.of(item.id, '{Potion:"minecraft:awkward"}');
}

function getDropItem(item) {
    if (isGoldenSerumPotion(item)) {
        return makeAwkwardVersion(item);
    }
    return item.copy();
}

BlockEvents.placed(event => {
    let block = event.block;
    if (!block || block.id !== "minecraft:brewing_stand") return;
    trackBrewingStand(event.level, block.x, block.y, block.z);
});

BlockEvents.rightClicked(event => {
    let block = event.block;
    if (!block || block.id !== "minecraft:brewing_stand") return;
    trackBrewingStand(event.level, block.x, block.y, block.z);
});

BlockEvents.broken(event => {
    let block = event.block;
    if (!block || block.id !== "minecraft:brewing_stand") return;
    untrackBrewingStand(event.level, block.x, block.y, block.z);
});

ServerEvents.tick(event => {
    if (event.server.tickCount % 20 !== 0) return;

    trackedBrewingStands.forEach((positions, dim) => {
        let level = event.server.getLevel(dim);
        if (!level) return;

        let toRemove = [];

        positions.forEach(posStr => {
            let [x, y, z] = posStr.split(',').map(Number);

            let block = level.getBlock(x, y, z);

            if (block.id !== "minecraft:brewing_stand") {
                toRemove.push(posStr);
                return;
            }

            let be = block.getEntity();
            if (!be) return;

            if (be.getItem(3).id !== 'minecraft:enchanted_golden_apple') return;

            let changed = false;

            let item0 = be.getItem(0);
            if (!item0.isEmpty()) {
                let item1 = be.getItem(1);
                if (item1.isEmpty()) {
                    be.setItem(1, item0.copy());
                } else {
                    let dropItem = getDropItem(item0);
                    level.addFreshEntity(new $ItemEntity(level, x + 0.5, y + 1.0, z + 0.5, dropItem));
                }
                be.setItem(0, Item.of('minecraft:air'));
                changed = true;
            }

            let item2 = be.getItem(2);
            if (!item2.isEmpty()) {
                let dropItem = getDropItem(item2);
                level.addFreshEntity(new $ItemEntity(level, x + 0.5, y + 1.0, z + 0.5, dropItem));
                be.setItem(2, Item.of('minecraft:air'));
                changed = true;
            }

            if (changed) {
                be.setChanged();
            }
        });

        toRemove.forEach(pos => positions.delete(pos));
    });
});

PlayerEvents.tick(event => {
    let player = event.player;
    let containerMenu = player.containerMenu;

    if (containerMenu.toString().includes('BrewingStandMenu') || containerMenu.toString().includes('class_1708')) {
        let ingredientSlot = containerMenu.getSlot(3);
        let ingredient = ingredientSlot.getItem();

        if (ingredient.id === 'minecraft:enchanted_golden_apple') {
            player.sendData("lock_side_slots", {});

            let slot0 = containerMenu.getSlot(0);
            let slot1 = containerMenu.getSlot(1);
            let slot2 = containerMenu.getSlot(2);

            if (slot0.hasItem()) {
                let item0 = slot0.getItem();
                if (!slot1.hasItem()) {
                    slot1.set(item0);
                    slot0.set(Item.of('minecraft:air'));
                } else {
                    player.give(item0.copy());
                    slot0.set(Item.of('minecraft:air'));
                }
            }

            if (slot2.hasItem()) {
                player.give(slot2.getItem().copy());
                slot2.set(Item.of('minecraft:air'));
            }
        } else {
            player.sendData("clear_widgets", {});
        }
    }
});

NetworkEvents.dataReceived("button_error", (event) => {
    let player = event.player;
    global.sound(player, 'minecraft:block.note_block.didgeridoo', 0.6, 0.1, 0);
});