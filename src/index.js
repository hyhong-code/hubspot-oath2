require("dotenv").config();
const express = require("express");
const qs = require("query-string");
const axios = require("axios");
const session = require("express-session");
const path = require("path");

const client_id = process.env.HB_CLIENT_ID;
const client_secret = process.env.HB_CLIENT_SECRET;
const redirect_uri = process.env.HB_REDIRECT_URI;
const installUrl = process.env.HB_INSTALL_URL;

const app = express();
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

app.use(
  session({
    secret: Math.random().toString(36).substring(2),
    resave: false,
    saveUninitialized: true,
  })
);

// Mock token store and auth check function
const tokenStore = {};
const isAuthenticated = (userId) => {
  return !!tokenStore[userId];
};

// Conditionally render views based on whether use is authenticated
app.get("/", async (req, res, next) => {
  try {
    if (isAuthenticated(req.sessionID)) {
      const accessToken = tokenStore[req.sessionID];

      // Attach access token as bearer token
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      };

      // Get recently created contacts, uses access token to authenticate
      const {
        data: { contacts },
      } = await axios.get(`https://api.hubapi.com/contacts/v1/lists/all/contacts/recent`, {
        headers,
      });

      res.render("home", { contacts, token: accessToken });
    } else {
      // Promps user to authenticate if not
      res.render("home", { authUrl: installUrl });
    }
  } catch (error) {
    console.error(error);
  }
});

app.get("/oauth-callback", async (req, res, next) => {
  try {
    // Get `code` from query params when hubspot calls us back
    const { code } = req.query;

    const authProof = {
      grant_type: "authorization_code",
      client_id,
      client_secret,
      redirect_uri,
      code,
    };

    // Get a set of access and refresh tokens based on the `code`
    // This endpoint expects application/x-www-form-urlencoded format, part of the oauth specs
    const { data } = await axios.post(
      `https://api.hubapi.com/oauth/v1/token`,
      qs.stringify(authProof) // qs helps convert object into url-encoded format
    );

    // Stores access token into store
    tokenStore[req.sessionID] = data.access_token;

    res.redirect("/"); // Redirects back to home route
  } catch (error) {
    console.error(error);
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Sever up on port ${port}...`));
