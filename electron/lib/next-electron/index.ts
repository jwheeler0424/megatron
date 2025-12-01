import type { Protocol, Session } from "electron";
import next from "next";
import { NextBundlerOptions, NextServerOptions } from "next/dist/server/next";
import assert from "node:assert";
import fs from "node:fs";
import {
  IncomingMessage,
  OutgoingHttpHeaders,
  ServerResponse,
} from "node:http";
import { Socket } from "node:net";
import { parse } from "node:url";
import cookieParser from "set-cookie-parser";
// import path from "node:path";

// type NextServer = ReturnType<typeof createServerNext>;
type ServerOptions = NextServerOptions & NextBundlerOptions;

/**
 * Converts an OutgoingHttpHeaders object to a HeadersInit value.
 * Handles undefined, null, array, and number header values per the fetch spec.
 */
export function outgoingHttpHeadersToHeadersInit(
  headers: OutgoingHttpHeaders
): HeadersInit {
  const result: Record<string, string> = {};
  for (const key in headers) {
    const value = headers[key];
    if (typeof value === "undefined" || value === null) continue;
    if (Array.isArray(value)) {
      result[key] = value.join(", ");
    } else {
      // number or string
      result[key] = value.toString();
    }
  }
  return result;
}

/**
 * https://nextjs.org/docs/pages/building-your-application/configuring/custom-server
 * https://github.com/vercel/next.js/pull/68167/files#diff-d0d8b7158bcb066cdbbeb548a29909fe8dc4e98f682a6d88654b1684e523edac
 * https://github.com/vercel/next.js/blob/canary/examples/custom-server/server.ts
 */
export function createHandler({
  protocol,
  debug = false,
  dev = true,
  hostname = "localhost",
  port = 3000,
  dir,
  mode = "development",
  ...nextOptions
}: Omit<ServerOptions, "conf"> & {
  conf?: ServerOptions["conf"];
  protocol: Protocol;
  debug?: boolean;
  mode?: "production" | "development" | "packaged";
}): {
  url: string;
  createInterceptor: ({ session }: { session: Session }) => Promise<() => void>;
} {
  assert(dir, "dir is required");
  assert(protocol, "protocol is required");
  assert(hostname, "hostname is required");
  assert(port, "port is required");

  dir = dev ? process.cwd() : dir;

  if (debug) {
    console.log("Next.js handler", {
      dev: dev,
      dir: dir,
      hostname: hostname,
      port: port,
      debug: debug,
    });
  }

  const localhostUrl = `http://${hostname}:${port}`;

  const serverOptions: Omit<ServerOptions, "conf"> = {
    ...nextOptions,
    dir,
    dev,
    hostname,
    port,
  };

  const nextApp = next(serverOptions);
  const handler = nextApp.getRequestHandler();
  if (dev) {
    // nextApp.prepare().then(() => {
    //   createServer((req, res) => {
    //     const parsedUrl = parse(req.url!, true);
    //     handler(req, res, parsedUrl);
    //   }).listen(port);
    //   console.log(
    //     `> Server listening at http://${hostname}:${port} as ${mode}`
    //   );
    // });
    // Early exit before rest of prod stuff
    // return {
    //   url: localhostUrl,
    //   createInterceptor: async ({ session }: { session: Session }) => {
    //     assert(session, "Session is required");
    //     if (debug)
    //       console.log(
    //         `Server Intercept Enabled, ${localhostUrl} is served by Next.js embedded server`
    //       );
    //     return () => {};
    //   },
    // };
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

  const preparePromise = nextApp.prepare().catch((err: Error) => {
    console.error("Cannot prepare Next.js server", err.stack);
    throw err;
  });

  async function createInterceptor({ session }: { session: Session }) {
    assert(session, "Session is required");
    assert(fs.existsSync(dir ?? "unknown"), "dir does not exist");

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
        const url = parse(req.url ?? "/", true);

        handler(req, res, url); // Next.js request handler

        const response = await res.getResponse();

        try {
          const cookies = cookieParser(response.headers.getSetCookie());

          await Promise.all(
            cookies.map((cookie) =>
              session.cookies.set({
                url: req.url ?? "/",
                name: cookie.name,
                value: cookie.value,
                path: cookie.path,
                domain: cookie.domain,
                secure: cookie.secure,
                httpOnly: cookie.httpOnly,
                expirationDate: cookie.expires
                  ? cookie.expires.getTime() / 1000
                  : cookie.maxAge
                    ? Date.now() / 1000 + cookie.maxAge
                    : undefined,
              })
            )
          );
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

  return { createInterceptor, url: localhostUrl };
}

export async function createRequest({
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

  // request.headers.forEach((value, key) => {
  //   req.headers[key] = value;
  // });

  try {
    // @see https://github.com/electron/electron/issues/39525#issue-1852825052
    // const cookies = await session.cookies.get({
    //   url: request.url,
    //   domain: url.hostname,
    //   path: url.pathname,
    //   // `secure: true` Cookies should not be sent via http
    //   secure: url.protocol === 'http:' ? false : undefined,
    //   // theoretically not possible to implement sameSite because we don't know the url
    //   // of the website that is requesting the resource
    // });

    // if (cookies.length) {
    //   const cookiesHeader = [];

    //   for (const cookie of cookies) {
    //     const { name, value, ...options } = cookie;
    //     cookiesHeader.push(serializeCookie(name, value)); // ...(options as any)?
    //   }

    //   req.headers.cookie = cookiesHeader.join("; ");
    // }
    const cookies = await session.cookies.get({
      url: req.url,
      domain: url.hostname,
      path: url.pathname,
      // `secure: true` Cookies should not be sent via http
      secure: url.protocol === "http:" ? false : undefined,
      // theoretically not possible to implement sameSite because we don't know the url
      // of the website that is requesting the resource
    });

    request.headers.set(
      "Cookie",
      cookies
        .map((cookie) => `${cookie.name}=${encodeURI(cookie.value)}`)
        .join("; ")
    );
  } catch (e: unknown) {
    throw new Error("Failed to parse cookies", { cause: e });
  }

  if (request.body) {
    req.push(Buffer.from(await request.arrayBuffer()));
  }

  req.push(null);
  req.complete = true;

  return req;
}

export class ReadableServerResponse extends ServerResponse {
  private responsePromise: Promise<Response>;

  constructor(req: IncomingMessage) {
    super(req);

    this.responsePromise = new Promise<Response>((resolve, _reject) => {
      const readableStream = new ReadableStream({
        start: (controller) => {
          let onData;

          this.on(
            "data",
            (onData = (
              chunk: ArrayBuffer | Buffer | BufferEncoding | string
            ) => {
              controller.enqueue(chunk);
            })
          );

          this.once("end", (chunk) => {
            controller.enqueue(chunk);
            controller.close();
            this.off("data", onData);
          });
        },
        pull: (_controller) => {
          this.emit("drain");
        },
        cancel: () => {},
      });

      this.once("writeHead", (statusCode) => {
        const headers = outgoingHttpHeadersToHeadersInit(this.getHeaders());
        resolve(
          new Response(readableStream, {
            status: statusCode,
            statusText: this.statusMessage,
            headers,
          })
        );
      });
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  write(chunk: ArrayBuffer | Buffer | string, ...args: any[]): boolean {
    this.emit("data", chunk);
    return super.write(chunk, ...args);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  end(chunk: (() => void) | undefined, ...args: any[]): this {
    this.emit("end", chunk);
    return super.end(chunk, ...args);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  writeHead(statusCode: number, ...args: any[]): this {
    this.emit("writeHead", statusCode);
    return super.writeHead(statusCode, ...args);
  }

  getResponse() {
    return this.responsePromise;
  }
}
