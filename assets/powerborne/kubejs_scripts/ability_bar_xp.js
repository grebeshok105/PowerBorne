let $Minecraft = Java.loadClass('net.minecraft.client.Minecraft');
let $AbilityBarRenderer = Java.loadClass('net.threetag.palladium.client.screen.AbilityBarRenderer');
let $PalladiumConfig = Java.loadClass('net.threetag.palladium.PalladiumConfig');
let $ChatScreen = Java.loadClass('net.minecraft.client.gui.screens.ChatScreen');

const POWERS = ['sentry', 'superman', 'homelander', 'god_of_thunder', 'captain_america'];
const XP_WIDTH = 49;
const XP_HEIGHT = 3;
const ABILITIES_WIDTH = 24;

global.XP_REQUIREMENTS = [0, 50, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3250];

const LEVEL_SHOW_MS = 3000;
const LEVEL_FADE_MS = 1000;

let isF3 = false;
let levelUpTime = null;
let halfXpTime = null;
let lastKnownLevel = -1;
let lastKnownProgress = -1;
let lastKnownPower = null;

ClientEvents.leftDebugInfo(event => {
    Client.scheduleInTicks(1, () => { isF3 = false; });
    isF3 = true;
});

function getActivePower(player) {
    for (let p of POWERS) {
        if (abilityUtil.hasPower(player, `powerborne:${p}`)) return p;
    }
    return null;
}

const PROP_KEY = { god_of_thunder: 'thor' };

function getBarProgress(player, power) {
    let key = PROP_KEY[power] || power;
    let level = palladium.getProperty(player, `${key}_level`) || 0;
    let xp = palladium.getProperty(player, `${key}_xp`) || 0;

    if (level >= 10) return { level: level, progress: 1.0 };

    let xpForCurrent = global.XP_REQUIREMENTS[level] || 0;
    let xpForNext = global.XP_REQUIREMENTS[level + 1] || 1;
    let xpNeeded = xpForNext - xpForCurrent;
    let progress = xpNeeded > 0 ? (xp - xpForCurrent) / xpNeeded : 0;

    return { level: level, progress: Math.min(1.0, Math.max(0.0, progress)) };
}

function alphaFromTimestamp(timestamp) {
    if (timestamp === null) return 0.0;
    let elapsed = Date.now() - timestamp;
    if (elapsed < LEVEL_SHOW_MS) return 1.0;
    if (elapsed < LEVEL_SHOW_MS + LEVEL_FADE_MS) {
        return 1.0 - (elapsed - LEVEL_SHOW_MS) / LEVEL_FADE_MS;
    }
    return 0.0;
}

function getLevelAlpha(isChatOpen) {
    if (isChatOpen) return 1.0;
    return Math.max(alphaFromTimestamp(levelUpTime), alphaFromTimestamp(halfXpTime));
}

function drawLevelText(poseStack, component, x, y, alpha) {
    let a = Math.round(alpha * 255);
    let shadowColor = (a * 0x1000000) | 0;
    let textColor = shadowColor | 0x99F74C;
    guiUtil.drawString(poseStack, component, x + 1, y, shadowColor);
    guiUtil.drawString(poseStack, component, x - 1, y, shadowColor);
    guiUtil.drawString(poseStack, component, x, y + 1, shadowColor);
    guiUtil.drawString(poseStack, component, x, y - 1, shadowColor);
    guiUtil.drawString(poseStack, component, x, y, textColor);
}

PalladiumEvents.registerGuiOverlays((event) => {
    event.register(
        'powerborne/ability_bar_xp',
        (minecraft, gui, poseStack, partialTick, screenWidth, screenHeight) => {
            let player = minecraft.player;
            if (!player) return;

            let power = getActivePower(player);
            if (!power) return;

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
            if (isF3 && (posName.includes('TOP') && !isChatOpen)) return;

            let list = $AbilityBarRenderer.getSelectedList();
            if (!list || !list.getPower().getId().equals(new ResourceLocation('powerborne', power))) return;

            let info = getBarProgress(player, power);

            if (lastKnownPower === power) {
                // detect level-up
                if (lastKnownLevel !== -1 && info.level > lastKnownLevel) {
                    levelUpTime = Date.now();
                }
                // detect crossing the 50% threshold
                if (lastKnownProgress !== -1 && lastKnownProgress < 0.5 && info.progress >= 0.5) {
                    halfXpTime = Date.now();
                }
            }
            lastKnownLevel = info.level;
            lastKnownProgress = info.progress;
            lastKnownPower = power;

            let w = minecraft.getWindow();
            let isLeft = posName.includes('LEFT');
            let isTop = posName.includes('TOP');

            let barX = isLeft ? 0 : w.getGuiScaledWidth() - ABILITIES_WIDTH - 25;
            let barY = isTop ? 23 : w.getGuiScaledHeight() - 3;
            let levelX = isLeft ? 56 : barX - 18;
            let levelY = barY - 13;

            poseStack.pose().pushPose();
            poseStack.pose().translate(0, 0, 200);
            guiUtil.drawString(poseStack, Component.string(""), 0, 0, 0);
            // Empty bar
            guiUtil.blit(
                new ResourceLocation('powerborne:textures/gui/xp_bar_empty.png'),
                poseStack,
                barX, barY,
                0, 0,
                XP_WIDTH, XP_HEIGHT,
                XP_WIDTH, XP_HEIGHT
            );

            // Filled bar
            if (info.progress > 0) {
                let filledWidth = Math.floor(XP_WIDTH * info.progress);
                if (filledWidth > 0) {
                    guiUtil.blit(
                        new ResourceLocation('powerborne:textures/gui/xp_bar_full.png'),
                        poseStack,
                        barX, barY,
                        0, 0,
                        filledWidth, XP_HEIGHT,
                        XP_WIDTH, XP_HEIGHT
                    );
                }
            }

            let alpha = getLevelAlpha(isChatOpen);
            if (alpha > 0.05) {
                drawLevelText(poseStack, Component.string(String(info.level)), levelX, levelY, alpha);
            }

            poseStack.pose().popPose();
        }
    );
});
