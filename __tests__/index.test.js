const fs = require('fs');
const path = require('path');

const rimraf = require('rimraf');
const IceChest = require('../index');

jest.mock('../lib/low-level');
const lowIceChest = require('../lib/low-level');
const cacheLocation = path.resolve(path.join(__dirname, '.cache'));

beforeEach(() => {
  if (process.listeners('beforeEach').length > 0) {
    throw new Error('Whoa! Some assumptions are broken, check me out!');
  }
  rimraf.sync(cacheLocation);
});

afterEach(() => {
  process.removeAllListeners('beforeExit');
});

test('creating and instance of IceChest should create the cacheLocation', () => {
  const iceChest = new IceChest({ cacheLocation });
  expect(() => {
    fs.statSync(cacheLocation);
  }).not.toThrow();
});

test('iceChest instances wrap low-level functions', () => {
  const obj = { test: 1};
  const fakeCacheKey = 'asdf';
  const iceChest = new IceChest({ cacheLocation });
  iceChest.createCacheKey(obj);
  expect(lowIceChest.createCacheKey).toBeCalledWith(obj);
  iceChest.writeToCache(fakeCacheKey, obj);
  expect(lowIceChest.writeToCache).toBeCalledWith(fakeCacheKey, obj, cacheLocation);
  iceChest.loadFromCache(fakeCacheKey);
  expect(lowIceChest.loadFromCache).toBeCalledWith(fakeCacheKey, cacheLocation);
});

test('iceChest hooks up a beforeExit hook when passing a maxCacheSize', () => {
  expect(process.listeners('beforeExit').length).toBe(0); // beforeExit not hooked up.
  const iceChest = new IceChest({
    cacheLocation,
    maxCacheSize: 75, // A single file should exceed the cache size.
  });

  expect(process.listeners('beforeExit').length).toBe(1);
  expect(process.listeners('beforeExit')[0]());
  // expect that performCacheMaintenance was called w/ correct args.
  expect(lowIceChest.performCacheMaintenance).toBeCalledWith(75, cacheLocation);
});

test('iceChest does not hook up beforeExit call when not maxCacheSize is passed', () => {
    expect(process.listeners('beforeExit').length).toBe(0);
    const iceChest = new IceChest({ cacheLocation });
    expect(process.listeners('beforeExit').length).toBe(0);
});
