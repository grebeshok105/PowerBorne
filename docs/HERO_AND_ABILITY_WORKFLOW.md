# Hero And Ability Workflow

## Existing-Solution-First Rule

Before adding or fixing a hero ability, search for a finished equivalent:

```powershell
rg "ability_id|powerborne:hero_id|item_id|resource_property" data assets addon
```

If a hero is based on another hero, copy the whole chain:

- main power JSON
- item power JSON
- suit/item definitions
- KubeJS server scripts
- KubeJS client scripts
- animation registrations
- render layers, beams, trails, particles, sounds
- textures and item models
- lang keys
- creative tab entries
- damage tags and immunity tags

Do not stop after the visible button works. Flight, fall damage, HUD bars, passives, cooldowns, resource drain, upgrade logic, particles, screen shake, and death/reset behavior all count as part of the ability.

## PvP Progression Policy

This mod is balanced around PvP superhero fights, not survival progression. The current policy is:

- Wearing a hero suit auto-maxes that hero to level 10 and max XP.
- Main hero powers should not require manual skill-tree purchases.
- Runtime upgrade checks should use `global.isAbilityUnlockedOrAutoMaxed(...)` on the server when they previously depended on `abilityUtil.isUnlocked(...)`.
- Client display fallbacks can use `abilityUtil.isUnlocked(...) || <hero>_level >= 10`.
- `/powerborne reset_hero <target> <hero|all>` resets level, XP, skill points, and resources.
- `/powerborne max_hero <target> <hero|all>` is available for admin testing.

## Adding A Hero

1. Pick the closest existing hero and map every reference with `rg`.
2. Create new IDs for power, suit, resource properties, beams, trails, render layers, damage tags, and lang keys.
3. Copy the full baseline implementation.
4. Rename IDs and texture paths.
5. Add the hero to `HEROES_CONFIG` and `HERO_AUTO_MAX_CONFIG` in `leveling_system.js`.
6. Register server and client properties in `util.js` and `power_screen.js`.
7. Add item power, item definition, creative tab entry, item model, suit render layer, and translations.
8. Run `node tools/validate_powerborne.mjs`.
9. Build a jar and smoke test in Minecraft with Palladium/KubeJS.

## Ability QA Checklist

Check every active ability for:

- appears in ability bar
- activates and cancels cleanly
- consumes or requires the intended resource
- obeys cooldown
- has correct particles/sounds/screen shake
- damages or controls only intended targets
- works in multiplayer-facing PvP scenarios
- handles low resource, death, dimension change, unequip, and re-equip
- does not refill resources every tick unless the design explicitly says so
