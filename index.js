const mkdirp = require('mkdirp');

const lowIceChest = require('./lib/low-level');

class IceChest {
  constructor(options) {
    this.cacheLocation = options.cacheLocation;
    mkdirp.sync(this.cacheLocation);

    const maxCacheSize = options.maxCacheSize;

    if (maxCacheSize) {
      process.once('beforeExit', () => {
        lowIceChest.performCacheMaintenance(maxCacheSize, this.cacheLocation);
      });
    }
  }

  createCacheKey(object) {
    return lowIceChest.createCacheKey(object);
  }

  writeToCache(cacheKey, content) {
    return lowIceChest.writeToCache(cacheKey, content, this.cacheLocation);
  }

  loadFromCache(cacheKey) {
    return lowIceChest.loadFromCache(cacheKey, this.cacheLocation);
  }
}

module.exports = IceChest;
