const { getEnv } = require("./lib/env.ts");
console.log("QLIK API URL:", getEnv().QLIK_API_URL);
console.log("RECORDS API URL:", getEnv().API_BASE_URL);
