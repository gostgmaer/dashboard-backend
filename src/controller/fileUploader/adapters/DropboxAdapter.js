const StorageAdapter = require('./StorageAdapter');
const { storage } = require('../../../config/setting');
const http = require('http');
const https = require('https');

class DropboxAdapter extends StorageAdapter {
  constructor() {
    super();
    this.accessToken = storage.dropbox?.accessToken || process.env.DROPBOX_ACCESS_TOKEN;
    this.rootPath = storage.dropbox?.rootPath || process.env.DROPBOX_ROOT_PATH || '';
  }

  formatPath(destinationPath) {
    let p = destinationPath.startsWith('/') ? destinationPath : '/' + destinationPath;
    if (this.rootPath) {
      const root = this.rootPath.startsWith('/') ? this.rootPath : '/' + this.rootPath;
      p = root.replace(/\/$/, '') + p;
    }
    return p;
  }

  async uploadBuffer(buffer, destinationPath, options = {}) {
    return new Promise((resolve, reject) => {
      const formattedPath = this.formatPath(destinationPath);
      const dbxArgs = JSON.stringify({
        path: formattedPath,
        mode: 'overwrite',
        autorename: true,
        mute: false,
        strict_conflict: false
      });

      const reqOptions = {
        hostname: 'content.dropboxapi.com',
        path: '/2/files/upload',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Dropbox-API-Arg': dbxArgs,
          'Content-Type': 'application/octet-stream',
          'Content-Length': buffer.length
        }
      };

      const req = https.request(reqOptions, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const data = JSON.parse(body);
              resolve({
                success: true,
                path: destinationPath,
                id: data.id,
                size: data.size,
                location: `https://www.dropbox.com/home${formattedPath}`
              });
            } catch (err) {
              resolve({ success: true, path: destinationPath, raw: body });
            }
          } else {
            reject(new Error(`Dropbox upload failed (${res.statusCode}): ${body}`));
          }
        });
      });

      req.on('error', (err) => reject(new Error(`Dropbox connection error: ${err.message}`)));
      req.write(buffer);
      req.end();
    });
  }

  async uploadStream(stream, destinationPath, options = {}) {
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    return this.uploadBuffer(buffer, destinationPath, options);
  }

  async getDownloadStream(destinationPath) {
    return new Promise((resolve, reject) => {
      const formattedPath = this.formatPath(destinationPath);
      const dbxArgs = JSON.stringify({ path: formattedPath });

      const reqOptions = {
        hostname: 'content.dropboxapi.com',
        path: '/2/files/download',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Dropbox-API-Arg': dbxArgs
        }
      };

      const req = https.request(reqOptions, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res);
        } else {
          let body = '';
          res.on('data', (chunk) => body += chunk);
          res.on('end', () => reject(new Error(`Dropbox download failed (${res.statusCode}): ${body}`)));
        }
      });

      req.on('error', (err) => reject(new Error(`Dropbox download connection error: ${err.message}`)));
      req.end();
    });
  }

  async getSignedUrl(destinationPath, options = {}) {
    return new Promise((resolve, reject) => {
      const formattedPath = this.formatPath(destinationPath);
      const payload = JSON.stringify({
        path: formattedPath,
        settings: { requested_visibility: 'public' }
      });

      const reqOptions = {
        hostname: 'api.dropboxapi.com',
        path: '/2/sharing/create_shared_link_with_settings',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(reqOptions, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.url) {
              const directUrl = data.url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
              resolve(directUrl);
            } else if (res.statusCode === 409) {
              // Link already exists
              this.getExistingLink(formattedPath).then(resolve).catch(reject);
            } else {
              reject(new Error(`Dropbox share link failed: ${body}`));
            }
          } catch (err) {
            reject(new Error(`Dropbox parse error: ${err.message}`));
          }
        });
      });

      req.on('error', (err) => reject(new Error(`Dropbox share link error: ${err.message}`)));
      req.write(payload);
      req.end();
    });
  }

  async getExistingLink(formattedPath) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({ path: formattedPath });

      const reqOptions = {
        hostname: 'api.dropboxapi.com',
        path: '/2/sharing/list_shared_links',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(reqOptions, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.links && data.links.length > 0) {
              resolve(data.links[0].url.replace('www.dropbox.com', 'dl.dropboxusercontent.com'));
            } else {
              reject(new Error('No existing shared link found'));
            }
          } catch (err) {
            reject(err);
          }
        });
      });

      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  async delete(destinationPath) {
    return new Promise((resolve, reject) => {
      const formattedPath = this.formatPath(destinationPath);
      const payload = JSON.stringify({ path: formattedPath });

      const reqOptions = {
        hostname: 'api.dropboxapi.com',
        path: '/2/files/delete_v2',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(reqOptions, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, path: destinationPath });
          } else {
            reject(new Error(`Dropbox delete failed (${res.statusCode}): ${body}`));
          }
        });
      });

      req.on('error', (err) => reject(new Error(`Dropbox delete error: ${err.message}`)));
      req.write(payload);
      req.end();
    });
  }

  async copy(sourcePath, destPath) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        from_path: this.formatPath(sourcePath),
        to_path: this.formatPath(destPath),
        autorename: true
      });

      const reqOptions = {
        hostname: 'api.dropboxapi.com',
        path: '/2/files/copy_v2',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(reqOptions, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, sourcePath, destPath });
          } else {
            reject(new Error(`Dropbox copy failed (${res.statusCode}): ${body}`));
          }
        });
      });

      req.on('error', (err) => reject(new Error(`Dropbox copy error: ${err.message}`)));
      req.write(payload);
      req.end();
    });
  }

  async getMetadata(destinationPath) {
    return new Promise((resolve, reject) => {
      const formattedPath = this.formatPath(destinationPath);
      const payload = JSON.stringify({ path: formattedPath });

      const reqOptions = {
        hostname: 'api.dropboxapi.com',
        path: '/2/files/get_metadata',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(reqOptions, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const data = JSON.parse(body);
              resolve({
                size: data.size,
                name: data.name,
                serverModified: data.server_modified,
                id: data.id
              });
            } catch (err) {
              reject(err);
            }
          } else {
            reject(new Error(`Dropbox getMetadata failed (${res.statusCode}): ${body}`));
          }
        });
      });

      req.on('error', (err) => reject(new Error(`Dropbox metadata error: ${err.message}`)));
      req.write(payload);
      req.end();
    });
  }
}

module.exports = DropboxAdapter;
