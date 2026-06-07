PalladiumEvents.registerProperties((event) => {
	if (event.getEntityType() === "palladium:custom_projectile") {
		event.registerProperty("color1", 'string', '#ffffff');
		event.registerProperty("color4", 'string', '#ffffff');
	}
});

function normalizeShieldHex(value) {
	if (value === undefined || value === null) return null;
	let s = String(value).trim();
	if (s.length === 0) return null;
	if (s.charAt(0) !== '#') s = '#' + s;
	return s;
}

function readShieldItemColor(itemstack, key) {
	if (!itemstack || itemstack.isEmpty()) return null;
	let nbt = itemstack.nbt;
	if (!nbt) return null;
	try {
		if (nbt.contains && !nbt.contains(key)) return null;
		return normalizeShieldHex(nbt.getString ? nbt.getString(key) : nbt[key]);
	} catch (_) {
		try { return normalizeShieldHex(nbt[key]); } catch (_) { return null; }
	}
}

function applyShieldProjectileColors(projectile, itemstack) {
	let c1 = readShieldItemColor(itemstack, "Color1");
	let c4 = readShieldItemColor(itemstack, "Color4");
	if (c1) palladium.setProperty(projectile, "color1", c1);
	if (c4) palladium.setProperty(projectile, "color4", c4);
}

function copyShieldItemData(itemstack) {
	if (!itemstack || itemstack.isEmpty()) return { id: CAP_SHIELD_ID, Count: 1 };
	let itemData = { id: String(itemstack.id), Count: 1 };
	if (itemstack.nbt) itemData.tag = itemstack.nbt;
	return itemData;
}

function snapshotShieldDataForPlayer(itemData) {
	let safe = { id: CAP_SHIELD_ID, Count: 1 };
	if (!itemData) return safe;

	if (itemData.id) safe.id = String(itemData.id);
	if (itemData.Count !== undefined && itemData.Count !== null) safe.Count = itemData.Count;

	let sourceTag = itemData.tagSnbt ? itemData.tagSnbt : itemData.tag;
	if (sourceTag !== undefined && sourceTag !== null) {
		try {
			safe.tagSnbt = String(sourceTag);
		} catch (_) { }
	}

	return safe;
}

function readPlayerShieldSnapshot(itemData) {
	if (!itemData) return { id: CAP_SHIELD_ID, Count: 1 };
	if (itemData.tagSnbt !== undefined && itemData.tagSnbt !== null) return itemData;
	return snapshotShieldDataForPlayer(itemData);
}

function createItemFromSavedData(itemData) {
	if (!itemData) return Item.of(CAP_SHIELD_ID);
	if (itemData.tagSnbt) return Item.of(itemData.id, String(itemData.tagSnbt));
	if (itemData.tag) return Item.of(itemData.id, itemData.tag);
	return Item.of(itemData.id);
}

function giveSavedShieldToPlayer(player, itemData) {
	let item = createItemFromSavedData(itemData);
	if (player.getMainHandItem().isEmpty()) {
		player.setMainHandItem(item);
	} else if (!player.inventory.add(item)) {
		player.drop(item, true);
	}
}

function getShieldProjectileItemData(projectile) {
	let saved = projectile.persistentData.SavedShieldItem;
	if (!saved) return { id: CAP_SHIELD_ID, Count: 1 };
	return saved;
}

function damageThrownShieldOnImpact(projectile, owner) {
	let isSpin = projectile.getTags().contains('powerborne.spinning_shield');
	let stateKey = isSpin ? 'SpinningShieldItem' : 'ThrownShieldItem';
	let data = getShieldProjectileItemData(projectile);
	let item = createItemFromSavedData(data).copy();
	if (!item || item.isEmpty()) return true;
	if (!item.isDamageableItem()) return true;
	if (item.nbt && item.nbt.Unbreakable) return true;

	let maxD = item.getMaxDamage();
	let remaining = maxD - item.getDamageValue();
	if (remaining <= 5) return true;

	item.hurtAndBreak(1, owner, () => {
		projectile.level.playSound(
			null, projectile.x, projectile.y, projectile.z,
			"minecraft:item.shield.break", "players", 1, 0.9 + Math.random() * 0.1
		);
	});

	if (item.isEmpty()) {
		removeShieldProjectileTracking(projectile);
		owner.persistentData.remove(stateKey);
		if (isSpin) owner.persistentData.SpinningShieldActive = 0;
		projectile.kill();
		return false;
	}

	let newData = copyShieldItemData(item);
	projectile.persistentData.SavedShieldItem = newData;
	owner.persistentData[stateKey] = snapshotShieldDataForPlayer(newData);

	projectile.mergeNbt({
		"Appearances": [
			{ "Type": "item", "Item": newData },
			{ "Type": "trail", "Trail": "powerborne:shield_trail" },
			{ "Type": "trail", "Trail": "powerborne:shield_trail2" }
		]
	});
	return true;
}

const SHIELDP = {
	SPEED: 1.7,
	RETURN_MIN_RISE_Y: 0.1,
	RETURN_CATCH_DIST: 1.25,
	MAX_RICOCHET_DIST: 128,
	MAX_RETURN_DIST: 256,
	ENTITY_CHAIN_RANGE: 10,
	BLOCK_CHAIN_RANGE: 5,
	MAX_ENTITY_RICOCHETS: 2,
	MAX_BLOCK_RICOCHETS: 2,
	RICOCHET_COOLDOWN: 2,
	BOUNCE_PATH_RANGE: 24,
	WALL_BOUNCE_PATH_RANGE: 64,
	MJOLNIR_PROJ_SCAN_RANGE: 0.8,
	PATH_SAMPLE_STEP: 0.2,
	MIN_BLOCK_BOUNCE_CLEAR: 0.9,
	MAX_BLOCK_BOUNCE_CLEAR: 2.0,
	CHAIN_HITBOX_INFLATE: 0.35,
	OVERSHOOT_SPEED_FACTOR: 0.92,
	GRAVITY_MIN: 0.008,
	GRAVITY_MAX: 0.03,
	GRAVITY_FLIGHT_TICKS: 20 * 5,
	GRAVITY_UP_TICKS: 20 * 2
};

let $BlockPos = Java.loadClass("net.minecraft.core.BlockPos");
let $LeverBlock = Java.loadClass("net.minecraft.world.level.block.LeverBlock");
let $ButtonBlock = Java.loadClass("net.minecraft.world.level.block.ButtonBlock");
let $AbstractGlassBlock = Java.loadClass("net.minecraft.world.level.block.AbstractGlassBlock");

function getEntityCenter(entity) {
	return { x: entity.x, y: entity.y + entity.eyeHeight * 0.5 + 0.5, z: entity.z };
}

function isEntityLoaded(entity, level) {
	if (!entity || !level) return false;
	return level.isPositionEntityTicking(entity.blockPosition());
}

function normalizeVec(x, y, z) {
	let len = Math.sqrt(x * x + y * y + z * z);
	if (len <= 0.00001) return { x: 0, y: 0, z: 0, length: 0 };
	return { x: x / len, y: y / len, z: z / len, length: len };
}

function getAabbMinMax(bb) {
	if (!bb) return null;
	try {
		if (typeof bb.minX === "function") {
			return {
				minX: bb.minX(), minY: bb.minY(), minZ: bb.minZ(),
				maxX: bb.maxX(), maxY: bb.maxY(), maxZ: bb.maxZ()
			};
		}
		return {
			minX: bb.minX, minY: bb.minY, minZ: bb.minZ,
			maxX: bb.maxX, maxY: bb.maxY, maxZ: bb.maxZ
		};
	} catch (e) {
		return null;
	}
}

function rayAabbEnterDistance(ox, oy, oz, dx, dy, dz, minX, minY, minZ, maxX, maxY, maxZ) {
	let tMin = -Infinity;
	let tMax = Infinity;

	let axis = [
		{ o: ox, d: dx, min: minX, max: maxX },
		{ o: oy, d: dy, min: minY, max: maxY },
		{ o: oz, d: dz, min: minZ, max: maxZ }
	];

	for (let i = 0; i < axis.length; i++) {
		let o = axis[i].o, d = axis[i].d, min = axis[i].min, max = axis[i].max;
		if (Math.abs(d) <= 0.0000001) {
			if (o < min || o > max) return null;
			continue;
		}
		let inv = 1.0 / d;
		let t1 = (min - o) * inv;
		let t2 = (max - o) * inv;
		if (t1 > t2) { let tmp = t1; t1 = t2; t2 = tmp; }
		if (t1 > tMin) tMin = t1;
		if (t2 < tMax) tMax = t2;
		if (tMin > tMax) return null;
	}

	if (tMax < 0) return null;
	return tMin < 0 ? 0 : tMin;
}

function hasShieldLineOfSight(level, x1, y1, z1, x2, y2, z2) {
	let dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
	let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
	if (dist <= 0.0001) return true;
	let step = 0.25;
	let numSamples = Math.max(1, Math.ceil(dist / step) - 1);
	for (let i = 1; i <= numSamples; i++) {
		let t = i / (numSamples + 1);
		let cx = x1 + dx * t;
		let cy = y1 + dy * t;
		let cz = z1 + dz * t;
		if (isBlockSolidForShield(level, cx, cy, cz)) return false;
	}
	return true;
}

function shieldBounceAimHitsTargetAabb(projectile, target) {
	if (!target || !target.getBoundingBox) return false;
	let center = getEntityCenter(target);
	let dx = center.x - projectile.x, dy = center.y - projectile.y, dz = center.z - projectile.z;
	let norm = normalizeVec(dx, dy, dz);
	if (norm.length <= 0.00001) return false;

	let bb = target.getBoundingBox().inflate(SHIELDP.CHAIN_HITBOX_INFLATE);
	let b = getAabbMinMax(bb);
	if (!b) return true;

	let tHit = rayAabbEnterDistance(
		projectile.x, projectile.y, projectile.z,
		norm.x, norm.y, norm.z,
		b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ
	);
	return tHit !== null;
}

function getProjectileMotion(projectile) {
	let m = projectile.getDeltaMovement();
	return { x: m.get("x"), y: m.get("y"), z: m.get("z") };
}

function setProjectileMotion(projectile, x, y, z) {
	projectile.setMotion(x, y, z);
	projectile.hasImpulse = true;
}

function getFaceNormal(face) {
	if (face === "east") return { x: 1, y: 0, z: 0 };
	if (face === "west") return { x: -1, y: 0, z: 0 };
	if (face === "up") return { x: 0, y: 1, z: 0 };
	if (face === "down") return { x: 0, y: -1, z: 0 };
	if (face === "south") return { x: 0, y: 0, z: 1 };
	if (face === "north") return { x: 0, y: 0, z: -1 };
	return { x: 0, y: 0, z: 0 };
}

function reflectVectorByNormal(vx, vy, vz, nx, ny, nz) {
	let dot = vx * nx + vy * ny + vz * nz;
	return { x: vx - 2 * dot * nx, y: vy - 2 * dot * ny, z: vz - 2 * dot * nz };
}

function isBlockSolidForShield(level, x, y, z) {
	let bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
	try {
		let pos = new BlockPos(bx, by, bz);
		let state = level.getBlockState(pos);
		if (!state) return false;
		let shape = state.getCollisionShape(level, pos);
		if (!shape || shape.isEmpty()) return false;
		let aabb = shape.bounds();
		let volume = aabb.getXsize() * aabb.getYsize() * aabb.getZsize();
		return volume >= 0.15;
	} catch (e) {
		return false;
	}
}

function isShieldInteractableBlock(level, bx, by, bz) {
	try {
		let bw = level.getBlock(bx, by, bz);
		if (!bw) return false;
		let state = bw.getBlockState();
		if (!state) return false;
		let b = state.getBlock();
		return (b instanceof $LeverBlock) || (b instanceof $ButtonBlock);
	} catch (e) {
		return false;
	}
}

function shieldActivateInteractable(level, bx, by, bz) {
	try {
		let bw = level.getBlock(bx, by, bz);
		if (!bw) return false;
		let state = bw.getBlockState();
		if (!state) return false;
		let b = state.getBlock();
		let pos = new $BlockPos(bx, by, bz);
		if (b instanceof $LeverBlock) {
			b.pull(state, level, pos);
			return true;
		}
		if (b instanceof $ButtonBlock) {
			b.press(state, level, pos);
			return true;
		}
	} catch (e) { }
	return false;
}

function isShieldBreakableGlass(level, bx, by, bz) {
	try {
		let bw = level.getBlock(bx, by, bz);
		if (!bw) return false;
		let id = String(bw.id || "");
		if (id === "minecraft:air" || id === "minecraft:cave_air" || id === "minecraft:void_air") return false;
		let state = bw.getBlockState();
		if (!state) return false;

		let pos = new $BlockPos(bx, by, bz);
		if (state.getDestroySpeed(level, pos) < 0) return false;

		let b = state.getBlock();
		if (b instanceof $AbstractGlassBlock) return true;
		if (id.indexOf("glass") >= 0) return true;
		return false;
	} catch (e) {
		return false;
	}
}

function shieldBreakGlassAt(level, owner, bx, by, bz) {
	if (!owner || !owner.isPlayer()) return false;
	try {
		if (!isShieldBreakableGlass(level, bx, by, bz)) return false;
		let pos = new $BlockPos(bx, by, bz);
		return level.destroyBlock(pos, true, owner);
	} catch (e) {
		return false;
	}
}

function sweepShieldPath(level, x1, y1, z1, x2, y2, z2, owner) {
	let dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
	let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
	let numSamples = Math.max(2, Math.ceil(dist / 0.4) + 1);
	let prevKey = null;
	for (let i = 1; i <= numSamples; i++) {
		let t = i / numSamples;
		let cx = x1 + dx * t, cy = y1 + dy * t, cz = z1 + dz * t;
		let bx = Math.floor(cx), by = Math.floor(cy), bz = Math.floor(cz);
		let key = bx + "," + by + "," + bz;
		if (key === prevKey) continue;
		prevKey = key;

		if (isShieldInteractableBlock(level, bx, by, bz))
			return { x: cx, y: cy, z: cz, interactPos: { x: bx, y: by, z: bz } };
		if (owner && isShieldBreakableGlass(level, bx, by, bz)) {
			shieldBreakGlassAt(level, owner, bx, by, bz);
			continue;
		}
		if (isBlockSolidForShield(level, cx, cy, cz))
			return { x: cx, y: cy, z: cz, interactPos: null };
	}
	return null;
}

function getHitFaceFromPath(x1, y1, z1, hitX, hitY, hitZ) {
	let bx = Math.floor(hitX), by = Math.floor(hitY), bz = Math.floor(hitZ);
	let dx = hitX - x1, dy = hitY - y1, dz = hitZ - z1;

	let tX = -Infinity, tY = -Infinity, tZ = -Infinity;
	if (Math.abs(dx) > 0.0001) tX = ((dx > 0 ? bx : bx + 1) - x1) / dx;
	if (Math.abs(dy) > 0.0001) tY = ((dy > 0 ? by : by + 1) - y1) / dy;
	if (Math.abs(dz) > 0.0001) tZ = ((dz > 0 ? bz : bz + 1) - z1) / dz;

	if (tX >= tY && tX >= tZ) return dx > 0 ? "west" : "east";
	if (tY >= tX && tY >= tZ) return dy > 0 ? "down" : "up";
	return dz > 0 ? "north" : "south";
}

function isBounceWorthwhile(projectile, face, range) {
	let motion = getProjectileMotion(projectile);
	let normal = getFaceNormal(face);
	if (normal.x === 0 && normal.y === 0 && normal.z === 0) return false;

	let reflected = reflectVectorByNormal(motion.x, motion.y, motion.z, normal.x, normal.y, normal.z);
	let norm = normalizeVec(reflected.x, reflected.y, reflected.z);
	if (norm.length <= 0.00001) return false;

	let eps = 0.05;
	let bx = Math.floor(projectile.x), by = Math.floor(projectile.y), bz = Math.floor(projectile.z);
	let sx = projectile.x, sy = projectile.y, sz = projectile.z;
	if (face === "east") sx = bx + 1.0 + eps;
	else if (face === "west") sx = bx - eps;
	else if (face === "up") sy = by + 1.0 + eps;
	else if (face === "down") sy = by - eps;
	else if (face === "south") sz = bz + 1.0 + eps;
	else if (face === "north") sz = bz - eps;

	let speed = Math.sqrt(motion.x * motion.x + motion.y * motion.y + motion.z * motion.z);
	let minClearDist = Math.max(
		SHIELDP.MIN_BLOCK_BOUNCE_CLEAR,
		Math.min(SHIELDP.MAX_BLOCK_BOUNCE_CLEAR, speed * 0.85)
	);
	let step = SHIELDP.PATH_SAMPLE_STEP;
	let numSamples = Math.ceil(range / step);
	let foundAir = false;
	let firstAirDist = 0;

	for (let i = 1; i <= numSamples; i++) {
		let d = i * step;
		if (d > range) break;
		let solid = isBlockSolidForShield(projectile.level, sx + norm.x * d, sy + norm.y * d, sz + norm.z * d);
		if (!foundAir) {
			if (!solid) {
				foundAir = true;
				firstAirDist = d;
			}
		} else {
			if (solid) return (d - firstAirDist) >= minClearDist;
		}
	}

	return false;
}

function resetShieldGravityRamp(projectile) {
	projectile.persistentData.TicksSinceLastRicochet = 0;
	projectile.mergeNbt({ Gravity: SHIELDP.GRAVITY_MIN });
}

function computeShieldGravityFromFlightTicks(ticks) {
	let t = ticks || 0;
	if (t < SHIELDP.GRAVITY_FLIGHT_TICKS) return SHIELDP.GRAVITY_MIN;
	if (t < SHIELDP.GRAVITY_FLIGHT_TICKS + SHIELDP.GRAVITY_UP_TICKS) {
		let u = (t - SHIELDP.GRAVITY_FLIGHT_TICKS) / SHIELDP.GRAVITY_UP_TICKS;
		return SHIELDP.GRAVITY_MIN + u * (SHIELDP.GRAVITY_MAX - SHIELDP.GRAVITY_MIN);
	}
	return SHIELDP.GRAVITY_MAX;
}

function applyOutboundShieldGravity(projectile, returning, speedSq) {
	if (returning !== 0) {
		projectile.mergeNbt({ Gravity: SHIELDP.GRAVITY_MIN });
		return;
	}
	if (speedSq > 0.0025) {
		projectile.persistentData.TicksSinceLastRicochet = (projectile.persistentData.TicksSinceLastRicochet || 0) + 1;
	}
	let g = computeShieldGravityFromFlightTicks(projectile.persistentData.TicksSinceLastRicochet || 0);
	projectile.mergeNbt({ Gravity: g });
}

function playShieldHitSound(level, x, y, z) {
	level.playSound(null, x, y, z, 'powerborne:shield_hit', 'players', 0.9, 0.95 + Math.random() * 0.1);
}

function bounceShieldToTarget(projectile, target, momentum) {
	if (!target || !target.isAlive() || !target.isLiving()) return false;

	let motion = getProjectileMotion(projectile);
	let speed = Math.sqrt(motion.x * motion.x + motion.y * motion.y + motion.z * motion.z);
	if (speed <= 0.001) speed = SHIELDP.SPEED;

	let center = getEntityCenter(target);
	let dx = center.x - projectile.x, dy = center.y - projectile.y, dz = center.z - projectile.z;
	let norm = normalizeVec(dx, dy, dz);
	if (norm.length <= 0.00001) return false;

	let newSpeed = Math.max(speed * momentum, 0.18);
	if (target.getBoundingBox) {
		let bb = target.getBoundingBox().inflate(SHIELDP.CHAIN_HITBOX_INFLATE);
		let b = getAabbMinMax(bb);
		if (b) {
			let tHit = rayAabbEnterDistance(
				projectile.x, projectile.y, projectile.z,
				norm.x, norm.y, norm.z,
				b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ
			);
			if (tHit !== null && tHit > 0.0001 && tHit < newSpeed) {
				newSpeed = Math.max(0.18, tHit * SHIELDP.OVERSHOOT_SPEED_FACTOR);
			}
		}
	}
	setProjectileMotion(projectile, norm.x * newSpeed, norm.y * newSpeed, norm.z * newSpeed);
	return true;
}

function startShieldReturn(projectile, owner, momentum) {
	if (!owner || !owner.isAlive()) return false;

	let returnAnchorY = projectile.persistentData.ReturnAnchorY;
	if (returnAnchorY === undefined || returnAnchorY === null || !isFinite(returnAnchorY)) {
		returnAnchorY = owner.y + owner.eyeHeight * 0.5 + 0.5;
		projectile.persistentData.ReturnAnchorY = returnAnchorY;
	}

	if (projectile.y < returnAnchorY - 1.0) {
		let dx = owner.x - projectile.x;
		let dy = returnAnchorY - projectile.y;
		let dz = owner.z - projectile.z;
		let norm = normalizeVec(dx, dy, dz);

		if (norm.y < SHIELDP.RETURN_MIN_RISE_Y && norm.length > 0.00001) {
			let hLen = Math.sqrt(norm.x * norm.x + norm.z * norm.z);
			let maxH = Math.sqrt(1.0 - SHIELDP.RETURN_MIN_RISE_Y * SHIELDP.RETURN_MIN_RISE_Y);
			if (hLen > 0.001) {
				let s = maxH / hLen;
				norm = { x: norm.x * s, y: SHIELDP.RETURN_MIN_RISE_Y, z: norm.z * s, length: 1.0 };
			} else {
				norm = { x: 0, y: 1, z: 0, length: 1 };
			}
		}

		if (norm.length > 0.00001) {
			let spd = Math.max(SHIELDP.SPEED * momentum, 0.18);
			setProjectileMotion(projectile, norm.x * spd, norm.y * spd, norm.z * spd);
		}
		projectile.persistentData.Returning = 1;
	} else {
		if (!bounceShieldToTarget(projectile, owner, momentum)) return false;
		projectile.persistentData.Returning = 2;
	}
	return true;
}

function applyShieldRicochet(projectile, face, momentum) {
	let motion = getProjectileMotion(projectile);
	let normal = getFaceNormal(face);
	if (normal.x === 0 && normal.y === 0 && normal.z === 0) return false;

	let reflected = reflectVectorByNormal(motion.x, motion.y, motion.z, normal.x, normal.y, normal.z);
	let speed = Math.sqrt(reflected.x * reflected.x + reflected.y * reflected.y + reflected.z * reflected.z);
	if (speed <= 0.0001) return false;

	let scaled = normalizeVec(reflected.x, reflected.y, reflected.z);
	let finalSpeed = Math.max(speed * momentum, 0.18);

	let eps = 0.05;
	let bx = Math.floor(projectile.x), by = Math.floor(projectile.y), bz = Math.floor(projectile.z);
	let newX = projectile.x, newY = projectile.y, newZ = projectile.z;
	if (face === "east") newX = bx + 1.0 + eps;
	else if (face === "west") newX = bx - eps;
	else if (face === "up") newY = by + 1.0 + eps;
	else if (face === "down") newY = by - eps;
	else if (face === "south") newZ = bz + 1.0 + eps;
	else if (face === "north") newZ = bz - eps;

	projectile.setPosition(newX, newY, newZ);
	setProjectileMotion(projectile, scaled.x * finalSpeed, scaled.y * finalSpeed, scaled.z * finalSpeed);
	projectile.persistentData.RicochetCooldown = SHIELDP.RICOCHET_COOLDOWN;
	resetShieldGravityRamp(projectile);
	return true;
}

function addShieldProjectileTracking(owner, projectile) {
	let isSpin = projectile.getTags().contains('powerborne.spinning_shield');
	if (isSpin) {
		owner.persistentData.ActiveSpinShieldUUID = String(projectile.uuid);
	} else {
		owner.persistentData.ActiveThrownShieldUUID = String(projectile.uuid);
	}
}

function removeShieldProjectileTracking(projectile) {
	let owner = projectile.getOwner();
	if (!owner) return;
	let isSpin = projectile.getTags().contains('powerborne.spinning_shield');
	if (isSpin) {
		owner.persistentData.remove('ActiveSpinShieldUUID');
	} else {
		owner.persistentData.remove('ActiveThrownShieldUUID');
	}
}

function cleanupOrphanedShieldState(player) {
	if (player.persistentData.SpinningShieldActive) return;

	if (player.persistentData.ThrownShieldItem) {
		let savedItem = readPlayerShieldSnapshot(player.persistentData.ThrownShieldItem)
			|| { id: CAP_SHIELD_ID, Count: 1 };
		giveSavedShieldToPlayer(player, savedItem);
		player.persistentData.remove('ThrownShieldItem');
	}

	if (player.persistentData.SpinningShieldItem) {
		let savedItem = readPlayerShieldSnapshot(player.persistentData.SpinningShieldItem)
			|| { id: CAP_SHIELD_ID, Count: 1 };
		giveSavedShieldToPlayer(player, savedItem);
		player.persistentData.remove('SpinningShieldItem');
		player.persistentData.SpinningShieldActive = 0;
	}
}

function getShieldAlreadyHitList(projectile) {
	if (!projectile.persistentData.HitEntities) projectile.persistentData.HitEntities = "";
	return String(projectile.persistentData.HitEntities);
}

function hasShieldAlreadyHit(projectile, entity) {
	return getShieldAlreadyHitList(projectile).indexOf("|" + String(entity.uuid) + "|") >= 0;
}

function addShieldHitEntity(projectile, entity) {
	let list = getShieldAlreadyHitList(projectile);
	let key = "|" + String(entity.uuid) + "|";
	if (list.indexOf(key) < 0) projectile.persistentData.HitEntities = list + key;
}

function canShieldBounceToEntity(projectile, owner, toEntity, fromEntity, minRange, maxRange) {
	if (!toEntity || !toEntity.isAlive() || !toEntity.isLiving()) return false;
	if (!owner || !owner.isAlive()) return false;
	if (!owner.isPlayer() || !abilityUtil.isEnabled(owner, CAP_POWER, 'shield_bounce_buy')) return false;
	if (toEntity.uuid == owner.uuid) return false;
	if (hasShieldAlreadyHit(projectile, toEntity)) return false;
	if (toEntity.hurtTime > 0) return false
	if (!toEntity.attackable()) return false;
	if (projectile.distanceToSqr(toEntity) > maxRange * maxRange) return false;

	let minSep = Math.max(minRange || 0, SHIELDP.SPEED);
	if (projectile.distanceToSqr(toEntity) < minSep * minSep) return false;
	if (fromEntity && fromEntity.distanceToSqr(toEntity) < minSep * minSep) return false;

	return true;
}

function findNearestShieldBounceTarget(projectile, owner, fromEntity, minRange, maxRange) {
	let nearby = projectile.level.getEntitiesWithin(projectile.getBoundingBox().inflate(maxRange));
	let best = null, bestDist = Infinity;

	nearby.forEach(e => {
		if (e.uuid == projectile.uuid) return;
		if (!canShieldBounceToEntity(projectile, owner, e, fromEntity, minRange, maxRange)) return;
		if (!shieldBounceAimHitsTargetAabb(projectile, e)) return;
		let center = getEntityCenter(e);
		if (!hasShieldLineOfSight(projectile.level, projectile.x, projectile.y, projectile.z, center.x, center.y, center.z)) return;
		let dx = center.x - projectile.x, dy = center.y - projectile.y, dz = center.z - projectile.z;
		let d = dx * dx + dy * dy + dz * dz;
		if (d < bestDist) { bestDist = d; best = e; }
	});

	return best;
}

function createShieldProjectile(player, itemstack) {
	let savedItem = copyShieldItemData(itemstack);
	let spawnY = player.eyeY - 0.2;

	let projectile = player.level.createEntity('palladium:custom_projectile');
	projectile.setOwner(player);
	projectile.x = player.x;
	projectile.y = spawnY;
	projectile.z = player.z;

	projectile.shootFromRotation(player, player.pitch, player.yaw, 0, SHIELDP.SPEED, 0);
	projectile.addTag("powerborne.vibranium_shield_projectile");

	projectile.mergeNbt({
		"Damage": 9.5,
		"Gravity": SHIELDP.GRAVITY_MIN,
		"DieOnEntityHit": false,
		"DieOnBlockHit": false,
		"Size": -0.3,
		"Lifetime": 99999,
		"PreventShooterInteraction": 1,
		"KubeJSPersistentData": {
			"BounceCount": 0,
			"Returning": 0,
			"TravelDistance": 0.0,
			"TicksSinceLastRicochet": 0,
			"OwnerUsername": player.username,
			"HitEntities": "",
			"LastX": player.x,
			"LastY": spawnY,
			"LastZ": player.z,
			"ThrowY": spawnY,
			"SavedShieldItem": savedItem
		},
		"Appearances": [
			{ "Type": "item", "Item": savedItem },
			{ "Type": "trail", "Trail": "powerborne:shield_trail" },
			{ "Type": "trail", "Trail": "powerborne:shield_trail2" }
		],
		"CustomName": '{"text":"' + player.username + '\'s Vibranium Shield"}'
	});


	applyShieldProjectileColors(projectile, itemstack);
	if (Platform.isFabric()) {
		let c1 = readShieldItemColor(itemstack, "Color1");
		let c4 = readShieldItemColor(itemstack, "Color4");
		projectile.persistentData.TrailColor1 = c1;
		projectile.persistentData.TrailColor4 = c4;
	}
	projectile.spawn();
	player.persistentData.ThrownShieldItem = snapshotShieldDataForPlayer(savedItem);
	addShieldProjectileTracking(player, projectile);
	return projectile;
}

NetworkEvents.dataReceived("vibranium_shield_bc_swing", (event) => {
	let player = event.player;
	if (!player) return;
	let bcSwing = event.data && event.data.bcSwing;
	player.persistentData.ShieldClientBcSwing = bcSwing ? 1 : 0;
});

PlayerEvents.tick(event => {
	let player = event.player;
	if (!player || !player.isAlive()) return;
	if (player.level.isClientSide()) return;

	let catchCooldown = player.persistentData.ShieldCatchCooldown || 0;
	if (catchCooldown > 0) {
		player.persistentData.ShieldCatchCooldown = catchCooldown - 1;
		player.persistentData.ShieldThrowLatch = 1;
		return;
	}

	let item = player.mainHandItem;
	if (!item || item.isEmpty()) {
		player.persistentData.ShieldClientBcSwing = 0;
		return;
	}
	if (item.id !== CAP_SHIELD_ID) {
		player.persistentData.ShieldClientBcSwing = 0;
		return;
	}

	if (!abilityUtil.isEnabled(player, CAP_POWER, "throw_shield")) {
		player.persistentData.ShieldThrowLatch = 0;
		player.persistentData.ShieldClientBcSwing = 0;
		return;
	}

	if (player.swinging || (player.persistentData.ShieldClientBcSwing | 0)) {
		if (player.persistentData.ShieldThrowLatch == 1) return;

		if (player.persistentData.ThrownShieldItem || player.persistentData.SpinningShieldItem) {
			return;
		}
		player.persistentData.ShieldThrowLatch = 1;
		createShieldProjectile(player, item);
		item.shrink(1);

		player.addItemCooldown(CAP_SHIELD_ID, 20);

		global.sound(player, 'powerborne:shield_throw', 0.6, 0.9, 0.15);
	} else {
		player.persistentData.ShieldThrowLatch = 0;
	}
});

EntityEvents.hurt(event => {
	let entity = event.entity;
	let source = event.source;
	let projectile = source.immediate;
	if (!projectile || projectile.type !== 'palladium:custom_projectile')
		projectile = source.actual;

	if (!projectile) return;
	if (projectile.type !== 'palladium:custom_projectile') return;
	if (!projectile.getTags().contains('powerborne.vibranium_shield_projectile')) return;
	if (projectile.getTags().contains('powerborne.spinning_shield')) return;

	if (!entity || !entity.isAlive() || !entity.isLiving()) return;

	let owner = projectile.getOwner();
	if (owner && entity.uuid == owner.uuid) return;
	if (entity.hurtTime >= 2) return;

	addShieldHitEntity(projectile, entity);

	let bounces = (projectile.persistentData.BounceCount || 0) + 1;
	projectile.persistentData.BounceCount = bounces;

	if (!owner || !owner.isAlive()) return;

	playShieldHitSound(owner.level, entity.x, entity.y, entity.z);
	if (!damageThrownShieldOnImpact(projectile, owner)) return;

	let returning = projectile.persistentData.Returning || 0;
	if (returning >= 1) return;

	let motion = getProjectileMotion(projectile);
	let currentSpeed = Math.sqrt(motion.x * motion.x + motion.y * motion.y + motion.z * motion.z);
	let totalDistance = projectile.persistentData.TravelDistance || 0;

	if (bounces <= SHIELDP.MAX_ENTITY_RICOCHETS && totalDistance <= SHIELDP.MAX_RICOCHET_DIST && currentSpeed >= 0.18) {
		let nextTarget = findNearestShieldBounceTarget(
			projectile, owner, entity, SHIELDP.SPEED, SHIELDP.ENTITY_CHAIN_RANGE
		);
		if (nextTarget) {
			bounceShieldToTarget(projectile, nextTarget, 1);
			resetShieldGravityRamp(projectile);
			return;
		}
	}

	if (totalDistance <= SHIELDP.MAX_RETURN_DIST && currentSpeed >= 0.18) {
		startShieldReturn(projectile, owner, 1);
	}
});

PalladiumEvents.customProjectileTick(event => {
	let projectile = event.getProjectile();
	if (!projectile || projectile.level.isClientSide()) return;
	if (!projectile.getTags().contains('powerborne.vibranium_shield_projectile')) return;

	projectile.remainingFireTicks = 0;
	if (Platform.isFabric()) {
		if (projectile.age < 5 || projectile.age % 20 === 0) {
			let c1 = projectile.persistentData.TrailColor1;
			let c4 = projectile.persistentData.TrailColor4;
			if (c1) palladium.setProperty(projectile, "color1", c1);
			if (c4) palladium.setProperty(projectile, "color4", c4);
		}
	}

	let owner = projectile.getOwner();

	if (!owner || !owner.isAlive()) {
		let ownerUsername = projectile.persistentData.OwnerUsername;
		let server = projectile.level.getServer();

		if (server && ownerUsername) {
			let recoveredOwner = server.getPlayerList().getPlayerByName(ownerUsername);
			if (recoveredOwner && recoveredOwner.isAlive()) {
				giveSavedShieldToPlayer(recoveredOwner, getShieldProjectileItemData(projectile));
				if (projectile.getTags().contains('powerborne.spinning_shield')) {
					recoveredOwner.persistentData.remove('SpinningShieldItem');
					recoveredOwner.persistentData.SpinningShieldActive = 0;
				} else {
					recoveredOwner.persistentData.remove('ThrownShieldItem');
				}
				removeShieldProjectileTracking(projectile);
				projectile.kill();
				return;
			}
		}

		removeShieldProjectileTracking(projectile);
		return;
	}

	if (projectile.getTags().contains('powerborne.spinning_shield')) {
		handleSpinningShieldProjectileTick(projectile, owner);
		return;
	}

	let returningEarly = projectile.persistentData.Returning || 0;
	if (returningEarly === 0 && owner.isPlayer() && global.runShieldMjolnirClash) {
		let scan = projectile.level.getEntitiesWithin(projectile.getBoundingBox().inflate(SHIELDP.MJOLNIR_PROJ_SCAN_RANGE));
		let mjolnirProj = null;
		scan.forEach((e) => {
			if (mjolnirProj) return;
			if (
				e.type === "palladium:custom_projectile" &&
				e.uuid !== projectile.uuid &&
				(e.getTags().contains("powerborne.mjolnir_projectile") || e.getTags().contains("powerborne.stormbreaker_projectile"))
			) {
				mjolnirProj = e;
			}
		});
		if (mjolnirProj) {
			let mjolnirDamage = mjolnirProj.nbt.contains("Damage") ? mjolnirProj.nbt.getDouble("Damage") : 0;
			if (mjolnirDamage < 15) {
				mjolnirProj = null;
			}
		}
		if (mjolnirProj) {
			global.runShieldMjolnirClash(owner, projectile, mjolnirProj.getOwner(), true);
			resetShieldGravityRamp(projectile);
			startShieldReturn(projectile, owner, 1);
			global.triggerMjolnirReturnAfterShieldClash(mjolnirProj);
			return;
		}
	}

	let lastX = projectile.persistentData.LastX ?? projectile.x;
	let lastY = projectile.persistentData.LastY ?? projectile.y;
	let lastZ = projectile.persistentData.LastZ ?? projectile.z;

	let dxStep = projectile.x - lastX, dyStep = projectile.y - lastY, dzStep = projectile.z - lastZ;
	projectile.persistentData.TravelDistance = (projectile.persistentData.TravelDistance || 0)
		+ Math.sqrt(dxStep * dxStep + dyStep * dyStep + dzStep * dzStep);
	projectile.persistentData.LastX = projectile.x;
	projectile.persistentData.LastY = projectile.y;
	projectile.persistentData.LastZ = projectile.z;

	let motion = getProjectileMotion(projectile);
	let speedSq = motion.x * motion.x + motion.y * motion.y + motion.z * motion.z;
	let speed = Math.sqrt(speedSq);

	if (projectile.isInWater() && speed > 0.1) {
		projectile.addMotion(motion.x * 0.25, motion.y * 0.25, motion.z * 0.25);
	}

	let cooldown = projectile.persistentData.RicochetCooldown || 0;
	if (cooldown > 0) projectile.persistentData.RicochetCooldown = cooldown - 1;

	let returning = projectile.persistentData.Returning || 0;
	let bounces = projectile.persistentData.BounceCount || 0;
	let totalDistance = projectile.persistentData.TravelDistance || 0;

	let sweepHit = sweepShieldPath(projectile.level, lastX, lastY, lastZ, projectile.x, projectile.y, projectile.z, owner);

	if (returning === 0 && cooldown <= 0 && sweepHit !== null) {
		projectile.setPosition(sweepHit.x, sweepHit.y, sweepHit.z);

		if (sweepHit.interactPos)
			shieldActivateInteractable(projectile.level, sweepHit.interactPos.x, sweepHit.interactPos.y, sweepHit.interactPos.z);

		let hitFace = getHitFaceFromPath(lastX, lastY, lastZ, sweepHit.x, sweepHit.y, sweepHit.z);
		if (hitFace !== "") {
			bounces++;
			projectile.persistentData.BounceCount = bounces;
			playShieldHitSound(projectile.level, projectile.x, projectile.y, projectile.z);

			let handled = false;

			if (bounces <= SHIELDP.MAX_BLOCK_RICOCHETS && totalDistance <= SHIELDP.MAX_RICOCHET_DIST && speed >= 0.18) {
				let nextTarget = findNearestShieldBounceTarget(
					projectile, owner, null, SHIELDP.SPEED, SHIELDP.BLOCK_CHAIN_RANGE
				);
				if (nextTarget) {
					handled = bounceShieldToTarget(projectile, nextTarget, 1);
					if (handled) resetShieldGravityRamp(projectile);
					projectile.persistentData.RicochetCooldown = SHIELDP.RICOCHET_COOLDOWN;
				}
			}

			if (!handled && bounces <= SHIELDP.MAX_BLOCK_RICOCHETS && totalDistance <= SHIELDP.MAX_RICOCHET_DIST) {
				if (hitFace === "up" || hitFace === "down") {
					if (isBounceWorthwhile(projectile, hitFace, SHIELDP.BOUNCE_PATH_RANGE)) {
						handled = applyShieldRicochet(projectile, hitFace, 1);
					}
				} else {
					if (isBounceWorthwhile(projectile, hitFace, SHIELDP.WALL_BOUNCE_PATH_RANGE)) {
						handled = applyShieldRicochet(projectile, hitFace, 1);
					}
				}
			}

			if (!handled) {
				startShieldReturn(projectile, owner, 1);
				projectile.persistentData.RicochetCooldown = SHIELDP.RICOCHET_COOLDOWN;
			}
		}
	}

	if (returning >= 1) {
		if (owner.isPlayer()) {
			let gx = Math.floor(projectile.x), gy = Math.floor(projectile.y), gz = Math.floor(projectile.z);
			if (isShieldBreakableGlass(projectile.level, gx, gy, gz))
				shieldBreakGlassAt(projectile.level, owner, gx, gy, gz);
		}

		let returnAnchorY = projectile.persistentData.ReturnAnchorY;
		if (returnAnchorY === undefined || returnAnchorY === null || !isFinite(returnAnchorY)) {
			returnAnchorY = owner.y + owner.eyeHeight * 0.5 + 0.5;
			projectile.persistentData.ReturnAnchorY = returnAnchorY;
		}

		if (returning === 1 && projectile.y >= returnAnchorY - 1.0) {
			projectile.persistentData.Returning = 2;
			returning = 2;
		}

		let targetY = returning === 1
			? returnAnchorY
			: owner.y + owner.eyeHeight * 0.5 + 0.5;

		let dx = owner.x - projectile.x;
		let dy = targetY - projectile.y;
		let dz = owner.z - projectile.z;

		let targetNorm = normalizeVec(dx, dy, dz);
		if (targetNorm.length > 0.00001) {
			let steered;

			if (returning === 1) {
				steered = targetNorm;

				let riseNeeded = returnAnchorY - projectile.y;
				if (riseNeeded > 1.0 && steered.y < SHIELDP.RETURN_MIN_RISE_Y) {
					let hLen = Math.sqrt(steered.x * steered.x + steered.z * steered.z);
					let maxH = Math.sqrt(1.0 - SHIELDP.RETURN_MIN_RISE_Y * SHIELDP.RETURN_MIN_RISE_Y);
					if (hLen > 0.001) {
						let s = maxH / hLen;
						steered = { x: steered.x * s, y: SHIELDP.RETURN_MIN_RISE_Y, z: steered.z * s, length: 1.0 };
					} else {
						steered = { x: 0, y: 1, z: 0, length: 1 };
					}
				}
			} else {
				let baseNorm = speed > 0.05 ? normalizeVec(motion.x, motion.y, motion.z) : targetNorm;
				let dist = targetNorm.length;
				let turnStrength = Math.min(1.0, 0.35 + (1.0 - Math.min(dist, 6.0) / 6.0) * 0.25);
				let steerX = baseNorm.x + (targetNorm.x - baseNorm.x) * turnStrength;
				let steerY = baseNorm.y + (targetNorm.y - baseNorm.y) * turnStrength;
				let steerZ = baseNorm.z + (targetNorm.z - baseNorm.z) * turnStrength;
				steered = normalizeVec(steerX, steerY, steerZ);
			}

			let returnSpeed = SHIELDP.SPEED;
			if (projectile.isInWater()) returnSpeed *= 1.3;
			let nearTargetMaxSpeed = Math.max(0.08, targetNorm.length * 0.55);
			if (nearTargetMaxSpeed < returnSpeed) {
				returnSpeed = Math.max(0.02, nearTargetMaxSpeed);
			}
			setProjectileMotion(projectile, steered.x * returnSpeed, steered.y * returnSpeed, steered.z * returnSpeed);
		}

		if (isBlockSolidForShield(projectile.level, projectile.x, projectile.y, projectile.z)) {
			let stuck = (projectile.persistentData.StuckTicks || 0) + 1;
			projectile.persistentData.StuckTicks = stuck;
			if (stuck >= 3) {
				if (returning === 1) {
					for (let d = 1; d <= 10; d++) {
						if (!isBlockSolidForShield(projectile.level, projectile.x, projectile.y + d, projectile.z)) {
							projectile.setPosition(projectile.x, projectile.y + d, projectile.z);
							projectile.persistentData.StuckTicks = 0;
							break;
						}
					}
				} else {
					let rm = getProjectileMotion(projectile);
					let rn = normalizeVec(rm.x, rm.y, rm.z);
					if (rn.length > 0.00001) {
						for (let d = 1; d <= 10; d++) {
							let tx = projectile.x + rn.x * d;
							let ty = projectile.y + rn.y * d;
							let tz = projectile.z + rn.z * d;
							if (!isBlockSolidForShield(projectile.level, tx, ty, tz)) {
								projectile.setPosition(tx, ty, tz);
								projectile.persistentData.StuckTicks = 0;
								break;
							}
						}
					}
				}
			}
		} else {
			projectile.persistentData.StuckTicks = 0;
		}
	}

	let motionForGravity = getProjectileMotion(projectile);
	let speedSqForGravity = motionForGravity.x * motionForGravity.x + motionForGravity.y * motionForGravity.y + motionForGravity.z * motionForGravity.z;
	let returningForGravity = projectile.persistentData.Returning || 0;
	applyOutboundShieldGravity(projectile, returningForGravity, speedSqForGravity);

	if (returning >= 1 || totalDistance > 3.0) {
		let catchDx = owner.x - projectile.x;
		let catchDy = owner.y + owner.eyeHeight * 0.5 - projectile.y;
		let catchDz = owner.z - projectile.z;
		let catchDist = Math.sqrt(catchDx * catchDx + catchDy * catchDy + catchDz * catchDz);
		if (catchDist < SHIELDP.RETURN_CATCH_DIST) {
			global.playSoundLocal(owner, 'minecraft:entity.item.pickup', 'players', 0.2, 2);
			giveSavedShieldToPlayer(owner, getShieldProjectileItemData(projectile));
			owner.persistentData.remove('ThrownShieldItem');
			owner.persistentData.remove('ActiveThrownShieldUUID');
			owner.persistentData.ShieldThrowLatch = 1;
			owner.persistentData.ShieldCatchCooldown = 5;
			projectile.kill();
			return;
		}
	}
});

function findProjectileByUuid(server, uuid) {
	let found = null;
	server.allLevels.forEach(level => {
		if (!found) {
			let e = level.getEntity(uuid);
			if (e && !e.removed) found = e;
		}
	});
	return found;
}

function nudgeProjectileTowardPlayer(projectile, player) {
	let dist = Math.sqrt(projectile.distanceToSqr(player));
	let t = dist > 0.0001 ? Math.min(5.0, dist) / dist : 0;
	projectile.setPosition(
		projectile.x + (player.x - projectile.x) * t,
		projectile.y + (player.y + 1.5 - projectile.y) * t,
		projectile.z + (player.z - projectile.z) * t
	);
	if (!(projectile.persistentData.Returning || 0)) {
		startShieldReturn(projectile, player, 1);
	}
}

ServerEvents.tick(event => {
	if (event.server.tickCount % 20 !== 0) return;

	event.server.players.forEach(player => {
		if (player.persistentData.ThrownShieldItem) {
			let uuid = player.persistentData.ActiveThrownShieldUUID;

			if (!uuid) {
				if (!player.persistentData.SpinningShieldActive) {
					let savedItem = readPlayerShieldSnapshot(player.persistentData.ThrownShieldItem)
						|| { id: CAP_SHIELD_ID, Count: 1 };
					giveSavedShieldToPlayer(player, savedItem);
					player.persistentData.remove('ThrownShieldItem');
				}
			} else {
				let projectile = findProjectileByUuid(event.server, uuid);

				if (!projectile) {
					let savedItem = readPlayerShieldSnapshot(player.persistentData.ThrownShieldItem)
						|| { id: CAP_SHIELD_ID, Count: 1 };
					giveSavedShieldToPlayer(player, savedItem);
					player.persistentData.remove('ThrownShieldItem');
					player.persistentData.remove('ActiveThrownShieldUUID');
				} else if (!isEntityLoaded(projectile, projectile.level)) {
					nudgeProjectileTowardPlayer(projectile, player);
				}
			}
		}

		if (player.persistentData.SpinningShieldItem && !player.persistentData.SpinningShieldActive) {
			let uuid = player.persistentData.ActiveSpinShieldUUID;
			let projectile = uuid ? findProjectileByUuid(event.server, uuid) : null;

			if (!projectile) {
				let savedItem = readPlayerShieldSnapshot(player.persistentData.SpinningShieldItem)
					|| { id: CAP_SHIELD_ID, Count: 1 };
				giveSavedShieldToPlayer(player, savedItem);
				player.persistentData.remove('SpinningShieldItem');
				player.persistentData.remove('ActiveSpinShieldUUID');
			}
		}
	});
});

function isShieldProjectile(entity) {
	return entity && entity.type === 'palladium:custom_projectile' &&
		entity.getTags && entity.getTags().contains('powerborne.vibranium_shield_projectile');
}

EntityEvents.death(event => {
	const source = event.source;
	let projectile = source ? source.immediate : null;
	if (!projectile || projectile.type !== 'palladium:custom_projectile')
		projectile = source ? source.actual : null;
	if (isShieldProjectile(projectile)) {
		const owner = projectile.getOwner();
		if (!owner || !abilityUtil.hasPower(owner, CAP_POWER)) return;
		const abilityId = projectile.getTags().contains('powerborne.spinning_shield')
			? 'spinning_shield' : 'throw_shield';
		global.levelingSystem.awardXPForAbility(owner, CAP_POWER, abilityId);
		return;
	}

	const player = event.source ? event.source.player : null;
	if (!player || !abilityUtil.hasPower(player, CAP_POWER)) return;
	const victim = event.entity;
	if (!victim) return;
	const lastAbility = victim.persistentData.capLastHitAbility;
	const lastTick = victim.persistentData.capLastHitTick || 0;
	if (!lastAbility) return;
	const now = victim.level.gameTime;
	if (now - lastTick > 40) return;
	global.levelingSystem.awardXPForAbility(player, CAP_POWER, String(lastAbility));
});
