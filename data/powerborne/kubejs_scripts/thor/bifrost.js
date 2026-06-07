let $Player = Java.loadClass('net.minecraft.world.entity.player.Player');
let $UUID = Java.loadClass('java.util.UUID');
let $ListTag = Java.loadClass('net.minecraft.nbt.ListTag');
let $CompoundTag = Java.loadClass('net.minecraft.nbt.CompoundTag');
let $RecipeType = Java.loadClass('net.minecraft.world.item.crafting.RecipeType');
let $SimpleContainer = Java.loadClass('net.minecraft.world.SimpleContainer');
let $Block = Java.loadClass('net.minecraft.world.level.block.Block');
let $Blocks = Java.loadClass('net.minecraft.world.level.block.Blocks');

let BIFROST = {
    POWER: 'powerborne:god_of_thunder',
    SAVE_ABILITY: 'bifrost_save',
    USE_ABILITY: 'bifrost_use',
    COOLDOWN_TICKS: 1600,
    pdata: {
        x: 'powerborne_bifrost_x',
        y: 'powerborne_bifrost_y',
        z: 'powerborne_bifrost_z',
        dimension: 'powerborne_bifrost_dimension'
    }
};

const BIFROST_GRAVITY_ATTR = Platform.isForge() ? 'forge:entity_gravity' : 'porting_lib:entity_gravity';

const BIFROST_TICKS = {
    SAVE_FEEDBACK: 1,
    CAPTURE: 10,
    BEAM_VISUAL_DURATION: 55,
    BEAM_TP_VISUAL_DURATION: 35,
    BEAM_NOTIFY_RADIUS: 256,
    BEAM_EXIT_VISUAL_DURATION: 5,
    LAUNCH_BASE: 35,
    LAUNCH_JITTER: 20,
    TELEPORT_AFTER_LAUNCH: 8,
    TELEPORT_ARRIVAL_Y_BOOST: 48,
    TELEPORT_DESCENT_MOTION_Y: -6.2,
    TELEPORT_DESCENT_PLAYER_CANCEL_RADIUS: 12,
    TELEPORT_DESCENT_PLAYER_RADIUS_MIN_TICKS: 5
};

const BIFROST_BEAM_SLOT = { ORIGIN: 0, DESTINATION: 1 };

const BIFROST_FX = {
    BREAK_RADIUS: 2,
    BURN_RADIUS: 3,
    BURN_CHANCE: 0.60,
    BURN_SCAN_UP: 3,
    BURN_SCAN_DOWN: 8,
    SMOKE_RADIUS: 2,
    SMOKE_PER_BURST: 2,
    SMOKE_INTERVAL: 1,
    SMOKE_TICKS: 20
};

function bifrostBurnGround(level, cx, cy, cz) {
    let bx = Math.floor(cx);
    let by = Math.floor(cy);
    let bz = Math.floor(cz);
    let r  = BIFROST_FX.BURN_RADIUS;

    for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
            if (dx * dx + dz * dz > r * r) continue;
            if (Math.random() > BIFROST_FX.BURN_CHANCE) continue;

            let wx = bx + dx;
            let wz = bz + dz;

            let surfaceY = null;
            for (let sy = by + BIFROST_FX.BURN_SCAN_UP; sy >= by - BIFROST_FX.BURN_SCAN_DOWN; sy--) {
                if (!level.getBlockState(new BlockPos(wx, sy, wz)).isAir()) {
                    surfaceY = sy;
                    break;
                }
            }
            if (surfaceY === null) continue;

            let pos   = new BlockPos(wx, surfaceY, wz);
            let state = level.getBlockState(pos);
            let block = state.getBlock();

            if (block === $Blocks.GRASS_BLOCK) {
                let pick = Math.random() < 0.5 ? $Blocks.COARSE_DIRT : $Blocks.DIRT;
                level.setBlock(pos, pick.defaultBlockState(), 3);
                continue;
            }

            try {
                let stack = Item.of(block.asItem());
                if (stack.isEmpty()) continue;

                let container = new $SimpleContainer(stack);
                let optional  = level.getRecipeManager()
                                     .getRecipeFor($RecipeType.SMELTING, container, level);
                if (!optional.isPresent()) continue;

                let result      = optional.get().assemble(container, level.registryAccess());
                if (!result || result.isEmpty()) continue;

                let resultBlock = $Block.byItem(result.getItem());
                if (resultBlock === $Blocks.AIR) continue;

                level.setBlock(pos, resultBlock.defaultBlockState(), 3);
            } catch (_) { }
        }
    }
}

function bifrostSmokeBurst(level, cx, cy, cz) {
    if (!level) return;

    let r = BIFROST_FX.SMOKE_RADIUS;
    let ry = Math.max(0.15, r * 0.25);
    level.spawnParticles(
        'minecraft:campfire_cosy_smoke',
        true,
        cx, cy + 0.35, cz,
        r * 0.65, ry, r * 0.65,
        Math.floor(14 * BIFROST_FX.SMOKE_PER_BURST),
        0.02
    );
    level.spawnParticles(
        'minecraft:campfire_cosy_smoke',
        true,
        cx, cy + 0.1, cz,
        r * 0.35, 0.12, r * 0.35,
        Math.floor(6 * BIFROST_FX.SMOKE_PER_BURST),
        0.02
    );
}

function bifrostSpawnSmoke(server, level, cx, cy, cz, durationTicks) {
    if (!server || !level || durationTicks <= 0) return;

    let dimStr = level.dimension.toString();
    let step   = BIFROST_FX.SMOKE_INTERVAL;
    let ccx = cx, ccy = cy, ccz = cz;

    let cloud = level.createEntity('minecraft:area_effect_cloud');
    cloud.x = cx;
    cloud.y = cy;
    cloud.z = cz;
    cloud.mergeNbt({
      Particle: 'minecraft:ambient_entity_effect',
      Radius: 3,
      Duration: 60,
    });
    cloud.spawn();

    for (let delay = 0; delay < durationTicks; delay += step) {
        let d = delay;
        server.scheduleInTicks(d, function () {
            let lvl = bifrostLevelForDimension(server, dimStr);
            if (lvl) bifrostSmokeBurst(lvl, ccx, ccy, ccz);
        });
    }
}

function bifrostLevelForDimension(server, dimStr) {
    if (!server || !dimStr) return null;
    let lvl = null;
    try { lvl = server.getLevel(dimStr); } catch (e) { lvl = null; }
    if (lvl) return lvl;
    server.allLevels.forEach(function (l) {
        if (!lvl && l.dimension.toString() === dimStr) lvl = l;
    });
    return lvl;
}

function bifrostEntityByUuid(server, preferredLevel, uuidStr) {
    if (!server || !uuidStr) return null;
    let id = $UUID.fromString(uuidStr);
    let e  = preferredLevel ? preferredLevel.getEntity(id) : null;
    if (e && e.isAlive()) return e;
    let found = null;
    server.allLevels.forEach(function (l) {
        if (!found) {
            let cand = l.getEntity(id);
            if (cand && cand.isAlive()) found = cand;
        }
    });
    return found;
}

function bifrostFindArrivalY(level, destX, destY, destZ) {
    let MAX_BOOST = BIFROST_TICKS.TELEPORT_ARRIVAL_Y_BOOST;
    let MIN_AIR   = 4;
    let baseY     = Math.floor(destY);

    let checkPoints = [
        [destX,        destZ       ],
        [destX + 0.4,  destZ + 0.4],
        [destX - 0.4,  destZ + 0.4],
        [destX + 0.4,  destZ - 0.4],
        [destX - 0.4,  destZ - 0.4]
    ];

    let ceilingY = baseY + MAX_BOOST + 1;
    for (let ci = 0; ci < checkPoints.length; ci++) {
        let cx = Math.floor(checkPoints[ci][0]);
        let cz = Math.floor(checkPoints[ci][1]);
        for (let scanY = baseY + 1; scanY <= baseY + MAX_BOOST; scanY++) {
            if (!level.getBlockState(new BlockPos(cx, scanY, cz)).isAir()) {
                if (scanY < ceilingY) ceilingY = scanY;
                break;
            }
        }
    }

    let spawnY = Math.min(ceilingY - 1, baseY + MAX_BOOST);
    if (spawnY < baseY + MIN_AIR) return { y: baseY, doSkyDescent: false };
    return { y: spawnY - 1, doSkyDescent: true };
}

function bifrostSendBeamRecipients(server, level, beamX, beamY, beamZ, payload, extraPlayers, dimensionHint) {
    if (!server) return;
    let dimStr = level ? level.dimension.toString() : (dimensionHint || '');
    let packet = Object.assign({}, payload, { dimension: dimStr });
    let seen = {};
    function send(p) {
        if (!p || !p.isAlive() || !p.isPlayer()) return;
        let id = p.uuid.toString();
        if (seen[id]) return;
        seen[id] = true;
        p.sendData('bifrost_beam', packet);
    }
    if (level) {
        let r   = BIFROST_TICKS.BEAM_NOTIFY_RADIUS;
        let box = AABB.of(beamX - r, beamY - r, beamZ - r, beamX + r, beamY + r, beamZ + r);
        level.getEntitiesOfClass($Player, box).forEach(send);
    }
    if (extraPlayers) extraPlayers.forEach(send);
}

function bifrostCleanupDescent(entity) {
    if (!entity || !entity.isAlive()) return;
    entity.persistentData.remove('powerborne_bifrost_descent');
    entity.persistentData.remove('powerborne_bifrost_descent_i');
    entity.persistentData.remove('powerborne_bifrost_descent_ax');
    entity.persistentData.remove('powerborne_bifrost_descent_az');
    entity.persistentData.remove('powerborne_bifrost_nodmg');
    entity.resetFallDistance();
    entity.removeAttribute(BIFROST_GRAVITY_ATTR, 'bifrost_flight');
}

function bifrostFinishSkyDescent(server, uuidStr) {
    if (!server || !uuidStr) return;
    let entity = bifrostEntityByUuid(server, null, uuidStr);
    if (!entity || !entity.isAlive()) return;
    if (!entity.persistentData.contains('powerborne_bifrost_descent')) return;

    let attempts = (entity.persistentData.getInt('powerborne_bifrost_descent_i') || 0) + 1;
    entity.persistentData.putInt('powerborne_bifrost_descent_i', attempts);

    if (entity.onGround() || attempts > 160) {
        bifrostCleanupDescent(entity);
        return;
    }
    if (entity.isPlayer() && entity.persistentData.contains('powerborne_bifrost_descent_ax')
        && attempts > BIFROST_TICKS.TELEPORT_DESCENT_PLAYER_RADIUS_MIN_TICKS) {
        let ax  = entity.persistentData.getDouble('powerborne_bifrost_descent_ax');
        let az  = entity.persistentData.getDouble('powerborne_bifrost_descent_az');
        let rdx = entity.x - ax;
        let rdz = entity.z - az;
        let rM  = BIFROST_TICKS.TELEPORT_DESCENT_PLAYER_CANCEL_RADIUS;
        if (rdx * rdx + rdz * rdz > rM * rM) {
            bifrostCleanupDescent(entity);
            return;
        }
    }
    entity.setMotion(0, BIFROST_TICKS.TELEPORT_DESCENT_MOTION_Y, 0);
    entity.hurtMarked = true;
    entity.resetFallDistance();
    server.scheduleInTicks(1, function () { bifrostFinishSkyDescent(server, uuidStr); });
}

function bifrostBeginSkyDescent(server, entity, landingX, landingZ) {
    if (!entity || !entity.isAlive() || !server) return;
    let uuidStr = entity.uuid.toString();
    entity.persistentData.putBoolean('powerborne_bifrost_descent', true);
    entity.persistentData.putInt('powerborne_bifrost_descent_i', 0);
    if (entity.isPlayer()) {
        entity.persistentData.putDouble('powerborne_bifrost_descent_ax', landingX);
        entity.persistentData.putDouble('powerborne_bifrost_descent_az', landingZ);
    }
    entity.persistentData.putBoolean('powerborne_bifrost_nodmg', true);
    entity.setMotion(0, BIFROST_TICKS.TELEPORT_DESCENT_MOTION_Y, 0);
    entity.resetFallDistance();
    entity.hurtMarked = true;
    server.scheduleInTicks(1, function () { bifrostFinishSkyDescent(server, uuidStr); });
}

PlayerEvents.tick(function (event) {
    let player = event.player;
    if (!player || !player.isAlive()) return;
    if (!abilityUtil.hasPower(player, BIFROST.POWER)) return;

    let pdata = player.persistentData;
    if (pdata.contains(BIFROST.pdata.x) && (palladium.getProperty(player, 'bifrost_has_point') || 0) < 1) {
        palladium.setProperty(player, 'bifrost_has_point', 1);
    }

    let cd = palladium.getProperty(player, 'bifrost_cooldown') || 0;
    let useInst = abilityUtil.getInstance(player, BIFROST.POWER, BIFROST.USE_ABILITY);

    let pdCooldown = player.persistentData;
    let useEnabled = !!(useInst && useInst.isEnabled());
    if (!useEnabled && pdCooldown.contains('bifrost_pending_cooldown')) {
        pdCooldown.remove('bifrost_pending_cooldown');
        palladium.setProperty(player, 'bifrost_cooldown', BIFROST.COOLDOWN_TICKS);
    } else if (cd > 0 && !useEnabled) {
        palladium.setProperty(player, 'bifrost_cooldown', cd - 1);
    }
});

PlayerEvents.tick(function (event) {
    let player = event.player;
    if (!abilityUtil.hasPower(player, BIFROST.POWER)) return;

    let inst = abilityUtil.getInstance(player, BIFROST.POWER, BIFROST.SAVE_ABILITY);
    if (!inst || !inst.isEnabled() || inst.getEnabledTicks() !== BIFROST_TICKS.SAVE_FEEDBACK) return;

    let pd        = player.persistentData;
    let x         = player.x;
    let y         = player.y;
    let z         = player.z;
    let dimension = player.getLevel().dimension.toString();

    pd.putDouble(BIFROST.pdata.x, x);
    pd.putDouble(BIFROST.pdata.y, y);
    pd.putDouble(BIFROST.pdata.z, z);
    pd.putString(BIFROST.pdata.dimension, dimension);
    palladium.setProperty(player, 'bifrost_has_point', 1);

    global.playSoundLocal(player, 'minecraft:block.amethyst_block.hit', 'ambient', 1, 1);

    player.tell(
        Text.translate('text.powerborne.bifrost.point_set',
            '' + parseInt(x),
            '' + parseInt(y),
            '' + parseInt(z),
            dimension
        )
    );
});

PlayerEvents.tick(function (event) {
    let player  = event.player;
    if (!abilityUtil.hasPower(player, BIFROST.POWER)) return;

    let useInst = abilityUtil.getInstance(player, BIFROST.POWER, BIFROST.USE_ABILITY);
    let pd      = player.persistentData;

    if (!useInst || !useInst.isEnabled()) {
        pd.remove('bifrost_session');
        pd.remove('bifrost_origin_x');
        pd.remove('bifrost_origin_y');
        pd.remove('bifrost_origin_z');
        pd.remove('powerborne_bifrost_dest_beam_sent');
        pd.remove('powerborne_bifrost_dest_fx_tick');
        pd.remove('bifrost_player_teleport_tick');
        return;
    }

    let ticks = useInst.getEnabledTicks();

    if (ticks === 1) {
        player.level.playSound(null, player.x, player.y, player.z,
            'powerborne:bifrost_start', 'ambient', 1.0, 1.0);
    }

    if (ticks === BIFROST_TICKS.CAPTURE) {
        if (!pd.contains(BIFROST.pdata.x)) return;

        pd.remove('bifrost_session');
        pd.remove('bifrost_origin_x');
        pd.remove('bifrost_origin_y');
        pd.remove('bifrost_origin_z');
        pd.remove('powerborne_bifrost_dest_beam_sent');
        pd.remove('powerborne_bifrost_dest_fx_tick');
        pd.remove('bifrost_player_teleport_tick');

        let originX = player.x;
        let originY = player.y;
        let originZ = player.z;

        let nearby = player.level.getEntitiesWithin(player.getBoundingBox().inflate(2))
            .filter(function (e) { return e.isAlive() && e.isLiving() && !e.is(player); });

        let entities     = [player].concat(nearby);
        let beamAudience = entities.filter(function (e) { return e.isPlayer(); });

        pd.putDouble('bifrost_origin_x', originX);
        pd.putDouble('bifrost_origin_y', originY);
        pd.putDouble('bifrost_origin_z', originZ);

        let sessionList              = new $ListTag();
        let maxNonPlayerTeleportTick = 0;
        let minLaunchTick            = Infinity;

        entities.forEach(function (e) {
            if (e.isPlayer()) return;
            let lt = BIFROST_TICKS.LAUNCH_BASE + Math.floor(Math.random() * BIFROST_TICKS.LAUNCH_JITTER);
            let tt = lt + BIFROST_TICKS.TELEPORT_AFTER_LAUNCH;
            if (tt > maxNonPlayerTeleportTick) maxNonPlayerTeleportTick = tt;
            if (lt < minLaunchTick) minLaunchTick = lt;
            let entry = new $CompoundTag();
            entry.putString('uuid', e.uuid.toString());
            entry.putInt('launchTick', lt);
            entry.putDouble('dx', e.x - originX);
            entry.putDouble('dz', e.z - originZ);
            sessionList.add(entry);
        });

        let playerLaunchTick = maxNonPlayerTeleportTick > 0
            ? maxNonPlayerTeleportTick
            : BIFROST_TICKS.LAUNCH_BASE + Math.floor(Math.random() * BIFROST_TICKS.LAUNCH_JITTER);
        if (playerLaunchTick < minLaunchTick) minLaunchTick = playerLaunchTick;
        let playerTeleportTick = playerLaunchTick + BIFROST_TICKS.TELEPORT_AFTER_LAUNCH;

        entities.forEach(function (e) {
            if (!e.isPlayer()) return;
            let entry = new $CompoundTag();
            entry.putString('uuid', e.uuid.toString());
            entry.putInt('launchTick', playerLaunchTick);
            entry.putDouble('dx', e.x - originX);
            entry.putDouble('dz', e.z - originZ);
            sessionList.add(entry);
        });

        pd.putInt('bifrost_player_teleport_tick', playerTeleportTick);

        let VISUAL_BUFFER      = 10;
        let originBeamDuration = (playerLaunchTick - BIFROST_TICKS.CAPTURE) + VISUAL_BUFFER;

        bifrostSendBeamRecipients(player.server, player.level, originX, originY, originZ, {
            x: originX, y: originY, z: originZ,
            beamSlot: BIFROST_BEAM_SLOT.ORIGIN,
            duration: originBeamDuration,
            exitDuration: BIFROST_TICKS.BEAM_EXIT_VISUAL_DURATION
        }, beamAudience);

        let fxDelay     = 8;
        let cOriginX    = originX;
        let cOriginY    = originY;
        let cOriginZ    = originZ;
        let cLevel      = player.level;
        let cPlayer     = player;
        let cServer     = player.server;
        player.server.scheduleInTicks(5, function () {
            bifrostSpawnSmoke(cServer, cLevel, cOriginX, cOriginY, cOriginZ, BIFROST_FX.SMOKE_TICKS);
        });
        player.server.scheduleInTicks(fxDelay, function () {
            global.breakReplaceableInRadius(cLevel, cPlayer, cOriginX, cOriginY, cOriginZ, BIFROST_FX.BREAK_RADIUS);
            bifrostBurnGround(cLevel, cOriginX, cOriginY, cOriginZ);
        });

        pd.put('bifrost_session', sessionList);
        pd.putBoolean('bifrost_pending_cooldown', true);
        return;
    }

    if (!pd.contains('bifrost_session')) return;

    let sessionList = pd.getList('bifrost_session', 10);
    
    let savedX   = pd.getDouble(BIFROST.pdata.x);
    let savedY   = pd.getDouble(BIFROST.pdata.y);
    let savedZ   = pd.getDouble(BIFROST.pdata.z);
    let savedDim = pd.getString(BIFROST.pdata.dimension);
    
    if (pd.contains('powerborne_bifrost_dest_fx_tick') && ticks === pd.getInt('powerborne_bifrost_dest_fx_tick')) {
        pd.remove('powerborne_bifrost_dest_fx_tick');
        let destLevel = bifrostLevelForDimension(event.server, savedDim);
        if (destLevel) {
            bifrostBurnGround(destLevel, savedX, savedY, savedZ);
            bifrostSpawnSmoke(event.server, destLevel, savedX, savedY, savedZ, BIFROST_FX.SMOKE_TICKS);
        }
    }
    
    if (sessionList.size() === 0) return;
    
    let originX  = pd.getDouble('bifrost_origin_x');
    let originY  = pd.getDouble('bifrost_origin_y');
    let originZ  = pd.getDouble('bifrost_origin_z');

    let playerTeleportTick = pd.getInt('bifrost_player_teleport_tick');

    let toRemove = [];

    for (let i = 0; i < sessionList.size(); i++) {
        let entry        = sessionList.getCompound(i);
        let uuidStr      = entry.getString('uuid');
        let launchTick   = entry.getInt('launchTick');
        let teleportTick = launchTick + BIFROST_TICKS.TELEPORT_AFTER_LAUNCH;
        let dx           = entry.getDouble('dx');
        let dz           = entry.getDouble('dz');

        if (ticks === launchTick) {
            let entity = player.level.getEntity($UUID.fromString(uuidStr));
            if (!entity || !entity.isAlive()) { toRemove.push(i); continue; }
            let ddx = entity.x - originX;
            let ddz = entity.z - originZ;
            if (Math.sqrt(ddx * ddx + ddz * ddz) > 4) { toRemove.push(i); continue; }
            entity.persistentData.putBoolean('powerborne_bifrost_nodmg', true);
            entity.resetFallDistance();
            entity.modifyAttribute(BIFROST_GRAVITY_ATTR, 'bifrost_flight', -1, 'multiply_total');
            entity.setMotion((Math.random() - 0.5) * 0.3, 5.8, (Math.random() - 0.5) * 0.3);
            entity.hurtMarked = true;
        }

        let destX = savedX + dx;
        let destZ = savedZ + dz;
        if (ticks === teleportTick - 2) {
            if (!pd.contains('powerborne_bifrost_dest_beam_sent')) {
                pd.putBoolean('powerborne_bifrost_dest_beam_sent', true);

                let destLevel = bifrostLevelForDimension(event.server, savedDim);
                let destAudience = [];
                for (let ai = 0; ai < sessionList.size(); ai++) {
                    let aEnt = bifrostEntityByUuid(event.server, player.level,
                        sessionList.getCompound(ai).getString('uuid'));
                    if (aEnt && aEnt.isPlayer()) destAudience.push(aEnt);
                }

                let VISUAL_BUFFER    = 10;
                let destBeamDuration = (playerTeleportTick - ticks) + VISUAL_BUFFER + 25;

                bifrostSendBeamRecipients(event.server, destLevel, savedX, savedY, savedZ, {
                    x: savedX, y: savedY, z: savedZ,
                    beamSlot: BIFROST_BEAM_SLOT.DESTINATION,
                    duration: destBeamDuration,
                    exitDuration: BIFROST_TICKS.BEAM_EXIT_VISUAL_DURATION
                }, destAudience, savedDim);
            }
        }

        if (ticks === teleportTick) {
            if (!pd.contains('powerborne_bifrost_dest_fx_tick')) {
                pd.putInt('powerborne_bifrost_dest_fx_tick', teleportTick + 3);
            }
            let entityToTp = player.level.getEntity($UUID.fromString(uuidStr));
            if (!entityToTp) {
                event.server.allLevels.forEach(function (l) {
                    if (!entityToTp) entityToTp = l.getEntity($UUID.fromString(uuidStr));
                });
            }

            if (entityToTp && entityToTp.isAlive()) {
                entityToTp.resetFallDistance();
                entityToTp.setMotion(0, 0, 0);
                entityToTp.hurtMarked = true;

                if (entityToTp.isPlayer()) {
                    let flashY = entityToTp.y + entityToTp.getBbHeight() * 0.5;
                    entityToTp.level.spawnParticles(
                        'minecraft:flash', false,
                        entityToTp.x, flashY, entityToTp.z,
                        1, 0, 0, 0, 0);
                }

                let crossDim      = entityToTp.level.dimension.toString() !== savedDim;
                let destLevelScan = crossDim
                    ? bifrostLevelForDimension(event.server, savedDim)
                    : entityToTp.level;
                let arrival = destLevelScan
                    ? bifrostFindArrivalY(destLevelScan, destX, savedY, destZ)
                    : { y: savedY, doSkyDescent: false };
                let arrivalY     = arrival.y;
                let doSkyDescent = arrival.doSkyDescent;

                if (destLevelScan) {
                    let mh = destLevelScan.getMaxBuildHeight();
                    if (arrivalY > mh - 2) { arrivalY = mh - 3; doSkyDescent = false; }
                }

                entityToTp.persistentData.putBoolean('powerborne_bifrost_nodmg', true);
                entityToTp.resetFallDistance();

                if (crossDim) {
                    entityToTp.teleportTo(savedDim, destX, arrivalY, destZ,
                        entityToTp.yaw, entityToTp.pitch);
                    if (entityToTp.isPlayer())
                        global.playSoundLocal(entityToTp, 'powerborne:bifrost_end', 'players', 1, 1);

                    let cu = uuidStr, cdx = destX, cdz = destZ, cDesc = doSkyDescent;
                    event.server.scheduleInTicks(2, function () {
                        let settled = bifrostEntityByUuid(event.server, null, cu);
                        if (!settled || !settled.isAlive()) return;
                        if (cDesc) {
                            bifrostBeginSkyDescent(event.server, settled, cdx, cdz);
                        } else {
                            event.server.scheduleInTicks(40, function () {
                                settled.persistentData.remove('powerborne_bifrost_nodmg');
                                settled.resetFallDistance();
                                settled.removeAttribute(BIFROST_GRAVITY_ATTR, 'bifrost_flight');
                            });
                        }
                    });
                } else {
                    entityToTp.teleportTo(destX, arrivalY, destZ);
                    if (entityToTp.isPlayer())
                        global.playSoundLocal(entityToTp, 'powerborne:bifrost_end', 'players', 1, 1);

                    if (doSkyDescent) {
                        bifrostBeginSkyDescent(event.server, entityToTp, destX, destZ);
                    } else {
                        let cEnt = entityToTp;
                        event.server.scheduleInTicks(40, function () {
                            cEnt.persistentData.remove('powerborne_bifrost_nodmg');
                            cEnt.resetFallDistance();
                            cEnt.removeAttribute(BIFROST_GRAVITY_ATTR, 'bifrost_flight');
                        });
                    }
                }
            }
            toRemove.push(i);
        }
    }
    if (pd.contains('powerborne_bifrost_dest_fx_tick') && ticks === pd.getInt('powerborne_bifrost_dest_fx_tick')) {
        pd.remove('powerborne_bifrost_dest_fx_tick');
        let destLevel = bifrostLevelForDimension(event.server, savedDim);
        if (destLevel) {
            bifrostBurnGround(destLevel, savedX, savedY, savedZ);
            bifrostSpawnSmoke(event.server, destLevel, savedX, savedY, savedZ, BIFROST_FX.SMOKE_TICKS);
        }
    }
    for (let r = toRemove.length - 1; r >= 0; r--) sessionList.remove(toRemove[r]);
    pd.put('bifrost_session', sessionList);
});

EntityEvents.hurt(function (event) {
    let ent = event.entity;
    let isFall = event.source.type().msgId() === 'fall';

    if (!ent.persistentData.contains('powerborne_bifrost_nodmg')) return;
    if (isFall) {
        event.cancel();
    }
});