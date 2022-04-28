require('dotenv').config();
const archiver = require('archiver');
const { initTempDirs } = require("./dirs.js");
const { initApp } = require("./app.js");
const { connectMongoDB } = require("./mongoose.js");


function initAll() {
    archiver.registerFormat('zip-encrypted', require("archiver-zip-encrypted"));
    initTempDirs();
    initApp();
    connectMongoDB().catch(err => console.log(err));
}


module.exports = { initAll }