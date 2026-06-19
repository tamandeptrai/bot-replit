/**
 * Builds the standard context object passed to command handlers.
 * Shared across handleCommand, handleCommandNoprefix, handleReply, and handleReaction.
 */
function buildCommandObj({ api, event, args, models, Users, Threads, Currencies, permssion, getText, extra }) {
    const obj = {
        api,
        event,
        models,
        Users,
        Threads,
        Currencies,
        getText
    };
    if (args !== undefined) obj.args = args;
    if (permssion !== undefined) obj.permssion = permssion;
    if (extra) Object.assign(obj, extra);
    return obj;
}

module.exports = { buildCommandObj };
