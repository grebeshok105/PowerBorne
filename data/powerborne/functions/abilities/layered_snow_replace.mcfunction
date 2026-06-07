# Clear fire first
fill ~1 ~1 ~1 ~-1 ~-1 ~-1 minecraft:air replace fire

# Early exit if surface is invalid
execute if block ~ ~ ~ #minecraft:geode_invalid_blocks run return 0
execute if block ~ ~ ~ minecraft:obsidian run return 0
execute if block ~ ~-1 ~ #powerborne:replaceable_plants run return 0
execute if block ~ ~-1 ~ minecraft:air run return 0  
execute if block ~ ~-1 ~ #minecraft:ice run return 0
execute if block ~ ~-1 ~ #minecraft:geode_invalid_blocks run return 0

# Special case: layer 7 can become full block if full snow below
execute if block ~ ~ ~ minecraft:snow[layers=7] if block ~ ~-1 ~ minecraft:snow[layers=8] run setblock ~ ~ ~ minecraft:snow[layers=8]
execute if block ~ ~ ~ minecraft:snow[layers=7] if block ~ ~-1 ~ minecraft:snow[layers=8] run schedule_snow_removal
execute if block ~ ~ ~ minecraft:snow[layers=7] if block ~ ~-1 ~ minecraft:snow[layers=8] run return 1

# Increment snow layers (only one will match per execution)
execute if block ~ ~ ~ minecraft:snow[layers=7] run setblock ~ ~ ~ minecraft:snow[layers=8]
execute if block ~ ~ ~ minecraft:snow[layers=6] run setblock ~ ~ ~ minecraft:snow[layers=7]
execute if block ~ ~ ~ minecraft:snow[layers=5] run setblock ~ ~ ~ minecraft:snow[layers=6]
execute if block ~ ~ ~ minecraft:snow[layers=4] run setblock ~ ~ ~ minecraft:snow[layers=5]
execute if block ~ ~ ~ minecraft:snow[layers=3] run setblock ~ ~ ~ minecraft:snow[layers=4]
execute if block ~ ~ ~ minecraft:snow[layers=2] run setblock ~ ~ ~ minecraft:snow[layers=3]
execute if block ~ ~ ~ minecraft:snow[layers=1] run setblock ~ ~ ~ minecraft:snow[layers=2]

# Place initial snow if no snow exists, allow on full snow blocks
execute unless block ~ ~ ~ minecraft:snow if block ~ ~-1 ~ minecraft:snow[layers=8] if block ~ ~ ~ #minecraft:replaceable run setblock ~ ~ ~ minecraft:snow[layers=1]
execute unless block ~ ~ ~ minecraft:snow unless block ~ ~-1 ~ minecraft:snow if block ~ ~ ~ #minecraft:replaceable run setblock ~ ~ ~ minecraft:snow[layers=1]

# Schedule removal for any snow placed
execute if block ~ ~ ~ minecraft:snow run schedule_snow_removal