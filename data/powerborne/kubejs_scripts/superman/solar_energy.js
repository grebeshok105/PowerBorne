const SOLAR = {
  POWER: 'powerborne:superman',
  MAX_CHARGES: [100, 200, 350, 500],
  SUN_RECHARGE_RATES: [0.025, 0.05, 0.075, 0.09],
  MOONLIGHT_RECHARGE_RATE: 0.05,
  HIGH_ALTITUDE_Y: 210,
  HIGH_ALTITUDE_MULTIPLIER: 1.25,
  MIN_SKY_BRIGHTNESS: 12,
  HEAT_VISION_DRAIN: 0.10,
  FREEZE_BREATH_DRAIN: 0.08,
  SUPER_SPEED_DRAIN: 0.025,
  THUNDERCLAP_COST: 7,
  FLIGHT_BOOST_COST: 4,
  SUPER_PUNCH_COST: 5,
  KRYPTONITE_DRAIN: 0.2,
};

function getSolarCharge(player) {
  return palladium.getProperty(player, 'energy_bar_solar') || 0;
}

function setSolarCharge(player, value) {
  let max = palladium.getProperty(player, 'energy_bar_solar_max');
  palladium.setProperty(player, 'energy_bar_solar', clamp(Math.round(value), 0, max));
}

function addSolarCharge(player, amount) {
  setSolarCharge(player, getSolarCharge(player) + amount);
}

function subSolarCharge(player, amount) {
  setSolarCharge(player, getSolarCharge(player) - amount);
}

function hasSuperman(player) {
  return abilityUtil.hasPower(player, SOLAR.POWER);
}

function solarEnabled(player, ability) {
  return abilityUtil.isEnabled(player, SOLAR.POWER, ability);
}

function solarUnlocked(player, ability) {
  return global.isAbilityUnlockedOrAutoMaxed(player, SOLAR.POWER, ability);
}

function getSolarAbilityTicks(player, ability) {
  let instance = abilityUtil.getInstance(player, SOLAR.POWER, ability);
  return instance ? instance.getEnabledTicks() : 0;
}

function getSolarUpgradeLevel(player) {
  if (solarUnlocked(player, 'solar_energy_u3')) return 3;
  if (solarUnlocked(player, 'solar_energy_u2')) return 2;
  if (solarUnlocked(player, 'solar_energy_u1')) return 1;
  return 0;
}

function getSolarRechargeRate(player) {
  let rate = SOLAR.SUN_RECHARGE_RATES[getSolarUpgradeLevel(player)];
  if (player.getBlockY() > SOLAR.HIGH_ALTITUDE_Y) rate *= SOLAR.HIGH_ALTITUDE_MULTIPLIER;
  return rate;
}


function getSkyBrightness(player) {
  return player.level.getBrightness($LightLayer.SKY, player.blockPosition());
}

function isInSunlight(player) {
  return player.level.isDay() && getSkyBrightness(player) > SOLAR.MIN_SKY_BRIGHTNESS;
}

function isInMoonlight(player) {
  return !player.level.isDay() && getSkyBrightness(player) > SOLAR.MIN_SKY_BRIGHTNESS;
}

function accumulateSolarCharge(player, amount) {
  let accum = player.persistentData.getFloat('solar_charge_accum') + amount;
  let intPart = Math.floor(accum);
  if (intPart > 0) {
    addSolarCharge(player, intPart);
    accum -= intPart;
  }
  player.persistentData.putFloat('solar_charge_accum', accum);
}

function accumulateSolarDrain(player, amount) {
  let accum = player.persistentData.getFloat('solar_drain_accum') + amount;
  let intPart = Math.floor(accum);
  if (intPart > 0) {
    subSolarCharge(player, intPart);
    accum -= intPart;
  }
  player.persistentData.putFloat('solar_drain_accum', accum);
}

PlayerEvents.tick(event => {
  let player = event.player;

  if (!hasSuperman(player)) return;
  let upgradeLevel = getSolarUpgradeLevel(player);
  let lastLevel = player.persistentData.getInt('solar_last_upgrade_level');

  if (upgradeLevel !== lastLevel) {
    let maxCharge = SOLAR.MAX_CHARGES[upgradeLevel];
    palladium.setProperty(player, 'energy_bar_solar_max', maxCharge);
    player.persistentData.putInt('solar_last_upgrade_level', upgradeLevel);
  }

  let maxCharge = palladium.getProperty(player, 'energy_bar_solar_max') || 100;
  let charge = getSolarCharge(player);

  let hasKryptonite = player.hasEffect("powerborne:kryptonite_poisoning");
  let hasSolarExhaustion = player.hasEffect("powerborne:solar_exhaustion");

  if (!hasKryptonite && !hasSolarExhaustion) {
    if (isInSunlight(player) && charge < maxCharge) {
      accumulateSolarCharge(player, getSolarRechargeRate(player));
    } else if (upgradeLevel >= 3 && isInMoonlight(player) && charge < maxCharge) {
      accumulateSolarCharge(player, SOLAR.MOONLIGHT_RECHARGE_RATE);
    } else {
      player.persistentData.putFloat('solar_charge_accum', 0);
    }
  } else {
    player.persistentData.putFloat('solar_charge_accum', 0);
  }

  let draining = false;

  if (solarEnabled(player, 'heat_vision_timer')) {
    accumulateSolarDrain(player, SOLAR.HEAT_VISION_DRAIN);
    draining = true;
  }

  if (solarEnabled(player, 'freeze_breath')) {
    accumulateSolarDrain(player, SOLAR.FREEZE_BREATH_DRAIN);
    draining = true;
  }

  if (solarEnabled(player, 'speed_trail')) {
    accumulateSolarDrain(player, SOLAR.SUPER_SPEED_DRAIN);
    draining = true;
  }

  if (player.hasEffect("powerborne:kryptonite_poisoning")) {
    accumulateSolarDrain(player, SOLAR.KRYPTONITE_DRAIN);
    draining = true;
  }

  if (!draining) {
    player.persistentData.putFloat('solar_drain_accum', 0);
  }

  if (solarEnabled(player, 'thunderclap')) {
    subSolarCharge(player, SOLAR.THUNDERCLAP_COST);
  }

  if (solarEnabled(player, 'flight_boost')) {
    subSolarCharge(player, SOLAR.FLIGHT_BOOST_COST);
  }

  if (solarEnabled(player, 'super_flare')) {
    let drainPerTick = maxCharge / 50;
    accumulateSolarDrain(player, drainPerTick);
  }
});
