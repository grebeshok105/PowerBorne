PalladiumEvents.registerPropertiesClientSided((event) => {
    if (event.getEntityType() === "minecraft:player") {
        event.registerProperty("screen_shake_timer", 'integer', 0);
    }
});

global.screenShake = (entity, baseIntensity, maxIntensity) => {
    let newYaw = entity.getYaw() + ((Math.random() * maxIntensity - maxIntensity / 2) * baseIntensity);
    let newPitch = entity.getPitch() + ((Math.random() * maxIntensity - maxIntensity / 2) * baseIntensity);
    entity.setYaw(newYaw);
    entity.setPitch(newPitch);
};

let p_ss_timer = 0;
let base_intensity = 0;
let max_intensity = 0;
NetworkEvents.dataReceived('screen_shake', e => {
    p_ss_timer = e.data.ticks;
    base_intensity = e.data.base_intensity;
    max_intensity = e.data.max_intensity;
})

ClientEvents.tick(event => {
    let entity = event.player;
    if (p_ss_timer > 0) {
        global.screenShake(entity, base_intensity, max_intensity);
        p_ss_timer--;
    }
    palladium.abilities.getEntries(entity).forEach(entry => {
        if (entry.getConfiguration().ability.id == 'powerborne:screen_shake' && entry.enabled) {
            if (entry.getPropertyByName('base_intensity') && entry.getPropertyByName('max_intensity')) {
                let base_intensity = entry.getPropertyByName('base_intensity');
                let max_intensity = entry.getPropertyByName('max_intensity');
                global.screenShake(entity, base_intensity, max_intensity);
            }
        }
    })
});