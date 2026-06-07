PalladiumEvents.registerPropertiesClientSided((event) => {
    if (event.getEntityType() === "minecraft:player") {
        event.registerProperty("energy_bar_arc", 'integer', 0);
        event.registerProperty("energy_bar_arc_max", 'integer', 1000);
        event.registerProperty("iron_man_reactor_swap_ticks", 'integer', 0);
        event.registerProperty("iron_man_reactor_status", 'integer', 0);
    }
});

function ironManOverlayText(player) {
    let targeting = abilityUtil.isEnabled(player, 'powerborne:iron_man', 'targeting_hud');
    let swapTicks = palladium.getProperty(player, 'iron_man_reactor_swap_ticks') || 0;
    let status = palladium.getProperty(player, 'iron_man_reactor_status') || 0;
    let energy = palladium.getProperty(player, 'energy_bar_arc') || 0;
    let max = palladium.getProperty(player, 'energy_bar_arc_max') || 1000;

    if (!targeting && swapTicks <= 0 && status !== 3) return null;

    if (swapTicks > 0) {
        let progress = Math.max(0, Math.min(100, 100 - swapTicks));
        return {
            title: 'JARVIS // REACTOR SWAP',
            body: `${progress}%  ARC ${energy}/${max}`,
            color: 0x66E4FF
        };
    }

    if (status === 3) {
        return {
            title: 'JARVIS // ARC OFFLINE',
            body: `REACTOR REQUIRED  ${energy}/${max}`,
            color: 0xFF5A4A
        };
    }

    return {
        title: 'JARVIS // TARGETING',
        body: `LOCK RANGE 28M  ARC ${energy}/${max}`,
        color: 0x66E4FF
    };
}

PalladiumEvents.registerGuiOverlays((event) => {
    event.register(
        'powerborne/iron_man_jarvis_overlay',
        (minecraft, gui, poseStack, partialTick, screenWidth, screenHeight) => {
            if (minecraft.options.hideGui) return;

            let player = minecraft.player;
            if (!player || !abilityUtil.hasPower(player, 'powerborne:iron_man')) return;

            let text = ironManOverlayText(player);
            if (!text) return;

            let x = screenWidth - 132;
            let y = 34;
            poseStack.pose().pushPose();
            poseStack.pose().translate(0, 0, 200);
            guiUtil.drawString(poseStack, Component.string(text.title), x + 1, y + 1, 0x55000000);
            guiUtil.drawString(poseStack, Component.string(text.title), x, y, text.color);
            guiUtil.drawString(poseStack, Component.string(text.body), x + 1, y + 11, 0x55000000);
            guiUtil.drawString(poseStack, Component.string(text.body), x, y + 10, 0xF4F7D7);
            poseStack.pose().popPose();
        }
    );
});
