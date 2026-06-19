const handleCreateDatabaseFactory = require('../../includes/handle/handleCreateDatabase');

describe('handleCreateDatabase', () => {
    let Users, Threads, Currencies, handler;

    beforeEach(() => {
        Users = {
            getInfo: jest.fn(),
            createData: jest.fn().mockResolvedValue(true),
            setData: jest.fn().mockResolvedValue(true),
            getData: jest.fn(),
        };
        Threads = {
            getInfo: jest.fn(),
            setData: jest.fn().mockResolvedValue(true),
        };
        Currencies = {
            createData: jest.fn().mockResolvedValue(true),
        };
        handler = handleCreateDatabaseFactory({ Users, Threads, Currencies });

        global.data = {
            allUserID: [],
            allCurrenciesID: [],
            allThreadID: [],
            userName: new Map(),
            threadInfo: new Map(),
        };
        global.config = { autoCreateDB: true };
    });

    afterEach(() => {
        delete global.data;
        delete global.config;
    });

    it('should return early if autoCreateDB is disabled', async () => {
        global.config.autoCreateDB = false;
        const event = { senderID: '123', threadID: '456', isGroup: true };
        await handler(event);
        expect(Threads.getInfo).not.toHaveBeenCalled();
        expect(Users.getInfo).not.toHaveBeenCalled();
    });

    it('should create thread data for new group thread', async () => {
        const threadIn4 = {
            threadID: '456',
            threadName: 'Test Group',
            participantIDs: ['123', '789'],
            userInfo: [
                { id: '123', name: 'User1', gender: 'MALE' },
                { id: '789', name: 'User2', gender: 'FEMALE' },
            ],
            isGroup: true,
            emoji: null,
            color: null,
            threadTheme: null,
            nicknames: {},
            adminIDs: [],
            approvalMode: false,
            imageSrc: '',
            inviteLink: '',
        };
        Threads.getInfo.mockResolvedValue(threadIn4);
        Users.getInfo.mockResolvedValue({ name: 'User1', gender: 'MALE' });

        const event = { senderID: '123', threadID: '456', isGroup: true };
        await handler(event);

        expect(global.data.allThreadID).toContain('456');
        expect(global.data.threadInfo.has('456')).toBe(true);
        expect(Threads.setData).toHaveBeenCalledWith('456', expect.objectContaining({
            threadInfo: expect.any(Object),
            data: {},
        }));
    });

    it('should create user data for new sender', async () => {
        Users.getInfo.mockResolvedValue({ name: 'NewUser', gender: 'MALE' });

        const event = { senderID: '999', threadID: '456', isGroup: false };
        await handler(event);

        expect(Users.createData).toHaveBeenCalledWith('999', {
            name: 'NewUser',
            gender: 'MALE',
        });
        expect(global.data.allUserID).toContain('999');
        expect(global.data.userName.get('999')).toBe('NewUser');
    });

    it('should create currencies data for new sender', async () => {
        Users.getInfo.mockResolvedValue({ name: 'NewUser', gender: 'MALE' });

        const event = { senderID: '999', threadID: '456', isGroup: false };
        await handler(event);

        expect(Currencies.createData).toHaveBeenCalledWith('999', { data: {} });
        expect(global.data.allCurrenciesID).toContain('999');
    });

    it('should skip thread creation if thread already exists', async () => {
        global.data.allThreadID.push('456');
        Users.getInfo.mockResolvedValue({ name: 'User', gender: 'MALE' });

        const event = { senderID: '123', threadID: '456', isGroup: true };
        await handler(event);

        expect(Threads.getInfo).not.toHaveBeenCalled();
    });

    it('should skip user creation if user already exists and cached', async () => {
        global.data.allUserID.push('123');
        global.data.userName.set('123', 'ExistingUser');
        global.data.allCurrenciesID.push('123');

        const event = { senderID: '123', threadID: '456', isGroup: false };
        await handler(event);

        expect(Users.getInfo).not.toHaveBeenCalled();
        expect(Users.createData).not.toHaveBeenCalled();
    });

    it('should skip currencies creation if currencies ID already exists', async () => {
        global.data.allUserID.push('123');
        global.data.userName.set('123', 'User');
        global.data.allCurrenciesID.push('123');

        const event = { senderID: '123', threadID: '456', isGroup: false };
        await handler(event);

        expect(Currencies.createData).not.toHaveBeenCalled();
    });

    it('should handle users with undefined gender in thread userInfo', async () => {
        const threadIn4 = {
            threadID: '456',
            threadName: 'Test',
            participantIDs: ['123'],
            userInfo: [{ id: '123', name: 'Bot' }], // no gender
            isGroup: true,
            emoji: null,
            color: null,
            threadTheme: null,
            nicknames: {},
            adminIDs: [],
            approvalMode: false,
            imageSrc: '',
            inviteLink: '',
        };
        Threads.getInfo.mockResolvedValue(threadIn4);
        Users.getInfo.mockResolvedValue({ name: 'User', gender: 'MALE' });

        const event = { senderID: '123', threadID: '456', isGroup: true };
        await handler(event);

        // Should not create data for users without gender
        expect(Users.createData).toHaveBeenCalledTimes(1); // Only for the sender
    });
});
