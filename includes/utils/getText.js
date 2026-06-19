/**
 * Creates a getText function for a command's language support.
 * Shared across handleCommand, handleCommandNoprefix, handleReply, and handleReaction.
 */
function createGetText(command) {
    if (command && command.languages && typeof command.languages === 'object' && command.languages.hasOwnProperty(global.config.language)) {
        return (...values) => {
            var lang = command.languages[global.config.language][values[0]] || '';
            for (var i = 1; i < values.length; i++) {
                const expReg = RegExp('%' + i, 'g');
                lang = lang.replace(expReg, values[i]);
            }
            return lang;
        };
    }
    return () => {};
}

module.exports = { createGetText };
