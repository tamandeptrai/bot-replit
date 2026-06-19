const { createGetText } = require('../utils/getText');
const { buildCommandObj } = require('../utils/commandObj');

module.exports = function ({ api, models, Users, Threads, Currencies }) {
    return function (event ) {
        if (!event.messageReply) return;
        const { handleReply, commands } = global.client
        const { messageID, threadID, messageReply } = event;
        if (handleReply.length !== 0) {
            const indexOfHandle = handleReply.findIndex(e => e.messageID == messageReply.messageID);
            if (indexOfHandle < 0) return;
            const indexOfMessage = handleReply[indexOfHandle];
            const handleNeedExec = commands.get(indexOfMessage.name);
            if (!handleNeedExec) return api.sendMessage(global.getText('handleReply', 'missingValue'), threadID, messageID);
            try {
                const getText2 = createGetText(handleNeedExec);
                const Obj = buildCommandObj({
                    api, event, models, Users, Threads, Currencies,
                    getText: getText2,
                    extra: { handleReply: indexOfMessage }
                });
                handleNeedExec.handleReply(Obj);
                return;
            } catch (error) {
                return api.sendMessage(global.getText('handleReply', 'executeError', error), threadID, messageID);
            }
        }
    };
}
