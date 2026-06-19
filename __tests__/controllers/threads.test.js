const threadsFactory = require('../../includes/controllers/threads');

function createMockModel() {
    return {
        findAll: jest.fn(),
        findOne: jest.fn(),
        findOrCreate: jest.fn(),
    };
}

function createMockApi() {
    return {
        getThreadInfo: jest.fn(),
    };
}

function createController(mockModel, mockApi) {
    const models = { use: () => mockModel };
    return threadsFactory({ api: mockApi || createMockApi(), event: {}, models });
}

describe('Threads Controller', () => {
    let mockModel, mockApi, controller;

    beforeEach(() => {
        mockModel = createMockModel();
        mockApi = createMockApi();
        controller = createController(mockModel, mockApi);
    });

    describe('getAll', () => {
        it('should return all records as plain objects', async () => {
            const records = [
                { get: jest.fn().mockReturnValue({ threadID: '1', data: {} }) },
                { get: jest.fn().mockReturnValue({ threadID: '2', data: {} }) },
            ];
            mockModel.findAll.mockResolvedValue(records);

            const result = await controller.getAll({ threadID: '1' });
            expect(result).toEqual([
                { threadID: '1', data: {} },
                { threadID: '2', data: {} },
            ]);
        });

        it('should accept array as attributes filter', async () => {
            mockModel.findAll.mockResolvedValue([]);
            await controller.getAll(['threadID']);
            expect(mockModel.findAll).toHaveBeenCalledWith({
                where: undefined,
                attributes: ['threadID'],
            });
        });

        it('should throw if argument is not an object', async () => {
            await expect(controller.getAll('invalid')).rejects.toThrow();
        });

        it('should throw if findAll fails', async () => {
            mockModel.findAll.mockRejectedValue(new Error('DB error'));
            await expect(controller.getAll()).rejects.toThrow('DB error');
        });
    });

    describe('getData', () => {
        it('should return plain data for existing thread', async () => {
            const record = { get: jest.fn().mockReturnValue({ threadID: '123', data: {} }) };
            mockModel.findOne.mockResolvedValue(record);

            const result = await controller.getData('123');
            expect(result).toEqual({ threadID: '123', data: {} });
        });

        it('should return false for non-existing thread', async () => {
            mockModel.findOne.mockResolvedValue(null);
            const result = await controller.getData('999');
            expect(result).toBe(false);
        });

        it('should throw if findOne fails', async () => {
            mockModel.findOne.mockRejectedValue(new Error('DB error'));
            await expect(controller.getData('123')).rejects.toThrow('DB error');
        });
    });

    describe('getInfo', () => {
        it('should call api.getThreadInfo and return result', async () => {
            const threadInfo = { threadID: '123', threadName: 'Test' };
            mockApi.getThreadInfo.mockResolvedValue(threadInfo);

            const result = await controller.getInfo('123');
            expect(result).toEqual(threadInfo);
            expect(mockApi.getThreadInfo).toHaveBeenCalledWith('123');
        });

        it('should throw if api call fails', async () => {
            mockApi.getThreadInfo.mockRejectedValue(new Error('API error'));
            await expect(controller.getInfo('123')).rejects.toThrow('API error');
        });
    });

    describe('setData', () => {
        it('should update existing thread and return true', async () => {
            const record = { update: jest.fn().mockResolvedValue(true) };
            mockModel.findOne.mockResolvedValue(record);

            const result = await controller.setData('123', { data: { key: 'val' } });
            expect(result).toBe(true);
            expect(record.update).toHaveBeenCalledWith({ data: { key: 'val' } });
        });

        it('should create data if thread does not exist', async () => {
            mockModel.findOne.mockResolvedValueOnce(null); // setData findOne
            mockModel.findOrCreate.mockResolvedValue([{}, true]); // createData

            await controller.setData('123', { data: {} });
            expect(mockModel.findOrCreate).toHaveBeenCalled();
        });

        it('should throw if options is not an object', async () => {
            await expect(controller.setData('123', 'invalid')).rejects.toThrow();
        });
    });

    describe('delData', () => {
        it('should destroy existing thread and return true', async () => {
            const record = { destroy: jest.fn().mockResolvedValue(true) };
            mockModel.findOne.mockResolvedValue(record);

            const result = await controller.delData('123');
            expect(result).toBe(true);
            expect(record.destroy).toHaveBeenCalled();
        });

        it('should return false if thread does not exist', async () => {
            mockModel.findOne.mockResolvedValue(null);
            const result = await controller.delData('999');
            expect(result).toBe(false);
        });
    });

    describe('createData', () => {
        it('should find or create thread and return true', async () => {
            mockModel.findOrCreate.mockResolvedValue([{}, true]);

            const result = await controller.createData('123', { data: {} });
            expect(result).toBe(true);
            expect(mockModel.findOrCreate).toHaveBeenCalledWith({
                where: { threadID: '123' },
                defaults: { data: {} },
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
