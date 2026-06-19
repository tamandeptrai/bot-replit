const { createBaseController } = require('./baseController');

module.exports = function ({ api, event, models }) {
    const Currencies = models.use('Currencies');
    const base = createBaseController(Currencies, 'userID');

    async function increaseMoney(userID, money) {
        if (typeof money != 'number' || isNaN(money) || money <= 0) throw new Error("Cần một số dương.");
        try {
            const data = await base.getData(userID);
            if (!data) throw new Error("Người dùng không tồn tại.");
            const balance = Number(data.money);
            await base.setData(userID, { money: balance + money });
            return true;
        } catch (error) {
            console.error(error);
            throw new Error(error);
        }
    }

    async function decreaseMoney(userID, money) {
        if (typeof money != 'number' || isNaN(money) || money <= 0) throw new Error("Cần một số dương.");
        try {
            const data = await base.getData(userID);
            if (!data) throw new Error("Người dùng không tồn tại.");
            let balance = Number(data.money);
            if (balance < money) return false;
            await base.setData(userID, { money: balance - money });
            return true;
        } catch (error) {
            console.error(error);
            throw new Error(error);
        }
    }

    return {
        ...base,
        increaseMoney,
        decreaseMoney
    };
};
