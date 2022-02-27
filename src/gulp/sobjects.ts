/*
 Copyright (c) 2022 Kevin Jones, All rights reserved.
 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions
 are met:
 1. Redistributions of source code must retain the above copyright
    notice, this list of conditions and the following disclaimer.
 2. Redistributions in binary form must reproduce the above copyright
    notice, this list of conditions and the following disclaimer in the
    documentation and/or other materials provided with the distribution.
 3. The name of the author may not be used to endorse or promote products
    derived from this software without specific prior written permission.
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { promisify } from 'util';
import { resolve } from 'path';
import decompress = require('decompress');
import { Connection, Package, RetrieveResult } from 'jsforce';
import { SfdxError } from '@salesforce/core';
import { StubFS } from './stubfs';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

export class SObjectReader {
  private static UNMANAGED = 'unmanaged';
  private connection: Connection;
  private namespaces: Set<string>;
  private stubFS: StubFS;

  public constructor(connection: Connection, namespaces: string[], stubFS: StubFS) {
    this.connection = connection;
    this.namespaces = new Set(namespaces);
    this.stubFS = stubFS;
  }

  public async run(): Promise<SfdxError | void> {
    try {
      const results = [this.writeByNamespace(null)];
      this.namespaces.forEach((namespace) => {
        results.push(this.writeByNamespace(namespace));
      });
      await Promise.all(results);
    } catch (err) {
      if (err instanceof Error) {
        if (err.stack) {
          return SfdxError.wrap(err.stack);
        } else {
          return SfdxError.wrap(err.toString());
        }
      }
      if (typeof err === 'string') {
        return SfdxError.wrap(err);
      }
    }
  }

  private async writeByNamespace(namespace: string): Promise<void> {
    const customObjectNames = await this.queryCustomObjects(namespace);
    const tmpDir = await this.retrieveCustomObjects(customObjectNames);

    try {
      const files = await this.getFiles(tmpDir);
      const targetDirectory = namespace === null ? SObjectReader.UNMANAGED : namespace;
      files
        .filter((name) => name.endsWith('.object'))
        .forEach((name) => {
          const contents = fs.readFileSync(name, 'utf8');
          this.stubFS.newFile(path.join(targetDirectory, 'objects', path.basename(name)), contents);
        });
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  }

  private async getFiles(dir: string): Promise<string[]> {
    const subdirs = await readdir(dir);
    const files = await Promise.all(
      subdirs.map(async (subdir) => {
        const res = resolve(dir, subdir);
        return (await stat(res)).isDirectory() ? this.getFiles(res) : [res];
      })
    );
    return files.flat();
  }

  private async queryCustomObjects(namespace: string): Promise<SObjectName[]> {
    const customObjects = await this.connection.tooling
      .sobject('EntityDefinition')
      .find<CustomObjectDetail>(
        namespace === null ? "Publisher.Name = '<local>'" : `NamespacePrefix = '${namespace}'`,
        'QualifiedApiName'
      )
      .execute({ autoFetch: true, maxFetch: 100000 });

    return customObjects
      .map((customObject) => SObjectName.apply(customObject.QualifiedApiName))
      .filter((sobjectName) => sobjectName !== null);
  }

  private async retrieveCustomObjects(names: SObjectName[]): Promise<string> {
    const retrievePackage: Package = {
      version: this.connection.version,
      types: [
        {
          members: names.map((name) => name.fullName()),
          name: 'CustomObject',
        },
      ],
    };

    const retrieveOptions = {
      apiVersion: this.connection.version,
      unpackaged: retrievePackage,
    };
    const result = await this.connection.metadata.retrieve(retrieveOptions).complete();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gulp'));

    const zipBuffer = Buffer.from((result as unknown as RetrieveResult).zipFile, 'base64');
    await decompress(zipBuffer, tmpDir);
    return tmpDir;
  }
}

interface CustomObjectDetail {
  QualifiedApiName: string;
}
class SObjectName {
  public namespace: string;
  public name: string;
  public extension: string;

  public constructor(namespace: string, name: string, extension: string) {
    this.namespace = namespace;
    this.name = name;
    this.extension = extension;
  }

  public static apply(name: string): SObjectName | null {
    const parts = name.split('__');
    if (parts.length >= 2 && parts.length <= 3) {
      const last = parts[parts.length - 1];
      if (last === 'c' || last === 'mdt' || last === 'e' || last === 'b') {
        if (parts.length === 2) {
          return new SObjectName(null, parts[0], parts[1]);
        } else {
          return new SObjectName(parts[0], parts[1], parts[2]);
        }
      }
    }
    return null;
  }

  public fullName(): string {
    if (this.namespace === null) {
      return `${this.name}__${this.extension}`;
    } else {
      return `${this.namespace}__${this.name}__${this.extension}`;
    }
  }

  public developerName(): string {
    if (this.namespace === null) {
      return `${this.name}`;
    } else {
      return `${this.namespace}__${this.name}`;
    }
  }
}
