const IS_FORGE = Platform.isForge();
const IS_FABRIC = Platform.isFabric();

const BIFROST_BEAM_VISUAL_Y_OFFSET = 10;

global.getRainbowColor = (time, saturation) => {
    let speed = 0.1;
    let hue = (time * speed) % 1;

    let r = 0, g = 0, b = 0;

    let i = Math.floor(hue * 6);
    let f = hue * 6 - i;
    let q = 1 - f;

    switch (i % 6) {
        case 0: r = 1; g = f; b = 0; break;
        case 1: r = q; g = 1; b = 0; break;
        case 2: r = 0; g = 1; b = f; break;
        case 3: r = 0; g = q; b = 1; break;
        case 4: r = f; g = 0; b = 1; break;
        case 5: r = 1; g = 0; b = q; break;
    }
    r = r * saturation + (1 - saturation);
    g = g * saturation + (1 - saturation);
    b = b * saturation + (1 - saturation);

    return [r, g, b];
};

global.bifrostEaseSkyFall = (t) => {
    let u = Math.max(0, Math.min(1, t));
    return 1 - Math.pow(1 - u, 20);
};

if (Platform.isClientEnvironment()) {

    if (!global.bifrostBeamSlots || global.bifrostBeamSlots.length !== 2) {
        global.bifrostBeamSlots = [null, null];
    }

    let Minecraft;
    let BeaconRendererClass;
    let BEAM_LOCATION;

    if (IS_FORGE) {

        console.log("Loading Forge renderer...");

        let RenderLevelStageEvent = Java.loadClass(
            "net.minecraftforge.client.event.RenderLevelStageEvent$Stage"
        );

        Minecraft = Java.loadClass("net.minecraft.client.Minecraft");
        BeaconRendererClass = Java.loadClass(
            "net.minecraft.client.renderer.blockentity.BeaconRenderer"
        );
        let ResourceLocation = Java.loadClass("net.minecraft.resources.ResourceLocation");

        BEAM_LOCATION = new ResourceLocation("textures/entity/beacon_beam.png");

        ForgeEvents.onEvent(
            "net.minecraftforge.client.event.RenderLevelStageEvent",
            event => {
                if (event.stage != RenderLevelStageEvent.AFTER_ENTITIES) return;
                global.renderCommon({
                    poseStack: event.poseStack,
                    buffer: Minecraft.getInstance().renderBuffers().bufferSource(),
                    camera: event.camera,
                    partialTick: event.partialTick,
                    worldTime: Minecraft.getInstance().level.getTime()
                });
            }
        );
    }

    if (IS_FABRIC) {

        console.log("Loading Fabric renderer...");

        let $UtilsJS = Java.loadClass("dev.latvian.mods.kubejs.util.UtilsJS");
        let $WorldRenderEvents = Java.loadClass(
            "net.fabricmc.fabric.api.client.rendering.v1.WorldRenderEvents"
        );
        let $AfterEntities = Java.loadClass(
            "net.fabricmc.fabric.api.client.rendering.v1.WorldRenderEvents$AfterEntities"
        );

        Minecraft = Java.loadClass("net.minecraft.class_310");
        BeaconRendererClass = Java.loadClass("net.minecraft.class_822");
        let Identifier = Java.loadClass("net.minecraft.class_2960");

        BEAM_LOCATION = Identifier.tryParse("textures/entity/beacon_beam.png");

        let renderFabric = context => {
            global.renderCommon({
                poseStack: context.matrixStack(),
                buffer: context.consumers(),
                camera: context.camera(),
                partialTick: context.tickDelta(),
                worldTime: context.world().getTime()
            });
        };

        let proxy = $UtilsJS.makeFunctionProxy("STARTUP", $AfterEntities, renderFabric);
        $WorldRenderEvents.AFTER_ENTITIES.register(proxy);
    }

    global.renderCommon = (ctx) => {

        let player = Client.player;
        if (!player) return;
        let slots = global.bifrostBeamSlots;
        if (!slots || slots.length !== 2) return;

        try {

            let camPos;
            let animatedTime = ctx.worldTime + ctx.partialTick;
            let rainbow_full = global.getRainbowColor(animatedTime, 1.0);
            let rainbow_low = global.getRainbowColor(animatedTime, 0.2);

            if (IS_FORGE) {
                let coords = ctx.camera.position.toString()
                    .replace("(", "")
                    .replace(")", "")
                    .split(",");
                camPos = {
                    x: parseFloat(coords[0]),
                    y: parseFloat(coords[1]),
                    z: parseFloat(coords[2])
                };
            }

            if (IS_FABRIC) {
                let pos = ctx.camera.getPosition();
                camPos = {
                    x: pos.x(),
                    y: pos.y(),
                    z: pos.z()
                };
            }

            if (!ctx.poseStack || !ctx.buffer) return;

            let curDim = '';
            if (player.level && player.level.dimension) {
                curDim = player.level.dimension.toString();
            }

            for (let si = 0; si < 2; si++) {
                let beam = slots[si];
                if (!beam) continue;
                if (curDim && beam.dimension && beam.dimension !== curDim) continue;

                let inEntry = beam.ticks > 0;
                let inExit = beam.ticks <= 0 && beam.exitTicks > 0;
                if (!inEntry && !inExit) continue;

                let rawTargetY = beam.targetY != null ? beam.targetY : beam.y;
                let rawSkyY = beam.skyY != null ? beam.skyY : rawTargetY + 120;
                let o = BIFROST_BEAM_VISUAL_Y_OFFSET;
                let targetY = rawTargetY - o;
                let skyY = rawSkyY - o;
                let beamY;
                if (inEntry) {
                    let dur = beam.durationTotal || 1;
                    let progress = 1 - (beam.ticks - ctx.partialTick) / dur;
                    progress = Math.max(0, Math.min(1, progress));
                    let eased = global.bifrostEaseSkyFall(progress);
                    beamY = skyY + (targetY - skyY) * eased;
                } else {
                    beamY = targetY;
                }

                let beam1EndA = 0.0;
                let beam1EndB = 2.1; // outer glow
                let beam2EndA = 2.3; // inner
                let beam2EndB = 0.0;
                if (inExit) {
                    let edur = beam.exitDurationTotal || 1;
                    let exitScale = Math.max(0, Math.min(1, (beam.exitTicks - ctx.partialTick) / edur));
                    beam1EndA *= exitScale;
                    beam1EndB *= exitScale;
                    beam2EndA *= exitScale;
                    beam2EndB *= exitScale;
                }

                ctx.poseStack.pushPose();

                ctx.poseStack.translate(
                    -camPos.x + beam.x,
                    -camPos.y + beamY,
                    -camPos.z + beam.z
                );

                BeaconRendererClass.renderBeaconBeam(
                    ctx.poseStack,
                    ctx.buffer,
                    BEAM_LOCATION,
                    ctx.partialTick * 2,
                    1.0,
                    ctx.worldTime,
                    0,
                    1024,
                    rainbow_full,
                    beam1EndA,
                    beam1EndB
                );

                BeaconRendererClass.renderBeaconBeam(
                    ctx.poseStack,
                    ctx.buffer,
                    BEAM_LOCATION,
                    ctx.partialTick,
                    1.0,
                    ctx.worldTime * 2,
                    0,
                    1024,
                    rainbow_low,
                    beam2EndA,
                    beam2EndB
                );

                ctx.poseStack.popPose();
            }

        } catch (err) {
            console.log("Bifrost render error: " + err);
        }
    };
}
