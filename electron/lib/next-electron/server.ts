// server.js
// import { createServer } from "http";
// import { parse } from "url";
// import next from "next";

// import { parse as parseCookie, splitCookiesString } from "set-cookie-parser";
// import { serialize as serializeCookie } from "cookie";

// const port = parseInt(process.env.PORT || "3000", 10);
// const dev = process.env.NODE_ENV !== "production";
// const app = next({ dev });
// const handle = app.getRequestHandler();

// app.prepare().then(() => {
//   createServer((req, res) => {
//     const parsedUrl = parse(req.url!, true);
//     handle(req, res, parsedUrl);
//   }).listen(port);

//   console.log(
//     `> Server listening at http://localhost:${port} as ${
//       dev ? "development" : process.env.NODE_ENV
//     }`
//   );
// });

// package.json
// {
//   "scripts": {
//     "dev": "node server.js",
//     "build": "next build && cp server.js .next/standalone/server.js",
//     "start": "NODE_ENV=production node .next/standalone/server.js"
//   }
// }
// *** OR ***
// {
//   "scripts": {
//     "dev": "node server.js",
//     "build": "next build",
//     "start": "NODE_ENV=production node server.js"
//   }
// }

// copy-assets.js (example)
// const fs = require('fs').promises;
// const path = require('path');

// const publicSrcPath = path.join(__dirname, 'public');
// const publicDestPath = path.join(__dirname, '.next/standalone/public');

// async function copyAssets() {
//   await fs.mkdir(publicDestPath, { recursive: true });
//   await fs.cp(publicSrcPath, publicDestPath, { recursive: true });
//   console.log('Public assets copied.');
// }

// copyAssets();

/*
Automatically Copying Traced Files
Next.js can automatically create a standalone folder that copies only the necessary files for a production deployment including select files in node_modules.

To leverage this automatic copying you can enable it in your next.config.js:

next.config.js
module.exports = {
  output: 'standalone',
}
This will create a folder at .next/standalone which can then be deployed on its own without installing node_modules.

Additionally, a minimal server.js file is also output which can be used instead of next start. This minimal server does not copy the public or .next/static folders by default as these should ideally be handled by a CDN instead, although these folders can be copied to the standalone/public and standalone/.next/static folders manually, after which server.js file will serve these automatically.

To copy these manually, you can use the cp command-line tool after you next build:

Terminal
cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
To start your minimal server.js file locally, run the following command:

Terminal
node .next/standalone/server.js
Good to know:

If your project needs to listen to a specific port or hostname, you can define PORT or HOSTNAME environment variables before running server.js. For example, run PORT=8080 HOSTNAME=0.0.0.0 node server.js to start the server on http://0.0.0.0:8080.
*/
