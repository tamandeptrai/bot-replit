jest.mock('../../includes/database/models/users', () => {
    return jest.fn(() => ({ sync: jest.fn() }));
});
jest.mock('../../includes/database/models/threads', () => {
    return jest.fn(() => ({ sync: jest.fn() }));
});
jest.mock('../../includes/database/models/currencies', () => {
    return jest.fn(() => ({ sync: jest.fn() }));
});

const modelFactory = require('../../includes/database/model');

describe('Database Model Factory', () => {
    let input, result;

    beforeEach(() => {
        input = {
            sequelize: {},
            Sequelize: {},
        };
        result = modelFactory(input);
    });

    it('should return an object with model property containing Users, Threads, Currencies', () => {
        expect(result.model).toHaveProperty('Users');
        expect(result.model).toHaveProperty('Threads');
        expect(result.model).toHaveProperty('Currencies');
    });

    it('should have a use() method that returns the correct model', () => {
        expect(typeof result.use).toBe('function');
        expect(result.use('Users')).toBe(result.model.Users);
        expect(result.use('Threads')).toBe(result.model.Threads);
        expect(result.use('Currencies')).toBe(result.model.Currencies);
    });

    it('should return undefined for non-existent model name', () => {
        expect(result.use('NonExistent')).toBeUndefined();
    });

    it('should sync all models with force: false', () => {
        expect(result.model.Users.sync).toHaveBeenCalledWith({ force: false });
        expect(result.model.Threads.sync).toHaveBeenCalledWith({ force: false });
        expect(result.model.Currencies.sync).toHaveBeenCalledWith({ force: false });
    });
});
