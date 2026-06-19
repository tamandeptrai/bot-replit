const handleReactionFactory = require('../../includes/handle/handleReaction');

describe('handleReaction', () => {
    let api, models, Users, Threads, Currencies, handler;

    beforeEach(() => {
        api = { sendMessage: jest.fn() };
        models = {};
        Users = {};
        Threads = {};
        Currencies = {};

        global.client = {
            handleReaction: [],
            commands: new Map(),
        };
        global.config = { language: 'vi' };
        global.getText = jest.fn().mockReturnValue('Error message');

        handler = handleReactionFactory({ api, models, Users, Threads, Currencies });
    });

    afterEach(() => {
        delete global.client;
        delete global.config;
        delete global.getText;
    });

    it('should return early if handleReaction array is empty', async () => {
        const event = { messageID: 'msg1', threadID: 'thread1' };
        await handler(event);
        expect(api.sendMessage).not.toHaveBeenCalled();
    });

    it('should return early if messageID is not found in handleReaction', async () => {
        global.client.handleReaction = [{ messageID: 'other', name: 'cmd1' }];
        const event = { messageID: 'msg1', threadID: 'thread1' };
        await handler(event);
        expect(api.sendMessage).not.toHaveBeenCalled();
    });

    it('should send error message if command is not found', async () => {
        global.client.handleReaction = [{ messageID: 'msg1', name: 'unknownCmd' }];
        const event = { messageID: 'msg1', threadID: 'thread1' };
        await handler(event);
        expect(api.sendMessage).toHaveBeenCalled();
        expect(global.getText).toHaveBeenCalledWith('handleReaction', 'missingValue');
    });

    it('should execute handleReaction method on matched command', async () => {
        const mockHandleReaction = jest.fn();
        const mockCommand = {
            config: { name: 'testCmd' },
            languages: { vi: { greeting: 'Xin chao' } },
            handleReaction: mockHandleReaction,
        };
        global.client.commands.set('testCmd', mockCommand);
        global.client.handleReaction = [{ messageID: 'msg1', name: 'testCmd' }];

        const event = { messageID: 'msg1', threadID: 'thread1' };
        await handler(event);

        expect(mockHandleReaction).toHaveBeenCalledWith(
            expect.objectContaining({
                api,
                event,
                models,
                Users,
                Threads,
                Currencies,
                handleReaction: { messageID: 'msg1', name: 'testCmd' },
            })
        );
    });

    it('should handle getText2 when command has no languages', async () => {
        const mockHandleReaction = jest.fn();
        const mockCommand = {
            config: { name: 'testCmd' },
            handleReaction: mockHandleReaction,
        };
        global.client.commands.set('testCmd', mockCommand);
        global.client.handleReaction = [{ messageID: 'msg1', name: 'testCmd' }];

        const event = { messageID: 'msg1', threadID: 'thread1' };
        await handler(event);

        expect(mockHandleReaction).toHaveBeenCalled();
        const callArg = mockHandleReaction.mock.calls[0][0];
        expect(typeof callArg.getText).toBe('function');
        expect(callArg.getText('anything')).toBeUndefined();
    });

    it('should send error message if handleReaction throws', async () => {
        const mockCommand = {
            config: { name: 'testCmd' },
            handleReaction: jest.fn().mockImplementation(() => { throw new Error('fail'); }),
        };
        global.client.commands.set('testCmd', mockCommand);
        global.client.handleReaction = [{ messageID: 'msg1', name: 'testCmd' }];

        const event = { messageID: 'msg1', threadID: 'thread1' };
        await handler(event);

        expect(api.sendMessage).toHaveBeenCalled();
        expect(global.getText).toHaveBeenCalledWith('handleReaction', 'executeError', expect.any(Error));
    });
});
