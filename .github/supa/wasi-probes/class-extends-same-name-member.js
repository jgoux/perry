// A class that extends a member of an imported namespace runs that member's
// constructor even when the member has the subclass's own name. Storage's tus
// store is `class FileStore extends import_file_store.FileStore`; the heritage was
// resolved by the trailing name, found the subclass itself and left it without a
// parent, so the base constructor never ran and `this.configstore` stayed undefined.
// network: yes
// npm: @tus/file-store
const path = require('node:path');
const tusfs = require('@tus/file-store');
const dir = path.join(process.env.WORK_DIR || '/work', 'tus-same-name');

class FileStore extends tusfs.FileStore {
  constructor(options) {
    super(options);
    this.options = options;
    this.other = 1;
  }
  options;
  other;
  async create(file) {
    await this.configstore.set(file.id, { id: file.id });
    return file;
  }
}

async function main() {
  const store = new FileStore({ directory: dir });
  console.log(store instanceof tusfs.FileStore, store instanceof FileStore);
  console.log(store.directory === dir, typeof store.configstore, store.expirationPeriodInMilliseconds);
  console.log(store.hasExtension('creation'), store.options.directory === dir, store.other);
  const created = await store.create({ id: 'abc' });
  console.log(created.id, (await store.configstore.get('abc')).id);
}
main().then(() => console.log('done'), (e) => console.log('ERR', e.message));
