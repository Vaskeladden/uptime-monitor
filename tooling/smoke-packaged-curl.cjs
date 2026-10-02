"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");

async function main() {
  const yaml = require("js-yaml");
  const action = yaml.load(await fs.readFile(path.join(__dirname, "../action.yml"), "utf8"));
  assert.equal(action.runs.using, `node${process.versions.node.split(".")[0]}`);
  // Exercise the binary that Actions downloads, using its pinned npm wrapper.
  const installed = path.join(path.dirname(require.resolve("node-libcurl")), "../lib/binding/node_libcurl.node");
  await fs.copyFile(path.join(__dirname, "../dist/lib/binding/node_libcurl.node"), installed);
  const { curly } = require("node-libcurl");
  const server = http.createServer((_request, response) => {
    response.writeHead(201, { "Content-Type": "text/plain" });
    response.end("packaged-native-curl-ok");
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    const result = await curly.get(`http://127.0.0.1:${server.address().port}/`, { timeout: 5 });
    assert.equal(result.statusCode, 201);
    assert.equal(result.data, "packaged-native-curl-ok");
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
