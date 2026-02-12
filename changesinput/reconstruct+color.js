/**
 * Восстанавливает CNetObj_PlayerInput из снапшота персонажа DDNet
 * @param {Object} char - объект CNetObj_Character (vanilla)
 * @param {Object|null} ddnetChar - объект CNetObj_DDNetCharacter (может быть null)
 * @returns {Object} восстановленный input в формате CNetObj_PlayerInput
 */
function reconstructPlayerInput(char, ddnetChar = null, tick = null) {
    const input = {
        m_Direction: 0,
        m_TargetX: 0,
        m_TargetY: -1,
        m_Jump: 0,
        m_Fire: 0,
        m_Hook: 0,
        m_PlayerFlags: char.player_flags || 0,
        m_WantedWeapon: 0,
        m_NextWeapon: 0,
        m_PrevWeapon: 0
    };

    input.m_Direction = char.character_core.direction;


    if (ddnetChar && (ddnetChar.m_TargetX !== 0 || ddnetChar.m_TargetY !== 0)) {
        input.m_TargetX = ddnetChar.m_TargetX;
        input.m_TargetY = ddnetChar.m_TargetY;
    } else {
        const angleRad = (char.character_core.angle / 256.0) * Math.PI / 128.0;
        input.m_TargetX = Math.cos(angleRad) * 256;
        input.m_TargetY = Math.sin(angleRad) * 256;
    }

    if (input.m_TargetX === 0 && input.m_TargetY === 0) {
        input.m_TargetY = -1;
    }

    const hookActive = char.character_core.hook_state !== 0 || char.character_core.hooked_player !== -1;
    input.m_Hook = hookActive ? 1 : 0;

    const isNinja = ddnetChar && (ddnetChar.m_Flags & 0x20) !== 0;
    const currentWeapon = isNinja ? 5 : char.weapon; 
    input.m_WantedWeapon = currentWeapon + 1; 

    const jumped = char.character_core.jumped;
    const grounded = Math.abs(char.character_core.vel_y) < 1 && jumped === 0;
    input.m_Jump = (jumped > 0 && !grounded) ? 1 : 0;


    const isAutofireWeapon = [2, 3, 4].includes(currentWeapon);
    const isJetpackGun = currentWeapon === 1 && ddnetChar && ddnetChar.m_Jetpack;
    const recentlyAttacked = false; // без tick нельзя точно сказать

    if (isAutofireWeapon || isJetpackGun) {
        input.m_Fire = recentlyAttacked ? 1 : 0;
    } else {
        input.m_Fire = 0;
    }

    input.m_WantedWeapon = char.weapon

    return input;
}

function getRandomSaturatedColor() {
    const hue = Math.floor(Math.random() * 360); // 0-360 градусов
    const saturation = 90 + Math.floor(Math.random() * 10); // 90-100% насыщенность
    const lightness = 50 + Math.floor(Math.random() * 15); // 50-65% яркость
    
    // Конвертируем HSL в RGB
    return hslToRgb(hue, saturation, lightness);
}

function hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;
    
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    
    let r, g, b;
    
    if (h < 60) {
        r = c; g = x; b = 0;
    } else if (h < 120) {
        r = x; g = c; b = 0;
    } else if (h < 180) {
        r = 0; g = c; b = x;
    } else if (h < 240) {
        r = 0; g = x; b = c;
    } else if (h < 300) {
        r = x; g = 0; b = c;
    } else {
        r = c; g = 0; b = x;
    }
    
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    
    // Возвращаем в формате для Teeworlds (RGB в одном числе)
    return (r << 16) | (g << 8) | b;
}

module.exports = {
    reconstructPlayerInput,
    getRandomSaturatedColor
}