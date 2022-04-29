require('dotenv').config();

const express = require('express');
const app = express();


const bodyParser = require('body-parser');
const cors = require('cors');
function initApp() {
    // app.set('view engine', 'ejs');
    // app.use(express.static("public"));

    app.use(bodyParser.raw({type: 'application/octet-stream', limit:'10gb'}));
    app.use(bodyParser.json());

    app.use(cors({origin: process.env.CLIENT_URL}));

    app.use('/uploads', express.static('uploads'));
    app.use('/downloads', express.static('downloads'));

    const port = process.env.PORT ? process.env.PORT : 4001;
    app.listen(port, () => { console.log("Server Started on Port:" + port) });
}

module.exports = { app, initApp }