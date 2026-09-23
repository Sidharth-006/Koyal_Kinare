const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
  const origLookup = dns.lookup;
  dns.lookup = function (hostname, options, callback) {
    let cb = callback;
    let opts = options;
    if (typeof options === 'function') {
      cb = options;
      opts = {};
    } else if (typeof options === 'number') {
      opts = { family: options };
    }

    origLookup(hostname, opts, (err, address, family) => {
      if (err && typeof hostname === 'string' && hostname.includes('neon.tech')) {
        dns.resolve4(hostname, (rErr, addresses) => {
          if (!rErr && addresses && addresses.length > 0) {
            if (opts && opts.all) {
              return cb(null, addresses.map(a => ({ address: a, family: 4 })));
            }
            return cb(null, addresses[0], 4);
          }
          return cb(err, address, family);
        });
      } else {
        cb(err, address, family);
      }
    });
  };
} catch (e) {
  // Ignore
}
