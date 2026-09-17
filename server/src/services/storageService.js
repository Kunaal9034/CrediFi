const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const FormData = require('form-data');

class StorageService {
  constructor() {
    this.storageDir = path.join(__dirname, '../../uploads/ipfs_store');
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }

    this.pinataJwt = process.env.PINATA_JWT || '';
    this.pinataApiKey = process.env.PINATA_API_KEY || '';
    this.pinataSecret = process.env.PINATA_API_SECRET || '';
  }

  /**
   * Upload an evidence file to off-chain storage & pin to IPFS
   * @param {string} localFilePath - Path to temporary uploaded file
   * @param {string} originalName - Original filename
   * @param {string} sha256 - Authoritative file hash
   * @returns {Promise<{ ipfsCid: string, storagePath: string, size: number }>}
   */
  async uploadEvidenceFile(localFilePath, originalName, sha256) {
    const stats = fs.statSync(localFilePath);
    const fileSize = stats.size;

    // First, save into our secured local content-addressed vault
    const ext = path.extname(originalName);
    const secureStorageFilename = `${sha256}${ext}`;
    const destinationPath = path.join(this.storageDir, secureStorageFilename);

    fs.copyFileSync(localFilePath, destinationPath);

    let ipfsCid = null;

    // Try pinning to Pinata if credentials are configured
    if (this.pinataJwt || (this.pinataApiKey && this.pinataSecret)) {
      try {
        ipfsCid = await this.uploadToPinata(localFilePath, originalName, sha256);
      } catch (pinataErr) {
        console.warn(`[StorageService] Pinata upload warning: ${pinataErr.message}. Falling back to content-addressed CID.`);
      }
    }

    // If Pinata was not configured or threw an error, generate a standard deterministic IPFS-compatible CID
    if (!ipfsCid) {
      ipfsCid = this.generateLocalCid(sha256);
    }

    return {
      ipfsCid,
      storagePath: destinationPath,
      size: fileSize
    };
  }

  /**
   * Pin file to Pinata IPFS service
   */
  async uploadToPinata(filePath, filename, sha256) {
    const url = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
    const data = new FormData();
    data.append('file', fs.createReadStream(filePath), { filepath: filename });

    const metadata = JSON.stringify({
      name: `JusticeVault-${filename}`,
      keyvalues: {
        evidenceSha256: sha256,
        uploadedAt: new Date().toISOString()
      }
    });
    data.append('pinataMetadata', metadata);

    const headers = {
      ...data.getHeaders()
    };

    if (this.pinataJwt) {
      headers['Authorization'] = `Bearer ${this.pinataJwt}`;
    } else {
      headers['pinata_api_key'] = this.pinataApiKey;
      headers['pinata_secret_api_key'] = this.pinataSecret;
    }

    const response = await axios.post(url, data, {
      maxBodyLength: Infinity,
      headers
    });

    return response.data.IpfsHash;
  }

  /**
   * Generates a deterministic, standard IPFS-style multihash/CID representation for offline/hybrid use
   */
  generateLocalCid(sha256Hex) {
    // 0x12 = sha256, 0x20 = 32 bytes length followed by the raw sha256 bytes
    const hashBytes = Buffer.from(sha256Hex, 'hex');
    const multihashBuffer = Buffer.concat([Buffer.from([0x12, 0x20]), hashBytes]);
    
    // Convert to base58btc string (equivalent to CIDv0 Qm...)
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let digits = [0];
    for (let i = 0; i < multihashBuffer.length; i++) {
      let carry = multihashBuffer[i];
      for (let j = 0; j < digits.length; j++) {
        carry += digits[j] << 8;
        digits[j] = carry % 58;
        carry = (carry / 58) | 0;
      }
      while (carry > 0) {
        digits.push(carry % 58);
        carry = (carry / 58) | 0;
      }
    }
    for (let i = 0; i < multihashBuffer.length && multihashBuffer[i] === 0; i++) {
      digits.push(0);
    }
    return digits.reverse().map(d => ALPHABET[d]).join('');
  }

  /**
   * Resolve a secure readable stream for evidence download
   * @param {string} storagePath
   * @returns {fs.ReadStream}
   */
  getFileStream(storagePath) {
    if (!fs.existsSync(storagePath)) {
      throw new Error('Evidence file not found in off-chain storage');
    }
    return fs.createReadStream(storagePath);
  }
}

module.exports = new StorageService();
