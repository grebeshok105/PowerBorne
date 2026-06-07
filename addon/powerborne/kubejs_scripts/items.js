let isClient = Platform.isClientEnvironment()
let $ItemProperties = isClient ? Java.loadClass('net.minecraft.client.renderer.item.ItemProperties') : null
let $Integer = Java.loadClass('java.lang.Integer');
let accessoryIds = [
    "sentry_black_and_gold",
    "sentry_mcu",
    "sentry_horseman",
    "superman_beyond",
    "superman_maws",
    "superman_maws_v2",
    "superman_justice_lord",
    "superman_cyborg",
    "superman_cyborg_dcamu",
    "superman_absolute",
    "superman_dceu",
    "superman_dcu",
    "thor_classic",
    "thor_herald",
    "thor_unworthy",
    "thor_avengers",
    "thor_infinity_war_v1",
    "thor_infinity_war_v2",
    "thor_love_and_thunder",
    "thor_love_and_thunder_extreme",
    "captain_america_the_captain",
    "captain_america_bucky",
    "captain_america_hydra_supreme",
    "captain_america_civil_warrior",
    "captain_america_first_avenger",
    "sentry_void_merged"
];

let scrollExcludedIds = [
    "sentry_void_merged"
];

StartupEvents.registry('creative_mode_tab', event => {
    event.create('powerborne:psuit_scrolls')
        .displayName(Component.translate('powerborne.itemGroup.suit_scrolls'))
        .icon(() => 'powerborne:suit_scroll')
        .content(showRestrictedItems =>
            accessoryIds.filter(id => !scrollExcludedIds.includes(id)).map(id => Item.of('powerborne:suit_scroll', { AccessoryID: id }))
        )
})

StartupEvents.modifyCreativeTab('powerborne:powerborne', event => {
    event.addAfter('powerborne:sun_totem', Item.of('powerborne:sun_totem', { energy: 0 }))
    event.addAfter('powerborne:sun_totem', Item.of('powerborne:sun_totem', { energy: 5000 }))
    event.addAfter('powerborne:thor_suit', Item.of('powerborne:mjolnir', { Unbreakable: 1, RepairCost: $Integer.valueOf("2147483647") }))
    event.addAfter('powerborne:thor_suit', Item.of('powerborne:stormbreaker', { Unbreakable: 1, RepairCost: $Integer.valueOf("2147483647") }))
    event.addAfter('powerborne:captain_america_suit', Item.of('powerborne:vibranium_shield', '{Color1:"ffffff",Color2:"dfdfdf",Color3:"ffffff",Color4:"dfdfdf",Color5:"ffffff"}'))
    event.addAfter('powerborne:captain_america_suit', Item.of('powerborne:vibranium_shield', '{Color1:"1c65b3",Color2:"cd1f2d",Color3:"ffffff",Color4:"cd1f2d",Color5:"ffffff"}'))
    event.addAfter('powerborne:mjolnir', Item.of('minecraft:potion', '{Potion:"powerborne:golden_serum"}'))
    event.addAfter('powerborne:mjolnir', Item.of('powerborne:super_soldier_serum'))
})

StartupEvents.postInit(event => {
    if (!Platform.isClientEnvironment()) return;
    
    if (Platform.isForge()) {
        // Forge
        $ItemProperties["register(net.minecraft.world.item.Item,net.minecraft.resources.ResourceLocation,net.minecraft.client.renderer.item.ItemPropertyFunction)"](Item.of('powerborne:kryptonian_whistle'), new ResourceLocation('tooting'), (stack, world, living, seed) => {  
            return living != null && living.isUsingItem() && living.getUseItem() == stack ? 1.0 : 0.0;
        })
    } else {
        // Fabric
        $ItemProperties.register(Ingredient.of('powerborne:kryptonian_whistle'), new ResourceLocation('tooting'), (stack, world, living, seed) => {  
            return living != null && living.isUsingItem() && living.getUseItem() == stack ? 1.0 : 0.0;  
        })
    }
})

StartupEvents.registry('item', event => {
    event.create('powerborne:kryptonian_whistle')
    .modelJson({
        "parent": "item/generated",
        "textures": {
            "layer0": "powerborne:item/kryptonian_whistle"
        },
        "display": {
            "thirdperson_righthand": {
                "rotation": [ 0, 180, 0 ],
                "translation": [ 0, 3, 1 ],
                "scale": [ 0.55, 0.55, 0.55 ]
            },
            "thirdperson_lefthand": {
                "rotation": [ 0, 0, 0 ],
                "translation": [ 0, 3, 1 ],
                "scale": [ 0.55, 0.55, 0.55 ]
            },
            "firstperson_righthand": {
                "rotation": [ 0, -90, 25 ],
                "translation": [ 1.13, 3.2, 1.13 ],
                "scale": [ 0.68, 0.68, 0.68 ]
            },
            "firstperson_lefthand": {
                "rotation": [ 0, 90, -25 ],
                "translation": [ 1.13, 3.2, 1.13 ],
                "scale": [ 0.68, 0.68, 0.68 ]
            }
        },
        "overrides": [
            {
                "predicate": {
                    "tooting": 1.0
                },
                "model": "powerborne:item/tooting_kryptonian_whistle"
            }
        ]
      })
    .unstackable()
    .rarity('uncommon')
    .useAnimation('toot_horn')
    .useDuration((itemstack) => 60)
    .maxDamage(1)
    .use((level, player, hand) => {
        player.level.playSound(null, player.x, player.y, player.z, 'powerborne:whistle', 'players', 0.7, 1);
        player.addItemCooldown("powerborne:kryptonian_whistle", 300)
        return true;
    })

})

StartupEvents.registry('item', event => {
    event.create('powerborne:super_soldier_serum')
        .rarity('rare')
        .unstackable()
        .useAnimation('drink')
        .useDuration(itemstack => 32)
        .use((level, player, hand) => true)
        .finishUsing((itemstack, level, entity) => {
            entity.potionEffects.add('minecraft:strength', 1800, 1, false, true)
            entity.potionEffects.add('minecraft:regeneration', 440, 1, false, true)
            entity.potionEffects.add('minecraft:jump_boost', 1800, 1, false, true)
            entity.potionEffects.add('minecraft:speed', 1800, 1, false, true)
            entity.potionEffects.add('minecraft:resistance', 1800, 0, false, true)
            itemstack.shrink(1)
            if (entity.isPlayer()) {  
                if (itemstack.isEmpty()) {  
                    // If stack is empty, replace with glass bottle  
                    return Item.of('minecraft:glass_bottle')  
                } else {  
                    // If stack still has items, add bottle to inventory  
                    entity.give(Item.of('minecraft:glass_bottle'))  
                    return itemstack  
                }  
            }  
            return itemstack
        })
})

StartupEvents.registry('item', (event) => {
    event.create('powerborne:vibranium_shield', 'sword').tier('diamond')
        .maxDamage(2031)
        .useAnimation('block')
        .fireResistant(true)
        .useDuration(itemstack => 72000)
        .use((level, player, hand) => true)
        .tag('minecraft:shields')
        .rarity('rare')
        .modelJson({
            parent: "powerborne:item/vibranium_shield_base",  
            overrides: [  
              {"predicate": {"damage": 0.9975}, "model": "powerborne:item/vibranium_shield_broken"}
            ]  
        })
        .color((itemstack, tintIndex) => {
            if (tintIndex == 1) {
                let hex = itemstack?.nbt?.Color1 ?? 'ffffff';
                if (typeof hex === 'string' && hex.startsWith('#')) { hex = hex.substring(1); }
                let color = parseInt(hex, 16);
                return color;
            };
            if (tintIndex == 2) {
                let hex = itemstack?.nbt?.Color2 ?? 'ffffff';
                if (typeof hex === 'string' && hex.startsWith('#')) { hex = hex.substring(1); }
                let color = parseInt(hex, 16);
                return color;
            };
            if (tintIndex == 3) {
                let hex = itemstack?.nbt?.Color3 ?? 'ffffff';
                if (typeof hex === 'string' && hex.startsWith('#')) { hex = hex.substring(1); }
                let color = parseInt(hex, 16);
                return color;
            };
            if (tintIndex == 4) {
                let hex = itemstack?.nbt?.Color4 ?? 'ffffff';
                if (typeof hex === 'string' && hex.startsWith('#')) { hex = hex.substring(1); }
                let color = parseInt(hex, 16);
                return color;
            };
            if (tintIndex == 5) {  
                let hex = itemstack?.nbt?.Color5 ?? 'ffffff';  
                if (typeof hex === 'string' && hex.startsWith('#')) { hex = hex.substring(1); }  
                let color = parseInt(hex, 16);  
                return color;  
            };
            return -1;
        });
});

ItemEvents.modification(event => {
    event.modify('powerborne:vibranium_shield', item => {
        item.setTier(tier => {
            tier.setRepairIngredient('palladium:vibranium_ingot')
        })
    })
})

StartupEvents.modifyCreativeTab('kubejs:tab', event => {
    event.remove('powerborne:kryptonian_whistle');
    event.remove('powerborne:mjolnir');
    event.remove('powerborne:kryptonite_cluster')
    event.remove('powerborne:void_block')
    event.remove('powerborne:vibranium_shield')
    event.remove('powerborne:super_soldier_serum')
});

StartupEvents.registry('sound_event', event => {
    event.create('powerborne:void_teleport')
    event.create('powerborne:void_banishment')
    event.create('powerborne:sentry_telekinesis_throw')
    event.create('powerborne:sentry_fly_start')
    event.create('powerborne:flight_boost')
    event.create('powerborne:thunderclap')
    event.create('powerborne:super_punch')
    event.create('powerborne:mjolnir_hit')
    event.create('powerborne:mjolnir_throw')
    event.create('powerborne:mjolnir_hum')
    event.create('powerborne:mjolnir_spin')
    event.create('powerborne:mjolnir_grab'),
    event.create('powerborne:charge_thunder')
    event.create('powerborne:storm_strike')
    event.create('powerborne:lightning_jump')
    event.create('powerborne:lightning_loop')
    event.create('powerborne:electricity_beam_loop')
    event.create('powerborne:chain_lightning_hit')
    event.create('powerborne:mjolnir_fail')
    event.create('powerborne:whistle')
    event.create('powerborne:super_flare')
    event.create('powerborne:shield_throw')
    event.create('powerborne:shield_hit')
    event.create('powerborne:shield_beam_hit')
    event.create('powerborne:shield_mjolnir_hit')
    event.create('powerborne:shield_block')
    event.create('powerborne:shield_spin')
    event.create('powerborne:bifrost_start')
    event.create('powerborne:bifrost_end')
})