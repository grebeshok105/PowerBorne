let prevCameraType = null;
let wasVortexActive = false;
let wasFlying = false;

ClientEvents.tick(event => {
    let player = event.player;
    if (!abilityUtil.hasPower(player, "powerborne:god_of_thunder")) {
        wasVortexActive = false;
        prevCameraType = null;
        wasFlying = false;
        return;
    }

    let handler = player.palladium$getFlightHandler();  
    let isFlyingType = handler.getFlightType().isNotNull();
    let isFlying = abilityUtil.isEnabled(player, "powerborne:god_of_thunder", "is_flying");
    let isFastFlying = abilityUtil.isEnabled(player, "powerborne:god_of_thunder", "is_fast_flying");
    let isFlightUnlocked = abilityUtil.isUnlocked(player, "powerborne:god_of_thunder", "flight_buy") || (palladium.getProperty(player, "thor_level") || 0) >= 10;
    let isGodMode = abilityUtil.isEnabled(player, "powerborne:god_of_thunder", "god_mode");
    let isHoveringOrFlying = abilityUtil.isEnabled(player, "powerborne:god_of_thunder", "is_hovering_or_flying");
    let horizontalSpeed = handler.getHorizontalSpeed(0);
    let mainHandId = player.getMainHandItem().id;
    let holdsMjolnirOrStormbreaker = mainHandId === 'powerborne:mjolnir' || mainHandId === 'powerborne:stormbreaker';
    if (wasFlying && player.onGround()) {
        player.input.shiftKeyDown = false;
        wasFlying = false;
    }
    if (!holdsMjolnirOrStormbreaker && !isGodMode) {
        if (isFlying && isFlyingType) {
            handler.flightBoost = 1.0;
            player.input.shiftKeyDown = true;
            player.refreshDimensions();
            wasFlying = true;
        }
        if (isHoveringOrFlying) {
            player.setSprinting(false);
        }
    }
    if (holdsMjolnirOrStormbreaker && !isFlightUnlocked && isFastFlying && horizontalSpeed < 0.015) {
        handler.setFlightType(handler.getFlightType().NONE);
        player.refreshDimensions();
    }
    
    let isVortexActive = abilityUtil.isEnabled(player, "powerborne:god_of_thunder", "mjolnir_vortex");
    let cameraType = Client.options.getCameraType();

    if (isVortexActive && !wasVortexActive) {
        if (cameraType === 'first_person') {
            prevCameraType = cameraType;
            Client.options.setCameraType('third_person_back');
        }
    } else if (isVortexActive) {
        if (cameraType === 'first_person') {
            Client.options.setCameraType('third_person_back');
        }
    } else if (wasVortexActive) {
        if (prevCameraType !== null) {
            Client.options.setCameraType(prevCameraType);
            prevCameraType = null;
        }
    }

    wasVortexActive = isVortexActive;
});
