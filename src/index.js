const express = require("express");

const app = express();

const port = 3000;

app.use(port, () => console.log(`Sever up on port ${port}...`));
