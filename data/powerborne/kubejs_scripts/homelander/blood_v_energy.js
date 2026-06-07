const HOMELANDER_BLOOD_V = {
  POWER: 'powerborne:homelander',
  MAX_CHARGE: 500,
  BLOOD_V_GAIN: 50,
  HEAT_VISION_DRAIN: 0.10,
  FREEZE_BREATH_DRAIN: 0.08,
  SUPER_SPEED_DRAIN: 0.025,
  THUNDERCLAP_COST: 7,
  FLIGHT_BOOST_COST: 4,
  SUPER_PUNCH_COST: 5,
  SONIC_SCREAM_COST: 20
};

function getBloodVCharge(player) {
  return palladium.getProperty(player, 'energy_bar_blood_v') || 0;
}

function setBloodVCharge(player, value) {
  let max = palladium.getProperty(player, 'energy_bar_blood_v_max') || HOMELANDER_BLOOD_V.MAX_CHARGE;
  let clamped = Math.max(0, Math.min(max, Math.round(value)));
  palladium.setProperty(player, 'energy_bar_blood_v', clamped);
}

function addBloodVCharge(player, amount) {
  setBloodVCharge(player, getBloodVCharge(player) + amount);
}

function subBloodVCharge(player, amount) {
  setBloodVCharge(player, getBloodVCharge(player) - amount);
}

function hasHomelanderPower(player) {
  return abilityUtil.hasPower(player, HOMELANDER_BLOOD_V.POWER);
}

function bloodVEnabled(player, ability) {
  return abilityUtil.isEnabled(player, HOMELANDER_BLOOD_V.POWER, ability);
}

function accumulateBloodVDrain(player, amount) {
  let accum = player.persistentData.getFloat('homelander_blood_v_drain_accum') + amount;
  let intPart = Math.floor(accum);
  if (intPart > 0) {
    subBloodVCharge(player, intPart);
    accum -= intPart;
  }
  player.persistentData.putFloat('homelander_blood_v_drain_accum', accum);
}

PlayerEvents.tick(event => {
  let player = event.player;
  if (!hasHomelanderPower(player)) return;

  if ((palladium.getProperty(player, 'energy_bar_blood_v_max') || 0) !== HOMELANDER_BLOOD_V.MAX_CHARGE) {
    palladium.setProperty(player, 'energy_bar_blood_v_max', HOMELANDER_BLOOD_V.MAX_CHARGE);
  }

  let draining = false;

  if (bloodVEnabled(player, 'heat_vision_timer')) {
    accumulateBloodVDrain(player, HOMELANDER_BLOOD_V.HEAT_VISION_DRAIN);
    draining = true;
  }

  if (bloodVEnabled(player, 'freeze_breath')) {
    accumulateBloodVDrain(player, HOMELANDER_BLOOD_V.FREEZE_BREATH_DRAIN);
    draining = true;
  }

  if (bloodVEnabled(player, 'speed_trail')) {
    accumulateBloodVDrain(player, HOMELANDER_BLOOD_V.SUPER_SPEED_DRAIN);
    draining = true;
  }

  if (!draining) {
    player.persistentData.putFloat('homelander_blood_v_drain_accum', 0);
  }

  if (bloodVEnabled(player, 'thunderclap')) {
    subBloodVCharge(player, HOMELANDER_BLOOD_V.THUNDERCLAP_COST);
  }

  if (bloodVEnabled(player, 'flight_boost')) {
    subBloodVCharge(player, HOMELANDER_BLOOD_V.FLIGHT_BOOST_COST);
  }

  if (bloodVEnabled(player, 'sonic_scream')) {
    subBloodVCharge(player, HOMELANDER_BLOOD_V.SONIC_SCREAM_COST);
  }

  if (bloodVEnabled(player, 'super_flare')) {
    let maxCharge = palladium.getProperty(player, 'energy_bar_blood_v_max') || HOMELANDER_BLOOD_V.MAX_CHARGE;
    accumulateBloodVDrain(player, maxCharge / 50);
  }
});

ItemEvents.rightClicked('powerborne:blood_v', event => {
  const player = event.player;
  const itemStack = event.item;
  if (!player || itemStack.isEmpty()) return;

  let max = palladium.getProperty(player, 'energy_bar_blood_v_max') || HOMELANDER_BLOOD_V.MAX_CHARGE;
  let current = getBloodVCharge(player);
  if (current >= max) {
    global.playSoundLocal(player, 'minecraft:block.glass.hit', 'players', 0.6, 0.8);
    event.cancel();
    return;
  }

  addBloodVCharge(player, HOMELANDER_BLOOD_V.BLOOD_V_GAIN);
  global.playSoundLocal(player, 'minecraft:item.honey_bottle.drink', 'players', 0.8, 1.2);
  player.addItemCooldown('powerborne:blood_v', 20);

  if (!player.isCreative()) {
    itemStack.shrink(1);
  }

  event.cancel();
});
