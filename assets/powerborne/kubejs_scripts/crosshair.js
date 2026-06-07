let $RenderSystem = Java.loadClass('com.mojang.blaze3d.systems.RenderSystem');
let $GlStateManager = Java.loadClass('com.mojang.blaze3d.platform.GlStateManager');
let $SourceFactor = Java.loadClass('com.mojang.blaze3d.platform.GlStateManager$SourceFactor');
let $DestFactor = Java.loadClass('com.mojang.blaze3d.platform.GlStateManager$DestFactor');
let $RenderType = Java.loadClass('net.minecraft.client.renderer.RenderType');

const MJOLNIR_CHARGE_MAX = 32;
const INDICATOR_TEX_W = 16;
const INDICATOR_TEX_H = 4;
const CROSSHAIR_OFFSET_Y = 6;
const SHIELD_OVERHEAT_MAX = 250;
const SHIELD_OVERHEAT_MAX_ABSORPTION = 1000;
const CAP_SHIELD_ID = "powerborne:vibranium_shield";
const CAP_POWER = "powerborne:captain_america";

function getClientShieldOverheatMax(player) {
    if (player && (abilityUtil.isUnlocked(player, CAP_POWER, 'vibranium_absorption_buy') || (palladium.getProperty(player, "captain_america_level") || 0) >= 10)) {
        return SHIELD_OVERHEAT_MAX_ABSORPTION;
    }
    return SHIELD_OVERHEAT_MAX;
}

const INDICATOR_TEX = new ResourceLocation('powerborne:textures/gui/mjolnir_indicator_progress.png');

PalladiumEvents.registerPropertiesClientSided((event) => {
    if (event.getEntityType() === "minecraft:player") {
        event.registerProperty("mjolnir_charge", 'integer', 0);
        event.registerProperty("is_blocking_beam", 'integer', 0);
        event.registerProperty("shield_overheating", 'integer', 0);
    }
});

function argbColor(alpha, red, green, blue) {
    let color = (alpha << 24) | (red << 16) | (green << 8) | blue;
    return color > 2147483647 ? color - 4294967296 : color;
}

PalladiumEvents.registerGuiOverlays((event) => {
    event.register(
        'powerborne/mjolnir_charge_crosshair',
        (minecraft, gui, poseStack, partialTick, screenWidth, screenHeight) => {
            if (!minecraft.options.getCameraType().isFirstPerson()) return;

            let player = minecraft.player;
            if (!player) return;
            if (!abilityUtil.hasPower(player, "powerborne:god_of_thunder")) return;

            if (!abilityUtil.isEnabled(player, "powerborne:god_of_thunder", "mjolnir_throw")) return;

            let mjCharge = palladium.getProperty(player, "mjolnir_charge") || 0;
            if (mjCharge <= 0) return;

            let ratio = Math.min(1.0, Math.max(0.0, mjCharge / MJOLNIR_CHARGE_MAX));
            let filledW = Math.max(1, Math.floor(INDICATOR_TEX_W * ratio));
            let x = Math.floor((screenWidth - 15) / 2) - 1;
            let cy = Math.floor(screenHeight / 2);
            let y = cy + CROSSHAIR_OFFSET_Y;

            poseStack.pose().pushPose();
            poseStack.pose().translate(0, 0, 200);

            $RenderSystem.blendFuncSeparate(
                $SourceFactor.ONE_MINUS_DST_COLOR,
                $DestFactor.ONE_MINUS_SRC_COLOR,
                $SourceFactor.ONE,
                $DestFactor.ZERO
            );

            guiUtil.blit(
                INDICATOR_TEX,
                poseStack,
                x,
                y,
                0,
                0,
                filledW,
                INDICATOR_TEX_H,
                INDICATOR_TEX_W,
                INDICATOR_TEX_H
            );

            $RenderSystem.defaultBlendFunc();
            poseStack.pose().popPose();
        }
    );

    event.register(
        'powerborne/orange_mainhand_overlay',
        (minecraft, gui, guiGraphics, partialTick, screenWidth, screenHeight) => {
            if (minecraft.options.hideGui) return;

            let player = minecraft.player;
            if (!player) return;

            let mainhandItem = player.getMainHandItem();
            let offhandItem = player.getOffhandItem();
            let hasShieldMainhand = !mainhandItem.isEmpty() && mainhandItem.id === CAP_SHIELD_ID;
            let hasShieldOffhand = !offhandItem.isEmpty() && offhandItem.id === CAP_SHIELD_ID;
            if (!hasShieldMainhand && !hasShieldOffhand) return;

            let hotbarCenterX = Math.floor(screenWidth / 2);
            let itemY = screenHeight - 16 - 3;
            let itemX;

            let isBlockingBeam = (palladium.getProperty(player, "is_blocking_beam") || 0) > 0;
            if (!isBlockingBeam) return;

            let drawOffhand = false;
            if (player.isUsingItem()) {
                let usingItem = player.getUseItem();
                if (!usingItem.isEmpty() && usingItem.id === CAP_SHIELD_ID) {
                    drawOffhand = String(player.getUsedItemHand()) === "OFF_HAND";
                }
            }
            if (!drawOffhand) {
                drawOffhand = !hasShieldMainhand && hasShieldOffhand;
            }

            if (drawOffhand) {
                // Calculate offhand position
                let humanoidarm = player.getMainArm().getOpposite();
                if (humanoidarm.toString() === 'LEFT') {
                    itemX = hotbarCenterX - 91 - 26;
                } else {
                    itemX = hotbarCenterX + 91 + 10;
                }
            } else {
                let selectedSlot = player.getInventory().selected;
                itemX = hotbarCenterX - 90 + selectedSlot * 20 + 2;
            }

            let shieldOverheating = palladium.getProperty(player, "shield_overheating") || 0;
            let overheatMax = getClientShieldOverheatMax(player);
            let ratio = Math.min(1.0, Math.max(0.0, shieldOverheating / overheatMax));
            let filledHeight = Math.floor(16 * ratio);
            if (filledHeight <= 0) return;

            let topY = itemY + 16 - filledHeight;
            guiGraphics.fill($RenderType.guiOverlay(), itemX, topY, itemX + 16, itemY + 16, argbColor(127, 189, 96, 0));
        }
    );
});
