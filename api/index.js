const app = require('../server');
const { initDatabase } = require('../db/schema');

let dbInitialized = false;

module.exports = async (req, res) => {
    if (!dbInitialized) {
        await initDatabase();
        dbInitialized = true;
    }
    return app(req, res);
};
