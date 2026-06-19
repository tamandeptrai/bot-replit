const usersFactory = require('../../includes/controllers/users');

function createMockModel() {
    return {
        findAll: jest.fn(),
        findOne: jest.fn(),
        findOrCreate: jest.fn(),
    };
}

function createMockApi() {
    return {
        getUserInfo: jest.fn(),
        httpGet: jest.fn(),
    };
}

function createController(mockModel, mockApi) {
    const models = { use: () => mockModel };
    return usersFactory({ api: mockApi || createMockApi(), models });
}

describe('Users Controller', () => {
    let mockModel, mockApi, controller;

    beforeEach(() => {
        mockModel = createMockModel();
        mockApi = createMockApi();
        controller = createController(mockModel, mockApi);

        global.data = {
            userName: new Map(),
            allUserID: [],
        };
    });

    afterEach(() => {
        delete global.data;
    });

    describe('getInfo', () => {
        it('should return user info from api', async () => {
            const userInfo = { '123': { name: 'TestUser', gender: 'male' } };
            mockApi.getUserInfo.mockResolvedValue(userInfo);

            const result = await controller.getInfo('123');
            expect(result).toEqual({ name: 'TestUser', gender: 'male' });
        });

        it('should return false if api call fails', async () => {
            mockApi.getUserInfo.mockRejectedValue(new Error('API error'));
            const result = await controller.getInfo('123');
            expect(result).toBe(false);
        });
    });

    describe('getNameUser', () => {
        it('should return name from cache if available', async () => {
            global.data.userName.set('123', 'CachedUser');
            const result = await controller.getNameUser('123');
            expect(result).toBe('CachedUser');
        });

        it('should return name from database if user exists', async () => {
            global.data.allUserID.push('123');
            const record = { get: jest.fn().mockReturnValue({ userID: '123', name: 'DBUser' }) };
            mockModel.findOne.mockResolvedValue(record);

            const result = await controller.getNameUser.call(controller, '123');
            expect(result).toBe('DBUser');
        });

        it('should return default name if user not found anywhere', async () => {
            const result = await controller.getNameUser('999');
            expect(result).toBe('Ng\u01b0\u1eddi d\u00f9ng Facebook');
        });
    });

    describe('getAll', () => {
        it('should return all records as plain objects', async () => {
            const records = [
                { get: jest.fn().mockReturnValue({ userID: '1', name: 'A' }) },
                { get: jest.fn().mockReturnValue({ userID: '2', name: 'B' }) },
            ];
            mockModel.findAll.mockResolvedValue(records);

            const result = await controller.getAll({ userID: '1' });
            expect(result).toEqual([
                { userID: '1', name: 'A' },
                { userID: '2', name: 'B' },
            ]);
        });

        it('should accept array as attributes', async () => {
            mockModel.findAll.mockResolvedValue([]);
            await controller.getAll(['userID', 'name']);
            expect(mockModel.findAll).toHaveBeenCalledWith({
                where: undefined,
                attributes: ['userID', 'name'],
            });
        });

        it('should throw if argument is not an object', async () => {
            await expect(controller.getAll('invalid')).rejects.toThrow();
        });
    });

    describe('getData', () => {
        it('should return plain data for existing user', async () => {
            const record = { get: jest.fn().mockReturnValue({ userID: '123', name: 'Test' }) };
            mockModel.findOne.mockResolvedValue(record);

            const result = await controller.getData('123');
            expect(result).toEqual({ userID: '123', name: 'Test' });
        });

        it('should return false for non-existing user', async () => {
            mockModel.findOne.mockResolvedValue(null);
            const result = await controller.getData('999');
            expect(result).toBe(false);
        });

        it('should throw if findOne fails', async () => {
            mockModel.findOne.mockRejectedValue(new Error('DB error'));
            await expect(controller.getData('123')).rejects.toThrow('DB error');
        });
    });

    describe('setData', () => {
        it('should update existing user and return true', async () => {
            const record = { update: jest.fn().mockResolvedValue(true) };
            mockModel.findOne.mockResolvedValue(record);

            const result = await controller.setData('123', { name: 'NewName' });
            expect(result).toBe(true);
        });

        it('should create data if user does not exist', async () => {
            mockModel.findOne.mockResolvedValueOnce(null);
            mockModel.findOrCreate.mockResolvedValue([{}, true]);

            await controller.setData.call(controller, '123', { name: 'New' });
            expect(mockModel.findOrCreate).toHaveBeenCalled();
        });

        it('should throw if options is not an object', async () => {
            await expect(controller.setData('123', 'invalid')).rejects.toThrow();
        });
    });

    describe('delData', () => {
        it('should destroy existing user and return true', async () => {
            const record = { destroy: jest.fn().mockResolvedValue(true) };
            mockModel.findOne.mockResolvedValue(record);

            const result = await controller.delData('123');
            expect(result).toBe(true);
        });

        it('should throw if user does not exist', async () => {
            mockModel.findOne.mockResolvedValue(null);
            await expect(controller.delData('999')).rejects.toThrow();
        });
    });

    describe('createData', () => {
        it('should find or create user and return true', async () => {
            mockModel.findOrCreate.mockResolvedValue([{}, true]);

            const result = await controller.createData('123', { name: 'New' });
            expect(result).toBe(true);
            expect(mockModel.findOrCreate).toHaveBeenCalledWith({
                where: { userID: '123' },
                defaults: { name: 'New' },
            });
        });

        it('should throw if defaults is not an object', async () => {
            await expect(controller.createData('123', 'invalid')).rejects.toThrow();
        });

        it('should throw if findOrCreate fails', async () => {
            mockModel.findOrCreate.mockRejectedValue(new Error('DB error'));
            await expect(controller.createData('123')).rejects.toThrow('DB error');
        });
    });
});
