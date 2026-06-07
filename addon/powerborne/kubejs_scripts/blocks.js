let $AmethystClusterBlock = Java.loadClass('net.minecraft.world.level.block.AmethystClusterBlock')
let $BProperties = Java.loadClass('net.minecraft.world.level.block.state.BlockBehaviour$Properties')
let $SoundType = Java.loadClass('net.minecraft.world.level.block.SoundType')
let $BlockItem = Java.loadClass('net.minecraft.world.item.BlockItem')
let $IProperties = Java.loadClass('net.minecraft.world.item.Item$Properties')

let $TintedGlassBlock = Java.loadClass('net.minecraft.world.level.block.TintedGlassBlock')
let $Blocks = Java.loadClass('net.minecraft.world.level.block.Blocks')
let $Properties = Java.loadClass('net.minecraft.world.level.block.state.BlockBehaviour$Properties')

let cluster
let voidBlock
StartupEvents.registry('block', event => {
  cluster = event.createCustom('powerborne:kryptonite_cluster', () =>
    new $AmethystClusterBlock(7, 3, $BProperties.of().requiresCorrectToolForDrops().sound($SoundType.AMETHYST).lightLevel(bs => 5).noOcclusion()))

  voidBlock = event.createCustom('powerborne:void_block', () =>
    new $TintedGlassBlock($Properties.copy($Blocks.TINTED_GLASS).strength(-1.0, 3600000.0).noCollission().noOcclusion()))
})

if (Platform.isClientEnvironment()) {
  ClientEvents.init(event => {
    if (Platform.isFabric()) {
      let $BlockRenderLayerMap = Java.loadClass('net.fabricmc.fabric.api.blockrenderlayer.v1.BlockRenderLayerMap')
      let $RenderType = Java.loadClass('net.minecraft.client.renderer.RenderType')
      $BlockRenderLayerMap.INSTANCE.putBlocks($RenderType.cutout(), cluster.get())
      $BlockRenderLayerMap.INSTANCE.putBlocks($RenderType.translucent(), voidBlock.get())
    }
  })
}

BlockEvents.modification((e) => {
  e.modify("powerborne:kryptonite_cluster", (block) => {
    block.destroySpeed = 4.0;
  });
  e.modify("powerborne:void_block", (block) => {
    block.hasCollision = false;
    block.destroySpeed = -1;
    block.explosionResistance = 3600000.0;
  });
});

StartupEvents.registry('item', event => {
  event.createCustom('powerborne:kryptonite_cluster', () =>
    new $BlockItem(cluster.get(), new $IProperties())
  )
})
