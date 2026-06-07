const HEROES_CONFIG = {
    'powerborne:sentry': { name: 'sentry', displayName: 'Sentry' },
    'powerborne:superman': { name: 'superman', displayName: 'Superman' },
    'powerborne:god_of_thunder': { name: 'thor', displayName: 'Thor' },
    'powerborne:captain_america': { name: 'captain_america', displayName: 'Captain America' }
};

PalladiumEvents.registerPropertiesClientSided((event) => {
    if (event.getEntityType() === "minecraft:player") {
        event.registerProperty("sentry_level", 'integer', 0);
        event.registerProperty("sentry_xp", 'integer', 0);
        event.registerProperty("sentry_skill_points", 'integer', 0);

        event.registerProperty("superman_level", 'integer', 0);
        event.registerProperty("superman_xp", 'integer', 0);
        event.registerProperty("superman_skill_points", 'integer', 0);

        event.registerProperty("thor_level", 'integer', 0);
        event.registerProperty("thor_xp", 'integer', 0);
        event.registerProperty("thor_skill_points", 'integer', 0);

        event.registerProperty("captain_america_level", 'integer', 0);
        event.registerProperty("captain_america_xp", 'integer', 0);
        event.registerProperty("captain_america_skill_points", 'integer', 0);
    }
});

const BAR_WIDTH = 182;
const BAR_HEIGHT = 5;
const BAR_HOVER_PAD = 2;

let $MinecraftScreen = Java.loadClass('net.minecraft.client.Minecraft');
let $ArrayList = Java.loadClass('java.util.ArrayList');

function getScreenMouse(e) {
    if (e.mouseX !== undefined && e.mouseY !== undefined) {
        return { x: e.mouseX, y: e.mouseY };
    }
    let mc = $MinecraftScreen.getInstance();
    let w = mc.getWindow();
    let scale = w.getGuiScale();
    if (scale <= 0) scale = 1;
    return {
        x: Math.floor(mc.mouseHandler.xpos() / scale),
        y: Math.floor(mc.mouseHandler.ypos() / scale)
    };
}

function getProgressInfo(player, heroName) {
    const currentLevel = palladium.getProperty(player, `${heroName}_level`) || 0;
    const currentXP = palladium.getProperty(player, `${heroName}_xp`) || 0;
    const skillPoints = palladium.getProperty(player, `${heroName}_skill_points`) || 0;

    if (currentLevel >= 10) {
        return {
            level: currentLevel,
            xp: currentXP,
            skillPoints: skillPoints,
            isMaxLevel: true,
            progress: 1.0,
            xpInLevel: 0,
            xpForLevel: 0
        };
    }

    const totalXPForNext = global.XP_REQUIREMENTS[currentLevel + 1];
    const totalXPForCurrent = global.XP_REQUIREMENTS[currentLevel];
    const xpInLevel = currentXP - totalXPForCurrent;
    const xpForLevel = totalXPForNext - totalXPForCurrent;
    const progress = xpForLevel > 0 ? xpInLevel / xpForLevel : 0;

    return {
        level: currentLevel,
        xp: currentXP,
        skillPoints: skillPoints,
        isMaxLevel: false,
        progress: Math.min(1.0, Math.max(0.0, progress)),
        xpInLevel: Math.max(0, xpInLevel),
        xpForLevel: xpForLevel
    };
}

function drawOutlinedText(guiGraphics, text, x, y, mainColor, shadowColor) {
    const component = Component.string(text);
    palladium.gui.drawString(guiGraphics, component, x + 1, y, shadowColor);
    palladium.gui.drawString(guiGraphics, component, x - 1, y, shadowColor);
    palladium.gui.drawString(guiGraphics, component, x, y + 1, shadowColor);
    palladium.gui.drawString(guiGraphics, component, x, y - 1, shadowColor);
    palladium.gui.drawString(guiGraphics, component, x, y, mainColor);
}

PalladiumEvents.renderPowerScreen(e => {
    let player = Client.player || $Minecraft.getInstance().player;
    if (!player) return;

    const tabId = e.tab ? e.tab.toString() : null;
    if (!tabId || !HEROES_CONFIG[tabId]) return;

    const heroConfig = HEROES_CONFIG[tabId];
    const heroName = heroConfig.name;
    const info = getProgressInfo(player, heroName);

    const WINDOW_WIDTH = 252;
    const WINDOW_HEIGHT = 196;

    const windowX = Math.floor((e.screen.width - WINDOW_WIDTH) / 2);
    const windowY = Math.floor((e.screen.height - WINDOW_HEIGHT) / 2);

    e.guiGraphics.pose().pushPose();
    e.guiGraphics.pose().translate(0.0, 0.0, 300.0);

    palladium.gui.drawString(e.guiGraphics, Component.translatable("gui.palladium.powers"), windowX + 8, windowY + 6, 0xC8C8C8);

    const barX = windowX + Math.floor((WINDOW_WIDTH - BAR_WIDTH) / 2);
    const barY = windowY + 8;

    e.guiGraphics.blit(
        new ResourceLocation('powerborne:textures/gui/xpbar_empty.png'),
        barX, barY,
        0, 0,
        BAR_WIDTH, BAR_HEIGHT,
        BAR_WIDTH, BAR_HEIGHT
    );

    if (info.progress > 0) {
        const filledWidth = Math.floor(BAR_WIDTH * info.progress);
        if (filledWidth > 0) {
            e.guiGraphics.blit(
                new ResourceLocation('powerborne:textures/gui/xpbar_full.png'),
                barX, barY,
                0, 0,
                filledWidth, BAR_HEIGHT,
                BAR_WIDTH, BAR_HEIGHT
            );
        }
    }

    const mouse = getScreenMouse(e);
    const hovering =
        mouse.x >= barX - BAR_HOVER_PAD && mouse.x <= barX + BAR_WIDTH + BAR_HOVER_PAD &&
        mouse.y >= barY - BAR_HOVER_PAD && mouse.y <= barY + BAR_HEIGHT + BAR_HOVER_PAD;

    if (hovering) {
        let tipText;
        if (info.isMaxLevel) {
            tipText = `Max Level`;
        } else {
            tipText = `${info.xpInLevel} / ${info.xpForLevel} XP`;
        }
        const tipList = new $ArrayList();
        tipList.add(Component.string(tipText));
        e.guiGraphics.renderComponentTooltip(
            $MinecraftScreen.getInstance().font,
            tipList,
            mouse.x,
            mouse.y
        );
    }

    const levelText = `${info.level}`;
    const levelTextWidth = levelText.length * 6;
    const levelX = barX + Math.floor((BAR_WIDTH - levelTextWidth) / 2);
    const levelY = barY + BAR_HEIGHT - 7;
    drawOutlinedText(e.guiGraphics, levelText, levelX, levelY, 0x99F74C, 0x000000);

    const spText = `Skill Points: ${info.skillPoints}`;
    const spTextWidth = spText.length * 6;
    const spX = windowX + WINDOW_WIDTH - spTextWidth + 11;
    const spY = windowY + 22;
    drawOutlinedText(e.guiGraphics, spText, spX, spY, 0xFFFF55, 0x000000);

    e.guiGraphics.pose().popPose();
});
