const currenciesFactory = require('../../includes/controllers/currencies');

function createMockModel() {
    return {
        findAll: jest.fn(),
        findOne: jest.fn(),
        findOrCreate: jest.fn(),
    };
}

function createController(mockModel) {
    const models = { use: () => mockModel };
    return currenciesFactory({ api: {}, event: {}, models });
}

describe('Currencies Controller', () => {
    let mockModel, controller;

    beforeEach(() => {
        mockModel = createMockModel();
        controller = createController(mockModel);
    });

    describe('getAll', () => {
        it('should return all records as plain objects', async () => {
            const records = [
                { get: jest.fn().mockReturnValue({ userID: 1, money: 100 }) },
                { get: jest.fn().mockReturnValue({ userID: 2, money: 200 }) },
            ];
            mockModel.findAll.mockResolvedValue(records);

            const result = await controller.getAll({ userID: 1 });
            expect(result).toEqual([
                { userID: 1, money: 100 },
                { userID: 2, money: 200 },
            ]);
            expect(mockModel.findAll).toHaveBeenCalledWith({
                where: { userID: 1 },
                attributes: undefined,
            });
        });

        it('should accept array as attributes filter', async () => {
            mockModel.findAll.mockResolvedValue([]);
            await controller.getAll(['userID', 'money']);
            expect(mockModel.findAll).toHaveBeenCalledWith({
                where: undefined,
                attributes: ['userID', 'money'],
            });
        });

        it('should accept both where and attributes', async () => {
            mockModel.findAll.mockResolvedValue([]);
            await controller.getAll({ userID: 1 }, ['money']);
            expect(mockModel.findAll).toHaveBeenCalledWith({
                where: { userID: 1 },
                attributes: ['money'],
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
        it('should return plain data for existing user', async () => {
            const record = { get: jest.fn().mockReturnValue({ userID: '123', money: 500 }) };
            mockModel.findOne.mockResolvedValue(record);

            const result = await controller.getData('123');
            expect(result).toEqual({ userID: '123', money: 500 });
            expect(mockModel.findOne).toHaveBeenCalledWith({ where: { userID: '123' } });
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

            const result = await controller.setData('123', { money: 1000 });
            expect(result).toBe(true);
            expect(record.update).toHaveBeenCalledWith({ money: 1000 });
        });

        it('should throw if user does not exist', async () => {
            mockModel.findOne.mockResolvedValue(null);
            await expect(controller.setData('999', { money: 100 })).rejects.toThrow();
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
            expect(record.destroy).toHaveBeenCalled();
        });

        it('should throw if user does not exist', async () => {
            mockModel.findOne.mockResolvedValue(null);
            await expect(controller.delData('999')).rejects.toThrow();
        });
    });

    describe('createData', () => {
        it('should find or create user and return true', async () => {
            mockModel.findOrCreate.mockResolvedValue([{}, true]);

            const result = await controller.createData('123', { money: 0 });
            expect(result).toBe(true);
            expect(mockModel.findOrCreate).toHaveBeenCalledWith({
                where: { userID: '123' },
                defaults: { money: 0 },
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

    describe('increaseMoney', () => {
        it('should increase user balance and return true', async () => {
            const record = { get: jest.fn().mockReturnValue({ userID: '123', money: 500 }) };
            const updateRecord = { update: jest.fn().mockResolvedValue(true) };
            mockModel.findOne
                .mockResolvedValueOnce(record)   // getData call
                .mockResolvedValueOnce(updateRecord); // setData call

            const result = await controller.increaseMoney('123', 200);
            expect(result).toBe(true);
            expect(updateRecord.update).toHaveBeenCalledWith({ money: 700 });
        });

        it('should throw for non-positive money', async () => {
            await expect(controller.increaseMoney('123', 0)).rejects.toThrow();
            await expect(controller.increaseMoney('123', -10)).rejects.toThrow();
        });

        it('should throw for non-number money', async () => {
            await expect(controller.increaseMoney('123', 'abc')).rejects.toThrow();
        });

        it('should throw for NaN money', async () => {
            await expect(controller.increaseMoney('123', NaN)).rejects.toThrow();
        });

        it('should throw if user does not exist', async () => {
            mockModel.findOne.mockResolvedValue(null);
            await expect(controller.increaseMoney('999', 100)).rejects.toThrow();
        });
    });

    describe('decreaseMoney', () => {
        it('should decrease user balance and return true', async () => {
            const record = { get: jest.fn().mockReturnValue({ userID: '123', money: 500 }) };
            const updateRecord = { update: jest.fn().mockResolvedValue(true) };
            mockModel.findOne
                .mockResolvedValueOnce(record)
                .mockResolvedValueOnce(updateRecord);

            const result = await controller.decreaseMoney('123', 200);
            expect(result).toBe(true);
            expect(updateRecord.update).toHaveBeenCalledWith({ money: 300 });
        });

        it('should return false if balance is insufficient', async () => {
            const record = { get: jest.fn().mockReturnValue({ userID: '123', money: 50 }) };
            mockModel.findOne.mockResolvedValue(record);

            const result = await controller.decreaseMoney('123', 100);
            expect(result).toBe(false);
        });

        it('should throw for non-positive money', async () => {
            await expect(controller.decreaseMoney('123', 0)).rejects.toThrow();
            await expect(controller.decreaseMoney('123', -10)).rejects.toThrow();
        });

        it('should throw for non-number money', async () => {
            await expect(controller.decreaseMoney('123', 'abc')).rejects.toThrow();
        });

        it('should throw if user does not exist', async () => {
            mockModel.findOne.mockResolvedValue(null);
            await expect(controller.decreaseMoney('999', 100)).rejects.toThrow();
        });
    });
});
