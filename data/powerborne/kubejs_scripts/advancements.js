PlayerEvents.tick(event => {
   const player = event.player;
   if (player.age % 20 != 0) return;

   if (abilityUtil.hasPower(player, 'powerborne:captain_america')) {
       if (!player.isAdvancementDone('powerborne:captain_america_origin')) {
           player.unlockAdvancement('powerborne:captain_america_origin');
       }

       if (!player.isAdvancementDone('powerborne:cold_days')) {
           let frozenEffect = player.getEffect('powerborne:frozen');
           if (frozenEffect && frozenEffect.getDuration() >= 115) {
               player.unlockAdvancement('powerborne:cold_days');
           }
       }
   }

   if (palladium.getProperty(player, 'hostile_killed') >= 200) {
       player.unlockAdvancement('powerborne:worthiness/hostile_killer');
   }
   let hostile_killer = player.isAdvancementDone('powerborne:worthiness/hostile_killer');
   let hero_of_the_village = player.isAdvancementDone('powerborne:worthiness/hero_of_the_village');
   let worthy = player.isAdvancementDone('powerborne:worthiness/worthy');
   if (hostile_killer) {
    palladium.setProperty(player, 'hostile_killed', 0);
    if (hero_of_the_village && !worthy) {
        player.unlockAdvancement('powerborne:worthiness/worthy');
    }
   }
});

EntityEvents.death(event => {
    const entity = event.entity;
    const source = event.source;
    const attacker = source ? source.actual : null;
    if (!attacker || !attacker.isPlayer() || !entity.isMonster()) return;

    const killed = palladium.getProperty(attacker, 'hostile_killed') || 0;
    palladium.setProperty(attacker, 'hostile_killed', killed + 1);
});