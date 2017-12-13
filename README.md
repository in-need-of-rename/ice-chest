# ice-chest

ice-chest is a caching library that makes it easier to create and manage a cache.

## Usage

```js
const IceChest = require('ice-chest');

const iceChest = new IceChest({
  cacheLocation: '/path/to/cache/location',
  maxCacheSize: 1024 * 1024 * 2, // Size in byte, optional
});

// This has to be JSON.serializable, ice-chest will not check this for you.
const contentToCache = {
  somekey: 'Some value that is very expensive to compute',
};

const cacheKey = iceChest.createCacheKey(contentToCache);
const write = iceChest.writeToCache(cacheKey, contentToCache); // returns a Promise

write.then(() => {
  // loadFromCache also returns a promise.
  iceChest.loadFromCache(cacheKey).then(cachedContent => {
    console.log(cachedContent); // deep equals contentToCache
  });
});
```

 **Constructor Options**

`cacheLocation` - Absolute path to the folder that you would like to use for caching.

`maxCacheSize` - Optional, max cache size in bytes. If this flag is passed, ice-chest will attempt to compress/delete old files from your cache to stay under the limit on process exit.

**Note:** `maxCacheSize` is only respected when the process is exiting, during the process run you may temporarily exceed the maxCacheSize. It's important to have sufficient free disk space.

### FAQ

Why not compress at write time instead of process exit?
 - Compression in node is super slow, if you're writing lots of stuff to the cache this will significantly slow down your application.

Can I provide my own cache key generating function?
 - No, but you can use your own function to generate the key, and skip the call to `generateCacheKey` altogether.
