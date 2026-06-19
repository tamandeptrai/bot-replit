const stringSimilarity = require('string-similarity');
const logger = require("../../utils/log.js");
const fs = require('fs-extra');
const {
    checkThuebot, checkMaintenance, checkAdminOnly, checkBanned,
    checkCommandBans, checkDisabledCategory, checkCommandBannedMap,
    calculatePermission, checkPermission, checkCooldown
} = require('../utils/commandChecks');
const { createGetText } = require('../utils/getText');
const { buildCommandObj } = require('../utils/commandObj');

global.prefixTO = {};
module.exports = function ({ api, models, Users, Threads, Currencies }) {
    return async function (event) {
        const { ADMINBOT, MAINTENANCE, FACEBOOK_ADMIN, NDH } = global.config;
        const { commandBanned } = global.data;
        const { commands, cooldowns, NPF_commands } = global.client;
        var { body, senderID, threadID, messageID } = event;
        senderID = String(senderID);
        threadID = String(threadID);
        const firstChar = body.trim().split(/\s+/)[0];
        const notCMD = NPF_commands.has(firstChar) ? firstChar : null;

        if (!notCMD || senderID === api.getCurrentUserID()) return;

        const thuebotResult = await checkThuebot({ api, event, senderID, threadID, ADMINBOT });
        if (thuebotResult) return thuebotResult;

        const dateNow = Date.now();
        if (checkMaintenance({ api, senderID, threadID, messageID, ADMINBOT, MAINTENANCE })) return;

        const adminOnlyResult = await checkAdminOnly({ api, event, senderID, threadID, Threads, ADMINBOT });
        if (adminOnlyResult) return adminOnlyResult;

        const bannedResult = await checkBanned({ api, event, Users, Threads, senderID, threadID, messageID, ADMINBOT, NDH, FACEBOOK_ADMIN });
        if (bannedResult) return bannedResult;

        const args = body.trim().split(/\s+/);
        let commandName = args?.shift().toLowerCase();
        var command = NPF_commands.get(commandName);

        const cmdBanResult = await checkCommandBans({ api, event, command, senderID, threadID, messageID, Threads, ADMINBOT });
        if (cmdBanResult) return cmdBanResult;

        const disabledResult = checkDisabledCategory({ api, command, senderID, threadID, ADMINBOT });
        if (disabledResult) return disabledResult;

        const bannedMapResult = checkCommandBannedMap({ api, command, senderID, threadID, messageID, commandBanned, ADMINBOT });
        if (bannedMapResult) return bannedMapResult;

        const permssion = await calculatePermission({ event, senderID, Threads, ADMINBOT, NDH, logger });

        const permResult = checkPermission({ api, command, permssion, event });
        if (permResult) return permResult;

        const cooldownResult = checkCooldown({ api, command, senderID, threadID, messageID, cooldowns, dateNow });
        if (cooldownResult) return cooldownResult;

        const getText2 = createGetText(command);
        try {
            const Obj = buildCommandObj({ api, event, args, models, Users, Threads, Currencies, permssion, getText: getText2 });
            await command.run(Obj);
            return;
        } catch (e) {
            return api.sendMessage(`${e}`, threadID, (err) => {
                if (err) console.error(err);
            }, messageID);
        }
    }
}
