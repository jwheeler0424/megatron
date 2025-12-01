// /**
//  * An object of unknown type for route loaders and actions provided by the
//  * server's `getLoadContext()` function.  This is defined as an empty interface
//  * specifically so apps can leverage declaration merging to augment this type
//  * globally: https://www.typescriptlang.org/docs/handbook/declaration-merging.html
//  */
// export interface AppLoadContext {
//   [key: string]: unknown;
// }
import { Server as HttpServer } from "node:http";
import { NextServerOptions } from "next/dist/server/next";

/**
 * The output of the compiler for the server build.
 */
export interface ServerBuild {
  conf: NextServerOptions["conf"];
  dev?: boolean;
  dir?: string;
  quiet?: boolean;
  hostname?: string;
  port?: number;
  httpServer?: HttpServer;
  turbopack?: boolean;
  webpack?: boolean;
}
