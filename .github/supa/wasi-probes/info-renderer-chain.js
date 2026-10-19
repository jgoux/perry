// Storage's object info route renders through InfoRenderer -> HeadRenderer -> Renderer: an
// async getAsset that awaits super.getAsset and spreads the result, and a setHeaders override
// that calls helpers inherited from the grandparent. The wasm module answered 500
// "TypeError: value is not a function" there while the native build and node did not.
function check(name, fn) {
  return Promise.resolve().then(fn).then(
    (v) => console.log(name, 'ok', JSON.stringify(v)),
    (e) => console.log(name, 'ERR', e && e.name, e && e.message));
}

class A { async m(x) { return { a: x }; } n(x) { return 'A.n' + x; } }
class B extends A { async m(x) { const h = await super.m(x); return { ...h, b: 2 }; } }
class C extends B { async m(x) { const h = await super.m(x); return { ...h, c: 3 }; } }
class D extends A { async m(x) { return super.m(x); } }
class E extends A { async m(x) { const h = super.m(x); return h; } }
class F extends A { m(x) { return super.m(x); } }
class G extends A { async m(x) { await null; return super.n(x); } }

// Renderer / HeadRenderer / InfoRenderer, reduced to the call shapes Storage uses.
class Renderer {
  async render(request, response, options) {
    try {
      const data = await this.getAsset(request, options);
      try {
        this.setHeaders(request, response, data, options);
        return response.send(data.body);
      } catch (err) {
        throw err;
      }
    } catch (err) {
      throw err;
    }
  }
  setHeaders(request, response, data, options) {
    response.status(200).header('Accept-Ranges', 'bytes');
  }
  setLastModifiedHeader(response, lastModified) {
    if (lastModified && !Number.isNaN(lastModified.getTime())) {
      response.header('Last-Modified', lastModified.toUTCString());
    }
  }
  setContentLengthHeader(response, contentLength) {
    if (contentLength !== undefined) response.header('Content-Length', contentLength);
  }
  setCacheControlHeader(response, values) {
    const cc = values.filter((v) => typeof v === 'string' && v.length > 0);
    if (cc.length > 0) response.header('Cache-Control', cc.join(', '));
  }
}
class ImageRenderer {
  static applyTransformation(options) {
    const segments = [];
    if (options.width) segments.push(`width:${options.width}`);
    return segments;
  }
}
class HeadRenderer extends Renderer {
  async getAsset(request, options) {
    const { object } = options;
    if (!object) throw new Error('NoSuchKey');
    return { metadata: { size: 5, mimetype: 'text/plain', eTag: '"e"', lastModified: new Date(0) },
             transformations: ImageRenderer.applyTransformation(request.query) };
  }
}
class InfoRenderer extends HeadRenderer {
  async getAsset(request, options) {
    const headAsset = await super.getAsset(request, options);
    const obj = options.object;
    return {
      ...headAsset,
      transformations: ImageRenderer.applyTransformation(request.query),
      body: { id: obj.id, name: obj.name, size: headAsset.metadata.size ?? null,
              content_type: headAsset.metadata.mimetype ?? null, etag: headAsset.metadata.eTag ?? null },
    };
  }
  setHeaders(request, response, data, options) {
    response.status(data.metadata.httpStatusCode ?? 200)
      .header('Content-Type', 'application/json')
      .header('ETag', data.metadata.eTag);
    this.setLastModifiedHeader(response, data.metadata.lastModified);
    this.setCacheControlHeader(response, [data.metadata.cacheControl]);
    this.setContentLengthHeader(response, data.metadata.contentLength);
    if (data.transformations && data.transformations.length > 0) {
      response.header('X-Transformations', data.transformations.join(','));
    }
  }
}
function reply() {
  const r = { code: 0, headers: {}, sent: undefined };
  r.status = (c) => { r.code = c; return r; };
  r.header = (k, v) => { r.headers[k] = v; return r; };
  r.send = (b) => { r.sent = b; return r; };
  return r;
}
async function run(R) {
  const res = reply();
  await new R().render({ query: { width: 10 } }, res, { object: { id: 'i', name: 'n' } });
  return res;
}

(async () => {
  await check('A>B', () => new B().m(1));
  await check('A>B>C', () => new C().m(1));
  await check('async return super', () => new D().m(1));
  await check('async sync super', () => new E().m(1));
  await check('sync super', () => new F().m(1));
  await check('super after await', () => new G().m(1));
  await check('head render', () => run(HeadRenderer).catch((e) => { throw e; }));
  await check('info render', () => run(InfoRenderer));
  await check('info render again', () => run(InfoRenderer));
  console.log('done');
})();
