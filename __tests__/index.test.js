const fs = require('fs');
const path = require('path');

const rimraf = require('rimraf');
const IceChest = require('../index');

jest.mock('../lib/low-level');
const lowIceChest = require('../lib/low-level');
const cacheLocation = path.resolve(path.join(__dirname, '.cache'));

beforeEach(() => {
  rimraf.sync(cacheLocation);
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
