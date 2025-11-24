/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { IncomingMessage, ServerResponse, type Server } from "node:http";
import { Socket } from "node:net";
import { parse, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import assert from "node:assert";
import { createRequire } from "node:module";
// import { createServer } from 'node:http';

import resolve from "resolve";
import { parse as parseCookie, splitCookiesString } from "set-cookie-parser";
import { serialize as serializeCookie } from "cookie";
import type { Protocol, Session } from "electron";
import { type NextConfig, default as createServerNext } from "next";

// import type { NextServer, NextServerOptions } from 'next/dist/server/next';

// type NextConfig = any;
// type NextServer = ReturnType<typeof createServerNext>;
type NextServerOptions = {
  conf: Record<string | number, any>; //	The same object you would use in next.config.js. Defaults to {}
  dev?: boolean; //	(Optional) Whether or not to launch Next.js in dev mode. Defaults to false
  dir?: string; //	(Optional) Location of the Next.js project. Defaults to '.'
  quiet?: boolean; //	(Optional) Hide error messages containing server information. Defaults to false
  hostname?: string; //	(Optional) The hostname the server is running behind
  port?: number; //	(Optional) The port the server is running behind
  httpServer?: Server; //	(Optional) The HTTP Server that Next.js is running behind
  turbopack?: boolean; //	(Optional) Enable Turbopack (enabled by default)
  webpack?: boolean; //	(Optional) Enable webpack
};

const require = createRequire(import.meta.url);

async function createRequest({
  socket,
  request,
  session,
}: {
  socket: Socket;
  request: Request;
  session: Session;
}): Promise<IncomingMessage> {
  const req = new IncomingMessage(socket);

  const url = new URL(request.url);

  // Normal Next.js URL does not contain schema and host/port, otherwise endless loops due to butchering of schema by normalizeRepeatedSlashes in resolve-routes
  req.url = url.pathname + (url.search || "");
  req.method = request.method;

  request.headers.forEach((value, key) => {
    req.headers[key] = value;
  });

  try {
    // @see https://github.com/electron/electron/issues/39525#issue-1852825052
    const cookies = await session.cookies.get({
      url: request.url,
      // domain: url.hostname,
      // path: url.pathname,
      // `secure: true` Cookies should not be sent via http
      // secure: url.protocol === 'http:' ? false : undefined,
      // theoretically not possible to implement sameSite because we don't know the url
      // of the website that is requesting the resource
    });

    if (cookies.length) {
      const cookiesHeader = [];

      for (const cookie of cookies) {
        const { name, value /*, ...options */ } = cookie;
        cookiesHeader.push(serializeCookie(name, value)); // ...(options as any)?
      }

      req.headers.cookie = cookiesHeader.join("; ");
    }
  } catch (e) {
    throw new Error("Failed to parse cookies", { cause: e });
  }

  if (request.body) {
    req.push(Buffer.from(await request.arrayBuffer()));
  }

  req.push(null);
  req.complete = true;

  return req;
}

class ReadableServerResponse extends ServerResponse {
  private responsePromise: Promise<Response>;

  constructor(req: IncomingMessage) {
    super(req);

    this.responsePromise = new Promise<Response>((resolve, reject) => {
      const readableStream = new ReadableStream({
        start: (controller) => {
          let onData;

          this.on(
            "data",
            (onData = (chunk: ArrayBuffer | string) => {
              controller.enqueue(chunk);
            })
          );

          this.once("end", (chunk) => {
            controller.enqueue(chunk);
            controller.close();
            this.off("data", onData);
          });
        },
        pull: (controller) => {
          this.emit("drain");
        },
        cancel: () => {},
      });

      this.once("writeHead", (statusCode) => {
        resolve(
          new Response(readableStream, {
            status: statusCode,
            statusText: this.statusMessage,
            headers: this.getHeaders() as any,
          })
        );
      });
    });
  }

  write(chunk: any, ...args: any[]): boolean {
    this.emit("data", chunk);
    return super.write(chunk, ...args);
  }

  end(chunk: any, ...args: any[]): this {
    this.emit("end", chunk);
    return super.end(chunk, ...args);
  }

  writeHead(statusCode: number, ...args: any[]): this {
    this.emit("writeHead", statusCode);
    return super.writeHead(statusCode, ...args);
  }

  getResponse() {
    return this.responsePromise;
  }
}

/**
 * https://nextjs.org/docs/pages/building-your-application/configuring/custom-server
 * https://github.com/vercel/next.js/pull/68167/files#diff-d0d8b7158bcb066cdbbeb548a29909fe8dc4e98f682a6d88654b1684e523edac
 * https://github.com/vercel/next.js/blob/canary/examples/custom-server/server.ts
 */
export async function createHandler({
  protocol,
  debug = false,
  dev = process.env.NODE_ENV === "development",
  hostname = "localhost",
  port = 3000,
  dir,
  ...nextOptions
}: Omit<NextServerOptions, "conf"> & {
  conf?: NextServerOptions["conf"];
  protocol: Protocol;
  debug?: boolean;
}): Promise<{
  localhostUrl: string;
  createInterceptor: ({ session }: { session: Session }) => Promise<() => void>;
}> {
  assert(dir, "dir is required");
  assert(protocol, "protocol is required");
  assert(hostname, "hostname is required");
  assert(port, "port is required");

  dir = dev ? process.cwd() : dir;

  if (debug) {
    console.log("Next.js handler", { dev, dir, hostname, port, debug });
  }

  const localhostUrl = `http://${hostname}:${port}`;

  const serverOptions: Omit<NextServerOptions, "conf"> & { isDev: boolean } = {
    ...nextOptions,
    dir,
    dev,
    hostname,
    port,
    isDev: dev,
  };

  if (dev) {
    //FIXME Closes window when restarting server
    const server = require(
      pathToFileURL(
        resolve.sync("next/dist/server/lib/start-server", { basedir: dir })
      ).href
    ).default;
    const preparePromise = server.startServer(serverOptions);

    //FIXME Not reloading by Next.js automatically, try Nodemon https://github.com/vercel/next.js/tree/canary/examples/custom-server
    // app.prepare().then(() => {
    //     createServer((req, res) => {
    //         try {
    //             const parsedUrl = parse(req.url!, true);
    //             handler(req, res, parsedUrl);
    //         } catch (err) {
    //             console.error('Error occurred handling', req.url, err);
    //             res.statusCode = 500;
    //             res.end('internal server error');
    //         }
    //     })
    //         .once('error', (err) => {
    //             console.error(err);
    //             rej(err);
    //         })
    //         .listen(port, () => {
    //             res();
    //             console.log(`> Server listening at ${localhostUrl}`);
    //         });
    // }).then(() => waitOn({resources: [localhostUrl]}).then(res);

    // Early exit before rest of prod stuff
    return {
      localhostUrl,
      createInterceptor: async ({ session }: { session: Session }) => {
        assert(session, "Session is required");
        await preparePromise;
        if (debug)
          console.log(
            `Server Intercept Disabled, ${localhostUrl} is served by Next.js`
          );
        return () => {};
      },
    };
  }

  // TODO: FIXME:
  // 1. Locate Standalone Directory
  // Ensure we are looking inside the resources bundle
  const standaloneDir = path.join(
    process.resourcesPath,
    "app/.next/standalone"
  );
  console.log({ standaloneDir });
  if (fs.existsSync(standaloneDir)) {
    dir = standaloneDir;
    if (debug) console.log("Using bundled standalone dir", dir);
  }

  // 2. Locate Next.js Main Module inside Standalone
  // We point DIRECTLY to the Next.js server entry file to avoid 'package.json' resolution errors
  // and use path.resolve to ensure OS-specific separators (backslashes on Windows).
  const nextPath = path.resolve(dir, "node_modules/next/dist/server/next.js");

  const next = require(
    pathToFileURL(resolve.sync(nextPath, { basedir: dir })).href
  );

  // @see https://github.com/vercel/next.js/issues/64031#issuecomment-2078708340
  const config = require(
    pathToFileURL(path.join(dir, ".next", "required-server-files.json")).href
  ).config as NextConfig;
  process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify({
    ...config,
    ...nextOptions?.conf,
  });

  const app = next(serverOptions);

  const handler = app.getRequestHandler();

  const preparePromise = app.prepare().catch((err: Error) => {
    console.error("Cannot prepare Next.js server", err.stack);
    throw err;
  });

  protocol.registerSchemesAsPrivileged([
    {
      scheme: "http",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
      },
    },
  ]);

  async function createInterceptor({ session }: { session: Session }) {
    assert(session, "Session is required");
    assert(dir, "dir is required");
    assert(fs.existsSync(dir), "dir does not exist");

    if (debug)
      console.log(
        `Server Intercept Enabled, ${localhostUrl} will be intercepted by ${dir}`
      );

    const socket = new Socket();

    const closeSocket = () => socket.end();

    process.on("SIGTERM", closeSocket);
    process.on("SIGINT", closeSocket);

    await preparePromise;

    protocol.handle("http", async (request) => {
      try {
        assert(
          request.url.startsWith(localhostUrl),
          "External HTTP not supported, use HTTPS"
        );

        const req = await createRequest({ socket, request, session });
        const res = new ReadableServerResponse(req);
        const url = parse(req.url ?? "", true);

        handler(req, res, url); //TODO Try/catch?

        const response = await res.getResponse();

        try {
          // @see https://github.com/electron/electron/issues/30717
          // @see https://github.com/electron/electron/issues/39525
          const cookies = parseCookie(
            response.headers.getSetCookie().reduce((r, c) => {
              // @see https://github.com/nfriedly/set-cookie-parser?tab=readme-ov-file#usage-in-react-native-and-with-some-other-fetch-implementations
              return [...r, ...splitCookiesString(c)];
            }, [] as string[])
          );

          for (const cookie of cookies) {
            const {
              name,
              value,
              path,
              domain,
              secure,
              httpOnly,
              expires,
              maxAge,
            } = cookie;

            const expirationDate = expires
              ? expires.getTime()
              : maxAge
                ? Date.now() + maxAge * 1000
                : undefined;

            if (expirationDate !== undefined && expirationDate < Date.now()) {
              await session.cookies.remove(request.url, cookie.name);
              continue;
            }

            await session.cookies.set({
              url: request.url,
              expirationDate,
              name,
              value,
              path,
              domain,
              secure,
              httpOnly,
              maxAge,
            } as any);
          }
        } catch (e) {
          throw new Error("Failed to set cookies", { cause: e });
        }

        if (debug) console.log("[NEXT] Handler", request.url, response.status);
        return response;
      } catch (e: unknown) {
        const err = e as Error;
        if (debug) console.log("[NEXT] Error", err);
        return new Response(err.message, { status: 500 });
      }
    });

    return function stopIntercept() {
      protocol.unhandle("http");
      process.off("SIGTERM", closeSocket);
      process.off("SIGINT", closeSocket);
      closeSocket();
    };
  }

  return { createInterceptor, localhostUrl };
}
