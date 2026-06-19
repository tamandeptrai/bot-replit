const handleReplyFactory = require('../../includes/handle/handleReply');

describe('handleReply', () => {
    let api, models, Users, Threads, Currencies, handler;

    beforeEach(() => {
        api = { sendMessage: jest.fn() };
        models = {};
        Users = {};
        Threads = {};
        Currencies = {};

        global.client = {
            handleReply: [],
            commands: new Map(),
        };
        global.config = { language: 'vi' };
        global.getText = jest.fn().mockReturnValue('Error message');

        handler = handleReplyFactory({ api, models, Users, Threads, Currencies });
    });

    afterEach(() => {
        delete global.client;
        delete global.config;
        delete global.getText;
    });

    it('should return early if event has no messageReply', () => {
        const event = { messageID: 'msg1', threadID: 'thread1' };
        handler(event);
        expect(api.sendMessage).not.toHaveBeenCalled();
    });

    it('should return early if handleReply array is empty', () => {
        const event = {
            messageID: 'msg1',
            threadID: 'thread1',
            messageReply: { messageID: 'reply1' },
        };
        handler(event);
        expect(api.sendMessage).not.toHaveBeenCalled();
    });

    it('should return early if reply messageID is not found', () => {
        global.client.handleReply = [{ messageID: 'other', name: 'cmd1' }];
        const event = {
            messageID: 'msg1',
            threadID: 'thread1',
            messageReply: { messageID: 'reply1' },
        };
        handler(event);
        expect(api.sendMessage).not.toHaveBeenCalled();
    });

    it('should send error message if command is not found', () => {
        global.client.handleReply = [{ messageID: 'reply1', name: 'unknownCmd' }];
        const event = {
            messageID: 'msg1',
            threadID: 'thread1',
            messageReply: { messageID: 'reply1' },
        };
        handler(event);
        expect(api.sendMessage).toHaveBeenCalled();
        expect(global.getText).toHaveBeenCalledWith('handleReply', 'missingValue');
    });

    it('should execute handleReply method on matched command', () => {
        const mockHandleReply = jest.fn();
        const mockCommand = {
            config: { name: 'testCmd' },
            languages: { vi: { key: 'value' } },
            handleReply: mockHandleReply,
        };
        global.client.commands.set('testCmd', mockCommand);
        global.client.handleReply = [{ messageID: 'reply1', name: 'testCmd' }];

        const event = {
            messageID: 'msg1',
            threadID: 'thread1',
            messageReply: { messageID: 'reply1' },
        };
        handler(event);

        expect(mockHandleReply).toHaveBeenCalledWith(
            expect.objectContaining({
                api,
                event,
                models,
                Users,
                Threads,
                Currencies,
                handleReply: { messageID: 'reply1', name: 'testCmd' },
            })
        );
    });

    it('should handle getText2 when command has no languages', () => {
        const mockHandleReply = jest.fn();
        const mockCommand = {
            config: { name: 'testCmd' },
            handleReply: mockHandleReply,
        };
        global.client.commands.set('testCmd', mockCommand);
        global.client.handleReply = [{ messageID: 'reply1', name: 'testCmd' }];

        const event = {
            messageID: 'msg1',
            threadID: 'thread1',
            messageReply: { messageID: 'reply1' },
        };
        handler(event);

        expect(mockHandleReply).toHaveBeenCalled();
        const callArg = mockHandleReply.mock.calls[0][0];
        expect(typeof callArg.getText).toBe('function');
        expect(callArg.getText('anything')).toBeUndefined();
    });

    it('should send error message if handleReply throws', () => {
        const mockCommand = {
            config: { name: 'testCmd' },
            handleReply: jest.fn().mockImplementation(() => { throw new Error('fail'); }),
        };
        global.client.commands.set('testCmd', mockCommand);
        global.client.handleReply = [{ messageID: 'reply1', name: 'testCmd' }];

        const event = {
            messageID: 'msg1',
            threadID: 'thread1',
            messageReply: { messageID: 'reply1' },
        };
        handler(event);

        expect(api.sendMessage).toHaveBeenCalled();
        expect(global.getText).toHaveBeenCalledWith('handleReply', 'executeError', expect.any(Error));
    });
});
