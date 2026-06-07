let ResourceLocation = Java.loadClass("net.minecraft.resources.ResourceLocation");
let $Accessory = Java.loadClass("net.threetag.palladium.accessory.Accessory");
let $SupporterHandler = Java.loadClass("net.threetag.palladium.util.SupporterHandler");
let AccessorySlot = Java.loadClass("net.threetag.palladium.accessory.AccessorySlot");
let NBTCompound = Java.loadClass("net.minecraft.nbt.CompoundTag");
let $SyncAccessoriesMessage = Java.loadClass("net.threetag.palladium.network.SyncAccessoriesMessage");

global.accessoryIds = [
    "sentry_black_and_gold",
    "sentry_mcu",
    "sentry_horseman",
    "superman_beyond",
    "superman_maws",
    "superman_maws_v2",
    "superman_justice_lord",
    "superman_cyborg",
    "superman_cyborg_dcamu",
    "superman_absolute",
    "superman_dceu",
    "superman_dcu",
    "thor_classic",
    "thor_herald",
    "thor_unworthy",
    "thor_avengers",
    "thor_infinity_war_v1",
    "thor_infinity_war_v2",
    "thor_love_and_thunder",
    "thor_love_and_thunder_extreme",
    "captain_america_the_captain",
    "captain_america_bucky",
    "captain_america_hydra_supreme",
    "captain_america_civil_warrior",
    "captain_america_first_avenger",
    "sentry_void_merged"
];

global.scrollExcludedIds = [
    "sentry_void_merged"
];

function updateSupporterHandlerData(player) {
    const supporterData = $SupporterHandler.getPlayerData(player.getUuid());
    const playerData = player.persistentData;

    let accessoriesField = supporterData.getClass().getDeclaredField("accessories");
    accessoriesField.setAccessible(true);
    let accessoriesList = accessoriesField.get(supporterData);

    let unlockedAccessories = playerData.contains('unlockedAccessories')
        ? playerData.getCompound('unlockedAccessories')
        : new NBTCompound();

    for (let accessoryId of global.accessoryIds) {
        let accessory = $Accessory.REGISTRY.get(new ResourceLocation("powerborne", accessoryId));
        if (!accessory) continue;

        if (unlockedAccessories.contains(accessoryId)) {
            if (!accessoriesList.contains(accessory)) {
                accessoriesList.add(accessory);
            }
        } else {
            // Remove if no longer unlocked
            accessoriesList.remove(accessory);
        }
    }

    // Sync equipped accessories
    $Accessory.getPlayerData(player).ifPresent(accessoryData => {
        new $SyncAccessoriesMessage(player.getId(), accessoryData.accessories).send(player);
    });

    sendUnlockedToClient(player);
}

function sendUnlockedToClient(player) {
    const playerData = player.persistentData;
    let data = { _clear: true };
    if (playerData.contains('unlockedAccessories')) {
        let unlockedAccessories = playerData.getCompound('unlockedAccessories');
        for (let accessoryId of global.accessoryIds) {
            if (unlockedAccessories.contains(accessoryId)) {
                data[accessoryId] = true;
            }
        }
    }
    player.sendData('sync_unlocked_accessories', data);
}

function makeAccessoriesExclusive() {
    global.accessoryIds.forEach(accessoryId => {
        const accessory = $Accessory.REGISTRY.get(new ResourceLocation("powerborne", accessoryId));
        if (accessory) {
            accessory.setExclusive();
        }
    });
}

ServerEvents.loaded(event => {
    makeAccessoriesExclusive();
});

function unlockAccessoryWithScroll(event) {
    const player = event.player;
    const itemStack = event.item;
    const nbtData = itemStack.nbt;
    if (nbtData && nbtData.contains("AccessoryID")) {
        const accessoryId = nbtData.getString("AccessoryID");
        const accessory = $Accessory.REGISTRY.get(new ResourceLocation("powerborne", accessoryId));
        if (accessory) {
            const playerData = player.persistentData;
            let unlockedAccessories = playerData.getCompound('unlockedAccessories');
            if (!playerData.contains('unlockedAccessories')) {
                unlockedAccessories = new NBTCompound();
                playerData.put('unlockedAccessories', unlockedAccessories);
            }

            if (unlockedAccessories.contains(accessoryId)) {
                player.sendData('accessory_already_unlocked', { accessoryId: accessoryId });
                return;
            }

            unlockedAccessories.putBoolean(accessoryId, true);
            updateSupporterHandlerData(player);

            global.playSoundLocal(player, 'minecraft:ui.cartography_table.take_result', 'players', 1, 1);
            player.sendData('accessory_unlocked_toast', { accessoryId: accessoryId });
            itemStack.shrink(1);
        }
    }
}

ItemEvents.rightClicked("powerborne:scroll", unlockAccessoryWithScroll);

PlayerEvents.loggedIn((event) => {
    let player = event.player;
    event.server.scheduleInTicks(60, _ => {
        if (player && !player.isRemoved()) {
            updateSupporterHandlerData(player);
        }
    });
});

global.unlockAccessory = function (player, accessoryId) {
    const accessory = $Accessory.REGISTRY.get(new ResourceLocation("powerborne", accessoryId));
    if (!accessory) return false;

    const playerData = player.persistentData;
    let unlockedAccessories = playerData.getCompound('unlockedAccessories');
    if (!playerData.contains('unlockedAccessories')) {
        unlockedAccessories = new NBTCompound();
        playerData.put('unlockedAccessories', unlockedAccessories);
    }

    if (unlockedAccessories.contains(accessoryId)) return false;

    unlockedAccessories.putBoolean(accessoryId, true);
    updateSupporterHandlerData(player);

    player.sendData('accessory_unlocked_toast', { accessoryId: accessoryId });
    global.sound(player, 'minecraft:ui.cartography_table.take_result');
    return true;
};

let $MerchantOffer = Java.loadClass("net.minecraft.world.item.trading.MerchantOffer");

EntityEvents.spawned("wandering_trader", event => {
    let trader = event.entity;
    if (trader.persistentData.getBoolean("powerborne_scroll_trade_added")) return;

    function getRandomAccessoryId() {
        let arr = global.accessoryIds.filter(id => !global.scrollExcludedIds.includes(id));
        if (!arr || arr.length === 0) return "sentry_black_and_gold";
        return arr[Math.floor(Math.random() * arr.length)];
    }
    let accessoryId = getRandomAccessoryId();
    let scroll = Item.of("powerborne:suit_scroll", { AccessoryID: accessoryId });
    let offer = new $MerchantOffer(Item.of("emerald", 24 + Math.floor(Math.random() * 8)), scroll, 1, 2, 0.1);

    event.server.scheduleInTicks(4, _ => {
        trader.offers.add(offer);
        trader.persistentData.putBoolean("powerborne_scroll_trade_added", true);
    });
});