export default async (canvas, uri, arg) => {
  return new Promise(async (resolve, reject) => {      
    const fetchPkg = async () => {
      // Open the local database used to cache packages
      const db = await new Promise((resolve, reject) => {
        //const indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
        const req = indexedDB.open('NET_LOCJAM_PRELOAD_CACHE', 1);
        req.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (db.objectStoreNames.contains('PACKAGES')) {
            db.deleteObjectStore('PACKAGES');
          };
          if (db.objectStoreNames.contains('ETAGS')) {
            db.deleteObjectStore('ETAGS');
          };
          db.createObjectStore('PACKAGES');
          db.createObjectStore('ETAGS');
        };
        req.onerror = (error) => {
          reject(error);
        };
        req.onsuccess = (event) => {
          resolve(event.target.result);
        };
      });

      // get remote file's ETag
      let res = await fetch(uri, {method: 'HEAD'});
      if (!res.ok) {
        alert('Could not fetch the love package');
        return null;
      }
      const etag = res.headers.get("Etag");

      let data = null;

      if (etag) {       
        // Check if there's a cached package, and if so whether it's the latest available
        var results = await new Promise((resolve, reject) => {
          const trans = db.transaction(['PACKAGES', 'ETAGS'], 'readonly');
          const packages = trans.objectStore('PACKAGES');
          const etags = trans.objectStore('ETAGS');
          const packagesRequest = packages.get(uri);
          const etagsRequest = etags.get(uri);
          let results = {};
          packagesRequest.onsuccess = (event) => {
            results.package = event.target.result;
          };
          etagsRequest.onsuccess = (event) => {
            results.etag = event.target.result;
          };

          trans.oncomplete = (event) => {
            resolve(results);
          }
          trans.onerror = (error) => {
            reject(error);
          };
        });
        if (results.etag == etag)
          data = results.package;
      };

      // Fetch the package remotely, if we do not have it in local storage
      if (!data || !(data instanceof Uint8Array)) {
        console.log('fetching ' + uri + ' remotely');
        const res = await fetch(uri);
        if (!res.ok)
          return reject('Could not fetch the love package');
        data = await res.arrayBuffer();
        // Check if the header is a valid ZIP archive
        data = new Uint8Array(data);
        const head = [80,75,3,4];
        for (let i = 0; i < head.length; i++)
          if (data[i] != head[i])
            return reject('The fetched resource is not a valid love package');
        // Cache remote package for subsequent requests
        await new Promise((resolve, reject) => {
          const trans = db.transaction(['PACKAGES', 'ETAGS'], 'readwrite');
          const packages = trans.objectStore('PACKAGES');
          const etags = trans.objectStore('ETAGS');
          packages.put(data, uri);
          etags.put(etag, uri);

          trans.oncomplete = (event) => {
            resolve();
          }
          trans.onerror = (error) => {
            reject(error);
          };
        });
      }
      else {
        console.log('fetching ' + uri + ' from cache');
      };
      return data;
    }
    
    const data = await fetchPkg();
    const pkg = 'game.love'; //uri.substring(uri.lastIndexOf('/') + 1);
    
    let Module = {};

    const mem = (navigator.deviceMemory || 1)*1e+9;
    Module.INITIAL_MEMORY = Math.min(4*data.length + 2e+7, mem);
    Module.canvas = canvas;
    Module.printErr = window.onerror;
    
    Module.arguments = [pkg];
    if (arg && Array.isArray(arg))
      for (let i = 0; i < arg.length; i++)
        Module.arguments.push(String(arg[i]));

    const runWithFS = async () => {
      Module.addRunDependency('fp '+pkg);

      // Copy the entire loaded file into a spot in the heap.
      // Files will refer to slices in the heap, but cannot be freed
      // (we may be allocating before malloc is ready, during startup).
      if (Module['SPLIT_MEMORY'])
        Module.printErr('warning: you should run the file packager with --no-heap-copy when SPLIT_MEMORY is used, otherwise copying into the heap may fail due to the splitting');

      //const data = await fetchPkg();
      const ptr = Module.getMemory(data.length);
      Module['HEAPU8'].set(data, ptr);
      Module.FS_createDataFile(pkg, null, data, true, true, true);
      Module.removeRunDependency('fp '+pkg);
      resolve(Module);
      Module.finishedDataFileDownloads ++;
    }

    if (Module.calledRun) {
      runWithFS();
    } else {
      // FS is not initialized yet, wait for it
      if (!Module.preRun)
        Module.preRun = [];
      Module.preRun.push(runWithFS);
    }

    if (window.Love === undefined) {
      // this operation initiates local storage
      let s = document.createElement('script');
      s.type = 'text/javascript';
      s.src = 'love/love.js';
      s.async = true;
      s.onload = () => {
        Love(Module);
      };
      document.body.appendChild(s);
    } else {
      window.Module.pauseMainLoop();
      Love(Module);
    }

    Module._luaCode = "";
    Module._getLuaCode = function() {
      let s = Module._luaCode;
      Module._luaCode = "";
      return s;
    }

    window.Module = Module;
  });
};
