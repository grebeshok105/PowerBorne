const BIFROST_BEAM_SLOT_COUNT = 2;

/** After entry finishes, beam width/glow params ease to 0 over this many client ticks. */
const BIFROST_CLIENT_EXIT_TICKS = 20;

if (!global.bifrostBeamSlots || global.bifrostBeamSlots.length !== BIFROST_BEAM_SLOT_COUNT) {
    global.bifrostBeamSlots = [null, null];
}

function bifrostResolveLevel() {
    let level = Client.level;
    if (!level && Client.player) level = Client.player.level;
    return level;
}

function bifrostComputeSkyY(targetY) {
    let level = bifrostResolveLevel();
    let maxH = 320;
    if (level && level.getMaxBuildHeight) maxH = level.getMaxBuildHeight();
    let sky = maxH - 3;
    if (sky <= targetY) sky = targetY + 48;
    return sky;
}

NetworkEvents.dataReceived('bifrost_beam', event => {
    let d = event.data;
    let slot = (d.beamSlot ?? 0) | 0;
    if (slot < 0 || slot >= BIFROST_BEAM_SLOT_COUNT) slot = 0;

    let dur = (d.duration ?? d.durationTicks ?? 20) | 0;
    if (dur < 1) dur = 1;
    let ty = d.y;
    let exitDur = (d.exitDuration ?? BIFROST_CLIENT_EXIT_TICKS) | 0;
    if (exitDur < 1) exitDur = BIFROST_CLIENT_EXIT_TICKS;

    let lvl = bifrostResolveLevel();
    let dim = d.dimension != null && d.dimension !== ''
        ? String(d.dimension)
        : (lvl && lvl.dimension ? lvl.dimension.toString() : '');

    global.bifrostBeamSlots[slot] = {
        x: d.x,
        y: ty,
        z: d.z,
        targetY: ty,
        skyY: d.skyY != null ? d.skyY : bifrostComputeSkyY(ty),
        dimension: dim,
        ticks: dur,
        durationTotal: dur,
        exitTicks: 0,
        exitDurationTotal: exitDur
    };
});

ClientEvents.tick(() => {
    let slots = global.bifrostBeamSlots;
    if (!slots) return;
    let curDim = '';
    if (Client.player && Client.player.level && Client.player.level.dimension) {
        curDim = Client.player.level.dimension.toString();
    }
    for (let i = 0; i < BIFROST_BEAM_SLOT_COUNT; i++) {
        let b = slots[i];
        if (!b) continue;
        if (curDim && b.dimension && b.dimension !== curDim) {
            continue;
        }
        if (b.ticks > 0) {
            b.ticks--;
            if (b.ticks === 0) {
                b.exitTicks = b.exitDurationTotal || BIFROST_CLIENT_EXIT_TICKS;
            }
        } else if (b.exitTicks > 0) {
            b.exitTicks--;
            if (b.exitTicks === 0) slots[i] = null;
        }
    }
});
