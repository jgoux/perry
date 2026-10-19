// Storage's object info route is an async arrow returning an async function that awaits a lookup
// and then throws when the bucket is missing. Fastify attaches its rejection handler to the
// returned promise; the wasm module delivered the error to that handler for one shape of the
// check and to the uncaught-exception hook for another, which exits Storage.
const seen = [];
process.on('uncaughtException', (e) => { seen.push('UNCAUGHT ' + (e && e.message)); });

class NotFound extends Error {
  constructor(name) { super('Bucket not found'); this.name = 'StorageBackendError'; this.resource = name; }
}
const q = {
  async findBucket(id) { return id === 'none' ? undefined : { id, public: id === 'pub' }; },
  async hasMigration() { return true; },
};

async function handlerA(request, publicRoute = false, method = 'head') {
  const { bucketName } = request.params;
  const bucket = await q.findBucket(bucketName, 'id,public', { dontErrorOnEmpty: true });
  if (!request.isAuthenticated) {
    if (!bucket?.public) throw new NotFound(bucketName);
  }
  if (!bucket) throw new NotFound(bucketName);
  return { method, publicRoute, bucket };
}
async function handlerB(request) {
  const bucket = await q.findBucket(request.params.bucketName);
  if (!bucket) throw new NotFound(request.params.bucketName);
  return { bucket };
}
async function handlerC(request) {
  const bucket = await q.findBucket(request.params.bucketName);
  if (!request.isAuthenticated) { if (!bucket?.public) throw new NotFound('x'); }
  return { bucket };
}
async function handlerD(request) {
  const bucket = await q.findBucket(request.params.bucketName);
  if (!bucket) throw new NotFound(request.params.bucketName);
  const migrated = await q.hasMigration('m');
  return { bucket, migrated };
}

const routes = {
  A: async (req) => handlerA(req, false, 'info'),
  A2: async (req) => handlerA(req),
  B: async (req) => handlerB(req),
  C: async (req) => handlerC(req),
  D: async (req) => handlerD(req),
};

function wrapThenable(p, label) {
  return new Promise((resolve) => {
    p.then(
      (v) => { console.log(label, 'resolved', JSON.stringify(v)); resolve(); },
      (e) => { console.log(label, 'rejected', e && e.name, e && e.message); resolve(); });
  });
}

(async () => {
  const cases = [
    ['A', { params: { bucketName: 'b' }, isAuthenticated: true }],
    ['A', { params: { bucketName: 'none' }, isAuthenticated: true }],
    ['A', { params: { bucketName: 'b' }, isAuthenticated: false }],
    ['A2', { params: { bucketName: 'none' }, isAuthenticated: true }],
    ['B', { params: { bucketName: 'none' }, isAuthenticated: true }],
    ['C', { params: { bucketName: 'b' }, isAuthenticated: false }],
    ['D', { params: { bucketName: 'none' }, isAuthenticated: true }],
  ];
  for (const [name, req] of cases) {
    await wrapThenable(routes[name](req), name + ':' + req.params.bucketName + ':' + req.isAuthenticated);
    await new Promise((r) => setTimeout(r, 5));
  }
  console.log('uncaught:', JSON.stringify(seen));
})();
