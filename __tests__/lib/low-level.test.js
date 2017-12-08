const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const rimraf = require('rimraf');
const mkdirp = require('mkdirp');
const lowIceChest = require('../../lib/low-level');

const cacheLocation = path.resolve(path.join(__dirname, '../.cache'));

beforeEach(() => {
  rimraf.sync(cacheLocation);
});

test('createCacheKey returns a string for an object.', () => {
  expect(typeof lowIceChest.createCacheKey({ test: 1})).toBe('string');
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