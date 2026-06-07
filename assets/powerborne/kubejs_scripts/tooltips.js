ItemEvents.tooltip(event => {
    event.addAdvanced('powerborne:suit_scroll', (item, advanced, text) => {
        const nbtData = item.nbt;
        if (nbtData && nbtData.contains('AccessoryID')) {
            const accessoryId = nbtData.getString('AccessoryID');
            if (accessoryId.includes('superman')) {
                text.add(1, Text.of(Component.translate('tooltip.powerborne.suit')).gray().append(Text.of(Component.translate('accessory_slot.powerborne.superman')).gold()));
            } else if (accessoryId.includes('sentry')) {
                text.add(1, Text.of(Component.translate('tooltip.powerborne.suit')).gray().append(Text.of(Component.translate('accessory_slot.powerborne.sentry')).gold()));
            } else if (accessoryId.includes('thor')) {
                text.add(1, Text.of(Component.translate('tooltip.powerborne.suit')).gray().append(Text.of(Component.translate('accessory_slot.powerborne.thor')).gold()));
            } else if (accessoryId.includes('captain_america')) {
                text.add(1, Text.of(Component.translate('tooltip.powerborne.suit')).gray().append(Text.of(Component.translate('accessory_slot.powerborne.captain_america')).gold()));
            }
            const translationKey = `accessory.powerborne.${accessoryId}`;
            const translatedText = Text.translate(translationKey).getString();

            text.add(2, Text.of(Component.translate('tooltip.powerborne.unlocks')).gray().append(Text.of(translatedText).blue()));
        }
    });
});

ItemEvents.tooltip(event => {
    event.addAdvanced('powerborne:mjolnir', (item, advanced, text) => {
        const nbt = item.nbt;
        const cmd = nbt && nbt.contains('CustomModelData') ? nbt.getInt('CustomModelData') : 0;
        if (cmd === 1) {
            text.add(1, Text.of(Component.translate('tooltip.powerborne.mjolnir.awakened')).color(0x48D1FF));
        }
    });
});

function serumFormatDuration(ticks) {
    const totalSec = Math.floor(ticks / 20)
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function serumRoman(amplifier) {
    return ['I', 'II', 'III', 'IV', 'V'][amplifier] ?? 'I'
}

function serumEffectLine(effectTranslationKey, amplifier, ticks) {
    return Text.of('')
        .append(Text.translate(effectTranslationKey))
        .append(` ${serumRoman(amplifier)} (${serumFormatDuration(ticks)})`)
        .blue()
}

ItemEvents.tooltip(event => {
    event.addAdvanced('powerborne:super_soldier_serum', (item, advanced, text) => {
        let i = 1
        text.add(i++, serumEffectLine('effect.minecraft.strength', 1, 1800))
        text.add(i++, serumEffectLine('effect.minecraft.regeneration', 1, 440))
        text.add(i++, serumEffectLine('effect.minecraft.jump_boost', 1, 1800))
        text.add(i++, serumEffectLine('effect.minecraft.speed', 1, 1800))
        text.add(i++, serumEffectLine('effect.minecraft.resistance', 0, 1800))
        text.add(i++, Text.empty())
        text.add(i++, Text.of('').append(Text.translate('potion.whenDrank')).darkPurple())
        text.add(i++, Text.of('')
            .append(Text.of('+6 '))
            .append(Text.translate('attribute.name.generic.attack_damage'))
            .blue())
        text.add(i++, Text.of('')
            .append(Text.of('+40% '))
            .append(Text.translate('attribute.name.generic.movement_speed'))
            .blue())
    })
})

ItemEvents.tooltip(event => {
    event.addAdvanced('powerborne:sun_totem', (item, advanced, text) => {
        const nbt = item.nbt;
        const energy = nbt ? nbt.getInt('energy') : 0;
        const maxEnergy = 5000;
        const rawPct = (energy / maxEnergy) * 100;
        const pct = rawPct % 1 === 0 ? rawPct.toFixed(0) : rawPct.toFixed(1);

        text.remove(1);

        text.add(1, Text.of(Component.translate('tooltip.powerborne.sun_charge')).gold().append(Text.of(pct + '%').yellow()));
        text.add(2, Text.empty());
        if (energy < maxEnergy) {
            text.add(3, Text.of(Component.translate('tooltip.powerborne.when_in_hand')).gray());
            text.add(4, Text.of(Component.translate('tooltip.powerborne.absorbs_sunlight')).yellow());
        } else {
            text.add(3, Text.of(Component.translate('tooltip.powerborne.when_in_hand')).gray());
            text.add(4, Text.of(Component.translate('tooltip.powerborne.right_click_to_become')).gray().append(Text.of(Component.translate('tooltip.powerborne.superman')).gold()));
        }
    });
});