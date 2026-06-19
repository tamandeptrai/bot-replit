const { createBaseController } = require('./baseController');

module.exports = function ({ api, event, models }) {
    const Threads = models.use('Threads');
    const base = createBaseController(Threads, 'threadID');

    async function getInfo(threadID) {
        try {
            const result = await api.getThreadInfo(threadID);
            return result;
        } catch (error) {
            console.log(error);
            throw new Error(error);
        }
    }

    // Override setData to auto-create if not found (preserving original behavior)
    async function setData(threadID, options = {}) {
        if (typeof options != 'object' && !Array.isArray(options)) throw new Error("Cần một đối tượng.");
        try {
            (await Threads.findOne({ where: { threadID } })).update(options);
            return true;
        } catch (error) {
            try {
                await base.createData(threadID, options);
            } catch (error) {
                console.error(error);
                throw new Error(error);
            }
        }
    }

    return {
        ...base,
        getInfo,
        setData
    };
};
