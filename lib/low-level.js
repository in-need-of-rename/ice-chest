const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const mkdirp = require('mkdirp');

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

module.exports = {
  loadFromCache,
  createCacheKey,
  writeToCache,
};
