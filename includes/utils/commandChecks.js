/**
 * Shared validation/check logic used by both handleCommand.js and handleCommandNoprefix.js.
 * Each function returns a truthy value (typically an api.sendMessage call) if the check
 * should halt further processing, or a falsy value to continue.
 */
const fs = require('fs-extra');

function formMmDdYyyy(input = '', split = input.split('/')) {
    return `${split[1]}/${split[0]}/${split[2]}`;
}

async function checkThuebot({ api, event, senderID, threadID, ADMINBOT }) {
    if (event.senderID == api.getCurrentUserID() || ADMINBOT.includes(senderID)) return null;

    let thuebot;
    try {
        thuebot = JSON.parse(fs.readFileSync(process.cwd() + '/modules/data/thuebot.json'));
    } catch {
        thuebot = [];
    }

    const find_thuebot = thuebot.find($ => $.t_id == threadID);

    if (!find_thuebot) {
        return api.sendMessage(
            `❎ Nhóm của bạn chưa thuê bot, vui lòng reply tin nhắn này và nhập key thuê bot hoặc liên hệ Admin để lấy key thuê bot\nfb: ${(!global.config.FACEBOOK_ADMIN) ? "Exclude Admin if not configured!" : global.config.FACEBOOK_ADMIN}`,
            event.threadID,
            (e, i) => {
                global.client.handleReply.push({
                    name: 'rent',
                    messageID: i.messageID,
                    threadID: event.threadID,
                    type: 'RentKey'
                });
            }
        );
    }

    if (new Date(formMmDdYyyy(find_thuebot.time_end)).getTime() <= Date.now() + 25200000) {
        return api.sendMessage(
            `⚠️ Thời hạn sử dụng bot của nhóm bạn đã hết. Vui lòng reply tin nhắn này và nhập mã key mới, hoặc liên hệ Admin để được hỗ trợ.\nfb: ${(!global.config.FACEBOOK_ADMIN) ? "Exclude Admin if not configured!" : global.config.FACEBOOK_ADMIN}`,
            event.threadID,
            (e, i) => {
                global.client.handleReply.push({
                    name: 'rent',
                    messageID: i.messageID,
                    threadID: event.threadID,
                    type: 'RentKey'
                });
            }
        );
    }

    return null;
}

function checkMaintenance({ api, senderID, threadID, messageID, ADMINBOT, MAINTENANCE }) {
    if (!ADMINBOT.includes(senderID) && MAINTENANCE) {
        return api.sendMessage('⚠️ Bot đang được bảo trì, vui lòng sử dụng sau', threadID, messageID);
    }
    return null;
}

async function checkAdminOnly({ api, event, senderID, threadID, Threads, ADMINBOT }) {
    const DT = "./modules/data/data.json";
    const threadInf = await Threads.getData(event.threadID);
    const findd = threadInf?.threadInfo?.adminIDs?.find(el => el.id == senderID);
    const Dataqtv = JSON.parse(await fs.readFile(DT, 'utf-8'));

    if (Dataqtv) {
        const threadEntry = Dataqtv?.find(entry => entry.threadID === threadID);
        if (threadEntry && !findd && !ADMINBOT.includes(senderID)) {
            return api.sendMessage('Chỉ quản trị viên nhóm mới có thể sử dụng bot ⚠️', event.threadID, event.messageID);
        }
    }
    return null;
}

async function checkBanned({ api, event, Users, Threads, senderID, threadID, messageID, ADMINBOT, NDH, FACEBOOK_ADMIN }) {
    const userBanned = (await Users.getData(event.senderID)).data;
    const threadBanned = (await Threads.getData(event.threadID)).data;
    const bannedData = userBanned?.banned ? userBanned : threadBanned?.banned ? threadBanned : null;
    if (bannedData && !ADMINBOT.includes(event.senderID) && !NDH.includes(event.senderID)) {
        const reason = bannedData.reason || "admin thích=))";
        const message = userBanned?.banned
            ? `⛔ Hiện tại bạn đang bị ban\nLý do: ${reason}\nAdmin: ${FACEBOOK_ADMIN}`
            : `⛔ Hiện tại nhóm của bạn đang bị ban\nLý do: ${reason}\nAdmin: ${FACEBOOK_ADMIN}`;

        return api.sendMessage(message, threadID, async (err, info) => {
            await new Promise(resolve => setTimeout(resolve, 5 * 1000));
            return api.unsendMessage(info.messageID);
        }, messageID);
    }
    return null;
}

async function checkCommandBans({ api, event, command, senderID, threadID, messageID, Threads, ADMINBOT }) {
    const path = __dirname + '/../../modules/data/commands-banned.json';
    let data = {};
    if (fs.existsSync(path)) data = JSON.parse(fs.readFileSync(path));

    const isQtvBox = async (id) => {
        const threadData = await Threads.getData(event.threadID);
        return threadData?.threadInfo?.adminIDs?.some($ => $.id == id);
    };

    const name = id => global.data.userName.get(id);
    const cmd = command?.config.name;

    if (data[threadID]) {
        const ban = data[threadID].cmds.find($ => $.cmd == cmd);
        if (ban) {
            if (ADMINBOT.includes(ban.author) && ban.author != senderID) {
                return api.sendMessage(`❎ ${ban.time} admin bot: ${name(ban.author)}\nĐã cấm nhóm sử dụng lệnh ${cmd}`, threadID, messageID);
            }
            if (await isQtvBox(ban.author) && ban.author != senderID) {
                return api.sendMessage(`❎ ${ban.time} qtv nhóm: ${name(ban.author)}\nĐã cấm thành viên sử dụng lệnh ${cmd}`, threadID, messageID);
            }
        }
        const all = (data[threadID].users[senderID] || {}).all;
        if (all) {
            if (all.status == true && ADMINBOT.includes(all.author) && !ADMINBOT.includes(senderID)) {
                return api.sendMessage(`❎ ${all.time} bạn đã bị admin bot: ${name(all.author)} cấm`, threadID, messageID);
            }
            if (all.status == true && await isQtvBox(all.author) && !await isQtvBox(senderID) && !ADMINBOT.includes(senderID)) {
                return api.sendMessage(`❎ ${all.time} bạn đã bị qtv box: ${name(all.author)} cấm`, threadID, messageID);
            }
        }
        const userBan = (data[threadID].users[senderID] || { cmds: [] }).cmds.find($ => $.cmd == cmd);
        if (userBan) {
            if (ADMINBOT.includes(userBan.author) && !ADMINBOT.includes(senderID)) {
                return api.sendMessage(`❎ ${userBan.time} admin bot: ${name(userBan.author)}\nĐã cấm bạn sử dụng lệnh ${cmd}`, threadID, messageID);
            }
            if (await isQtvBox(userBan.author) && !await isQtvBox(senderID) && !ADMINBOT.includes(senderID)) {
                return api.sendMessage(`❎ ${userBan.time} qtv nhóm: ${name(userBan.author)}\nĐã cấm bạn sử dụng lệnh ${cmd}`, threadID, messageID);
            }
        }
    }
    return null;
}

function checkDisabledCategory({ api, command, senderID, threadID, ADMINBOT }) {
    const disablePath = process.cwd() + '/modules/data/disable-command.json';
    if (fs.existsSync(disablePath)) {
        if (!ADMINBOT.includes(senderID) && JSON.parse(fs.readFileSync(disablePath))[threadID]?.[command.config.commandCategory] == true) {
            return api.sendMessage(`❎ Box không được phép sử dụng các lệnh thuộc nhóm '${command.config.commandCategory}'`, threadID);
        }
    }
    return null;
}

function checkCommandBannedMap({ api, command, senderID, threadID, messageID, commandBanned, ADMINBOT }) {
    if (commandBanned.get(threadID) || commandBanned.get(senderID)) {
        if (!ADMINBOT.includes(senderID)) {
            const banThreads = commandBanned.get(threadID) || [];
            const banUsers = commandBanned.get(senderID) || [];
            if (banThreads.includes(command.config.name)) {
                return api.sendMessage(global.getText("handleCommand", "commandThreadBanned", command.config.name), threadID, async (err, info) => {
                    await new Promise(resolve => setTimeout(resolve, 5 * 1000));
                    return api.unsendMessage(info.messageID);
                }, messageID);
            }
            if (banUsers.includes(command.config.name)) {
                return api.sendMessage(global.getText("handleCommand", "commandUserBanned", command.config.name), threadID, async (err, info) => {
                    await new Promise(resolve => setTimeout(resolve, 5 * 1000));
                    return api.unsendMessage(info.messageID);
                }, messageID);
            }
        }
    }
    return null;
}

async function calculatePermission({ event, senderID, Threads, ADMINBOT, NDH, logger }) {
    var threadInfo2;
    if (event.isGroup == true) {
        try {
            threadInfo2 = (await Threads.getData(event.threadID)).threadInfo;
            if (Object.keys(threadInfo2).length == 0) throw new Error();
        } catch (err) {
            if (logger) logger(`Không thể lấy thông tin của nhóm, lỗi: ${err}`, "error");
        }
    }
    const find = threadInfo2?.adminIDs?.find(el => el.id == senderID);
    let permssion = 0;
    if (ADMINBOT.includes(senderID.toString())) permssion = 3;
    else if (NDH.includes(senderID.toString())) permssion = 2;
    else if (!ADMINBOT.includes(senderID) && find) permssion = 1;
    return permssion;
}

function checkPermission({ api, command, permssion, event }) {
    var quyenhan = "";
    if (command?.config.hasPermssion == 1) quyenhan = "Quản Trị Viên";
    else if (command?.config.hasPermssion == 2) quyenhan = "SUPPORTBOT";
    else if (command?.config.hasPermssion == 3) quyenhan = "ADMINBOT";

    if (command?.config.hasPermssion > permssion) {
        return api.sendMessage(global.getText("handleCommand", "permssionNotEnough", command.config.name, quyenhan), event.threadID, event.messageID);
    }
    return null;
}

function checkCooldown({ api, command, senderID, threadID, messageID, cooldowns, dateNow }) {
    if (!cooldowns.has(command.config.name)) cooldowns.set(command.config.name, new Map());
    const timestamps = cooldowns.get(command.config.name);
    const expirationTime = (command.config.cooldowns || 1) * 1000;

    if (timestamps.has(senderID)) {
        const expiration = timestamps.get(senderID) + expirationTime;
        if (dateNow < expiration) {
            const timeLeft = ((expiration - dateNow) / 1000).toFixed(1);
            return api.sendMessage(`🔄 Vui lòng quay lại sau ${timeLeft} giây`, threadID, messageID);
        }
    }
    timestamps.set(senderID, dateNow);
    return null;
}

module.exports = {
    checkThuebot,
    checkMaintenance,
    checkAdminOnly,
    checkBanned,
    checkCommandBans,
    checkDisabledCategory,
    checkCommandBannedMap,
    calculatePermission,
    checkPermission,
    checkCooldown
};
