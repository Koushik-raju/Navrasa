// Vercel serverless function: every /api/* request is routed here (see vercel.json).
const { handler } = require('../lib/app');
module.exports = handler;
