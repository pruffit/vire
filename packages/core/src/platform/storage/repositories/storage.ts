export interface IFileStorage {
  upload(key: string, body: Uint8Array, contentType: string): Promise<string>;
}
