let $Button = Java.loadClass("net.minecraft.client.gui.components.Button");
let $BrewingStandScreen = Java.loadClass("net.minecraft.client.gui.screens.inventory.BrewingStandScreen");

function toggleAllButtonsVisible(screen, visible) {
    screen.renderables.forEach(widget => {
        if (widget instanceof $Button) widget.visible = visible;
    });
}

function addCustomButton(screen, player, symbol, x, y) {
    screen.addRenderableWidget(
        $Button
            .builder(Text.of(symbol).font("powerborne:button"), () => {
                player.sendData("button_error", {});
            })
            .bounds(x, y, 18, 18)
            .build()
    );
}

NetworkEvents.dataReceived("lock_side_slots", event => {
    let player = event.player;
    let screen = Client.screen;

    if (screen instanceof $BrewingStandScreen) {
        if (screen.renderables.length >= 2) return;

        toggleAllButtonsVisible(screen, true);

        let left = screen.leftPos;
        let top = screen.topPos;

        addCustomButton(screen, player, "\u2AD8", left + 55, top + 50);
        addCustomButton(screen, player, "\u2AD8", left + 101, top + 50);
    }
});

NetworkEvents.dataReceived("clear_widgets", (event) => {
    let screen = Client.screen;

    if (screen instanceof $BrewingStandScreen) {
        let toRemove = [];

        screen.renderables.forEach(widget => {
            if (
                widget instanceof $Button &&
                (widget.message.toString() === Text.of("\u2AD8").font("powerborne:button").toString() ||
                 widget.message.toString() === Text.of("\u2AD9").font("powerborne:button").toString())
            ) {
                toRemove.push(widget);
            }
        });

        toRemove.forEach(widget => {
            screen.renderables.remove(widget);
            screen.children().remove(widget);
        });
    }
});