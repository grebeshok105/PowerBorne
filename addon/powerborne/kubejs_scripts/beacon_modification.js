let BeaconBlockEntity = Java.loadClass('net.minecraft.world.level.block.entity.BeaconBlockEntity')
let AllEffects = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries').MOB_EFFECT
let HashSet = Java.loadClass('java.util.HashSet')
  
StartupEvents.postInit(e => {
    let original = BeaconBlockEntity.BEACON_EFFECTS
    let mutable = []
    for (let i = 0; i < 4; i++) mutable[i] = Array.from(original[i])
  
    // add effects
    mutable[2].push(AllEffects.get('powerborne:solar_ascension'))
  
    // update effects back
    for (let i = 0; i < 4; i++) original[i] = mutable[i]
  
    // update validation - inline unsafe field setting
    let flattened = []
    for (let sub of mutable) flattened.push.apply(flattened, sub)
    flattened = new HashSet(flattened)
      
    // Direct unsafe field modification without utility functions
    let unsafe = Java.class.forName('sun.misc.Unsafe').getDeclaredField('theUnsafe')
    unsafe.setAccessible(true)
    unsafe = unsafe.get(null)
      
    let fieldName = Platform.isForge() ? 'f_58647_' : 'field_11798'

    let field = BeaconBlockEntity.__javaObject__.getDeclaredField(fieldName)
    field.setAccessible(true)
    let base = unsafe.staticFieldBase(field)
    let offset = unsafe.staticFieldOffset(field)
    unsafe.putObject(base, offset, flattened)
})