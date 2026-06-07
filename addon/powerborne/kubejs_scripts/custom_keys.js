if (Platform.isClientEnvironment()) {
    let $KeyMappingRegistry = Java.loadClass('dev.architectury.registry.client.keymappings.KeyMappingRegistry')
    let $KeyMapping = Java.loadClass('net.minecraft.client.KeyMapping')
    let $GLFWKey = Java.loadClass('org.lwjgl.glfw.GLFW')

    if (!global.POWERBORNE_TOGGLE_HELMET_KEY) global.POWERBORNE_TOGGLE_HELMET_KEY = null;

    ClientEvents.init(event => {
        global.POWERBORNE_TOGGLE_HELMET_KEY = new $KeyMapping('key.powerborne.toggle_helmet', $GLFWKey.GLFW_KEY_RIGHT_SHIFT, 'key.categories.powerborne')
        $KeyMappingRegistry.register(global.POWERBORNE_TOGGLE_HELMET_KEY)
    })
}