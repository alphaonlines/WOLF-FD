"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.sha256Hex = sha256Hex;
exports.createSessionToken = createSessionToken;
const crypto_1 = require("crypto");
function hashPassword(password, saltHex) {
    const salt = saltHex || (0, crypto_1.randomBytes)(16).toString("hex");
    const derived = (0, crypto_1.scryptSync)(password, salt, 64);
    return `scrypt$${salt}$${derived.toString("hex")}`;
}
function verifyPassword(password, storedHash) {
    if (!storedHash || typeof storedHash !== "string")
        return false;
    const parts = storedHash.split("$");
    if (parts.length !== 3 || parts[0] !== "scrypt")
        return false;
    const salt = parts[1];
    const digestHex = parts[2];
    if (!salt || !digestHex)
        return false;
    const expected = Buffer.from(digestHex, "hex");
    const actual = (0, crypto_1.scryptSync)(password, salt, expected.length);
    return expected.length === actual.length && (0, crypto_1.timingSafeEqual)(expected, actual);
}
function sha256Hex(value) {
    return (0, crypto_1.createHash)("sha256").update(value).digest("hex");
}
function createSessionToken() {
    return (0, crypto_1.randomBytes)(32).toString("hex");
}
//# sourceMappingURL=authCrypto.js.map