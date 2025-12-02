import * as fs from "node:fs";
import * as path from "node:path";

fs.rmSync(path.join(__dirname, ".next"), { force: true, recursive: true });
fs.rmSync(path.join(__dirname, "out"), { force: true, recursive: true });
fs.rmSync(path.join(__dirname, "build"), { force: true, recursive: true });
