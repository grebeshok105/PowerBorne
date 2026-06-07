function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function getMainArm(player, heldItemId) {
    let mainArm = player.getMainArm().toString().toLowerCase();
    let isRight;
    if (heldItemId) {
        let mainHas = player.getMainHandItem().id == heldItemId;
        let offHas = player.getOffhandItem().id == heldItemId;
        if (mainHas) {
            isRight = mainArm === 'right';
        } else if (offHas) {
            isRight = mainArm !== 'right';
        } else {
            isRight = mainArm === 'right';
        }
    } else {
        isRight = mainArm === 'right';
    }
    return {
        isRight: isRight,
        arm: isRight ? 'right_arm' : 'left_arm',
        other: isRight ? 'left_arm' : 'right_arm',
        sign: isRight ? 1 : -1,
    };
}

PalladiumEvents.registerAnimations((event) => {
    event.registerForPower('sentry/photon_forcefield', 'powerborne:sentry', 20, (builder) => {
        let progress = animationUtil.getAnimationTimerAbilityValue(
            builder.getPlayer(), 'powerborne:sentry', 'photon_forcefield_animation', builder.getPartialTicks());
        if (progress > 0 && !builder.isFirstPerson()) {
            const isCrouching = builder.getPlayer().isCrouching();

            builder.get("right_arm")
                .setXRotDegrees(isCrouching ? 0 : -56)
                .setYRotDegrees(10)
                .setZRotDegrees(-5)
                .animate("InOutCubic", progress);

            builder.get("left_arm")
                .setXRotDegrees(isCrouching ? 0 : -56)
                .setYRotDegrees(-10)
                .setZRotDegrees(5)
                .animate("InOutCubic", progress);

            builder.get("right_leg")
                .setY(isCrouching ? 15 : 8.7)
                .setZ(isCrouching ? 5 : -2.6)
                .animate("InOutCubic", progress);

            builder.get('right_leg')
                .setX(-5)
                .setXRotDegrees(-19.6)
                .setYRotDegrees(-2.6)
                .setZRotDegrees(-73.2)
                .animate("InOutCubic", progress);

            builder.get("left_leg")
                .setY(isCrouching ? 15 : 8.7)
                .setZ(isCrouching ? 5 : -2.6)
                .animate("InOutCubic", progress);

            builder.get('left_leg')
                .setX(5)
                .setXRotDegrees(-10.6)
                .setYRotDegrees(22.6)
                .setZRotDegrees(60.2)
                .animate("InOutCubic", progress);
        }
    });

    event.registerForPower('powerborne/sun_charge', 'powerborne:superman', 20, (builder) => {
        let progress = animationUtil.getAnimationTimerAbilityValue(
            builder.getPlayer(), 'powerborne:superman', 'sun_charge_animation', builder.getPartialTicks());
        if (progress > 0 && !builder.isFirstPerson()) {
            builder.get('right_arm')
                .setXRotDegrees(-15)
                .setYRotDegrees(100)
                .setZRotDegrees(60)
                .animate('InOutCubic', progress);

            builder.get('left_arm')
                .setXRotDegrees(-15)
                .setYRotDegrees(-100)
                .setZRotDegrees(-60)
                .animate('InOutCubic', progress);
        }
    });

    event.registerForPower('powerborne/thunderclap_f', 'powerborne:superman', 100, (builder) => {

        const progress = animationUtil.getAnimationTimerAbilityValue(builder.getPlayer(), 'powerborne:superman', 'thunderclap_kjs_anim', builder.getPartialTicks());
        if (progress > 0.0) {

            if (builder.isFirstPerson()) {
                builder.get('right_arm')
                    .setZRotDegrees(90)
                    .animate('Linear', progress);

                builder.get('left_arm')
                    .setZRotDegrees(-90)
                    .animate('Linear', progress);
            } else {
                builder.get('right_arm')
                    .setXRotDegrees(-90)
                    .setYRotDegrees(90)
                    .animate('Linear', progress);

                builder.get('left_arm')
                    .setXRotDegrees(-90)
                    .setYRotDegrees(-90)
                    .animate('Linear', progress);

            }
        }

    });

    event.registerForPower('powerborne/thunderclap_f1', 'powerborne:superman', 100, (builder) => {

        const progress = animationUtil.getAnimationTimerAbilityValue(builder.getPlayer(), 'powerborne:superman', 'thunderclap_kjs_anim1', builder.getPartialTicks());
        if (progress > 0.0) {

            if (builder.isFirstPerson()) {
                builder.get('right_arm')
                    .setXRotDegrees(-50)
                    .setYRotDegrees(-9)
                    .setZRotDegrees(10)
                    .animate('InOutExpo', progress);

                builder.get('left_arm')
                    .setXRotDegrees(-50)
                    .setYRotDegrees(9)
                    .setZRotDegrees(-10)
                    .animate('InOutExpo', progress);
            } else {
                builder.get('right_arm')
                    .setXRotDegrees(-90)
                    .setYRotDegrees(-25)
                    .animate('InOutExpo', progress);

                builder.get('left_arm')
                    .setXRotDegrees(-90)
                    .setYRotDegrees(25)
                    .animate('InOutExpo', progress);

            }
        }

    });

    event.registerForPower('powerborne/homelander_sonic_scream', 'powerborne:homelander', 100, (builder) => {
        const progress = animationUtil.getAnimationTimerAbilityValue(builder.getPlayer(), 'powerborne:homelander', 'sonic_scream_timer', builder.getPartialTicks());
        if (progress > 0.0) {
            builder.get('head')
                .setXRotDegrees(-10)
                .animate('InOutCubic', progress);

            if (builder.isFirstPerson()) {
                builder.get('right_arm')
                    .setZRotDegrees(35)
                    .animate('InOutCubic', progress);

                builder.get('left_arm')
                    .setZRotDegrees(-35)
                    .animate('InOutCubic', progress);
            } else {
                builder.get('right_arm')
                    .setXRotDegrees(-55)
                    .setYRotDegrees(35)
                    .animate('InOutCubic', progress);

                builder.get('left_arm')
                    .setXRotDegrees(-55)
                    .setYRotDegrees(-35)
                    .animate('InOutCubic', progress);
            }
        }
    });

    event.registerForPower('powerborne/homelander_super_clap', 'powerborne:homelander', 100, (builder) => {
        const progress = animationUtil.getAnimationTimerAbilityValue(builder.getPlayer(), 'powerborne:homelander', 'super_clap_timer', builder.getPartialTicks());
        if (progress > 0.0) {
            if (builder.isFirstPerson()) {
                builder.get('right_arm')
                    .setZRotDegrees(90)
                    .animate('Linear', progress);

                builder.get('left_arm')
                    .setZRotDegrees(-90)
                    .animate('Linear', progress);
            } else {
                builder.get('right_arm')
                    .setXRotDegrees(-90)
                    .setYRotDegrees(90)
                    .animate('Linear', progress);

                builder.get('left_arm')
                    .setXRotDegrees(-90)
                    .setYRotDegrees(-90)
                    .animate('Linear', progress);
            }
        }
    });

    event.registerForPower('powerborne/homelander_super_clap_followthrough', 'powerborne:homelander', 100, (builder) => {
        const progress = animationUtil.getAnimationTimerAbilityValue(builder.getPlayer(), 'powerborne:homelander', 'super_clap_followthrough', builder.getPartialTicks());
        if (progress > 0.0) {
            if (builder.isFirstPerson()) {
                builder.get('right_arm')
                    .setXRotDegrees(-50)
                    .setYRotDegrees(-9)
                    .setZRotDegrees(10)
                    .animate('InOutExpo', progress);

                builder.get('left_arm')
                    .setXRotDegrees(-50)
                    .setYRotDegrees(9)
                    .setZRotDegrees(-10)
                    .animate('InOutExpo', progress);
            } else {
                builder.get('right_arm')
                    .setXRotDegrees(-90)
                    .setYRotDegrees(-25)
                    .animate('InOutExpo', progress);

                builder.get('left_arm')
                    .setXRotDegrees(-90)
                    .setYRotDegrees(25)
                    .animate('InOutExpo', progress);
            }
        }
    });

    event.registerForPower('powerborne/super_punch', 'powerborne:superman', 100, (builder) => {
        const rawProgress = animationUtil.getAnimationTimerAbilityValue(builder.getPlayer(), 'powerborne:superman', 'super_punch_timer', builder.getPartialTicks());
        if (rawProgress > 0.2) {
            const progress = Math.min((rawProgress - 0.2) / 0.8, 1.0);
            if (!builder.isFirstPerson()) {
                builder.get('right_arm')
                    .setXRotDegrees(-90)
                    .setZ(2)
                    .animate('Linear', progress);
                builder.get('left_arm')
                    .setXRotDegrees(-70)
                    .setYRotDegrees(-45)
                    .setZRotDegrees(-25)
                    .setZ(-2)
                    .animate('Linear', progress);
                builder.get('body')
                    .setYRotDegrees(-45)
                    .animate('Linear', progress);
                builder.get('head')
                    .setYRotShortestDegrees(-46)
                    .animate('Linear', progress);
                builder.get('left_leg')
                    .setYRotDegrees(-26)
                    .animate('Linear', progress);

            } else {
                builder.get('right_arm')
                    .setY(-6)
                    .animate('Linear', progress);
            }
        }
    });


    event.registerForPower('powerborne/homelander_sun_charge', 'powerborne:homelander', 20, (builder) => {
        let progress = animationUtil.getAnimationTimerAbilityValue(
            builder.getPlayer(), 'powerborne:homelander', 'sun_charge_animation', builder.getPartialTicks());
        if (progress > 0 && !builder.isFirstPerson()) {
            builder.get('right_arm')
                .setXRotDegrees(-15)
                .setYRotDegrees(100)
                .setZRotDegrees(60)
                .animate('InOutCubic', progress);
            builder.get('left_arm')
                .setXRotDegrees(-15)
                .setYRotDegrees(-100)
                .setZRotDegrees(-60)
                .animate('InOutCubic', progress);
        }
    });

    event.registerForPower('powerborne/homelander_thunderclap_f', 'powerborne:homelander', 100, (builder) => {
        const progress = animationUtil.getAnimationTimerAbilityValue(builder.getPlayer(), 'powerborne:homelander', 'thunderclap_kjs_anim', builder.getPartialTicks());
        if (progress > 0.0) {
            if (builder.isFirstPerson()) {
                builder.get('right_arm').setZRotDegrees(90).animate('Linear', progress);
                builder.get('left_arm').setZRotDegrees(-90).animate('Linear', progress);
            } else {
                builder.get('right_arm').setXRotDegrees(-90).setYRotDegrees(90).animate('Linear', progress);
                builder.get('left_arm').setXRotDegrees(-90).setYRotDegrees(-90).animate('Linear', progress);
            }
        }
    });

    event.registerForPower('powerborne/homelander_thunderclap_f1', 'powerborne:homelander', 100, (builder) => {
        const progress = animationUtil.getAnimationTimerAbilityValue(builder.getPlayer(), 'powerborne:homelander', 'thunderclap_kjs_anim1', builder.getPartialTicks());
        if (progress > 0.0) {
            if (builder.isFirstPerson()) {
                builder.get('right_arm').setXRotDegrees(-50).setYRotDegrees(-9).setZRotDegrees(10).animate('InOutExpo', progress);
                builder.get('left_arm').setXRotDegrees(-50).setYRotDegrees(9).setZRotDegrees(-10).animate('InOutExpo', progress);
            } else {
                builder.get('right_arm').setXRotDegrees(-90).setYRotDegrees(-25).animate('InOutExpo', progress);
                builder.get('left_arm').setXRotDegrees(-90).setYRotDegrees(25).animate('InOutExpo', progress);
            }
        }
    });

    event.registerForPower('powerborne/homelander_super_punch', 'powerborne:homelander', 100, (builder) => {
        const rawProgress = animationUtil.getAnimationTimerAbilityValue(builder.getPlayer(), 'powerborne:homelander', 'super_punch_timer', builder.getPartialTicks());
        if (rawProgress > 0.2) {
            const progress = Math.min((rawProgress - 0.2) / 0.8, 1.0);
            if (!builder.isFirstPerson()) {
                builder.get('right_arm').setXRotDegrees(-90).setZ(2).animate('Linear', progress);
                builder.get('left_arm').setXRotDegrees(-70).setYRotDegrees(-45).setZRotDegrees(-25).setZ(-2).animate('Linear', progress);
                builder.get('body').setYRotDegrees(-45).animate('Linear', progress);
                builder.get('head').setYRotShortestDegrees(-46).animate('Linear', progress);
                builder.get('left_leg').setYRotDegrees(-26).animate('Linear', progress);
            } else {
                builder.get('right_arm').setY(-6).animate('Linear', progress);
            }
        }
    });

    event.registerForPower('powerborne/iron_man_repulsor_blast', 'powerborne:iron_man', 100, (builder) => {
        const progress = animationUtil.getAnimationTimerAbilityValue(builder.getPlayer(), 'powerborne:iron_man', 'repulsor_blast_timer', builder.getPartialTicks());
        if (progress <= 0.0) return;

        let player = builder.getPlayer();
        let model = builder.getModel();
        let headYaw = model.head.yRot * 180 / JavaMath.PI;
        let pitch = Number(player.getPitch());

        if (builder.isFirstPerson()) {
            builder.get('right_arm')
                .setY(-5)
                .setZ(-2)
                .setXRotShortestDegrees(-18)
                .setYRotShortestDegrees(-10)
                .animate('InOutCubic', progress);
        } else {
            builder.get('right_arm')
                .setXRotShortestDegrees(pitch - 80)
                .setYRotShortestDegrees(headYaw - 15)
                .animate('InOutCubic', progress);
            builder.get('left_arm')
                .setXRotDegrees(-20)
                .setYRotDegrees(10)
                .animate('InOutCubic', progress);
        }
    });

    event.registerForPower('powerborne/iron_man_unibeam', 'powerborne:iron_man', 100, (builder) => {
        const progress = animationUtil.getAnimationTimerAbilityValue(builder.getPlayer(), 'powerborne:iron_man', 'unibeam_timer', builder.getPartialTicks());
        if (progress <= 0.0) return;

        if (builder.isFirstPerson()) {
            builder.get('right_arm')
                .setZRotDegrees(18)
                .animate('InOutCubic', progress);
            builder.get('left_arm')
                .setZRotDegrees(-18)
                .animate('InOutCubic', progress);
        } else {
            builder.get('right_arm')
                .setXRotDegrees(-40)
                .setYRotDegrees(28)
                .animate('InOutCubic', progress);
            builder.get('left_arm')
                .setXRotDegrees(-40)
                .setYRotDegrees(-28)
                .animate('InOutCubic', progress);
            builder.get('body')
                .setXRotDegrees(-5)
                .animate('InOutCubic', progress);
        }
    });

    event.register('powerborne/mjolnir_hold', 100, (builder) => {
        let player = builder.getPlayer();
        let mainHand = player.getMainHandItem().id == 'powerborne:mjolnir';
        let offHand = player.getOffhandItem().id == 'powerborne:mjolnir';
        let progress = (mainHand || offHand) ? 1 : 0;

        if (progress > 0.0 && builder.isFirstPerson()) {
            let armsToAnimate = (mainHand && offHand)
                ? [{ arm: 'right_arm', sign: 1 }, { arm: 'left_arm', sign: -1 }]
                : [{ arm: getMainArm(player, 'powerborne:mjolnir').arm, sign: getMainArm(player, 'powerborne:mjolnir').sign }];

            for (let { arm, sign } of armsToAnimate) {
                builder.get(arm)
                    .setY(-8).setX(-5 * sign).setZ(1)
                    .setXRotDegrees(-16).setYRotDegrees(61 * sign).setZRotDegrees(-55 * sign)
                    .animate('Linear', progress);
            }
        }
    });

    event.register('powerborne/stormbreaker_hold', 100, (builder) => {
        let player = builder.getPlayer();
        let mainHand = player.getMainHandItem().id == 'powerborne:stormbreaker';
        let offHand = player.getOffhandItem().id == 'powerborne:stormbreaker';
        let progress = (mainHand || offHand) ? 1 : 0;

        if (progress > 0.0 && builder.isFirstPerson()) {
            let armsToAnimate = (mainHand && offHand)
                ? [{ arm: 'right_arm', sign: 1 }, { arm: 'left_arm', sign: -1 }]
                : [{ arm: getMainArm(player, 'powerborne:stormbreaker').arm, sign: getMainArm(player, 'powerborne:stormbreaker').sign }];

            for (let { arm, sign } of armsToAnimate) {
                builder.get(arm)
                    .setY(-5).setX(-8 * sign).setZ(-2)
                    .setXRotDegrees(-16).setYRotDegrees(62 * sign).setZRotDegrees(-55 * sign)
                    .animate('Linear', progress);
            }
        }
    });

    event.registerForPower('powerborne/captain_america_shield_throw', 'powerborne:captain_america', 100, (builder) => {
        if (builder.isFirstPerson()) return;
        let player = builder.getPlayer();
        let progress = animationUtil.getAnimationTimerAbilityValue(
            player,
            'powerborne:captain_america',
            'throw_shield_animation',
            builder.getPartialTicks()
        );
        if (progress <= 0) return;

        let model = builder.getModel();
        const PI = JavaMath.PI;
        let pitch = clamp(Number(player.getPitch()), -90, 90);
        let headYaw = clamp(model.head.yRot * 180 / PI, -75, 75);

        const DEG2RAD = PI / 180;

        function aimWithZ(aimX, aimY, zDeg) {
            let z = zDeg * DEG2RAD;
            let c = Math.cos(z);
            let s = Math.sin(z);
            return {
                x: aimX * c + aimY * s,
                y: -aimX * s + aimY * c,
            };
        }

        let info = getMainArm(player, null);
        let s = info.sign;

        builder.get("body")
            .rotateYDegrees(-15 * s)
            .animate('Linear', progress);

        builder.get("head")
            .rotateYDegrees(-15 * s)
            .animate('Linear', progress);

        if (!player.swinging) {
            let active = aimWithZ(pitch, headYaw, 60 * s);
            let signedYaw = headYaw * s;
            let fade = 1 - (signedYaw - 30) / 30;
            if (fade > 1) fade = 1;
            if (fade < 0) fade = 0;
            let yOffset = 30 * s * fade;
            builder.get(info.arm)
                .moveY(1)
                .setXRotShortestDegrees(30 + active.x)
                .setYRotShortestDegrees(yOffset + active.y)
                .setZRotShortestDegrees(60 * s)
                .animate('Linear', progress);
        }

        let passive = aimWithZ(pitch, headYaw, -70 * s);
        builder.get(info.other)
            .moveY(1)
            .setXRotShortestDegrees(-80 + passive.x)
            .setYRotShortestDegrees(-10 * s + passive.y)
            .setZRotShortestDegrees(-70 * s)
            .animate('Linear', progress);
    });

    event.register('powerborne/vibranium_shield_block', 100, (builder) => {
        if (builder.isFirstPerson()) return;

        let player = builder.getPlayer();
        if (!player.isUsingItem() || player.getUseItem().id != 'powerborne:vibranium_shield') return;

        let mainHand = player.getMainHandItem().id == 'powerborne:vibranium_shield';
        let offHand = player.getOffhandItem().id == 'powerborne:vibranium_shield';
        if (!mainHand && !offHand) return;

        let progress = 1;
        let info = getMainArm(player, 'powerborne:vibranium_shield');
        let model = builder.getModel();
        let pitch = model.head.xRot * 180 / JavaMath.PI;
        let baseX = -85;

        builder.get(info.arm)
            .setZ(-1)
            .setXRotShortestDegrees(baseX + pitch)
            .setYRotShortestDegrees(-65 * info.sign)
            .setZRotShortestDegrees(12 * info.sign)
            .animate('Linear', progress);
    });

    event.register('powerborne/captain_america_rising_uppercut', 100, (builder) => {
        if (builder.isFirstPerson()) return;

        let player = builder.getPlayer();
        const progress = animationUtil.getAnimationTimerAbilityValue(
            player,
            'powerborne:captain_america',
            'rising_uppercut_animation',
            builder.getPartialTicks()
        );
        if (progress <= 0) return;

        let info = getMainArm(player, 'powerborne:vibranium_shield');
        let s = info.sign;
        let activeArm = info.arm;
        let passiveArm = info.other;
        let leadLeg = info.isRight ? 'right_leg' : 'left_leg';
        let trailLeg = info.isRight ? 'left_leg' : 'right_leg';

        builder.get("body")
            .setYRotDegrees(20 * s)
            .animate('Linear', progress);

        builder.get("chest")
            .moveX(s)
            .setZRotDegrees(5 * s)
            .animate('Linear', progress);

        builder.get(activeArm)
            .setY(-1)
            .setZ(-1)
            .setXRotDegrees(-150)
            .setYRotDegrees(0)
            .setZRotDegrees(-10 * s)
            .animate('Linear', progress);

        builder.get(passiveArm)
            .moveX(s)
            .rotateXDegrees(-10)
            .rotateZDegrees(-10 * s)
            .animate('Linear', progress);

        builder.get("head")
            .moveX(s)
            .rotateXDegrees(-10)
            .rotateYDegrees(10 * s)
            .animate('Linear', progress);

        builder.get(leadLeg)
            .setXRotDegrees(15)
            .setZRotDegrees(-5 * s)
            .animate('Linear', progress);

        builder.get(trailLeg)
            .moveZ(-4)
            .moveY(-3)
            .setXRotDegrees(20)
            .animate('Linear', progress);
    });

    event.registerForPower('powerborne/captain_america_shield_slam_pre', 'powerborne:captain_america', 100, (builder) => {
        if (builder.isFirstPerson()) return;
        let player = builder.getPlayer();
        let progress = animationUtil.getAnimationTimerAbilityValue(
            player,
            'powerborne:captain_america',
            'shield_slam_pre_animation',
            builder.getPartialTicks()
        );
        if (progress <= 0) return;
        let info = getMainArm(player, null);

        builder.get(info.arm)
            .setXRotDegrees(-100)
            .setYRotDegrees(70 * info.sign)
            .setZRotDegrees(30 * info.sign)
            .animate('Linear', progress);

    });

    event.registerForPower('powerborne/captain_america_shield_slam', 'powerborne:captain_america', 100, (builder) => {
        if (builder.isFirstPerson()) return;

        let player = builder.getPlayer();
        const progress = animationUtil.getAnimationTimerAbilityValue(
            player,
            'powerborne:captain_america',
            'shield_slam_animation',
            builder.getPartialTicks()
        );
        if (progress <= 0) return;

        let info = getMainArm(player, null);
        let s = info.sign;
        let activeArm = info.arm;
        let passiveArm = info.other;
        let activeLeg = info.isRight ? "left_leg" : "right_leg";
        let passiveLeg = info.isRight ? "right_leg" : "left_leg";

        builder.get(activeArm)
            .setZ(-3)
            .setX(-5 * s)

            .setXRotDegrees(-60)
            .setYRotDegrees(-20 * s)
            .setZRotDegrees(30 * s)
            .animate('Linear', progress);

        builder.get(passiveArm)
            .setXRotDegrees(30)
            .setYRotDegrees(0)
            .setZRotDegrees(-15 * s)
            .animate('Linear', progress);

        builder.get("body")
            .setY(-2)
            .setZ(9)
            .setXRotDegrees(-40)
            .animate('Linear', progress);

        builder.get(activeLeg)
            .setZ(-1)
            .setY(5)
            .setYRotDegrees(-10 * s)
            .setXRotDegrees(-50)
            .animate('Linear', progress);

        builder.get(passiveLeg)
            .setZ(-4)
            .setY(9)
            .setXRotDegrees(20)
            .animate('Linear', progress);
    });

    event.registerForPower('powerborne/shield_rush_arm', 'powerborne:captain_america', 100, (builder) => {
        if (builder.isFirstPerson()) return;

        let player = builder.getPlayer();
        const progress = animationUtil.getAnimationTimerAbilityValue(
            player,
            'powerborne:captain_america',
            'shield_rush_animation',
            builder.getPartialTicks()
        );
        if (progress <= 0) return;

        let info = getMainArm(player, null);
        let s = info.sign;

        let baseX = -85;
        let vanillaBlockX = -34;
        let vanillaBlockY = -30;

        builder.get(info.arm)
            .setZ(-1)
            .setXRotShortestDegrees(baseX + vanillaBlockX)
            .setYRotShortestDegrees((-65 + vanillaBlockY) * s)
            .setZRotShortestDegrees(12 * s)
            .animate('Linear', progress);
    });

    event.registerForPower('powerborne/mjolnir_aim', 'powerborne:god_of_thunder', 100, (builder) => {
        let player = builder.getPlayer();
        const progress = animationUtil.getAnimationTimerAbilityValue(player, 'powerborne:god_of_thunder', 'lightning_blast_aim', builder.getPartialTicks());
        if (progress > 0.0 && !builder.isFirstPerson()) {
            let model = builder.getModel();
            let headYaw = model.head.yRot * 180 / JavaMath.PI;

            let info = getMainArm(player, 'powerborne:mjolnir');

            builder.get(info.arm)
                .setXRotShortestDegrees(player.getPitch() - 90)
                .setYRotShortestDegrees(headYaw)
                .animate('Linear', progress);
        }

    });


    event.registerForPower('powerborne/mjolnir_flight_aim', 'powerborne:god_of_thunder', 100, (builder) => {
        let player = builder.getPlayer();
        let mainId = player.getMainHandItem().id;
        let offId = player.getOffhandItem().id;
        let thorWeaponId =
            mainId === 'powerborne:mjolnir' || mainId === 'powerborne:stormbreaker'
                ? mainId
                : offId === 'powerborne:mjolnir' || offId === 'powerborne:stormbreaker'
                  ? offId
                  : null;
        if (!thorWeaponId) return;
        let info = getMainArm(player, thorWeaponId);
        const progress = animationUtil.getAnimationTimerAbilityValue(player, 'powerborne:god_of_thunder', 'mjolnir_flight_aim', builder.getPartialTicks());
        if (progress > 0.0 && !builder.isFirstPerson()) {
            builder.get(info.arm)
                .setXRotDegrees(-180)
                .animate('Linear', progress);
        }
    });

    event.registerForPower('powerborne/stormbreaker_throw_windup', 'powerborne:god_of_thunder', 100, (builder) => {
        let player = builder.getPlayer();
        if (player.getMainHandItem().id != 'powerborne:stormbreaker') return;

        const progress = animationUtil.getAnimationTimerAbilityValue(player, 'powerborne:god_of_thunder', 'stormbreaker_use', builder.getPartialTicks());
        if (progress <= 0) return;

        let info = getMainArm(player, 'powerborne:stormbreaker');
        builder.get(info.arm)
            .setXRotDegrees(builder.isFirstPerson() ? -120 : -180)
            .animate('InOutCubic', progress);
    });

    event.registerForPower('powerborne/stormbreaker_blast', 'powerborne:god_of_thunder', 100, (builder) => {
        let player = builder.getPlayer();
        const progress = animationUtil.getAnimationTimerAbilityValue(player, 'powerborne:god_of_thunder', 'stormbreaker_blast_timer', builder.getPartialTicks());
        if (progress > 0.0 && !builder.isFirstPerson()) {
            let model = builder.getModel();
            let headYaw = model.head.yRot * 180 / JavaMath.PI;
            let info = getMainArm(player, 'powerborne:stormbreaker');
            builder.get(info.arm)
                .setXRotShortestDegrees(player.getPitch() - 65)
                .setYRotShortestDegrees(headYaw)
                .animate('Linear', progress);
        }
    });

    event.registerForPower('powerborne/god_blast_aim', 'powerborne:god_of_thunder', 100, (builder) => {
        let player = builder.getPlayer();
        const progress = animationUtil.getAnimationTimerAbilityValue(
            player,
            'powerborne:god_of_thunder',
            'god_blast_timer',
            builder.getPartialTicks()
        );
        if (progress <= 0.0) return;
        if (!builder.isFirstPerson()) {
            builder.get('right_arm')
                .setXRotShortestDegrees(-72)
                .setYRotShortestDegrees(-22)
                .animate('Linear', progress);
            builder.get('left_arm')
                .setXRotShortestDegrees(-72)
                .setYRotShortestDegrees(22)
                .animate('Linear', progress);
        } else {
            builder.get('right_arm')
                .setXRotShortestDegrees(12)
                .setYRotShortestDegrees(-12)
                .animate('Linear', progress);
            builder.get('left_arm')
                .setXRotShortestDegrees(12)
                .setYRotShortestDegrees(-12)
                .animate('Linear', progress);
        }
    });

    event.registerForPower('powerborne/lightning_charge', 'powerborne:god_of_thunder', 100, (builder) => {
        let player = builder.getPlayer();
        let progress = animationUtil.getAnimationTimerAbilityValue(player, 'powerborne:god_of_thunder', 'lightning_charge_timer', builder.getPartialTicks()) ||
        animationUtil.getAnimationTimerAbilityValue(player, 'powerborne:god_of_thunder', 'bifrost_animation_timer', builder.getPartialTicks());
        if (progress > 0.0) {
            let mainSb = player.getMainHandItem().id == 'powerborne:stormbreaker';
            let offSb = player.getOffhandItem().id == 'powerborne:stormbreaker';
            let mainMj = player.getMainHandItem().id == 'powerborne:mjolnir';
            let offMj = player.getOffhandItem().id == 'powerborne:mjolnir';
            let info = getMainArm(player, null);
            let poseWeaponId;
            if (mainSb) poseWeaponId = 'powerborne:stormbreaker';
            else if (mainMj) poseWeaponId = 'powerborne:mjolnir';
            else if (offSb) poseWeaponId = 'powerborne:stormbreaker';
            else if (offMj) poseWeaponId = 'powerborne:mjolnir';
            else poseWeaponId = 'powerborne:stormbreaker';
            let yRot = builder.isFirstPerson() && poseWeaponId === 'powerborne:stormbreaker' ? 55 : 25;
            builder.get(info.arm)
                .setXRotDegrees(-150)
                .setYRotDegrees(yRot * info.sign)
                .animate('InOutExpo', progress);
        }
    });

    event.registerForPower('powerborne/mjolnir_vortex', 'powerborne:god_of_thunder', 100, (builder) => {
        const progress = animationUtil.getAnimationTimerAbilityValue(builder.getPlayer(), 'powerborne:god_of_thunder', 'mjolnir_vortex', builder.getPartialTicks());
        if (progress > 0.0 && !builder.isFirstPerson()) {
            builder.get('body')
                .rotateYDegrees(360 * 14)
                .animate('Linear', progress);
        }
    });

    event.registerForPower('powerborne/mjolnir_vortex_anim', 'powerborne:god_of_thunder', 100, (builder) => {
        const progress = animationUtil.getAnimationTimerAbilityValue(builder.getPlayer(), 'powerborne:god_of_thunder', 'mjolnir_vortex_anim', builder.getPartialTicks());
        if (progress > 0.0 && !builder.isFirstPerson()) {
            builder.get('right_arm')
                .setXRotDegrees(-90)
                .setYRotDegrees(-30)
                .animate('Linear', progress);
            builder.get('left_arm')
                .setXRotDegrees(-90)
                .setYRotDegrees(30)
                .animate('Linear', progress);
        }
    });

    event.registerForPower('powerborne/storm_strike_pre', 'powerborne:god_of_thunder', 100, (builder) => {
        if (builder.isFirstPerson()) return;
        let player = builder.getPlayer();
        let progress = animationUtil.getAnimationTimerAbilityValue(
            player,
            'powerborne:god_of_thunder',
            'storm_strike_pre',
            builder.getPartialTicks()
        );
        if (progress <= 0) return;
        let info = getMainArm(player, 'powerborne:stormbreaker');
        let s = info.sign;
        let activeArm = info.arm;
        let passiveArm = info.other;
        let trailLeg = info.isRight ? 'left_leg' : 'right_leg';
        let leadLeg = info.isRight ? 'right_leg' : 'left_leg';

        builder.get(activeArm)
            .setXRotDegrees(-100)
            .setYRotDegrees(-22 * s)
            .setZRotDegrees(10 * s)
            .animate('Linear', progress);
        builder.get(passiveArm)
            .setXRotDegrees(-95)
            .setYRotDegrees(45 * s)
            .setZRotDegrees(5 * s)
            .animate('Linear', progress);
        builder.get(trailLeg)
            .moveZ(-4)
            .moveY(-3)
            .setXRotDegrees(20)
            .animate('Linear', progress);
        builder.get(leadLeg)
            .setXRotDegrees(10)
            .animate('Linear', progress);
    });

    event.registerForPower('powerborne/storm_strike_land', 'powerborne:god_of_thunder', 100, (builder) => {
        if (builder.isFirstPerson()) return;
        let player = builder.getPlayer();
        let progress = animationUtil.getAnimationTimerAbilityValue(
            player,
            'powerborne:god_of_thunder',
            'storm_strike_animation',
            builder.getPartialTicks()
        );
        if (progress <= 0) return;
        let info = getMainArm(player, 'powerborne:stormbreaker');
        let s = info.sign;
        let activeArm = info.arm;
        let passiveArm = info.other;
        let trailLeg = info.isRight ? 'left_leg' : 'right_leg';
        let leadLeg = info.isRight ? 'right_leg' : 'left_leg';

        builder.get(activeArm)
            .setXRotDegrees(-50)
            .setYRotDegrees(-22 * s)
            .setZRotDegrees(10 * s)
            .animate('Linear', progress);
        builder.get(passiveArm)
            .setXRotDegrees(-45)
            .setYRotDegrees(45 * s)
            .setZRotDegrees(5 * s)
        builder.get(trailLeg)
            .setZ(1)
            .setY(8)
            .setYRotDegrees(-10 * s)
            .setXRotDegrees(-50)
            .animate('Linear', progress);
        builder.get(leadLeg)
            .setZ(-4)
            .setY(9)
            .setXRotDegrees(20)
            .animate('Linear', progress);
        builder.get("body")
            .setY(-2)
            .setZ(7)
            .setXRotDegrees(-35)
            .animate('Linear', progress);
    });
});
