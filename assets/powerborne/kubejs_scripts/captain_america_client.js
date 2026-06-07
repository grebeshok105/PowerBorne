let $EnergyBeamManager = Java.loadClass('net.threetag.palladium.client.energybeam.EnergyBeamManager');
let $DataContext = Java.loadClass('net.threetag.palladium.util.context.DataContext');
let $ResourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation');
let $UUID = Java.loadClass('java.util.UUID');

let prevClientOnGround = true;
let wasJumpingLastTick = false;

PalladiumEvents.registerPropertiesClientSided((event) => {
    if (event.getEntityType() === "minecraft:player") {
        event.registerProperty("shield_reflected_glow_color", 'string', '#ffffff');
    }
    if (event.getEntityType() === "palladium:custom_projectile") {
        event.registerProperty("color1", 'string', '#ffffff');
        event.registerProperty("color4", 'string', '#ffffff');
    }
});

ClientEvents.tick(event => {
    let player = event.player;
    let jumpKey = $Minecraft.getInstance().options.keyJump;
    let ability = abilityUtil.isEnabled(player, "powerborne:captain_america", "super_soldier_u1");
    if (ability) {
        const isJumpingNow = jumpKey.isDown();

        if (isJumpingNow && !wasJumpingLastTick && !prevClientOnGround) {
            if (!player.isSpectator() && !player.getAbilities().flying) {
                player.sendData('captain_america_double_jump', {});
            }
        }

        wasJumpingLastTick = isJumpingNow;
        prevClientOnGround = player.onGround();
    }
});

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

NetworkEvents.dataReceived('vibranium_shield_beam_color_request', (event) => {
    let player = event.player;
    if (!player) return;

    let { beamId, attackerId } = event.data;
    let attackerIdStr = attackerId;
    if (!beamId) return;

    let beamRl = $ResourceLocation.tryParse(beamId);
    if (!beamRl) return;

    let beamConfig = $EnergyBeamManager.INSTANCE.get(beamRl);
    if (!beamConfig) return;

    let beamsField = beamConfig.getClass().getDeclaredField("beams");
    beamsField.setAccessible(true);
    let beamsList = beamsField.get(beamConfig);
    if (!beamsList || beamsList.size() === 0) return;

    let attacker = null;
    if (attackerIdStr) {
        try {
            let attackerUuid = $UUID.fromString(attackerIdStr);
            attacker = Client.level.getPlayerByUUID(attackerUuid);
            if (!attacker) {
                let entities = Client.level.entitiesForRendering();
                let it = entities.iterator();
                while (it.hasNext()) {
                    let e = it.next();
                    if (e.getUUID && e.getUUID().equals(attackerUuid)) { attacker = e; break; }
                }
            }
        } catch (e) { }
    }
    let context = $DataContext.forEntity(attacker || player);

    let totalRed = 0, totalGreen = 0, totalBlue = 0;
    let beamCount = 0;
    let maxBeams = Math.min(3, beamsList.size());

    for (let i = 0; i < maxBeams; i++) {
        let currentBeam = beamsList.get(i);

        let rendererField = currentBeam.getClass().getDeclaredField("renderer");
        rendererField.setAccessible(true);
        let renderer = rendererField.get(currentBeam);

        let laserRendererField = renderer.getClass().getDeclaredField("laserRenderer");
        laserRendererField.setAccessible(true);
        let laserRenderer = laserRendererField.get(renderer);

        let glowColor = laserRenderer.getGlowColor();
        let actualColor = glowColor.getColor(context);

        totalRed += actualColor.getRed() / 255;
        totalGreen += actualColor.getGreen() / 255;
        totalBlue += actualColor.getBlue() / 255;
        beamCount++;
    }

    if (beamCount > 0) {
        let avgRed = Math.round((totalRed / beamCount) * 255);
        let avgGreen = Math.round((totalGreen / beamCount) * 255);
        let avgBlue = Math.round((totalBlue / beamCount) * 255);

        let mixedHex = rgbToHex(avgRed, avgGreen, avgBlue);
        palladium.setProperty(player, "shield_reflected_glow_color", mixedHex);
        player.sendData('vibranium_shield_beam_color_response', { color: mixedHex });
    }
});

let $Starter = Java.loadClass('net.minecraft.client.particle.FireworkParticles$Starter');
let $Boolean = Java.loadClass('java.lang.Boolean');
let $Integer = Java.loadClass('java.lang.Integer');
let $Double = Java.loadClass('java.lang.Double');
let $IntArray = Java.loadClass('[I');
let $IntStream = Java.loadClass('java.util.stream.IntStream');

NetworkEvents.dataReceived('shield_block_particles', (event) => {
    let { x, y, z } = event.data;
    let particleEngine = $Minecraft.getInstance().particleEngine;

    let starter = new $Starter(
        Client.level,
        x, y + 1, z, 0, 0, 0,
        particleEngine,
        null
    );

    if (Platform.isForge()) {
        starter.createParticleBall(0.7, 3, [59391, 38655], [], false, true);
    } else {
        let createParticleBallMethod = starter.getClass().getDeclaredMethod("method_3031",
            $Double.TYPE,
            $Integer.TYPE,
            $IntArray,
            $IntArray,
            $Boolean.TYPE,
            $Boolean.TYPE
        );
        createParticleBallMethod.setAccessible(true);

        let colours = $IntStream.of(59391, 38655).toArray();
        let fadeColours = $IntStream.of().toArray();

        createParticleBallMethod.invoke(starter,
            $Double.valueOf(0.7),
            new $Integer("3"),
            colours,
            fadeColours,
            $Boolean.valueOf(false),
            $Boolean.valueOf(true)
        );
    }
});
