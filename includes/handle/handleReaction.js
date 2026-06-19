const { createGetText } = require('../utils/getText');
const { buildCommandObj } = require('../utils/commandObj');

module.exports = function ({ api, models, Users, Threads, Currencies }) {
    return async function (event ) {
        const { handleReaction, commands } = global.client;
        const { messageID, threadID } = event;
        if (handleReaction.length !== 0) {
            const indexOfHandle = handleReaction.findIndex(e => e.messageID == messageID);
            if (indexOfHandle < 0) return;
            const indexOfMessage = handleReaction[indexOfHandle];
            const handleNeedExec = commands.get(indexOfMessage.name);

            if (!handleNeedExec) return api.sendMessage(global.getText('handleReaction', 'missingValue'), threadID, messageID);
            try {
                const getText2 = createGetText(handleNeedExec);
                const Obj = buildCommandObj({
                    api, event, models, Users, Threads, Currencies,
                    getText: getText2,
                    extra: { handleReaction: indexOfMessage }
                });
                handleNeedExec.handleReaction(Obj);
                return;
            } catch (error) {
                return api.sendMessage(global.getText('handleReaction', 'executeError', error), threadID, messageID);
            }
        }
    };
};
