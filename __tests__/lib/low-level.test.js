const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const glob = require('glob');
const rimraf = require('rimraf');
const mkdirp = require('mkdirp');
const getFolderSize = require('get-folder-size');
const lowIceChest = require('../../lib/low-level');

const cacheLocation = path.resolve(path.join(__dirname, '../.cache'));

beforeEach(() => {
  rimraf.sync(cacheLocation);
});

test('createCacheKey returns a string for an object.', () => {
  expect(typeof lowIceChest.createCacheKey({ test: 1 })).toBe('string');
});

test('createCacheKey on two identical objects should return the same hash', () => {
  const hash1 = lowIceChest.createCacheKey({ test: 1 });
  const hash2 = lowIceChest.createCacheKey({ test: 1 });
  expect(hash1).toBe(hash2);
});

test('createCacheKey should return different hashes for two different objects', () => {
  const hash1 = lowIceChest.createCacheKey({ test: 1 });
  const hash2 = lowIceChest.createCacheKey({ test: 2 });
  expect(hash1).not.toBe(hash2);
});

test('writeToCache returns a promise', () => {
  const obj = { test: 1 };
  const cacheKey = lowIceChest.createCacheKey(obj);
  const result = lowIceChest.writeToCache(cacheKey, obj, cacheLocation);
  expect(result instanceof Promise).toBeTruthy();
  return result;
});

test('writeToCache writes JSON serialized data to the cache directory', () => {
  const obj = { test: 1 };
  const cacheKey = lowIceChest.createCacheKey(obj);
  return lowIceChest.writeToCache(cacheKey, obj, cacheLocation).then(() => {
    const fileLocation = path.join(cacheLocation, `${cacheKey}.json`);
    const writtenObject = JSON.parse(fs.readFileSync(fileLocation));
    // deep equal, different refernce
    expect(writtenObject).toEqual(obj);
  });
});

test('loadFromCache returns the JSON parsed object stored there', () => {
  const obj = { test: 1 };
  const fakeCacheKey = 'abcd';
  mkdirp.sync(cacheLocation);
  fs.writeFileSync(path.join(cacheLocation, `${fakeCacheKey}.json`), JSON.stringify(obj));
  return lowIceChest.loadFromCache(fakeCacheKey, cacheLocation).then((readObject) => {
    expect(readObject).toEqual(obj);
  });
});

test('loadFromCache support gzipped files', () => {
  const obj = { test: 1 };
  const fakeCacheKey = 'abcd';
  mkdirp.sync(cacheLocation);
  const gzippedBuffer = zlib.gzipSync(JSON.stringify(obj));
  fs.writeFileSync(path.join(cacheLocation, `${fakeCacheKey}.json.gz`), gzippedBuffer);
  return lowIceChest.loadFromCache(fakeCacheKey, cacheLocation).then((readObject) => {
    expect(readObject).toEqual(obj);
  });
});

test('loadFromCache reads gzippedContent correctly', () => {
  const fileSize = 100;
  // TODO - test this assumption in Windows/Mac OSX
  // 4096 is the size of an empty folder in linux
  const maxCacheSize = 4096 + fileSize;
  const content = 'a'.repeat(fileSize * 2);
  const cacheKey = lowIceChest.createCacheKey(content);
  return lowIceChest.writeToCache(cacheKey, content, cacheLocation).then(() => {
    return lowIceChest.performCacheMaintenance(maxCacheSize, cacheLocation).then(() => {
      return lowIceChest.loadFromCache(cacheKey, cacheLocation).then(retrievedContent => {
        const filePath = path.join(cacheLocation, cacheKey);
        expect(glob.sync(`${filePath}.json`).length).toBe(0);
        expect(glob.sync(`${filePath}.json.gz`).length).toBe(1);
        expect(retrievedContent).toBe(content);
      });
    });
  });
});

test('performCacheMaintenance gzips files to keep cache folder smaller than maxCacheSize', () => {
  const fileSize = 10000; // 10,000 bytes
  const filesToCache = 3;
  const maxCacheSize = fileSize * 0.75; // cache is too small to hold even a single file.

  const writePromises = [];
  for(let fileNumber = 0; fileNumber < filesToCache; fileNumber++) {
    const content = `${fileNumber}`.repeat(fileSize + fileNumber);
    const cacheKey = lowIceChest.createCacheKey(content);
    writePromises.push(lowIceChest.writeToCache(cacheKey, content, cacheLocation));
  }

  return Promise.all(writePromises).then(() => {
    return lowIceChest.performCacheMaintenance(maxCacheSize, cacheLocation).then(() => {
      return new Promise(resolve => {
        getFolderSize(cacheLocation, (err, size) => {
          expect(size).toBeLessThan(maxCacheSize);
          resolve();
        });
      });
    });
  });
});

/**
 * Set the max cache size large enough to hold a single file that is
 * uncompressed, but store 3 files in cache. This should trigger compression
 * on two of the three files, but not all of them.
 */
test('performCacheMaintenance gzips only enough files to stay under the passed limit', () => {
  const fileSize = 10000; // 10,000 bytes
  const filesToCache = 3;
  const maxCacheSize = fileSize * 1.5;
  const originalGzip = zlib.gzip; // store a reference
  zlib.gzip = jest.fn().mockImplementation((buffer, cb) => {
    return originalGzip(buffer, cb);
  });

  const writePromises = [];
  for(let fileNumber = 0; fileNumber < filesToCache; fileNumber++) {
    const content = `${fileNumber}`.repeat(fileSize + fileNumber);
    const cacheKey = lowIceChest.createCacheKey(content);
    writePromises.push(lowIceChest.writeToCache(cacheKey, content, cacheLocation));
  }

  return Promise.all(writePromises).then(() => {
    return lowIceChest.performCacheMaintenance(maxCacheSize, cacheLocation).then(() => {
      expect(zlib.gzip.mock.calls.length).toBe(2);
      zlib.gzip = originalGzip; // reset the function
    });
  });
});

test('performCacheMaintenance deletes files if it cannot compress files to create space', () => {
  const fileSize = 10000; // 10,000 bytes
  const filesToCache = 3;
  // 10 bytes, no way anything fits in this, should delete everything.
  const maxCacheSize = 10;

  const writePromises = [];
  for(let fileNumber = 0; fileNumber < filesToCache; fileNumber++) {
    const content = `${fileNumber}`.repeat(fileSize + fileNumber);
    // hack to avoid equal fileSizes
    const fileContent = lowIceChest.createCacheKey(`${fileNumber}`).repeat(fileSize);
    const cacheKey = lowIceChest.createCacheKey(content);
    writePromises.push(lowIceChest.writeToCache(cacheKey, fileContent, cacheLocation));
  }

  return Promise.all(writePromises).then(() => {
    return lowIceChest.performCacheMaintenance(maxCacheSize, cacheLocation).then(() => {
      const filesLeft = glob.sync(path.join(cacheLocation, '*')).length;
      // cache is super smaller, so everything should have been deleted to stay
      // under limits.
      expect(filesLeft).toBe(0);
    });
  });
});
