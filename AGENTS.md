# Agent Guide

This repository is an unpacked PowerBorne resource jar for Minecraft 1.20.1 with Palladium and KubeJS content. It is not a Gradle Java mod. Most gameplay is in JSON power definitions and KubeJS scripts.

Primary locations:

- `data/powerborne/palladium/powers/`: hero and helper power JSON.
- `data/powerborne/palladium/item_powers/`: suit item to power mappings.
- `data/powerborne/kubejs_scripts/`: server gameplay, resources, combat, commands, progression.
- `assets/powerborne/kubejs_scripts/`: client HUD, animations, overlays, render behavior.
- `assets/powerborne/palladium/`: beams, trails, render layers.
- `addon/powerborne/`: KubeJS item and creative tab data.

Use `rg` before editing. When adding or copying a hero, search every old ID, ability ID, item ID, resource property, texture path, render layer, beam ID, sound ID, and translation key. If the user says to base something on an existing hero, clone the complete implementation first, then remove or rebalance deliberately.

The current PvP design is: suits auto-max heroes. Do not reintroduce manual skill-tree gates into the main hero powers unless you also implement a reliable runtime unlock setter. `data/powerborne/kubejs_scripts/leveling_system.js` owns auto-max, reset, and the level-10 fallback for old `abilityUtil.isUnlocked(...)` checks.

Useful validation:

```powershell
node tools/validate_powerborne.mjs
jar --create --file ..\powerborne-heroes-dev.jar .
```

The validation script parses JSON, checks KubeJS syntax, confirms required Homelander files, and checks that the five main PvP heroes do not contain `property_buyable` or `ability_unlocked` gates.

Git workflow:

- Work on a feature branch.
- Keep the original imported jar state on `main`.
- Commit cohesive changes with clear messages.
- Push with `git push -u origin <branch>` and open a PR with `gh pr create`.

External reference vault:

- `C:\Users\stravvbery\Desktop\Superheroes_Reboot_Vault_2026-06-07`

Use the vault for historical ideas, assets, inventories, and old project lessons, but verify every imported file against this repo before shipping.
