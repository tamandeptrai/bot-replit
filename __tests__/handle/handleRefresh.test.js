const handleRefreshFactory = require('../../includes/handle/handleRefresh');

describe('handleRefresh', () => {
    let api, models, Users, Threads, Currencies, handler;
    let mockSetData;

    beforeEach(() => {
        mockSetData = jest.fn().mockResolvedValue(true);
        api = {
            getCurrentUserID: jest.fn().mockReturnValue('botID'),
            getUserInfo: jest.fn(),
        };
        models = {};
        Users = { createData: jest.fn().mockResolvedValue(true) };
        Threads = {
            getData: jest.fn(),
            setData: mockSetData,
            getInfo: jest.fn(),
        };
        Currencies = {};

        handler = handleRefreshFactory({ api, models, Users, Threads, Currencies });
    });

    function createThreadData(overrides = {}) {
        return {
            threadName: 'Test Group',
            participantIDs: ['123', '456'],
            userInfo: [{ id: '123', name: 'User1' }],
            adminIDs: [{ id: '123' }],
            nicknames: {},
            emoji: null,
            color: null,
            threadTheme: null,
            imageSrc: '',
            inviteLink: { link: '', enable: false },
            approvalMode: false,
            ...overrides,
        };
    }

    describe('log:thread-name', () => {
        it('should update thread name', async () => {
            const threadData = createThreadData();
            Threads.getData.mockResolvedValue({ threadInfo: threadData });

            const event = {
                threadID: '100',
                logMessageType: 'log:thread-name',
                logMessageData: { name: 'New Group Name' },
            };
            await handler(event);

            expect(mockSetData).toHaveBeenCalledWith('100', {
                threadInfo: expect.objectContaining({ threadName: 'New Group Name' }),
            });
        });
    });

    describe('log:thread-image', () => {
        it('should update thread image', async () => {
            const threadData = createThreadData();
            Threads.getData.mockResolvedValue({ threadInfo: threadData });

            const event = {
                threadID: '100',
                logMessageType: 'log:thread-image',
                logMessageData: { url: 'https://example.com/img.png' },
            };
            await handler(event);

            expect(mockSetData).toHaveBeenCalledWith('100', {
                threadInfo: expect.objectContaining({ imageSrc: 'https://example.com/img.png' }),
            });
        });
    });

    describe('log:thread-color', () => {
        it('should update thread color, emoji and theme', async () => {
            const threadData = createThreadData();
            Threads.getData.mockResolvedValue({ threadInfo: threadData });

            const event = {
                threadID: '100',
                logMessageType: 'log:thread-color',
                logMessageData: {
                    theme_emoji: '🔥',
                    theme_id: 'theme1',
                    accessibility_label: 'Fire',
                    theme_color: '#FF0000',
                },
            };
            await handler(event);

            expect(mockSetData).toHaveBeenCalledWith('100', {
                threadInfo: expect.objectContaining({
                    emoji: '🔥',
                    color: '#FF0000',
                    threadTheme: { id: 'theme1', accessibility_label: 'Fire' },
                }),
            });
        });
    });

    describe('log:thread-icon', () => {
        it('should update thread emoji', async () => {
            const threadData = createThreadData();
            Threads.getData.mockResolvedValue({ threadInfo: threadData });

            const event = {
                threadID: '100',
                logMessageType: 'log:thread-icon',
                logMessageData: { thread_quick_reaction_emoji: '👍' },
            };
            await handler(event);

            expect(mockSetData).toHaveBeenCalledWith('100', {
                threadInfo: expect.objectContaining({ emoji: '👍' }),
            });
        });
    });

    describe('log:user-nickname', () => {
        it('should set a new nickname', async () => {
            const threadData = createThreadData();
            Threads.getData.mockResolvedValue({ threadInfo: threadData });

            const event = {
                threadID: '100',
                logMessageType: 'log:user-nickname',
                logMessageData: { participant_id: '123', nickname: 'Cool Guy' },
            };
            await handler(event);

            expect(mockSetData).toHaveBeenCalledWith('100', {
                threadInfo: expect.objectContaining({
                    nicknames: { '123': 'Cool Guy' },
                }),
            });
        });

        it('should delete nickname when empty string', async () => {
            const threadData = createThreadData({ nicknames: { '123': 'OldNick' } });
            Threads.getData.mockResolvedValue({ threadInfo: threadData });

            const event = {
                threadID: '100',
                logMessageType: 'log:user-nickname',
                logMessageData: { participant_id: '123', nickname: '' },
            };
            await handler(event);

            expect(threadData.nicknames).not.toHaveProperty('123');
            expect(mockSetData).toHaveBeenCalled();
        });
    });

    describe('log:unsubscribe', () => {
        it('should remove participant from thread', async () => {
            const threadData = createThreadData({
                participantIDs: ['123', '456'],
                userInfo: [{ id: '123', name: 'U1' }, { id: '456', name: 'U2' }],
            });
            Threads.getData.mockResolvedValue({ threadInfo: threadData });

            const event = {
                threadID: '100',
                logMessageType: 'log:unsubscribe',
                logMessageData: { leftParticipantFbId: '456' },
            };
            await handler(event);

            expect(threadData.participantIDs).not.toContain('456');
            expect(threadData.userInfo).not.toContainEqual(expect.objectContaining({ id: '456' }));
            expect(mockSetData).toHaveBeenCalled();
        });

        it('should not modify data if bot itself leaves', async () => {
            const threadData = createThreadData();
            Threads.getData.mockResolvedValue({ threadInfo: threadData });

            const event = {
                threadID: '100',
                logMessageType: 'log:unsubscribe',
                logMessageData: { leftParticipantFbId: 'botID' },
            };
            await handler(event);

            expect(mockSetData).not.toHaveBeenCalled();
        });
    });

    describe('log:thread-admins', () => {
        it('should add admin', async () => {
            const threadData = createThreadData({ adminIDs: [{ id: '123' }] });
            Threads.getData.mockResolvedValue({ threadInfo: threadData });

            const event = {
                threadID: '100',
                logMessageType: 'log:thread-admins',
                logMessageData: { ADMIN_EVENT: 'add_admin', TARGET_ID: '456' },
            };
            await handler(event);

            expect(threadData.adminIDs).toContainEqual({ id: '456' });
            expect(mockSetData).toHaveBeenCalled();
        });

        it('should remove admin', async () => {
            const threadData = createThreadData({ adminIDs: [{ id: '123' }, { id: '456' }] });
            Threads.getData.mockResolvedValue({ threadInfo: threadData });

            const event = {
                threadID: '100',
                logMessageType: 'log:thread-admins',
                logMessageData: { ADMIN_EVENT: 'remove_admin', TARGET_ID: '456' },
            };
            await handler(event);

            expect(threadData.adminIDs).not.toContainEqual({ id: '456' });
            expect(mockSetData).toHaveBeenCalled();
        });
    });

    describe('log:thread-approval-mode', () => {
        it('should set approvalMode to true when APPROVAL_MODE is 1', async () => {
            const threadData = createThreadData({ approvalMode: false });
            Threads.getData.mockResolvedValue({ threadInfo: threadData });

            const event = {
                threadID: '100',
                logMessageType: 'log:thread-approval-mode',
                logMessageData: { APPROVAL_MODE: 1 },
            };
            await handler(event);

            expect(mockSetData).toHaveBeenCalledWith('100', {
                threadInfo: expect.objectContaining({ approvalMode: true }),
            });
        });

        it('should set approvalMode to false when APPROVAL_MODE is 0', async () => {
            const threadData = createThreadData({ approvalMode: true });
            Threads.getData.mockResolvedValue({ threadInfo: threadData });

            const event = {
                threadID: '100',
                logMessageType: 'log:thread-approval-mode',
                logMessageData: { APPROVAL_MODE: 0 },
            };
            await handler(event);

            expect(mockSetData).toHaveBeenCalledWith('100', {
                threadInfo: expect.objectContaining({ approvalMode: false }),
            });
        });
    });

    describe('log:link-status', () => {
        it('should enable invite link', async () => {
            const threadData = createThreadData({
                inviteLink: { link: 'https://fb.com/invite', enable: false },
            });
            Threads.getData.mockResolvedValue({ threadInfo: threadData });

            const event = {
                threadID: '100',
                logMessageType: 'log:link-status',
                logMessageData: { joinable_mode: '1' },
            };
            await handler(event);

            expect(mockSetData).toHaveBeenCalledWith('100', {
                threadInfo: expect.objectContaining({
                    inviteLink: { link: 'https://fb.com/invite', enable: true },
                }),
            });
        });

        it('should disable invite link', async () => {
            const threadData = createThreadData({
                inviteLink: { link: 'https://fb.com/invite', enable: true },
            });
            Threads.getData.mockResolvedValue({ threadInfo: threadData });

            const event = {
                threadID: '100',
                logMessageType: 'log:link-status',
                logMessageData: { joinable_mode: '0' },
            };
            await handler(event);

            expect(mockSetData).toHaveBeenCalledWith('100', {
                threadInfo: expect.objectContaining({
                    inviteLink: { link: 'https://fb.com/invite', enable: false },
                }),
            });
        });

        it('should fetch invite link if not present and enabling', async () => {
            const threadData = createThreadData({
                inviteLink: { link: '', enable: false },
            });
            Threads.getData.mockResolvedValue({ threadInfo: threadData });
            Threads.getInfo.mockResolvedValue({
                inviteLink: { link: 'https://fb.com/new-link' },
            });

            const event = {
                threadID: '100',
                logMessageType: 'log:link-status',
                logMessageData: { joinable_mode: '1' },
            };
            await handler(event);

            expect(Threads.getInfo).toHaveBeenCalledWith('100');
            expect(mockSetData).toHaveBeenCalledWith('100', {
                threadInfo: expect.objectContaining({
                    inviteLink: expect.objectContaining({ enable: true }),
                }),
            });
        });
    });

    describe('default case', () => {
        it('should do nothing for unknown logMessageType', async () => {
            const threadData = createThreadData();
            Threads.getData.mockResolvedValue({ threadInfo: threadData });

            const event = {
                threadID: '100',
                logMessageType: 'unknown-type',
                logMessageData: {},
            };
            await handler(event);

            expect(mockSetData).not.toHaveBeenCalled();
        });
    });
});
