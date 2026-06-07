# Vault And Asset Sources

The local reference vault is:

```text
C:\Users\stravvbery\Desktop\Superheroes_Reboot_Vault_2026-06-07
```

Use it as project memory, not as blind runtime content. Always verify paths, formats, dimensions, and IDs against this repo before copying anything.

## High-Value Vault Entrypoints

- `README.md`: vault overview.
- `knowledge-base/00_index.md`: knowledge-base index.
- `knowledge-base/full-old-project-archive/00_archive-index.md`: full old-project archive entrypoint.
- `knowledge-base/full-old-project-archive/02_heroes-and-abilities.md`: old hero and ability summaries.
- `knowledge-base/full-old-project-archive/03_systems-and-controllers.md`: controllers, resources, flight, effects, damage types.
- `knowledge-base/full-old-project-archive/05_client-ui-networking-rendering.md`: old HUD, rendering, client state, networking.
- `knowledge-base/full-old-project-archive/07_external-superman-flight-reference.md`: Superman flight reference summary.

## Asset Areas

- `asset-vault/runtime-assets/`: old runtime textures, sounds, particles, models, and lang assets.
- `asset-vault/generated-assets/`: generated item models.
- `asset-vault/raw-art-source/`: source textures and art references.
- `asset-vault/external-references/superman_flight_complete.zip`: external Superman flight reference.
- `inventories/`: CSV inventories for files, textures, sounds, model/particle/animation configs, and extensions.

## Import Rules

- Prefer assets already compatible with Minecraft resource-pack paths and naming.
- Keep new runtime assets under this repo's `assets/powerborne/...` or `data/powerborne/...` structure.
- Do not copy unused reference files into runtime folders.
- When importing textures, check the model/render JSON that references them.
- When importing sounds, update `assets/powerborne/sounds.json` and any script or JSON sound IDs.
- When importing old ideas, label unfinished plans as plans in docs; do not present them as implemented mechanics.
