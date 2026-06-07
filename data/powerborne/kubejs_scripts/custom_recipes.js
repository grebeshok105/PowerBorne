ServerEvents.recipes(event => {
    event.shapeless(
        'powerborne:super_soldier_serum',
        [
            'minecraft:golden_apple',
            Item.of('minecraft:potion', '{Potion:"minecraft:strong_strength"}').strongNBT(),
            Item.of('minecraft:potion', '{Potion:"minecraft:strong_regeneration"}').strongNBT(),
            Item.of('minecraft:potion', '{Potion:"minecraft:strong_leaping"}').strongNBT(),
            Item.of('minecraft:potion', '{Potion:"minecraft:strong_swiftness"}').strongNBT()
        ]
    ).id('powerborne:super_soldier_serum')
})

ServerEvents.recipes(event => {
    event.smithing(
        Item.of('powerborne:stormbreaker', '{Unbreakable:1,RepairCost:2147483647}'),
        'minecraft:nether_star',
        Item.of('powerborne:mjolnir', '{CustomModelData:1,Unbreakable:1.0,RepairCost:2147483647}').strongNBT(),
        'powerborne:uru_ingot'
    ).id('powerborne:stormbreaker_smithing')
})