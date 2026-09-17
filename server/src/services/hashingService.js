const crypto = require('crypto');
const fs = require('fs');

/**
 * Service to calculate authoritative SHA-256 hashes from file streams or buffers.
 * Never trusts client-supplied digests.
 */
class HashingService {
  /**
   * Calculate SHA-256 hash from a local file path using streams.
   * Ensures zero memory exhaustion even for multi-gigabyte files.
   * @param {string} filePath
   * @returns {Promise<string>} 64-character lowercase hex string
   */
  static calculateFileSha256(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (chunk) => {
        hash.update(chunk);
      });

      stream.on('end', () => {
        const sha256Hex = hash.digest('hex').toLowerCase();
        resolve(sha256Hex);
      });

      stream.on('error', (err) => {
        reject(new Error(`Failed to calculate SHA-256 hash: ${err.message}`));
      });
    });
  }

  /**
   * Calculate SHA-256 from an in-memory buffer.
   * @param {Buffer} buffer
   * @returns {string} 64-character lowercase hex string
   */
  static calculateBufferSha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex').toLowerCase();
  }

  /**
   * Convert a 64-character hex string to a bytes32 formatted hex string (0x...)
   * @param {string} hexString
   * @returns {string}
   */
  static hexToBytes32(hexString) {
    const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
    if (cleanHex.length !== 64) {
      throw new Error(`Invalid SHA-256 hex length: expected 64 chars, got ${cleanHex.length}`);
    }
    return `0x${cleanHex}`;
  }

  /**
   * Convert bytes32 on-chain string to clean 64-char lowercase hex
   * @param {string} bytes32String
   * @returns {string}
   */
  static bytes32ToHex(bytes32String) {
    const clean = bytes32String.startsWith('0x') ? bytes32String.slice(2) : bytes32String;
    return clean.toLowerCase();
  }
}

module.exports = HashingService;
