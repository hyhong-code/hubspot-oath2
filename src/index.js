require("dotenv").config();
const express = require("express");
const qs = require("query-string");
const axios = require("axios");
const session = require("express-session");

const app = express();

const clientId = process.env.HB_CLIENT_ID;
const clientSecret = process.env.HB_CLIENT_SECRET;
const redirectUrl = process.env.HB_REDIRECT_URL;
const installUrl = process.env.HB_INSTALL_URL;
console.log({ clientId, clientSecret, redirectUrl, installUrl });

const tokenStore = {};

app.use(
  session({
    secret: Math.random().toString(36).substring(2),
    resave: false,
    saveUninitialized: true,
  })
);

const port = process.env.PORT || 3000;
app.use(port, () => console.log(`Sever up on port ${port}...`));
