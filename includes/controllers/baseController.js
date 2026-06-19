/**
 * Base controller factory with shared CRUD methods.
 * Used by users.js, threads.js, and currencies.js controllers.
 */
function createBaseController(Model, idField) {
    async function getAll(...data) {
        var where, attributes;
        for (const i of data) {
            if (typeof i != 'object') throw new Error("Cần một đối tượng hoặc mảng.");
            if (Array.isArray(i)) attributes = i;
            else where = i;
        }
        try {
            return (await Model.findAll({ where, attributes })).map(e => e.get({ plain: true }));
        } catch (error) {
            console.error(error);
            throw new Error(error);
        }
    }

    async function getData(id) {
        try {
            const data = await Model.findOne({ where: { [idField]: id } });
            if (data) return data.get({ plain: true });
            else return false;
        } catch (error) {
            console.error(error);
            throw new Error(error);
        }
    }

    async function setData(id, options = {}) {
        if (typeof options != 'object' && !Array.isArray(options)) throw new Error("Cần một đối tượng.");
        try {
            const record = await Model.findOne({ where: { [idField]: id } });
            if (record) {
                await record.update(options);
                return true;
            }
            throw new Error("Bản ghi không tồn tại.");
        } catch (error) {
            console.error(error);
            throw new Error(error);
        }
    }

    async function delData(id) {
        try {
            const record = await Model.findOne({ where: { [idField]: id } });
            if (record) {
                await record.destroy();
                return true;
            }
            return false;
        } catch (error) {
            console.error(error);
            throw new Error(error);
        }
    }

    async function createData(id, defaults = {}) {
        if (typeof defaults != 'object' && !Array.isArray(defaults)) throw new Error("Cần một đối tượng.");
        try {
            await Model.findOrCreate({ where: { [idField]: id }, defaults });
            return true;
        } catch (error) {
            console.error(error);
            throw new Error(error);
        }
    }

    return { getAll, getData, setData, delData, createData };
}

module.exports = { createBaseController };
