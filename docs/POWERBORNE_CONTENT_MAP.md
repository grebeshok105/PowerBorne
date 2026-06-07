# PowerBorne Content Map

PowerBorne is organized as a resource jar with Palladium JSON and KubeJS scripts. Treat hero work as cross-file work, not as one JSON edit.

## Hero Powers

Main PvP hero powers:

- `data/powerborne/palladium/powers/sentry.json`
- `data/powerborne/palladium/powers/superman.json`
- `data/powerborne/palladium/powers/homelander.json`
- `data/powerborne/palladium/powers/god_of_thunder.json`
- `data/powerborne/palladium/powers/captain_america.json`

Companion/helper powers also exist, such as `void.json` and `stormbreaker.json`. Those can still use internal Palladium gates when they are separate systems; the main PvP hero powers are intended to be ready immediately on suit equip.

## Suit And Item Wiring

- `data/powerborne/palladium/item_powers/` maps suit items to power IDs.
- `addon/powerborne/items/` defines KubeJS item data.
- `addon/powerborne/creative_mode_tabs/powerborne.json` and `addon/powerborne/kubejs_scripts/items.js` expose items in creative tabs.
- `assets/powerborne/models/item/` and `assets/powerborne/textures/item/` hold item visuals.

## Gameplay Scripts

- `data/powerborne/kubejs_scripts/leveling_system.js`: XP, level properties, suit auto-max, reset/max commands support, and the level-10 unlock fallback helper.
- `data/powerborne/kubejs_scripts/util.js`: shared helpers, registered player properties, commands, damage/scale helpers.
- Hero folders under `data/powerborne/kubejs_scripts/` contain server combat/resource logic.

## Client Scripts And Visuals

- `assets/powerborne/kubejs_scripts/animations.js`: Palladium animation registrations.
- `assets/powerborne/kubejs_scripts/power_screen.js`: hero progress display.
- `assets/powerborne/kubejs_scripts/ability_bar_xp.js`: ability bar/progression overlay behavior.
- `assets/powerborne/palladium/render_layers/`: suit and glow layers.
- `assets/powerborne/palladium/energy_beams/`: beam definitions.
- `assets/powerborne/palladium/trails/`: movement/projectile trails.

## Translations

- `assets/powerborne/lang/en_us.json`
- `assets/powerborne/lang/ru_ru.json`

Every user-visible hero, item, ability, passive, resource, and command-facing concept should have matching English and Russian entries when practical.
