require("dotenv").config();
const path = require("path");
const express = require("express");
const qs = require("query-string");
const axios = require("axios");
const session = require("express-session");
const NodeCache = require("node-cache");

// Env vars
const client_id = process.env.HB_CLIENT_ID;
const client_secret = process.env.HB_CLIENT_SECRET;
const redirect_uri = process.env.HB_REDIRECT_URI;
const installUrl = process.env.HB_INSTALL_URL;

// Use node cache to manage short lived access token
const nodeCache = new NodeCache();

const app = express();
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

app.use(
  session({
    secret: Math.random().toString(36).substring(2), // dcgio3ppss
    resave: false,
    saveUninitialized: true,
  })
);

// Mock refresh token DB
const refreshTokenStore = {};
const isAuthenticated = (userId) => {
  return !!refreshTokenStore[userId];
};

// Returns user's access token from cache if exists
// Otherwise get a new one using refresh token
const getAccessToken = async (userId) => {
  try {
    if (nodeCache.get(userId)) {
      console.log("🔥 ----> Cached access token used.");
      return nodeCache.get(userId);
    }

    console.log("🔥 ----> Requested new access token using refresh token.");

    const refreshParams = {
      grant_type: "refresh_token",
      client_id,
      client_secret,
      refresh_token: refreshTokenStore[userId],
    };

    const { data } = await axios.post(
      `https://api.hubapi.com/oauth/v1/token`,
      qs.stringify(refreshParams)
    );

    // Stores refresh token into DB
    refreshTokenStore[userId] = data.refresh_token;

    // Store access token into node cache with a TTL that matches access token expiry
    nodeCache.set(userId, data.access_token, 10);

    return data.access_token;
  } catch (error) {
    console.error(error);
  }
};

// Conditionally render views based on whether use is authenticated
app.get("/", async (req, res, next) => {
  try {
    if (isAuthenticated(req.sessionID)) {
      const accessToken = await getAccessToken(req.sessionID);

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
    console.error(error.response);
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

    // Stores refresh token into DB
    refreshTokenStore[req.sessionID] = data.refresh_token;

    // Store access token into node cache with a TTL that matches access token expiry
    nodeCache.set(req.sessionID, data.access_token, 10);

    // Redirects back to home route
    res.redirect("/");
  } catch (error) {
    console.error(error.response);
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Sever up on port ${port}...`));
