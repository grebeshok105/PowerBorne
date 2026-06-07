execute as @s run mjolnir_explosion
data merge entity @s {KubeJSPersistentData:{ReturnTicks:1,JumpImpact:1}}
effect give @p minecraft:levitation 1 7
effect give @p minecraft:slow_falling 3 0 false
