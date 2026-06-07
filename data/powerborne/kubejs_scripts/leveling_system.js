global.XP_REQUIREMENTS = [0, 50, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3250];
const HIT_ENTITIES_MAX_XP = 30;

const HEROES_CONFIG = {
    'powerborne:sentry': {
        name: 'sentry',
        displayName: 'Sentry',
        abilities: {
            'sentry_beam': { type: 'beam_kill', xp: 5, timerId: 'beam_timer' },
            'photonic_strike': { type: 'action', xp: 6 },
            'photon_forcefield': { type: 'duration', xp: 1, ticksRequired: 100 },
            'telekinesis_timer': { type: 'duration', xp: 1, ticksRequired: 80 }
        }
    },
    'powerborne:superman': {
        name: 'superman',
        displayName: 'Superman',
        abilities: {
            'heat_vision_beam': { type: 'beam_kill', xp: 5, timerId: 'heat_vision_timer' },
            'freeze_breath': { type: 'freeze_mob', xp: 4 },
            'thunderclap': { type: 'hit_entities', xp: 2 },
            'speed_trail': { type: 'speed_running', xp: 1 },
            'super_punch': { type: 'hit_entities', xp: 5 }
        }
    },
    'powerborne:homelander': {
        name: 'homelander',
        displayName: 'Homelander',
        abilities: {
            'heat_vision_beam': { type: 'beam_kill', xp: 5, timerId: 'heat_vision_timer' },
            'freeze_breath': { type: 'freeze_mob', xp: 4 },
            'thunderclap': { type: 'hit_entities', xp: 2 },
            'sonic_scream': { type: 'hit_entities', xp: 2 },
            'speed_trail': { type: 'speed_running', xp: 1 },
            'super_punch': { type: 'hit_entities', xp: 5 }
        }
    },
    'powerborne:god_of_thunder': {
        name: 'thor',
        displayName: 'Thor',
        abilities: {
            'lightning_blast_timer': { type: 'beam_kill', xp: 5, timerId: 'lightning_blast_timer' },
            'stormbreaker_blast_timer': { type: 'beam_kill', xp: 5, timerId: 'stormbreaker_blast_timer' },
            'god_blast_timer': { type: 'beam_kill', xp: 8, timerId: 'god_blast_timer' },
            'lightning_burst_timer': { type: 'beam_kill', xp: 5, timerId: 'lightning_burst_timer' },
            'chain_lightning': { type: 'action', xp: 1 },
            'mjolnir_vortex': { type: 'action', xp: 1 },
            'mjolnir_use': { type: 'mjolnir_throw', xp: 5 },
            'stormbreaker_use': { type: 'mjolnir_throw', xp: 4 }
        }
    },
    'powerborne:captain_america': {
        name: 'captain_america',
        displayName: 'Captain America',
        abilities: {
            'throw_shield':     { type: 'projectile_kill', xp: 5 },
            'spinning_shield':  { type: 'projectile_kill', xp: 4 },
            'shield_rush':      { type: 'ability_kill',    xp: 3 },
            'rising_uppercut':  { type: 'ability_kill',    xp: 3 },
            'shield_slam':      { type: 'ability_kill',    xp: 4 },
            'super_soldier_u1': { type: 'action',          xp: 1 }
        }
    }
};

const HERO_AUTO_MAX_CONFIG = {
    'powerborne:sentry': {
        name: 'sentry',
        resources: {
            energy_bar_void: 200
        }
    },
    'powerborne:superman': {
        name: 'superman',
        resources: {
            energy_bar_solar_max: 500,
            energy_bar_solar: 500
        }
    },
    'powerborne:homelander': {
        name: 'homelander',
        resources: {
            energy_bar_blood_v_max: 500,
            energy_bar_blood_v: 500
        }
    },
    'powerborne:god_of_thunder': {
        name: 'thor',
        resources: {
            energy_bar_lightning: 200
        }
    },
    'powerborne:captain_america': {
        name: 'captain_america',
        resources: {}
    }
};

function getHeroAutoMaxKey(heroName, suffix) {
    return `powerborne_${heroName}_${suffix}`;
}

function isHeroAutoMaxBlocked(player, heroName) {
    return player.persistentData.getBoolean(getHeroAutoMaxKey(heroName, 'auto_max_blocked'));
}

global.levelingSystem = {
    getHeroName(powerId) {
        const config = HEROES_CONFIG[powerId];
        return config ? config.name : null;
    },

    getLevel(player, heroName) {
        return palladium.getProperty(player, `${heroName}_level`) || 0;
    },

    getXP(player, heroName) {
        return palladium.getProperty(player, `${heroName}_xp`) || 0;
    },

    getSkillPoints(player, heroName) {
        return palladium.getProperty(player, `${heroName}_skill_points`) || 0;
    },

    getXPForNextLevel(level) {
        if (level >= 10) return 0;
        return global.XP_REQUIREMENTS[level + 1] - global.XP_REQUIREMENTS[level];
    },

    getTotalXPForLevel(level) {
        return global.XP_REQUIREMENTS[Math.min(10, Math.max(0, level))];
    },

    getLevelFromXP(totalXP) {
        let level = 0;
        for (let i = 1; i <= 10; i++) {
            if (totalXP >= global.XP_REQUIREMENTS[i]) {
                level = i;
            } else {
                break;
            }
        }
        return level;
    },

    internalSetLevel(player, heroName, level) {
        palladium.setProperty(player, `${heroName}_level`, Math.max(0, Math.min(10, level)));
    },
    internalSetXP(player, heroName, xp) {
        palladium.setProperty(player, `${heroName}_xp`, Math.max(0, xp));
    },
    internalSetSkillPoints(player, heroName, points) {
        palladium.setProperty(player, `${heroName}_skill_points`, Math.max(0, points));
    },

    showLevelUpEffect(player, heroName, levelsGained, newLevel) {
        player.tell(
            Component.translate("messages.powerborne.level_up",
              Text.of(Component.translate(`accessory_slot.powerborne.${heroName}`)).aqua(),
              Text.of(String(newLevel)).green(),
              Text.of(String(levelsGained)).yellow()
            )
          );
        global.playSoundLocal(player, 'minecraft:entity.player.levelup', 'players', 0.5, 1.0);
    },

    syncLevelFromXP(player, heroName, showEffect) {
        if (showEffect === undefined) showEffect = false;
        const xp = this.getXP(player, heroName);
        const newLevel = this.getLevelFromXP(xp);
        const oldLevel = this.getLevel(player, heroName);
        const spDiff = newLevel - oldLevel;
        
        let newSP = this.getSkillPoints(player, heroName);
        if (spDiff > 0) {
            newSP += spDiff;
            if (showEffect) {
                this.showLevelUpEffect(player, heroName, spDiff, newLevel);
            }
        } else if (spDiff < 0) {
            newSP = newLevel;
        }
        
        this.internalSetSkillPoints(player, heroName, newSP);
        this.internalSetLevel(player, heroName, newLevel);
    },
    syncXPFromLevel(player, heroName) {
        const level = this.getLevel(player, heroName);
        this.internalSetXP(player, heroName, this.getTotalXPForLevel(level));
    },

    canLevelUp(player, heroName) {
        const currentLevel = this.getLevel(player, heroName);
        const currentXP = this.getXP(player, heroName);
        
        if (currentLevel >= 10) return false;
        
        return currentXP >= this.getTotalXPForLevel(currentLevel + 1);
    },

    setLevel(player, heroName, level) {
        this.internalSetLevel(player, heroName, level);
        this.internalSetSkillPoints(player, heroName, level);
        this.syncXPFromLevel(player, heroName);
    },

    setXP(player, heroName, xp) {
        this.internalSetXP(player, heroName, xp);
        this.syncLevelFromXP(player, heroName, true);
    },

    setSkillPoints(player, heroName, points) {
        palladium.setProperty(player, `${heroName}_skill_points`, Math.max(0, points));
    },

    awardXP(player, powerId, abilityId, amount) {
        const heroName = this.getHeroName(powerId);
        if (!heroName) return;

        if (!abilityUtil.hasPower(player, powerId)) return;

        const currentXP = this.getXP(player, heroName);
        const newXP = currentXP + amount;
        
        this.setXP(player, heroName, newXP);
        
        // if (amount > 0) {
        //     player.setStatusMessage(`§7+${amount} XP §8(${abilityId})`);
        // }
    },

    awardXPForAbility(player, powerId, abilityId, context) {
        if (!context) context = {};
        const config = HEROES_CONFIG[powerId];
        if (!config || !config.abilities[abilityId]) return;

        const abilityConfig = config.abilities[abilityId];
        let xpToAward = 0;

        switch (abilityConfig.type) {
            case 'action':
                xpToAward = abilityConfig.xp;
                break;
            case 'beam_kill':
                xpToAward = abilityConfig.xp;
                break;
            case 'freeze_mob':
                xpToAward = abilityConfig.xp;
                break;
            case 'hit_entities': {
                const hits = Math.max(1, context.entitiesHit ?? 0);
                xpToAward = Math.min(HIT_ENTITIES_MAX_XP, abilityConfig.xp * hits);
                break;
            }
            case 'duration':
                const enabledTicks = context.enabledTicks || 0;
                if (enabledTicks >= abilityConfig.ticksRequired) {
                    xpToAward = abilityConfig.xp;
                }
                break;
            case 'speed_running':
                xpToAward = abilityConfig.xp;
                break;
            case 'mjolnir_throw':
                xpToAward = abilityConfig.xp;
                break;
            case 'projectile_kill':
                xpToAward = abilityConfig.xp;
                break;
            case 'ability_kill':
                xpToAward = abilityConfig.xp;
                break;
        }

        if (xpToAward > 0) {
            this.awardXP(player, powerId, abilityId, xpToAward);
        }
    },

    getProgressInfo(player, heroName) {
        const currentLevel = this.getLevel(player, heroName);
        const currentXP = this.getXP(player, heroName);
        const skillPoints = this.getSkillPoints(player, heroName);
        
        if (currentLevel >= 10) {
            return {
                level: currentLevel,
                xp: currentXP,
                skillPoints: skillPoints,
                isMaxLevel: true,
                progress: 1.0,
                xpForNext: 0,
                totalXPForNext: 0
            };
        }

        const totalXPForNext = this.getTotalXPForLevel(currentLevel + 1);
        const totalXPForCurrent = this.getTotalXPForLevel(currentLevel);
        const xpForNext = totalXPForNext - currentXP;
        const progress = currentLevel === 0 
            ? currentXP / totalXPForNext 
            : (currentXP - totalXPForCurrent) / (totalXPForNext - totalXPForCurrent);

        return {
            level: currentLevel,
            xp: currentXP,
            skillPoints: skillPoints,
            isMaxLevel: false,
            progress: Math.min(1.0, Math.max(0.0, progress)),
            xpForNext: xpForNext,
            totalXPForNext: totalXPForNext
        };
    },

    maxHero(player, heroName) {
        const maxLevel = 10;
        const maxXP = this.getTotalXPForLevel(maxLevel);
        this.internalSetLevel(player, heroName, maxLevel);
        this.internalSetXP(player, heroName, maxXP);
        this.internalSetSkillPoints(player, heroName, 0);
    },

    resetHero(player, heroName) {
        this.internalSetLevel(player, heroName, 0);
        this.internalSetXP(player, heroName, 0);
        this.internalSetSkillPoints(player, heroName, 0);
    },

    resetAllHeroes(player) {
        Object.keys(HERO_AUTO_MAX_CONFIG).forEach(powerId => {
            this.resetHero(player, HERO_AUTO_MAX_CONFIG[powerId].name);
        });
    }
};

global.heroAutoMax = {
    getConfig(powerId) {
        return HERO_AUTO_MAX_CONFIG[powerId] || null;
    },

    getHeroNames() {
        return Object.keys(HERO_AUTO_MAX_CONFIG).map(powerId => HERO_AUTO_MAX_CONFIG[powerId].name);
    },

    maxHero(player, powerId, refillResources) {
        const config = this.getConfig(powerId);
        if (!config) return false;

        global.levelingSystem.maxHero(player, config.name);
        player.persistentData.remove(getHeroAutoMaxKey(config.name, 'auto_max_blocked'));
        if (abilityUtil.hasPower(player, powerId)) {
            player.persistentData.putBoolean(getHeroAutoMaxKey(config.name, 'had_power'), true);
        }
        if (refillResources !== false) {
            Object.keys(config.resources).forEach(property => {
                palladium.setProperty(player, property, config.resources[property]);
            });
        } else {
            Object.keys(config.resources).forEach(property => {
                if (property.endsWith('_max')) {
                    palladium.setProperty(player, property, config.resources[property]);
                }
            });
        }
        return true;
    },

    maxAllHeroes(player, refillResources) {
        Object.keys(HERO_AUTO_MAX_CONFIG).forEach(powerId => {
            this.maxHero(player, powerId, refillResources);
        });
    },

    resetHero(player, heroName, blockAutoMax) {
        let matchedPower = null;
        Object.keys(HERO_AUTO_MAX_CONFIG).forEach(powerId => {
            if (HERO_AUTO_MAX_CONFIG[powerId].name === heroName) matchedPower = powerId;
        });
        if (!matchedPower) return false;

        const config = HERO_AUTO_MAX_CONFIG[matchedPower];
        global.levelingSystem.resetHero(player, config.name);
        Object.keys(config.resources).forEach(property => {
            palladium.setProperty(player, property, 0);
        });
        const hadKey = getHeroAutoMaxKey(config.name, 'had_power');
        const blockedKey = getHeroAutoMaxKey(config.name, 'auto_max_blocked');
        if (blockAutoMax && abilityUtil.hasPower(player, matchedPower)) {
            player.persistentData.putBoolean(blockedKey, true);
        } else {
            player.persistentData.remove(hadKey);
            player.persistentData.remove(blockedKey);
        }
        return true;
    },

    resetAllHeroes(player, blockAutoMax) {
        Object.keys(HERO_AUTO_MAX_CONFIG).forEach(powerId => {
            this.resetHero(player, HERO_AUTO_MAX_CONFIG[powerId].name, blockAutoMax);
        });
    }
};

global.isAbilityUnlockedOrAutoMaxed = function(player, powerId, abilityId) {
    const config = global.heroAutoMax.getConfig(powerId);
    if (config && !isHeroAutoMaxBlocked(player, config.name) && global.levelingSystem.getLevel(player, config.name) >= 10) {
        return true;
    }
    return abilityUtil.isUnlocked(player, powerId, abilityId);
};

PlayerEvents.tick(event => {
    const player = event.player;

    Object.keys(HERO_AUTO_MAX_CONFIG).forEach(powerId => {
        const config = HERO_AUTO_MAX_CONFIG[powerId];
        const hadKey = getHeroAutoMaxKey(config.name, 'had_power');
        const blockedKey = getHeroAutoMaxKey(config.name, 'auto_max_blocked');
        const hasPower = abilityUtil.hasPower(player, powerId);

        const hadPower = player.persistentData.getBoolean(hadKey);
        const blocked = isHeroAutoMaxBlocked(player, config.name);

        if (!hasPower) {
            if (hadPower) player.persistentData.remove(hadKey);
            player.persistentData.remove(blockedKey);
            return;
        }

        if (!hadPower) {
            player.persistentData.putBoolean(hadKey, true);
            if (!blocked) global.heroAutoMax.maxHero(player, powerId, true);
            return;
        }

        if (!blocked && global.levelingSystem.getLevel(player, config.name) < 10) {
            global.heroAutoMax.maxHero(player, powerId, false);
        }
    });
});

PlayerEvents.tick(event => {
    const player = event.player;
    
    Object.keys(HEROES_CONFIG).forEach(powerId => {
        if (!abilityUtil.hasPower(player, powerId)) return;
        
        const config = HEROES_CONFIG[powerId];
        Object.keys(config.abilities).forEach(abilityId => {
            const abilityConfig = config.abilities[abilityId];
            
            if (abilityConfig.type === 'duration') {
                if (abilityUtil.isEnabled(player, powerId, abilityId)) {
                    const enabledTicks = global.getAbilityAnimationTicks(player, powerId, abilityId, true);
                    if (enabledTicks > 0 && enabledTicks % abilityConfig.ticksRequired === 0) {
                        if (abilityId === 'telekinesis_timer' && (!player.persistentData.telekinesisTargetType || player.persistentData.telekinesisTargetType === '')) {
                            // Don't award XP if telekinesis not holding anything
                        } else {
                            global.levelingSystem.awardXPForAbility(player, powerId, abilityId, {
                                enabledTicks: abilityConfig.ticksRequired
                            });
                        }
                    }
                }
            }
            
            if (abilityConfig.type === 'speed_running') {
                if (player.age % 200 === 0 &&
                    abilityUtil.isEnabled(player, powerId, abilityId) && 
                    (player.isSprinting() || player.getDeltaMovement().lengthSqr() > 0.01)) {
                    
                    global.levelingSystem.awardXPForAbility(player, powerId, abilityId);
                }
            }
        });
    });
});

EntityEvents.death(event => {
    const entity = event.entity;
    const source = event.source;
    if (!source || !source.player || !entity.isLiving() || entity.isPlayer()) return;
    
    const player = source.player;
    
    Object.keys(HEROES_CONFIG).forEach(powerId => {
        if (!abilityUtil.hasPower(player, powerId)) return;
        const config = HEROES_CONFIG[powerId];

        global.levelingSystem.awardXP(player, powerId, 'kill', 1);

        Object.keys(config.abilities).forEach(abilityId => {
            const ability = config.abilities[abilityId];
            if (ability.type === 'beam_kill' && ability.timerId) {
                const recentUse = global.getAbilityAnimationTicks(player, powerId, ability.timerId, false) > 0 ||
                                 abilityUtil.isEnabled(player, powerId, ability.timerId);
                if (recentUse) {
                    global.levelingSystem.awardXPForAbility(player, powerId, abilityId);
                }
            }
        });
    });
});
