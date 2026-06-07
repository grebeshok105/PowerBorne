let $SystemToast = Java.loadClass("net.minecraft.client.gui.components.toasts.SystemToast");
let $Minecraft = Java.loadClass("net.minecraft.client.Minecraft");
let ResourceLocation = Java.loadClass("net.minecraft.resources.ResourceLocation");
let $Accessory = Java.loadClass("net.threetag.palladium.accessory.Accessory");
let $SupporterHandler = Java.loadClass("net.threetag.palladium.util.SupporterHandler");

let accessoryIds = [
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

ClientEvents.loggedIn(event => {
    accessoryIds.forEach(accessoryId => {
        const accessory = $Accessory.REGISTRY.get(new ResourceLocation("powerborne", accessoryId));
        if (accessory) {
            accessory.setExclusive();
        }
    });
});

NetworkEvents.dataReceived('sync_unlocked_accessories', event => {
    let mc = $Minecraft.getInstance();
    let player = mc.player;
    if (!player) return;

    let supporterData = $SupporterHandler.getPlayerData(player.getUuid());
    let accessoriesField = supporterData.getClass().getDeclaredField("accessories");
    accessoriesField.setAccessible(true);
    let accessoriesList = accessoriesField.get(supporterData);

    let data = event.data;
    let keys = data.getAllKeys();
    let iterator = keys.iterator();

    while (iterator.hasNext()) {
        let accessoryId = iterator.next();
        let accessory = $Accessory.REGISTRY.get(new ResourceLocation("powerborne", accessoryId));
        if (accessory && !accessoriesList.contains(accessory)) {
            accessoriesList.add(accessory);
        }
    }
});

const ACCESSORY_HERO_PREFIXES = ['captain_america', 'sentry', 'superman', 'thor'];

function getHeroIdForAccessory(accessoryId) {
    for (let i = 0; i < ACCESSORY_HERO_PREFIXES.length; i++) {
        let prefix = ACCESSORY_HERO_PREFIXES[i];
        if (accessoryId === prefix || accessoryId.startsWith(prefix + '_')) {
            return prefix;
        }
    }
    let match = accessoryId.match(/^([a-z0-9]+)(?:_|$)/);
    return match ? match[1] : accessoryId;
}

function buildAccessoryDisplayComponent(accessoryId) {
    let accessoryKey = 'accessory.powerborne.' + accessoryId;
    let heroId = getHeroIdForAccessory(accessoryId);
    if (heroId) {
        let heroKey = 'accessory_slot.powerborne.' + heroId;
        return Component.translate(heroKey)
            .append(Component.literal(' ('))
            .append(Component.translate(accessoryKey))
            .append(Component.literal(')'));
    }

    return Component.translate(accessoryKey);
}

NetworkEvents.dataReceived('accessory_unlocked_toast', e => {
    const minecraft = $Minecraft.getInstance();
    $SystemToast.add(
        minecraft.getToasts(),
        "PERIODIC_NOTIFICATION",
        Component.translate('messages.powerborne.accessory_unlocked'),
        buildAccessoryDisplayComponent(e.data.accessoryId)
    );
});

NetworkEvents.dataReceived('accessory_already_unlocked', e => {
    Client.player.tell(
        Text.of(Component.translate('messages.powerborne.already_unlocked')).red()
            .append(Text.of(buildAccessoryDisplayComponent(e.data.accessoryId)).white())
    );
});

NetworkEvents.dataReceived('status_message', e => {
    Client.player.setStatusMessage(Component.translate(e.data.message));
});
