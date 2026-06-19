const stringSimilarity = require('string-similarity');
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const logger = require("../../utils/log.js");
const fs = require('fs-extra');
const axios = require("axios");
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
        const { PREFIX, ADMINBOT, MAINTENANCE, FACEBOOK_ADMIN, NDH } = global.config;
        const { commandBanned } = global.data;
        const { commands, cooldowns } = global.client;
        var { body, senderID, threadID, messageID } = event;
        senderID = String(senderID);
        threadID = String(threadID);
        if (!prefixTO[threadID]) {
            const threadData = await Threads.getData(String(threadID));
            const threadSetting = threadData?.data || {};
            const prefix = threadSetting.PREFIX || global.config.PREFIX;
            prefixTO[threadID] = prefix;
        }

        const prefixRegex = new RegExp(`^(<@!?${senderID}>|${escapeRegex(prefixTO[threadID])})\\s*`);

        if (!prefixRegex.test(body)) return;

        if ((prefixTO[threadID] + 'bank') != event.body[0]) {
            const thuebotResult = await checkThuebot({ api, event, senderID, threadID, ADMINBOT });
            if (thuebotResult) return thuebotResult;
        }

        const dateNow = Date.now();
        if (checkMaintenance({ api, senderID, threadID, messageID, ADMINBOT, MAINTENANCE })) return;

        const adminOnlyResult = await checkAdminOnly({ api, event, senderID, threadID, Threads, ADMINBOT });
        if (adminOnlyResult) return adminOnlyResult;

        const bannedResult = await checkBanned({ api, event, Users, Threads, senderID, threadID, messageID, ADMINBOT, NDH, FACEBOOK_ADMIN });
        if (bannedResult) return bannedResult;

        const [matchedPrefix] = body.match(prefixRegex),
            args = body.slice(matchedPrefix.length).trim().split(/ +/);
        let commandName = args.shift().toLowerCase();
        var command = commands.get(commandName);
        if (!command) {
            var allCommandName = [];
            const commandValues = commands['keys']();
			const response = await axios.get('https://raw.githubusercontent.com/Sang070801/api/main/thinh1.json');
			const data = response.data;
			const thinhArray = Object.values(data.data);
			const randomThinh = thinhArray[Math.floor(Math.random() * thinhArray.length)];
			const name = await Users.getNameUser(event.senderID);
			const moment = require("moment-timezone");
			const t = process.uptime();
            const h = Math.floor(t / (60 * 60));
            const p = Math.floor((t % (60 * 60)) / 60);
            const s = Math.floor(t % 60);
            var gio = moment.tz("Asia/Ho_Chi_Minh").format("D/MM/YYYY || HH:mm:ss");
            var thu = moment.tz('Asia/Ho_Chi_Minh').format('dddd');
            if (thu == 'Sunday') thu = 'Chủ nhật'
            if (thu == 'Monday') thu = 'Thứ 2'
            if (thu == 'Tuesday') thu = 'Thứ 3'
            if (thu == 'Wednesday') thu = 'Thứ 4'
            if (thu == "Thursday") thu = 'Thứ 5'
            if (thu == 'Friday') thu = 'Thứ 6'
            if (thu == 'Saturday') thu = 'Thứ 7'
            for (const cmd of commandValues) allCommandName.push(cmd);
            const checker = stringSimilarity.findBestMatch(commandName, allCommandName);
            if (checker.bestMatch.rating >= 0.5) {
                command = client.commands.get(checker.bestMatch.target);
            } else {
                return api.sendMessage({
				body: `👤 ${name} !\n🔎 Lệnh không tồn tại!\n📌 lệnh gần giống là " ${checker.bestMatch.target} "\n📝 Thính: ${randomThinh}\n────────────────────\n⏳ Uptime: ${h}:${p}:${s}\n⏱ ${thu} || ${gio}`,
					attachment: global.anime.splice(0, 1)
                }, event.threadID, async (err, info) => {
					await new Promise(resolve => setTimeout(resolve, 60 * 1000));
					return api.unsendMessage(info.messageID);
					}, event.messageID);
            }
        }

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
            await command?.run(Obj);
            return;
        } catch (e) {
            console.error('Lỗi xảy ra:', e);
            let errorMessage = e instanceof Error ? e.stack || e.message : JSON.stringify(e);
            return api.sendMessage(`${errorMessage}`, threadID, (err) => {
                if (err) console.error('Lỗi khi gửi tin nhắn:', err);
            }, messageID);
        }
    }
}
