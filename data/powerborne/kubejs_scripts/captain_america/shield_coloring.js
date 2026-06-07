let $CraftingMenu = Java.loadClass('net.minecraft.world.inventory.CraftingMenu')

const DYE_COLORS = {
    white:      'ffffff',
    orange:     'ff6a00',
    magenta:    'ff00cc',
    light_blue: '00aaff',
    yellow:     'ffe600',
    lime:       '7fff00',
    pink:       'ff69b4',
    gray:       '5a5a5a',
    light_gray: 'dfdfdf',
    cyan:       '56a1c3',
    purple:     '8b00ff',
    blue:       '1c65b3',
    brown:      '8b4513',
    green:      '2e7d00',
    red:        'cd1f2d',
    black:      '222222'
}

const DYE_DEPOT_COLORS = {
    'dye_depot:maroon_dye':  '7b2713',
    'dye_depot:rose_dye':    'ff5e64',
    'dye_depot:coral_dye':   'df7758',
    'dye_depot:indigo_dye':  '331e57',
    'dye_depot:navy_dye':    '153d64',
    'dye_depot:slate_dye':   '4c5e86',
    'dye_depot:olive_dye':   '8c8f2a',
    'dye_depot:amber_dye':   'd7af00',
    'dye_depot:beige_dye':   'e1d5a3',
    'dye_depot:teal_dye':    '2f7b67',
    'dye_depot:mint_dye':    '38ce7d',
    'dye_depot:aqua_dye':    '5ef0cc',
    'dye_depot:verdant_dye': '255714',
    'dye_depot:forest_dye':  '32a326',
    'dye_depot:ginger_dye':  'cf6121',
    'dye_depot:tan_dye':     'f49c5d'
}

function getDyeColor(itemId) {
    for (let name in DYE_COLORS) {
        if (itemId === `minecraft:${name}_dye`) return DYE_COLORS[name]
    }
    let depot = DYE_DEPOT_COLORS[itemId]
    if (depot) return depot
    return null
}

let SLOT_TO_COLOR = {
    1: 'Color4',
    2: 'Color3',
    3: 'Color2',
    4: 'Color1',
    8: 'Color5'
}

PlayerEvents.tick(event => {
    let player = event.player
    if (!(player.containerMenu instanceof $CraftingMenu)) return

    let menu = player.containerMenu

    let getSlotItem = (i) => menu.getSlot(i).getItem()

    if (getSlotItem(5).id !== CAP_SHIELD_ID) {
        return
    }

    for (let slot in SLOT_TO_COLOR) {
        let parsedSlot = parseInt(slot)
        if (parsedSlot === 5) continue
        let item = getSlotItem(parsedSlot)
        if (!item.isEmpty() && getDyeColor(item.id) === null) {
            menu.getSlot(0).set(Item.of('air'))
            return
        }
    }

    for (let s = 6; s <= 9; s++) {
        if (s === 8) continue
        if (!getSlotItem(s).isEmpty()) {
            menu.getSlot(0).set(Item.of('air'))
            return
        }
    }

    let anyDye = false
    let foundColors = {}

    for (let slot in SLOT_TO_COLOR) {
        let parsedSlot = parseInt(slot)
        let item = getSlotItem(parsedSlot)
        if (item.isEmpty()) continue
        foundColors[SLOT_TO_COLOR[slot]] = getDyeColor(item.id)
        anyDye = true
    }

    if (!anyDye) {
        menu.getSlot(0).set(Item.of('air'))
        return
    }

    let shieldItem = getSlotItem(5)
    let existingNbt = {}
    if (shieldItem.nbt) {
        for (let key in shieldItem.nbt) {
            existingNbt[key] = shieldItem.nbt[key]
        }
    }

    if (!existingNbt.Color1) existingNbt.Color1 = "ffffff"
    if (!existingNbt.Color2) existingNbt.Color2 = "ffffff"
    if (!existingNbt.Color3) existingNbt.Color3 = "ffffff"
    if (!existingNbt.Color4) existingNbt.Color4 = "ffffff"
    if (!existingNbt.Color5) existingNbt.Color5 = "ffffff"

    for (let colorKey in foundColors) {
        existingNbt[colorKey] = foundColors[colorKey]
    }

    let outputItem = Item.of(CAP_SHIELD_ID, existingNbt)

    menu.getSlot(0).set(outputItem)
})

ItemEvents.crafted(event => {
    let player = event.player
    let item = event.item

    if (item.id !== CAP_SHIELD_ID) return
    if (!(player.containerMenu instanceof $CraftingMenu)) return

    let menu = player.containerMenu
    let saved = {}

    for (let slot in SLOT_TO_COLOR) {
        let s = parseInt(slot)
        let slotItem = menu.getSlot(s).getItem()
        if (!slotItem.isEmpty()) {
            saved[s] = { id: slotItem.id, count: slotItem.count }
        }
    }

    player.server.scheduleInTicks(0, () => {
        if (!(player.containerMenu instanceof $CraftingMenu)) return

        for (let s in saved) {
            let { id, count } = saved[s]
            let remaining = count - 1
            menu.getSlot(parseInt(s)).set(remaining <= 0 ? Item.of('air') : Item.of(id, remaining))
        }
    })
})
