let ChunkStatus = Java.loadClass("net.minecraft.world.level.chunk.ChunkStatus")
let Registries = Java.loadClass("net.minecraft.core.registries.Registries")
let ResourceLocation = Java.loadClass("net.minecraft.resources.ResourceLocation")
let BlockPos = Java.loadClass("net.minecraft.core.BlockPos")
let GameRules = Java.loadClass("net.minecraft.world.level.GameRules")
let BoundingBox = Java.loadClass("net.minecraft.world.level.levelgen.structure.BoundingBox")
let SectionPos = Java.loadClass("net.minecraft.core.SectionPos")
let QuartPos = Java.loadClass("net.minecraft.core.QuartPos")
let ChunkPos = Java.loadClass("net.minecraft.world.level.ChunkPos")
let StructurePlaceSettings = Java.loadClass('net.minecraft.world.level.levelgen.structure.templatesystem.StructurePlaceSettings')
let Team = Java.loadClass('net.minecraft.world.scores.Team')

ServerEvents.loaded(event => {
    let dimension = "powerborne:void_dimension"
    let level = event.server.getLevel('powerborne:void_dimension');
    if (event.server.persistentData.powerborne_void_built) {
        return;
    }

    global.fillBiomeInChunks(event.server, 100, 0, -1, 190, 41, 57, 'powerborne:void_room1')
    level.getStructureManager().get(new ResourceLocation('powerborne:void_room1'))
        .ifPresent(t => t.placeInWorld(level, BlockPos.containing(100, 0, 0),
            BlockPos.containing(100, 0, 0),
            new StructurePlaceSettings(), level.random, 2))

    let scoreboard = event.server.getScoreboard();
    let team = scoreboard.addPlayerTeam('hidden_nametags')
    team.setNameTagVisibility('never');

    level.getEntities()
        .filter(e => e.getTags().contains('herobrine_stand'))
        .forEach(e => scoreboard.addPlayerToTeam(e.stringUuid, team));
    event.server.scheduleInTicks(20, () => {
        event.server.persistentData.powerborne_void_built = true;
        event.server.runCommandSilent(`execute in ${dimension} run forceload remove all`);
    });
});

global.fillBiomeInChunks = (server, x1, y1, z1, x2, y2, z2, biomeId) => {
    try {
        let level = server.getLevel('powerborne:void_dimension');
        let registryAccess = level.registryAccess()
        let structureRegistry = registryAccess.registryOrThrow(Registries.BIOME)
        let structureKey = structureRegistry.getResourceKey(structureRegistry.get(biomeId)).get()
        let biome = structureRegistry.getHolderOrThrow(structureKey)

        let from = BlockPos.containing(Math.min(x1, x2), Math.min(y1, y2), Math.min(z1, z2));
        let to = BlockPos.containing(Math.max(x1, x2), Math.max(y1, y2), Math.max(z1, z2));

        let box = BoundingBox.fromCorners(from, to);
        let chunks = [];
        for (let cz = SectionPos.blockToSectionCoord(box.minZ()); cz <= SectionPos.blockToSectionCoord(box.maxZ()); ++cz) {
            for (let cx = SectionPos.blockToSectionCoord(box.minX()); cx <= SectionPos.blockToSectionCoord(box.maxX()); ++cx) {
                level.setChunkForced(cx, cz, true);
            }
        }
        for (let cz = SectionPos.blockToSectionCoord(box.minZ()); cz <= SectionPos.blockToSectionCoord(box.maxZ()); ++cz) {
            for (let cx = SectionPos.blockToSectionCoord(box.minX()); cx <= SectionPos.blockToSectionCoord(box.maxX()); ++cx) {
                let chunk = level.getChunk(cx, cz, ChunkStatus.FULL, false);
                if (!chunk) console.log(`Chunk not loaded: ${cx},${cz}`);
                chunks.push(chunk);
            }
        }

        let replaced = { value: 0 };
        let resolver = (qx, qy, qz, sampler) => {
            let bx = QuartPos.toBlock(qx);
            let by = QuartPos.toBlock(qy);
            let bz = QuartPos.toBlock(qz);
            if (box.isInside(bx, by, bz)) {
                replaced.value++;
                return biome;
            }

            let chunk = chunks.find(c => c.getPos().x === SectionPos.blockToSectionCoord(bx) && c.getPos().z === SectionPos.blockToSectionCoord(bz));
            return chunk ? chunk.getNoiseBiome(qx, qy, qz) : biome;
        };

        for (let chunk of chunks) {
            chunk.fillBiomesFromNoise(resolver, level.getChunkSource().randomState().sampler());
            chunk.setUnsaved(true);
        }
        level.getChunkSource().chunkMap.resendBiomesForChunks(chunks);
        return replaced.value;
    } catch (err) {
        console.log('Error in fillBiomeInChunks:', err);
        return 0;
    }
};

const HEROBRINE_TELEPORT_LOCATIONS = [
    { x: 130.681, y: 10, z: 38.576 },
    { x: 148.299, y: 8, z: 35.534 },
    { x: 134.236, y: 11, z: 31.247 },
    { x: 151.462, y: 11, z: 17.575 },
    { x: 150.434, y: 15, z: 18.641 },
    { x: 136.489, y: 19, z: 19.611 },
    { x: 144.296, y: 18.5, z: 25.187 },
];

function getRandomTeleportLocation() {
    return HEROBRINE_TELEPORT_LOCATIONS[Math.floor(Math.random() * HEROBRINE_TELEPORT_LOCATIONS.length)];
}

ServerEvents.command('place', event => {
    const command = event.input
    if (command.includes('powerborne:void_room')) {
        Client.player.tell(Component.translate('commands.place.structure.failed').red());
        event.cancel();
    }
});

ServerEvents.command('fillbiome', event => {
    const command = event.input
    if (command.includes('powerborne:void_room')) {
        Client.player.tell(Component.translate('commands.place.structure.failed').red());
        event.cancel();
    }
});

EntityEvents.hurt(event => {
    let entity = event.entity;
    let source = event.source;
    let attacker = source.player;

    if (attacker) {
        if (abilityUtil.hasPower(entity, "powerborne:hb")) {
            event.level.spawnParticles('minecraft:smoke', true, entity.x, entity.y + 0.5, entity.z, 0.25, 0.8, 0.25, 100, 0);
            if (entity.y > 14) {
                entity.teleportTo(entity.x, entity.y - 10, entity.z);
            } else {
                entity.teleportTo(entity.x, entity.y - 5, entity.z);
            }
            global.sound(entity, 'minecraft:entity.enderman.teleport', 1.0, 0.8);

            event.server.scheduleInTicks(100, () => {
                if (entity.isAlive()) {
                    let teleportLoc = getRandomTeleportLocation();
                    entity.teleportTo(teleportLoc.x, teleportLoc.y, teleportLoc.z);
                    global.sound(entity, 'minecraft:entity.enderman.teleport', 1.0, 0.8);
                    event.server.scheduleInTicks(5, () => {
                        event.level.spawnParticles('minecraft:smoke', true, entity.x, entity.y + 0.5, entity.z, 0.25, 0.8, 0.25, 100, 0);
                    });
                }
            });
        }
    }
});