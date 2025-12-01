/* eslint-disable @typescript-eslint/no-require-imports */
import type { Protocol, Session } from "electron";
import type { NextConfig, default as createServerNext } from "next";
import type { NextServer, NextServerOptions } from "next/dist/server/next";
import resolve from "resolve";
import { constants, access, watch } from "node:fs/promises";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { parse } from "node:url";
import path from "node:path";
import fs from "node:fs";
import assert from "node:assert";
import { app, protocol } from "electron";
import { asAbsolutePath } from "./as-absolute-path";
import { serveAsset } from "./asset-files";
import { StartServerOptions } from "next/dist/server/lib/start-server";
import { ServerBuild } from "./types";
// // import { NextServerOptions } from "next/dist/server/next";
// import { AppLoadContext } from "./types";

// const getDefaultMode = () =>
//   app.isPackaged ? "production" : process.env.NODE_ENV;

type MaybePromise<T> = Promise<T> | T;

/**
 * https://nextjs.org/docs/pages/building-your-application/configuring/custom-server
 * https://github.com/vercel/next.js/pull/68167/files#diff-d0d8b7158bcb066cdbbeb548a29909fe8dc4e98f682a6d88654b1684e523edac
 * https://github.com/vercel/next.js/blob/canary/examples/custom-server/server.ts
 */
export async function createHandler(
  options: Omit<ServerBuild, "conf"> & {
    conf?: NextServerOptions["conf"];
    protocol: Protocol;
    debug?: boolean;
  }
): Promise<{
  localhostUrl: string;
  createInterceptor: ({ session }: { session: Session }) => Promise<() => void>;
}> {
  assert(options.dir, "dir is required");
  assert(protocol, "protocol is required");
  assert(options.hostname, "hostname is required");
  assert(options.port, "port is required");

  options.dir = options.dev ? process.cwd() : options.dir;

  if (options.debug) {
    console.log("Next.js handler", {
      dev: options.dev,
      dir: options.dir,
      hostname: options.hostname,
      port: options.port,
      debug: options.debug,
    });
  }

  const localhostUrl = `http://${options.hostname}:${options.port}`;

  const serverOptions: StartServerOptions & { isDev: boolean } = {
    ...options,
    dir: options.dir,
    port: options.port,
    isDev: !!options.dev,
  };

  if (options.dev) {
    const server = require(
      resolve.sync("next/dist/server/lib/start-server", {
        basedir: options.dir ?? process.cwd(),
      })
    );
    const preparePromise = server.startServer(serverOptions);
    // const next = await import("next");
    // const server = next.default;
    // const nextApp = await server(serverOptions);
    // const handler = nextApp.getRequestHandler();

    // //FIXME Not reloading by Next.js automatically, try Nodemon https://github.com/vercel/next.js/tree/canary/examples/custom-server
    // nextApp.prepare().then(() => {
    //   createServer((req, res) => {
    //     const parsedUrl = parse(req.url!, true);
    //     handler(req, res, parsedUrl);
    //   }).listen(port);

    //   console.log(
    //     `> Server listening at http://localhost:${port} as ${
    //       dev ? "development" : process.env.NODE_ENV
    //     }`
    //   );
    // });

    // Early exit before rest of prod stuff
    return {
      localhostUrl,
      createInterceptor: async ({ session }: { session: Session }) => {
        assert(session, "Session is required");
        await preparePromise;
        if (options.debug)
          console.log(
            `Server Intercept Disabled, ${localhostUrl} is served by Next.js`
          );
        return () => {};
      },
    };
  }

  // const next = require(resolve.sync("next", { basedir: dir }));

  // @see https://github.com/vercel/next.js/issues/64031#issuecomment-2078708340
  // const config = require(path.join(dir, ".next", "required-server-files.json"))
  //   .config as NextConfig;
  // process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify({
  //   ...config,
  //   ...nextOptions?.conf,
  // });

  // const app = next(serverOptions) as NextServer;

  // const handler = app.getRequestHandler();

  // const preparePromise = app.prepare().catch((err: Error) => {
  //   console.error("Cannot prepare Next.js server", err.stack);
  //   throw err;
  // });

  // protocol.registerSchemesAsPrivileged([
  //   {
  //     scheme: "http",
  //     privileges: {
  //       standard: true,
  //       secure: true,
  //       supportFetchAPI: true,
  //     },
  //   },
  // ]);

  async function createInterceptor({ session }: { session: Session }) {
    assert(session, "Session is required");
    assert(fs.existsSync(options.dir ?? "unknown"), "dir does not exist");

    if (options.debug)
      console.log(
        `Server Intercept Enabled, ${localhostUrl} will be intercepted by ${options.dir}`
      );

    const socket = new Socket();

    const closeSocket = () => socket.end();

    process.on("SIGTERM", closeSocket);
    process.on("SIGINT", closeSocket);

    // await preparePromise;

    // protocol.handle("http", async (request) => {
    //   // try {
    //     assert(
    //       request.url.startsWith(localhostUrl),
    //       "External HTTP not supported, use HTTPS"
    //     );

    //   //   const req = await createRequest({ socket, request, session });
    //   //   const res = new ReadableServerResponse(req);
    //   //   const url = parse(req.url, true);

    //   //   handler(req, res, url); //TODO Try/catch?

    //   //   const response = await res.getResponse();

    //   //   try {
    //   //     // @see https://github.com/electron/electron/issues/30717
    //   //     // @see https://github.com/electron/electron/issues/39525
    //   //     const cookies = parseCookie(
    //   //       response.headers.getSetCookie().reduce((r, c) => {
    //   //         // @see https://github.com/nfriedly/set-cookie-parser?tab=readme-ov-file#usage-in-react-native-and-with-some-other-fetch-implementations
    //   //         return [...r, ...splitCookiesString(c)];
    //   //       }, [])
    //   //     );

    //   //     for (const cookie of cookies) {
    //   //       const {
    //   //         name,
    //   //         value,
    //   //         path,
    //   //         domain,
    //   //         secure,
    //   //         httpOnly,
    //   //         expires,
    //   //         maxAge,
    //   //       } = cookie;

    //   //       const expirationDate = expires
    //   //         ? expires.getTime()
    //   //         : maxAge
    //   //           ? Date.now() + maxAge * 1000
    //   //           : undefined;

    //   //       if (expirationDate < Date.now()) {
    //   //         await session.cookies.remove(request.url, cookie.name);
    //   //         continue;
    //   //       }

    //   //       await session.cookies.set({
    //   //         url: request.url,
    //   //         expirationDate,
    //   //         name,
    //   //         value,
    //   //         path,
    //   //         domain,
    //   //         secure,
    //   //         httpOnly,
    //   //         maxAge,
    //   //       } as any);
    //   //     }
    //   //   } catch (e) {
    //   //     throw new Error("Failed to set cookies", { cause: e });
    //   //   }

    //   //   if (debug) console.log("[NEXT] Handler", request.url, response.status);
    //   //   return response;
    //   // } catch (e) {
    //   //   if (debug) console.log("[NEXT] Error", e);
    //   //   return new Response(e.message, { status: 500 });
    //   // }
    // });

    return function stopIntercept() {
      protocol.unhandle("http");
      process.off("SIGTERM", closeSocket);
      process.off("SIGINT", closeSocket);
      closeSocket();
    };
  }

  return { createInterceptor, localhostUrl };
}

// type GetLoadContextFunction = (
//   request: Request
// ) => MaybePromise<AppLoadContext | undefined>;

// /**
//  * Initialize and configure remix-electron
//  *
//  * @param options
//  * @returns The url to use to access the app.
//  */
// export async function initNext(
//   options: NextServerOptions,
//   mode: string | undefined,
//   publicFolderOption = "public"
// ): Promise<string> {
//   const publicFolder = asAbsolutePath(publicFolderOption, process.cwd());

//   if (
//     !(await access(publicFolder, constants.R_OK).then(
//       () => true,
//       () => false
//     ))
//   ) {
//     throw new Error(
//       `Public folder ${publicFolder} does not exist. Make sure that the initRemix \`publicFolder\` option is configured correctly.`
//     );
//   }

//   const buildPath =
//     typeof serverBuildOption === "string" ? serverBuildOption : undefined;

//   let serverBuild =
//     typeof buildPath === "string"
//       ? /** @type {ServerBuild} */ await import(
//           esm ? `${buildPath}?${Date.now()}` : buildPath
//         )
//       : serverBuildOption;

//   await app.whenReady();

//   protocol.handle("http", async (request) => {
//     const url = new URL(request.url);
//     if (
//       // We only want to handle local (Remix) requests to port 80.
//       // Requests to other hosts or ports should not be intercepted,
//       // this might be the case when an application makes requests to a local service.
//       !["localhost", "127.0.0.1"].includes(url.hostname) ||
//       (url.port && url.port !== "80")
//     ) {
//       return await fetch(request);
//     }

//     request.headers.append("Referer", request.referrer);
//     try {
//       const assetResponse = await serveAsset(request, publicFolder);
//       if (assetResponse) {
//         return assetResponse;
//       }

//       const context = await getLoadContext?.(request);
//       const handleRequest = createRequestHandler(
//         serverBuild,
//         mode ?? getDefaultMode()
//       );
//       return await handleRequest(request, context);
//     } catch (error) {
//       console.warn("[remix-electron]", error);
//       const { stack, message } = toError(error);
//       return new Response(`<pre>${stack || message}</pre>`, {
//         status: 500,
//         headers: { "content-type": "text/html" },
//       });
//     }
//   });

//   if (
//     (mode ?? getDefaultMode()) !== "production" &&
//     typeof buildPath === "string"
//   ) {
//     void (async () => {
//       for await (const _event of watch(buildPath)) {
//         if (esm) {
//           serverBuild = await import(`${buildPath}?${Date.now()}`);
//         } else {
//           purgeRequireCache(buildPath);
//           // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
//           serverBuild = require(buildPath);
//         }
//         await broadcastDevReady(serverBuild);
//       }
//     })();
//   }

//   // the remix web socket reads the websocket host from the browser url,
//   // so this _has_ to be localhost
//   return "http://localhost/";
// }

// function purgeRequireCache(prefix: string) {
//   for (const key in require.cache) {
//     if (key.startsWith(prefix)) {
//       // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
//       delete require.cache[key];
//     }
//   }
// }

// function toError(value: unknown) {
//   return value instanceof Error ? value : new Error(String(value));
// }
