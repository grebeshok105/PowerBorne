let prevCameraType = null;
let wasInTransform = false;
let restoreDelay = 0;

ClientEvents.tick((event) => {
    let player = event.player;
    if (!player) return;
    if (!abilityUtil.hasPower(player, "powerborne:sentry")) return;

    let voidProgress = animationUtil.getAnimationTimerAbilityValue(player, "powerborne:sentry", "void_transform", 0);
    let inTransform = voidProgress > 0 && voidProgress < 0.99;

    if (inTransform) {
        global.screenShake(player, 1, 3);
        let mode = Client.options.getCameraType();
        if (mode !== 'third_person_front') {
            prevCameraType = mode;
            Client.options.setCameraType('third_person_front');
        }
        wasInTransform = true;
        restoreDelay = 0;
    } else {
        if (wasInTransform && prevCameraType !== null) {
            if (voidProgress >= 0.99) {
                restoreDelay = 10;
            } else {
                Client.options.setCameraType(prevCameraType);
                prevCameraType = null;
            }
        }
        wasInTransform = false;

        if (restoreDelay > 0) {
            Client.options.setCameraType('third_person_front');
            restoreDelay--;
            if (restoreDelay <= 0 && prevCameraType !== null) {
                Client.options.setCameraType(prevCameraType);
                prevCameraType = null;
            }
        }
    }
});