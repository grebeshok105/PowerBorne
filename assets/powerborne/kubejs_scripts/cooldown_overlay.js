let $AbilityBarRenderer = Java.loadClass('net.threetag.palladium.client.screen.AbilityBarRenderer');
let $PalladiumConfig = Java.loadClass('net.threetag.palladium.PalladiumConfig');
let $ChatScreen = Java.loadClass('net.minecraft.client.gui.screens.ChatScreen');

const ABILITY_BAR_TEXTURE = new ResourceLocation('palladium', 'textures/gui/ability_bar.png');
const INDICATOR_HEIGHT = 28;
const ABILITIES_HEIGHT = 112;

const COOLDOWNS = [
    { property: 'storm_strike_cooldown', maxCooldown: 260, slotIndex: 2, power: 'god_of_thunder' },
    { property: 'bifrost_cooldown', maxCooldown: 1600, slotIndex: 4, power: 'god_of_thunder' },
    { property: 'void_banishment_cooldown', maxCooldown: 400, slotIndex: 4, power: 'void' },
];

PalladiumEvents.registerPropertiesClientSided((event) => {
    if (event.getEntityType() === "minecraft:player") {
        for (let cd of COOLDOWNS) {
            event.registerProperty(cd.property, 'integer', 0);
        }
    }
});

PalladiumEvents.registerGuiOverlays((event) => {
    event.register(
        'powerborne/cooldown_overlay',
        (minecraft, gui, poseStack, partialTick, screenWidth, screenHeight) => {
            let player = minecraft.player;
            if (!player) return;

            let position = $PalladiumConfig.Client.ABILITY_BAR_POSITION.get();
            if (position === $AbilityBarRenderer.Position.HIDDEN) return;

            let posName = position.name();
            let isChatOpen = minecraft.screen instanceof $ChatScreen;

            if (!posName.includes('TOP') && isChatOpen) {
                position = posName.includes('LEFT')
                    ? $AbilityBarRenderer.Position.TOP_LEFT
                    : $AbilityBarRenderer.Position.TOP_RIGHT;
                posName = position.name();
            }

            if (posName.includes('TOP') && minecraft.options.renderDebug) return;

            let list = $AbilityBarRenderer.getSelectedList();
            if (!list) return;

            let isSimple = list.simple && $AbilityBarRenderer.ABILITY_LISTS.size() <= 1;
            if (isSimple) return;

            let selectedPowerId = list.getPower().getId();

            let isLeft = posName.includes('LEFT');
            let isTop = posName.includes('TOP');

            let originX = isLeft ? 0 : screenWidth - ABILITIES_WIDTH;
            let originY = isTop
                ? INDICATOR_HEIGHT - 1
                : screenHeight - INDICATOR_HEIGHT - ABILITIES_HEIGHT + 1;

            for (let cd of COOLDOWNS) {
                if (!selectedPowerId.equals(new ResourceLocation('powerborne', cd.power))) continue;
                
                let cooldown = palladium.getProperty(player, cd.property) || 0;
                if (cooldown <= 0) continue;

                let barWidth = Math.floor((cooldown / cd.maxCooldown) * 18);
                if (barWidth <= 0) continue;

                let drawX = originX + 3;
                let drawY = originY + (cd.slotIndex * 22 + 3);

                poseStack.pose().pushPose();
                poseStack.pose().translate(0, 0, 200);

                guiUtil.blit(
                    ABILITY_BAR_TEXTURE,
                    poseStack,
                    drawX, drawY,
                    60, 74,
                    barWidth, 18,
                    256, 256
                );

                poseStack.pose().popPose();
            }
        }
    );
});