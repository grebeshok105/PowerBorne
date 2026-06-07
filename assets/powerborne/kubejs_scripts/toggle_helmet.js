PalladiumEvents.registerPropertiesClientSided((event) => {
    if (event.getEntityType() === "minecraft:player") {
        event.registerProperty("toggle_helmet", 'integer', 1);
    }
});

const TOGGLE_HELMET_POWERS = [
    "powerborne:captain_america",
    "powerborne:god_of_thunder",
];

ClientEvents.tick(() => {
    let key = global.POWERBORNE_TOGGLE_HELMET_KEY;
    if (key) {
        if (key.consumeClick()) {
            let player = Client.player;
            if (player) {
                if (TOGGLE_HELMET_POWERS.some(power => abilityUtil.isEnabled(player, power, "can_toggle_helmet"))) {
                    let raw = palladium.getProperty(player, "toggle_helmet");
                    let cur = raw == null ? 1 : Number(raw);
                    let next = cur === 1 ? 0 : 1;
                    palladium.setProperty(player, "toggle_helmet", next);
                    player.sendData("toggle_helmet", { toggle_helmet: next });
                }
            }
        }
    }
});