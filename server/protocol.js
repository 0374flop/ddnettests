"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NETMSG = exports.States = void 0;
var States;
(function (States) {
    States[States["STATE_OFFLINE"] = 0] = "STATE_OFFLINE";
    States[States["STATE_CONNECTING"] = 1] = "STATE_CONNECTING";
    States[States["STATE_LOADING"] = 2] = "STATE_LOADING";
    States[States["STATE_ONLINE"] = 3] = "STATE_ONLINE";
    States[States["STATE_DEMOPLAYBACK"] = 4] = "STATE_DEMOPLAYBACK";
    States[States["STATE_QUITTING"] = 5] = "STATE_QUITTING";
    States[States["STATE_RESTARTING"] = 6] = "STATE_RESTARTING";
})(States || (exports.States = States = {}));
var NETMSG;
(function (NETMSG) {
    let System;
    (function (System) {
        System[System["NETMSG_EX"] = 0] = "NETMSG_EX";
        // the first thing sent by the client
        // contains the version info for the client
        System[System["NETMSG_INFO"] = 1] = "NETMSG_INFO";
        // sent by server
        System[System["NETMSG_MAP_CHANGE"] = 2] = "NETMSG_MAP_CHANGE";
        System[System["NETMSG_MAP_DATA"] = 3] = "NETMSG_MAP_DATA";
        System[System["NETMSG_CON_READY"] = 4] = "NETMSG_CON_READY";
        System[System["NETMSG_SNAP"] = 5] = "NETMSG_SNAP";
        System[System["NETMSG_SNAPEMPTY"] = 6] = "NETMSG_SNAPEMPTY";
        System[System["NETMSG_SNAPSINGLE"] = 7] = "NETMSG_SNAPSINGLE";
        System[System["NETMSG_SNAPSMALL"] = 8] = "NETMSG_SNAPSMALL";
        System[System["NETMSG_INPUTTIMING"] = 9] = "NETMSG_INPUTTIMING";
        System[System["NETMSG_RCON_AUTH_STATUS"] = 10] = "NETMSG_RCON_AUTH_STATUS";
        System[System["NETMSG_RCON_LINE"] = 11] = "NETMSG_RCON_LINE";
        System[System["NETMSG_AUTH_CHALLANGE"] = 12] = "NETMSG_AUTH_CHALLANGE";
        System[System["NETMSG_AUTH_RESULT"] = 13] = "NETMSG_AUTH_RESULT";
        // sent by client
        System[System["NETMSG_READY"] = 14] = "NETMSG_READY";
        System[System["NETMSG_ENTERGAME"] = 15] = "NETMSG_ENTERGAME";
        System[System["NETMSG_INPUT"] = 16] = "NETMSG_INPUT";
        System[System["NETMSG_RCON_CMD"] = 17] = "NETMSG_RCON_CMD";
        System[System["NETMSG_RCON_AUTH"] = 18] = "NETMSG_RCON_AUTH";
        System[System["NETMSG_REQUEST_MAP_DATA"] = 19] = "NETMSG_REQUEST_MAP_DATA";
        System[System["NETMSG_AUTH_START"] = 20] = "NETMSG_AUTH_START";
        System[System["NETMSG_AUTH_RESPONSE"] = 21] = "NETMSG_AUTH_RESPONSE";
        // sent by both
        System[System["NETMSG_PING"] = 22] = "NETMSG_PING";
        System[System["NETMSG_PING_REPLY"] = 23] = "NETMSG_PING_REPLY";
        System[System["NETMSG_ERROR"] = 24] = "NETMSG_ERROR";
        // sent by server (todo: move it up)
        System[System["NETMSG_RCON_CMD_ADD"] = 25] = "NETMSG_RCON_CMD_ADD";
        System[System["NETMSG_RCON_CMD_REM"] = 26] = "NETMSG_RCON_CMD_REM";
        System[System["NUM_NETMSGS"] = 27] = "NUM_NETMSGS";
        System[System["__NETMSG_UUID_HELPER"] = 65535] = "__NETMSG_UUID_HELPER";
        System[System["NETMSG_WHATIS"] = 65536] = "NETMSG_WHATIS";
        System[System["NETMSG_ITIS"] = 65537] = "NETMSG_ITIS";
        System[System["NETMSG_IDONTKNOW"] = 65538] = "NETMSG_IDONTKNOW";
        System[System["NETMSG_RCONTYPE"] = 65539] = "NETMSG_RCONTYPE";
        System[System["NETMSG_MAP_DETAILS"] = 65540] = "NETMSG_MAP_DETAILS";
        System[System["NETMSG_CAPABILITIES"] = 65541] = "NETMSG_CAPABILITIES";
        System[System["NETMSG_CLIENTVER"] = 65542] = "NETMSG_CLIENTVER";
        System[System["NETMSG_PINGEX"] = 65543] = "NETMSG_PINGEX";
        System[System["NETMSG_PONGEX"] = 65544] = "NETMSG_PONGEX";
        System[System["NETMSG_CHECKSUM_REQUEST"] = 65545] = "NETMSG_CHECKSUM_REQUEST";
        System[System["NETMSG_CHECKSUM_RESPONSE"] = 65546] = "NETMSG_CHECKSUM_RESPONSE";
        System[System["NETMSG_CHECKSUM_ERROR"] = 65547] = "NETMSG_CHECKSUM_ERROR";
        System[System["NETMSG_REDIRECT"] = 65548] = "NETMSG_REDIRECT";
        System[System["NETMSG_RCON_CMD_GROUP_START"] = 65549] = "NETMSG_RCON_CMD_GROUP_START";
        System[System["NETMSG_RCON_CMD_GROUP_END"] = 65550] = "NETMSG_RCON_CMD_GROUP_END";
        System[System["NETMSG_MAP_RELOAD"] = 65551] = "NETMSG_MAP_RELOAD";
        System[System["NETMSG_RECONNECT"] = 65552] = "NETMSG_RECONNECT";
        System[System["NETMSG_MAPLIST_ADD"] = 65553] = "NETMSG_MAPLIST_ADD";
        System[System["NETMSG_MAPLIST_GROUP_START"] = 65554] = "NETMSG_MAPLIST_GROUP_START";
        System[System["NETMSG_MAPLIST_GROUP_END"] = 65555] = "NETMSG_MAPLIST_GROUP_END";
        System[System["NETMSG_I_AM_NPM_PACKAGE"] = 65556] = "NETMSG_I_AM_NPM_PACKAGE";
        System[System["__OFFSET_TEEHISTORIAN_UUID"] = 65557] = "__OFFSET_TEEHISTORIAN_UUID";
        System[System["__OFFSET_GAME_UUID"] = 65558] = "__OFFSET_GAME_UUID"; // https://github.com/swarfeya/ddnet/blob/3be8a592e52a03e555b6aa29a8dea529797bb645/src/engine/shared/teehistorian_ex.h#L11
        // offsets continue in Game enum
    })(System = NETMSG.System || (NETMSG.System = {}));
})(NETMSG || (exports.NETMSG = NETMSG = {}));
