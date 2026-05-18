import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

/**
 * Lightweight JSON file store.
 * Writes are serialised per-instance so concurrent requests never corrupt data.
 */
export class JsonStore {
  constructor(filename) {
    this.filePath = join(process.cwd(), 'data', filename);
    this.writeQueue = Promise.resolve();
  }

  async _ensureDir() {
    await mkdir(dirname(this.filePath), { recursive: true });
  }

  async read() {
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Write data to the JSON file.  Writes are queued so only one write runs at a time.
   */
  async write(data) {
    this.writeQueue = this.writeQueue.then(async () => {
      await this._ensureDir();
      await writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    });
    return this.writeQueue;
  }

  /**
   * Read-modify-write helper.  Pass a function that receives the current data
   * (or defaultValue if the file doesn't exist) and returns the new data.
   */
  async update(fn, defaultValue = {}) {
    const current = (await this.read()) ?? defaultValue;
    const updated = fn(current);
    await this.write(updated);
    return updated;
  }
}
