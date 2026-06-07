StartupEvents.registry('mob_effect', e => {
	e.create('powerborne:unstable_radiance')
		.beneficial()
        .effectTick((entity, lvl) => global.unstableRadianceEffectTick(entity, lvl))
		.color(0xD8C043)
  })

global.unstableRadianceEffectTick = (entity, lvl) => {
    if (entity.getLevel().clientSide) return;
    let effect = entity.getEffect("powerborne:unstable_radiance");
    if (Platform.isForge()) effect.setCurativeItems([]);
}

let PotionBrewing = Java.loadClass('net.minecraft.world.item.alchemy.PotionBrewing');  
let Items = Java.loadClass('net.minecraft.world.item.Items');  
let Potions = Java.loadClass('net.minecraft.world.item.alchemy.Potions');  
let $Item = Java.loadClass('net.minecraft.world.item.Item');
let Potion = Java.loadClass('net.minecraft.world.item.alchemy.Potion');
let $BuiltInRegistries = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries');

let $PotionBuilder = Java.loadClass("dev.latvian.mods.kubejs.misc.PotionBuilder")


StartupEvents.registry("potion", e => {
    e.createCustom("powerborne:golden_serum", () => {
        return new $PotionBuilder("powerborne:golden_serum")
        .effect("powerborne:unstable_radiance", -1, 0)
        .createObject()
    })
})
  
StartupEvents.postInit(e => {  
    try {  
        let clazz = PotionBrewing.__javaObject__;  
  
        let methodName = Platform.isForge() ? 'm_43513_' : 'method_8074'

        let addMixMethod = clazz.getDeclaredMethod(methodName, Potion, $Item, Potion);  
        addMixMethod.setAccessible(true);
		let registeredCustomPotion = $BuiltInRegistries.POTION.get(new ResourceLocation("powerborne", "golden_serum"));
  
        addMixMethod.invoke(null, Potions.AWKWARD, Items.ENCHANTED_GOLDEN_APPLE, registeredCustomPotion);  
  
    } catch (error) {  
        console.log("Failed to add brewing recipe:", error);  
    }  
});