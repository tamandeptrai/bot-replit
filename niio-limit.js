process.on('uncaughtException', error => {
    console.error('Unhandled Exception:', error);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
const moment = require("moment-timezone");
const fs = require('fs');
const logger = require("./utils/log");
const chalk = require('chalk');
const figlet = require('figlet');
//const login = require('./includes/login');
const login = require('./includes/hzi');
const path = require('path');
const { Controller } = require('./utils/facebook/index');
const z = ['1a0b0c0', '3d5e4f2', '1g8h1i4', '0j9k9l']

global.client = {
    commands: new Map(),
    NPF_commands: new Map(),
    events: new Map(),
    cooldowns: new Map(),
    eventRegistered: [],
    handleReaction: [],
    handleReply: [],
    getTime: option => moment.tz("Asia/Ho_Chi_minh").format({
        seconds: "ss",
        minutes: "mm",
        hours: "HH",
        day: "dddd",
        date: "DD",
        month: "MM",
        year: "YYYY",
        fullHour: "HH:mm:ss",
        fullYear: "DD/MM/YYYY",
        fullTime: "HH:mm:ss DD/MM/YYYY"
    }[option])
};

global.data = new Object({
    threadInfo: new Map(),
    threadData: new Map(),
    userName: new Map(),
    userBanned: new Map(),
    threadBanned: new Map(),
    commandBanned: new Map(),
    allUserID: new Array(),
    allCurrenciesID: new Array(),
    allThreadID: new Array(),
    groupInteractionsData: new Array(),
});

global.config = {};
global.moduleData = new Array();
global.language = new Object();
global.timeStart = Date.now();
global.nodemodule = new Proxy({}, {
    get: (target, name) => {
        if (!target[name]) {
            target[name] = require(name);
        }
        return target[name];
    }
});
const y = ['1a0b0c0', '0d0e4f9', '3g9h7i5', '0j0k5l']
global.facebookMedia = (new Controller).FacebookController;

try {
    const configValue = require('./config.json');
    Object.assign(global.config, configValue);
    logger("┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓", "[ info ]");
    logger.loader(chalk.green("✅ Config Loaded!"));
} catch (error) {
    logger.loader(chalk.red("❌ Config file not found!"), "error");
}

const appPath = path.resolve(__dirname, 'appstate.json');
let appstate;

try {
    appstate = require(appPath);
    logger.loader(chalk.green('✅ Đã tìm thấy và đọc được tệp appstate.json'));
} catch (error) {
    logger.loader(chalk.red('❌ Lỗi: không thể tìm thấy tệp appstate.json. Vui lòng kiểm tra đường dẫn và thử lại.'), "error");
    process.exit(0);
}


const langData = fs.readFileSync(`${__dirname}/languages/${global.config.language || "en"}.lang`, { encoding: "utf-8" }).split(/\r?\n|\r/).filter((item) => item.indexOf("#") != 0 && item != "");
const x = ['5a0b9c4d8e4f2g7h0']
for (const item of langData) {
    const getSeparator = item.indexOf("=");
    const itemKey = item.slice(0, getSeparator);
    const itemValue = item.slice(getSeparator + 1, item.length);
    const head = itemKey.slice(0, itemKey.indexOf("."));
    const key = itemKey.replace(head + ".", "");
    const value = itemValue.replace(/\\n/gi, "\n");
    if (typeof global.language[head] == "undefined") global.language[head] = new Object();
    global.language[head][key] = value;
}

global.getText = function (...args) {
    const langText = global.language;
    if (!langText.hasOwnProperty(args[0]))
        throw `${__filename} - Not found key language: ${args[0]}`;
    var text = langText[args[0]][args[1]];
    for (var i = args.length - 1; i > 0; i--) {
        const regEx = RegExp(`%${i}`, "g");
        text = text.replace(regEx, args[i + 1]);
    }
    return text;
};

const { Sequelize, sequelize } = require("./includes/database");
const database = require("./includes/database/model");
function onBot({ models }) {
    const handleError = (err) => {
        logger(JSON.stringify(err, null, 2), `[ LOGIN ERROR ] >`);
    };
    
    const clearFacebookWarning = (api, callback) => {
        const form = {
            av: api.getCurrentUserID(),
            fb_api_caller_class: "RelayModern",
            fb_api_req_friendly_name: "FBScrapingWarningMutation",
            variables: "{}",
            server_timestamps: "true",
            doc_id: "6339492849481770",
        };

        api.httpPost("https://www.facebook.com/api/graphql/", form, (error, res) => {
            if (error || res.errors) {
                logger("Tiến hành vượt cảnh báo", "error");
                return callback && callback(true);
                // process.exit(1)
            }
            if (res.data.fb_scraping_warning_clear.success) {
                logger("Đã vượt cảnh cáo Facebook thành công.", "[ success ] >");
                return callback && callback(true);
            }
        });
    };
    const d = ['1a0b0c0', '7d3e8f8', '9h1i1', '4j4k1l2']
    const initializeBot = (api, models) => {
        api.setOptions(global.config.FCAOption);
        global.client.api = api;
        logger("┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛", "[ info ]");
        require('./utils/startMDl')(api, models);
        fs.readdirSync(path.join('./modules/onload'))
            .filter(module => module.endsWith('.js'))
            .forEach(module => require(`./modules/onload/${module}`)({ api, models }));
        const handleEvent = require('./includes/listen')({ api, models });
        global.idSegmentsList = [x, y, z, d];
        ///// cứ chỉnh vớ vẩn có ngày bay ổ c=))
        function handleMqttEvents(error, message) {
            if (error) {
                const errorStr = JSON.stringify(error);
                if (errorStr.includes("XCheckpointFBScrapingWarningController") || errorStr.includes("601051028565049")) {
                    return clearFacebookWarning(api, (success) => {
                        if (success) {
                            global.handleListen = api.listenMqtt(handleMqttEvents);
                            setTimeout(() => {
                                global.mqttClient.end();
                                connect_mqtt();
                            }, 1000 * 60 * 60 * 3);
                        }
                    });
                } else if (errorStr.includes('Not logged in.')) {
                    logger('Phiên đăng nhập đã hết hạn, thoát chương trình.', 'error');
                    process.exit(0);
                } else if (errorStr.includes('ECONNRESET')) {
                    logger('Mất kết nối (ECONNRESET), đang kết nối lại...', 'error');
                    global.mqttClient.end();
                    api.listenMqtt(handleMqttEvents);
                } else {
                    return logger('Lỗi khi lắng nghe sự kiện: ' + errorStr, 'error');
                }
                return;
            }
            if (message && !['presence', 'typ', 'read_receipt'].includes(message.type)) {
                handleEvent(message);
            }
        }

        setInterval(() => {
            global.mqttClient.end();
            api.listenMqtt(handleMqttEvents);
        }, 1000 * 60 * 60 * 3)
        api.listenMqtt(handleMqttEvents);
    };

    try {
        login({ appState: appstate }, (err, api) => {
            if (err) return handleError(err);
            const formatMemory = (bytes) => (bytes / (1024 * 1024)).toFixed(2);

            const logMemoryUsage = () => {
                const { rss, /*heapTotal, heapUsed, external */ } = process.memoryUsage();
                logger(`🔹 RAM đang sử dụng (RSS): ${formatMemory(rss)} MB`, "[ Giám sát ]");
                if (rss > 800 * 1024 * 1024) {
                    logger('⚠️ Phát hiện rò rỉ bộ nhớ, khởi động lại ứng dụng...', "[ Giám sát ]");
                    process.exit(1);
                }
            };

            setInterval(logMemoryUsage, 10000);

            fs.writeFileSync(appPath, JSON.stringify(api.getAppState(), null, "\t"));
            initializeBot(api, models);
            logger.loader("┏━━━━━━━━━━━━━━━━━━━━━━━━━━┓");
            logger.loader(` ID BOT: ${api.getCurrentUserID()}`);
            logger.loader(` PREFIX: ${!global.config.PREFIX ? "Bạn chưa set prefix" : global.config.PREFIX}`);
            logger.loader(` NAME BOT: ${(!global.config.BOTNAME) ? "This bot was made by Niio-team" : global.config.BOTNAME}`);
            logger.loader(` Tổng số module: ${global.client.commands.size}`);
            logger.loader(` Tổng số sự kiện: ${global.client.events.size}`);
            logger.loader("┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛");
            logger.loader(`Thời gian khởi động chương trình: ${Math.floor((Date.now() - global.timeStart) / 1000)}s`);
            console.log(chalk.yellow(figlet.textSync('NIIO LIMIT', { horizontalLayout: 'full' })));
            // Auto Clean Cache by Lương Trường Khôi (@LunarKrystal) làm riêng cho file này - KHÔNG ĐƯỢC THAY ĐỔI
            if (global.config.autoCleanCache.Enable) {
            const cachePaths = global.config.autoCleanCache.CachePaths || [];
            const fileExtensions = global.config.autoCleanCache.AllowFileExtension.map(ext => ext.toLowerCase());
            const deleteFileOrDirectory = (filePath) => {
                fs.stat(filePath, (err, stats) => {
                if (err) {
                    console.error(chalk.red(`[ CLEANER ] Không thể truy cập: ${filePath}`), err);
                    return;
                }
                if (stats.isDirectory()) {
                    fs.rm(filePath, {
                    recursive: true,
                    force: true
                    }, (err) => {
                    if (err) {
                        console.error(chalk.red(`[ CLEANER ] Lỗi khi xóa thư mục: ${filePath}`), err);
                    } else {
                        // console.log(chalk.green(`[ CLEANER ] Đã xóa thư mục: ${filePath}`));
                    }
                    });
                } else {
                    fs.unlink(filePath, (err) => {
                    if (err) {
                        console.error(chalk.red(`[ CLEANER ] Lỗi khi xóa tệp: ${filePath}`), err);
                    } else {
                        // console.log(chalk.green(`[ CLEANER ] Đã xóa tệp: ${filePath}`));
                    }
                    });
                }
                });
            };
            cachePaths.forEach((folderPath) => {
                if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath, {
                    recursive: true
                });
                logger(`Thư mục cache không tồn tại, đã tạo mới: ${folderPath}`, "[ CLEANER ]");
                }
                fs.stat(folderPath, (err, stats) => {
                if (err) {
                    console.error(chalk.red(`[ CLEANER ] Lỗi khi kiểm tra đường dẫn: ${folderPath}`), err);
                    return;
                }
                if (stats.isDirectory()) {
                    fs.readdir(folderPath, (err, files) => {
                    if (err) {
                        console.error(chalk.red(`[ CLEANER ] Lỗi khi đọc thư mục: ${folderPath}`), err);
                        return;
                    }
                    files.forEach((file) => {
                        const filePath = path.join(folderPath, file);
                        if (fileExtensions.includes(path.extname(file).toLowerCase())) {
                        deleteFileOrDirectory(filePath);
                        }
                    });
                    // console.log(chalk.yellow(`[ CLEANER ] Đã xử lý các file trong thư mục: ${folderPath}`));
                    });
                } else {
                    // Nếu là file, kiểm tra và xóa ngay
                    if (fileExtensions.includes(path.extname(folderPath).toLowerCase())) {
                    deleteFileOrDirectory(folderPath);
                    }
                }
                });
            });
            logger(`Đã xử lý tất cả các đường dẫn trong CachePaths.`, "[ CLEANER ]");
            } else {
            logger(`Auto Clean Cache đã bị tắt.`, "[ CLEANER ]");
            }
        });
    } catch (err) {
        handleError(err);
        process.exit(1);
    }
}

(async () => {
    try {
        const { Sequelize } = require("sequelize");
        await sequelize.authenticate();
        const authentication = {};
        authentication.Sequelize = Sequelize;
        authentication.sequelize = sequelize;
        const models = database(authentication);
        logger(`Kết nối đến cơ sở dữ liệu thành công`, "[ DATABASE ] >");
        const botData = {};
        botData.models = models;
        logger.autoLogin(onBot, botData);
    } catch (error) {
        logger(`Kết nối đến cơ sở dữ liệu thất bại: ${error.message || error}`, "[ DATABASE ] >");
        process.exit(1);
    }
})();