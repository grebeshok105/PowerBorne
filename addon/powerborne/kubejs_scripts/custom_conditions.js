function isEntityLoaded(entity, level) {
  if (!entity || !level) return false;
  return level.isPositionEntityTicking(entity.blockPosition())
}


StartupEvents.registry('palladium:condition_serializer', (event) => {
    event.create('powerborne:stand_suit_variant')
      .addProperty('value', 'string', 'superman', 'Suit variant to check')
      .test((entity, props) => {
        return palladium.getProperty(entity, 'stand_suit_variant') === props.get('value');
      });

    event.create('powerborne:is_swinging')
      .test((entity, props) => {
        return entity.swinging && entity.swingTime == -1;
      });

    event.create('powerborne:is_using_item')
      .addProperty('item', 'string', 'powerborne:mjolnir', 'Item ID to check if being used')
      .test((entity, props) => {
        if (!entity.isPlayer()) return false;
        let useItem = entity.getUseItem();
        return useItem && useItem.id == props.get('item');
      });

    event.create('powerborne:has_mjolnir_projectile_callable')
      .test((entity, props) => {
        if (!entity || !entity.isPlayer() || !global.mjolnirProjectiles) return false;
        let tracked = global.mjolnirProjectiles.get(String(entity.uuid));
        if (!tracked || tracked.size === 0) return false;
        let hasRecallable = false;
        tracked.forEach(function(projUuid) {
          let proj = null;
          entity.server.allLevels.forEach(function(l) { if (!proj) proj = l.getEntity(projUuid); });
          if (!proj || proj.removed || (proj.persistentData.ReturnTicks || 0) >= 1) return;
          if (proj.getTags().contains('powerborne.mjolnir_jump')) return;
          if ((proj.age || 0) <= 5) return;
          hasRecallable = true;
        });
        return hasRecallable;
      });

    event.create('powerborne:has_mjolnir_weapon_stand_nearby')
      .test((entity, props) => {
        if (!entity || !entity.isPlayer()) return false;
        if (!global.mjolnirStandList) return false;
        return isEntityLoaded(global.mjolnirStandList.getClosest(entity, 195), entity.getLevel());
      });

    event.create('powerborne:mjolnir_is_returning')
      .test((entity, props) => {
        if (!entity || !entity.isPlayer()) return false;

        let entityUsername = entity.username;
        if (!entityUsername) return false;

        let mjolnirProjectiles = entity.getLevel().getEntitiesWithin(entity.getBoundingBox().inflate(80)).filter(projectile =>
            projectile.type === 'palladium:custom_projectile' && (
                projectile.getTags().contains('powerborne.mjolnir_projectile') ||
                projectile.getTags().contains('powerborne.stormbreaker_projectile')
            )
        );
   

        for (let projectile of mjolnirProjectiles) {
            let owner = projectile.getOwner();
            if (!owner || !owner.username || owner.username !== entityUsername) {
                continue;
            }

            let returnTicks = projectile.persistentData.ReturnTicks || 0;
            let projectileAge = projectile.age || 0;

            if (returnTicks > 2 && projectileAge > 2) {
                return true;
            }
        }

        return false;
      });

    event.create('powerborne:is_wolf_sitting')
      .test((entity, props) => {
        if (!entity || entity.type !== 'minecraft:wolf') return false;

        return entity.isInSittingPose() || entity.isOrderedToSit();
      });

    event.create('powerborne:shift_key_down')
      .test((entity, props) => {
        return entity.isShiftKeyDown();
      });

    event.create('powerborne:is_creative_mode')
      .test((entity, props) => {
        return entity.isPlayer() && entity.isCreative();
      });

    event.create('powerborne:can_see_sky')
      .test((entity, props) => {
        let level = entity.getLevel();
        let pos = entity.blockPosition();
        if (level.canSeeSky(pos)) return true;
        let topY = level.getHeight('MOTION_BLOCKING', pos.getX(), pos.getZ());
        return pos.getY() >= topY - 1;
      });

    event.create('powerborne:item_in_arm')
      .addProperty('item', 'string', 'powerborne:mjolnir', 'Item ID to match in main or off hand')
      .addProperty('arm', 'string', 'right', "Which arm to check: 'left' or 'right'")
      .addProperty('use_item_must_match', 'boolean', false, 'Match getUseItem() for this arm')
      .addProperty('prefer_main', 'boolean', false, 'Use main arm when both have same item')
      .test((entity, props) => {
        if (!entity) return false;

        const itemId = (props.get('item') || 'powerborne:mjolnir').toString();
        const mainHandItem = entity.getMainHandItem();
        const offHandItem = entity.getOffhandItem();

        const matchesItem = (item) => item && item.id === itemId;

        const targetArm = (props.get('arm') || 'right').toString().toLowerCase();

        let entityMainArm = 'right';
        if (entity.getMainArm) {
          let raw = entity.getMainArm();
          entityMainArm = (raw.toString ? raw.toString() : raw).toLowerCase();
          if (entityMainArm !== 'left') entityMainArm = 'right';
        }
        let mainMatches = matchesItem(mainHandItem);
        let offMatches = matchesItem(offHandItem);

        let mainMapsToTargetArm = targetArm === entityMainArm;
        let offMapsToTargetArm = targetArm !== entityMainArm;

        if (props.get('use_item_must_match')) {
          let useItem = entity.getUseItem();
          if (!matchesItem(useItem)) return false;
          if (entity.getUsedItemHand) {
            let hand = entity.getUsedItemHand();
            let handName = hand.name ? hand.name() : hand.toString();
            let isMain = handName === 'MAIN_HAND';
            let armForUsedHand = isMain
              ? entityMainArm
              : entityMainArm === 'right' ? 'left' : 'right';
            return targetArm === armForUsedHand;
          }
          let stackIsUse = (stack) =>
            stack && matchesItem(stack) && (stack.equals ? stack.equals(useItem) : stack === useItem);
          return (mainMapsToTargetArm && mainMatches && stackIsUse(mainHandItem))
            || (offMapsToTargetArm && offMatches && stackIsUse(offHandItem));
        }

        let matchesBothSlots =
          (mainMatches && mainMapsToTargetArm) || (offMatches && offMapsToTargetArm);

        if (props.get('prefer_main') && mainMatches && offMatches) {
          return targetArm === entityMainArm && mainMatches;
        }

        return matchesBothSlots;
      });

    event.create('powerborne:item_in_main_hand')
      .addProperty('item', 'string', 'powerborne:mjolnir', 'Item that must be in main hand')
      .test((entity, props) => {
        if (!entity || !entity.getMainHandItem) return false;
        const itemId = (props.get('item') || 'powerborne:mjolnir').toString();
        const main = entity.getMainHandItem();
        return main && !main.isEmpty() && main.id === itemId;
      });

      event.create('powerborne:held_item_cmd')
      .addProperty('item', 'string', 'powerborne:mjolnir', 'Item id')
      .addProperty('arm', 'string', 'right', "'left' or 'right'")
      .addProperty('value', 'integer', 1, 'CustomModelData int to match')
      .test((entity, props) => {
        if (!entity) return false;
    
        const itemId = props.get('item').toString();
        const wantNum = Number(props.get('value'));
        const targetArm = props.get('arm').toString().toLowerCase();
    
        let entityMainArm = 'right';
        if (entity.getMainArm) {
          let raw = entity.getMainArm();
          entityMainArm = raw.toString().toLowerCase();
          if (entityMainArm !== 'left') entityMainArm = 'right';
        }
    
        const stack = (targetArm === entityMainArm)
          ? entity.getMainHandItem()
          : entity.getOffhandItem();
    
        if (!stack || stack.isEmpty() || stack.id !== itemId) return false;
    
        let cmd = stack.nbt ? stack.nbt.getInt('CustomModelData') ?? 0 : 0;
        return cmd === wantNum;
      });

      event.create('powerborne:item_on_cooldown')
        .addProperty('item', 'string', 'powerborne:mjolnir', 'Item ID to check if on cooldown')
        .test((entity, props) => {
          if (!entity.isPlayer()) return false;
          const itemId = props.get('item');
          const itemObj = Item.of(itemId).item;
          return entity.getCooldowns().isOnCooldown(itemObj);
        });

      event.create('powerborne:item_durability')
        .addProperty('min_remaining', 'integer', 6, 'Item must have at least this many uses left')
        .test((entity, props) => {
          if (!entity || !entity.isPlayer()) return false;
          const stack = entity.getMainHandItem();
          if (!stack || stack.isEmpty()) return false;
          if (!stack.isDamageableItem()) return true;
          if (stack.nbt && stack.nbt.Unbreakable) return true;
          let minRem = props.get('min_remaining');
          if (minRem == null || minRem === undefined) minRem = 6;
          const remaining = stack.getMaxDamage() - stack.getDamageValue();
          return remaining >= minRem;
        });
   

        event.create('powerborne:is_hurt')
          .test((entity, props) => {
            return entity.hurtTime > 0;
        });

        event.create('powerborne:is_holding_telekinesis')
          .test((entity, props) => {
            if (!entity.isPlayer()) return false;
            return entity.persistentData.telekinesisTarget != null;
          });

        event.create('powerborne:is_in_space')
          .test((entity, props) => {
            return entity.getLevel().dimension.toString().includes('ad_astra');
          });

        event.create('powerborne:y_level')
          .addProperty('min', 'integer', 0, 'Minimum Y level')
          .addProperty('max', 'integer', 2147483647, 'Maximum Y level')
          .test((entity, props) => {
            let y = entity.getBlockY();
            return y >= props.get('min') && y <= props.get('max');
          });
        event.create('powerborne:air_above')
          .addProperty('blocks', 'integer', 4, 'Blocks upward to check')
          .test((entity, props) => {
            if (!entity || !entity.getLevel) return false;
            let level = entity.getLevel();
            if (!level) return false;
            let blocks = props.get('blocks');
            let n = Number(blocks);
            if (!(n > 0)) return true;
            let bp = entity.blockPosition();
            let nx = bp.getX();
            let ny = bp.getY();
            let nz = bp.getZ();
            for (let i = 0; i < n; i++) {
              if (level.getBlockState(new BlockPos(nx, ny + i, nz)).isSolid()) return false;
            }
            return true;
          });
  });