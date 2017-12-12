const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const glob = require('glob');
const mkdirp = require('mkdirp');
const getFolderSize = require('get-folder-size');

/**
 * Create a hexadecimal hash from string content.
 */
function createHashFromString(content) {
  const hash = crypto.createHash('sha256');
  hash.update(content);
  return hash.digest('hex');
}

/**
 * Load an entry from cache.
 * All cache files are JSON, so they can be required or JSON.parsed.
 * We support loading *.json.gz first as unzipping is very fast, and we want to
 * encourage compression in the cache directory.
 */
function loadFromCache(cacheKey, cacheLocation) {
  const cachePath = path.join(cacheLocation, `${cacheKey}.json`);
  const compressedCachePath = path.join(cacheLocation, `${cacheKey}.json.gz`);
  return new Promise((resolve, reject) => {
    fs.readFile(compressedCachePath, (err, buffer) => {
      if (err) {
        try {
          // eslint-disable-next-line global-require, import/no-dynamic-require
          resolve(require(cachePath));
        } catch (e) {
          reject(e);
        }
      } else {
        zlib.unzip(buffer, (zError, zBuffer) => {
          if (zError) {
            reject(zError);
          } else {
            resolve(JSON.parse(zBuffer));
          }
        });
      }
    });
  });
}

/**
 * Create a hexadecimal cache key for a given JSON serializable object.
 */
function createCacheKey(object) {
  return createHashFromString(JSON.stringify(object));
}

/**
 * Write a JSON.stringify'able object to cache.
 * Originally I explored compressing the output to save disk size, but this was
 * too slow. zlib uses a thread pool for compressing, which are oversaturated
 * on super huge builds.
 *
 * https://nodejs.org/api/zlib.html#zlib_threadpool_usage
 *
 * Potential alternatives -
 * Have ice-chest gzip cache contents while idle.
 * Set aside some static time for enabling compression after the build (5s?).
 * Use a cacheSizeLimit option, and compress/delete as needed
 */
function writeToCache(cacheKey, content, cacheLocation) {
  return new Promise((resolve, reject) => {
    mkdirp(cacheLocation, () => {
      const location = path.join(cacheLocation, `${cacheKey}.json`);
      fs.writeFile(location, JSON.stringify(content), (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
}

/**
 * Attempt to gzip the passed filePath, and delete the original to save space.
 */
function compressFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (readErr, buffer) => {
      if (readErr) reject(readErr);
      zlib.gzip(buffer, (zErr, zBuffer) => {
        if (zErr) reject(zErr);
        fs.writeFile(`${filePath}.gz`, zBuffer, (writeErr) => {
          if(writeErr) reject(writeErr);
          fs.unlink(filePath, (unlinkErr) => {
            if (unlinkErr) reject(unlinkErr);
            resolve();
          });
        });
      });
    });
  });
}

/**
 * Naive implementation of cache compression.
 * It will first attempt to compress enough cached assets to stay within the
 * passed limits. If after compressing, we're still beyond limits it'll start
 * deleting files.
 *
 * Note: Gzipping in node is extremely slow. Only gzip as much as necessary.
 * Note2: Shelling out is extremely fast! Can we detect success/failure here.
 */
function performCacheMaintenance(maxSize, cacheLocation) {
  return new Promise((resolve, reject) => {
    getFolderSize(cacheLocation, (err, currentSize) => {
      if (err) reject(err);
      const targetCompressionSize = currentSize - maxSize;
      if (targetCompressionSize > 0) {
        glob(path.join(cacheLocation, '*.json'), (globErr, files) => {
          if (globErr) reject(globErr);
          let compressing = 0;
          const filesToCompress = [];
          files
            .map(filePath => {
              return {
                path: filePath,
                size: fs.statSync(filePath).size,
              };
            })
            .sort((fileA, fileB) => fileB.size - fileA.size)
            .forEach(file => {
              if (compressing < targetCompressionSize) {
                compressing = compressing + file.size;
                filesToCompress.push(file.path);
              }
            });

            const compressionPromises = filesToCompress.map(compressFile);
            Promise.all(compressionPromises).then(() => { resolve(); });
        });
      } else {
        resolve();
      }
    });
  });
}

module.exports = {
  loadFromCache,
  createCacheKey,
  performCacheMaintenance,
  writeToCache,
};
