const session = require('express-session');
require('dotenv').config();

const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'timetablepro-default-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
};

module.exports = sessionConfig;
