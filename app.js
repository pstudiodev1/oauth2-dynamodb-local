const express = require('express');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const bodyParser = require('body-parser')
const formData = require('express-form-data');
const moment = require('moment');
const httpStatusCodes = require('http-status-codes');

// Load .env file
require('dotenv').config();
require('express-group-routes');

// Controllers
const authCtrl= require('./controllers/auth');

//
const app = express();

// Middleware.
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(cors({origin: '*', optionsSuccessStatus: 200,}))
app.use(formData.parse())
app.use(bodyParser.json({ limit:'50mb' }));
app.use(bodyParser.urlencoded({ limit:'50mb', extended: false }));

app.group('/oauth2', (r) => {
    r.get('/authorize', authCtrl.authorize);
    r.post('/token', authCtrl.token);
    r.get('/profile', authCtrl.profile);
    r.get('/verify', authCtrl.verify);
    r.get('/health', (req, res) => {
      res.status(httpStatusCodes.OK).send({ status: "OK", time: moment().format('YYYY-MM-DD hh:mm:ss') });
    })
});

module.exports = app;
