#!/usr/bin/env node
// Packs a WXT-built extension into a signed CRX3 + local update manifest,
// so ai-cloud-operator can force-install it via Chromium's ExtensionSettings
// policy (see that repo's internal/catalog/tracker.go) instead of the
// user-removable --load-extension flag.
//
// Run from a package directory (e.g. packages/claude-tracker) after `wxt
// build` — reads ./.output/chrome-mv3, mirrors it into ./extension/ (the
// prebuilt bundle ai-cloud-operator's install.sh downloads today, kept for
// any --load-extension-based local dev/testing), then packs that same
// content into ./extension.crx.
//
// The signing key (./signing-key.pem) is generated once and reused on every
// subsequent run — the extension's ID is derived entirely from this key
// (see crxIdFromPublicKey), so reusing it is what keeps the ID stable
// across releases. Committed to the repo deliberately: it only pins an ID,
// it doesn't gate distribution (ai-cloud-operator always fetches
// extension.crx from this repo directly, never validates anyone else's
// signature against it).
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync, copyFileSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { generateKeyPairSync, sign as cryptoSign, createHash, createPrivateKey, createPublicKey, constants as cryptoConstants } from "node:crypto";
import { crc32 } from "node:zlib";

// Must match ai-cloud-operator's internal/catalog/tracker.go
// trackerExtensionInstallDir constant exactly — this is where the operator's
// install-tracker-extension init container places extension.crx, and this
// hardcoded codebase is what tells Chromium's policy-driven updater where
// to find it on that same pod's filesystem. No per-deploy templating: every
// workload uses the identical fixed path.
const TRACKER_EXTENSION_INSTALL_DIR = "/extensions/poc";

const SIGNATURE_CONTEXT = Buffer.from("CRX3 SignedData\0", "binary");

function walkFiles(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walkFiles(full, base));
    } else {
      out.push({ full, arcname: relative(base, full).split("\\").join("/") });
    }
  }
  return out;
}

function syncDir(srcDir, destDir) {
  rmSync(destDir, { recursive: true, force: true });
  mkdirSync(destDir, { recursive: true });
  for (const { full, arcname } of walkFiles(srcDir)) {
    const destPath = join(destDir, arcname);
    mkdirSync(dirname(destPath), { recursive: true });
    copyFileSync(full, destPath);
  }
}

// Minimal ZIP writer — stored (uncompressed) entries only, which is all
// CRX3 needs (Chromium decompresses nothing extra beyond the zip format
// itself, and these bundles are a few KB, so there's no benefit to
// implementing deflate here). Fixed 1980-01-01 mod time/date on every
// entry for reproducible output (byte-identical zip given identical
// input), not because the value has any meaning to Chromium.
function buildZip(files) {
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const { arcname, data } of files) {
    const nameBuf = Buffer.from(arcname, "utf8");
    const crc = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0x21, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localChunks.push(localHeader, nameBuf, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0x21, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralChunks.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + data.length;
  }

  const centralStart = offset;
  const centralSize = Buffer.concat(centralChunks).length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralStart, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localChunks, ...centralChunks, eocd]);
}

function encodeVarint(value) {
  const out = [];
  while (true) {
    const b = value & 0x7f;
    value >>>= 7;
    if (value) {
      out.push(b | 0x80);
    } else {
      out.push(b);
      break;
    }
  }
  return Buffer.from(out);
}

function encodeBytesField(fieldNumber, data) {
  const tag = encodeVarint((fieldNumber << 3) | 2);
  return Buffer.concat([tag, encodeVarint(data.length), data]);
}

function crxIdFromPublicKeyDer(pubkeyDer) {
  return createHash("sha256").update(pubkeyDer).digest().subarray(0, 16);
}

function crxIdToExtensionId(crxId) {
  let id = "";
  for (const b of crxId) {
    id += String.fromCharCode(97 + (b >> 4));
    id += String.fromCharCode(97 + (b & 0xf));
  }
  return id;
}

function loadOrCreateKeyPair(keyPath) {
  if (existsSync(keyPath)) {
    return { privateKey: readFileSync(keyPath, "utf8") };
  }
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  writeFileSync(keyPath, privateKey, { mode: 0o600 });
  return { privateKey };
}

function packCrx(extensionDir, keyPath) {
  const { privateKey } = loadOrCreateKeyPair(keyPath);
  const privKeyObj = createPrivateKey(privateKey);
  const pubKeyObj = createPublicKey(privKeyObj);
  const pubkeyDer = pubKeyObj.export({ type: "spki", format: "der" });

  const crxId = crxIdFromPublicKeyDer(pubkeyDer);
  const extensionId = crxIdToExtensionId(crxId);

  const files = walkFiles(extensionDir).map(({ full, arcname }) => ({
    arcname,
    data: readFileSync(full),
  }));
  const zipBytes = buildZip(files);

  const signedHeaderData = encodeBytesField(1, crxId);

  const lengthPrefix = Buffer.alloc(4);
  lengthPrefix.writeUInt32LE(signedHeaderData.length, 0);
  const toSign = Buffer.concat([SIGNATURE_CONTEXT, lengthPrefix, signedHeaderData, zipBytes]);

  const signature = cryptoSign("sha256", toSign, { key: privKeyObj, padding: cryptoConstants.RSA_PKCS1_PADDING });

  const proof = Buffer.concat([encodeBytesField(1, pubkeyDer), encodeBytesField(2, signature)]);

  const header = Buffer.concat([
    encodeVarint((2 << 3) | 2), encodeVarint(proof.length), proof,
    encodeVarint((10000 << 3) | 2), encodeVarint(signedHeaderData.length), signedHeaderData,
  ]);

  const crxVersion = Buffer.alloc(4);
  crxVersion.writeUInt32LE(3, 0);
  const headerLen = Buffer.alloc(4);
  headerLen.writeUInt32LE(header.length, 0);

  const crx = Buffer.concat([Buffer.from("Cr24", "binary"), crxVersion, headerLen, header, zipBytes]);

  return { crx, extensionId };
}

function main() {
  const pkgDir = process.cwd();
  const outputDir = join(pkgDir, ".output", "chrome-mv3");
  const extensionDir = join(pkgDir, "extension");
  const keyPath = join(pkgDir, "signing-key.pem");

  if (!existsSync(outputDir)) {
    console.error(`pack-crx: ${outputDir} not found — run "wxt build" first`);
    process.exit(1);
  }

  syncDir(outputDir, extensionDir);

  const { crx, extensionId } = packCrx(extensionDir, keyPath);
  writeFileSync(join(pkgDir, "extension.crx"), crx);

  const manifest = JSON.parse(readFileSync(join(extensionDir, "manifest.json"), "utf8"));
  const updateManifest = `<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='${extensionId}'>
    <updatecheck codebase='file://${TRACKER_EXTENSION_INSTALL_DIR}/extension.crx' version='${manifest.version}' />
  </app>
</gupdate>
`;
  writeFileSync(join(pkgDir, "update_manifest.xml"), updateManifest);
  writeFileSync(join(pkgDir, "extension.json"), JSON.stringify({ id: extensionId, version: manifest.version }, null, 2) + "\n");

  console.log(`pack-crx: id=${extensionId} version=${manifest.version}`);
}

main();
