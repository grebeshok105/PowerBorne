let Integer = Java.loadClass('java.lang.Integer')
let originalRenderDistance = null;
let isFogActive = false;

ClientEvents.tick((event) => {
    let player = event.player;
    let biomeId = player.level.getBiome(player.blockPosition()).key().location().toString();
    let isInHerobrineBiome = (biomeId === 'powerborne:void_room1');

    if (isInHerobrineBiome && !isFogActive) {
        isFogActive = true;
        originalRenderDistance = Client.options.renderDistance().get();
        Client.options.renderDistance().set(Integer.valueOf("5"));
    }
    else if (!isInHerobrineBiome && isFogActive) {
        isFogActive = false;
        if (originalRenderDistance !== null) {
            Client.options.renderDistance().set(originalRenderDistance);
            originalRenderDistance = null;
        }
    }
});

PalladiumEvents.registerGuiOverlays((event) => {
    event.register(
        'powerborne/void_room1_alpha_version',
        (minecraft, gui, poseStack, partialTick, screenWidth, screenHeight) => {
            let player = minecraft.player;
            if (!player) return;

            let biomeId = player.level.getBiome(player.blockPosition()).key().location().toString();
            if (biomeId !== 'powerborne:void_room1') return;

            poseStack.pose().pushPose();
            poseStack.pose().translate(0, 0, 200);
            guiUtil.drawString(poseStack, Component.string('Minecraft Alpha v1.0.16_02'), 3, 3, 0);
            guiUtil.drawString(poseStack, Component.string('Minecraft Alpha v1.0.16_02'), 2, 2, -1);
            poseStack.pose().popPose();
        }
    );
});