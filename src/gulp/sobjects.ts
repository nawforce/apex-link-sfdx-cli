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
import { XMLParser } from 'fast-xml-parser';
import { StubFS } from './stubfs';
import { string } from '@oclif/parser/lib/flags';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

export class SObjectReader {
  private connection: Connection;
  private orgNamespace: string;
  private namespaces: Set<string>;
  private stubFS: StubFS;

  public constructor(connection: Connection, orgNamespace: string, namespaces: string[], stubFS: StubFS) {
    this.connection = connection;
    this.orgNamespace = orgNamespace;
    this.namespaces = new Set(namespaces);
    this.stubFS = stubFS;
  }

  public async run(): Promise<SfdxError | void> {
    try {
      const results = [this.writeByNamespace(this.orgNamespace)];
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
    const targetDirectory = namespace === null ? 'unmanged' : namespace;
    const alienNamespaces = new Set(this.namespaces);
    if (namespace !== null) {
      alienNamespaces.delete(namespace);
    }
    if (this.orgNamespace != null && namespace !== this.orgNamespace) {
      alienNamespaces.add(this.orgNamespace);
    }

    try {
      const files = await this.getFiles(tmpDir);

      files
        .filter((name) => name.endsWith('.object'))
        .forEach((name) => {
          const contents = fs.readFileSync(name, 'utf8');

          const split = this.splitFields(name, contents, alienNamespaces);
          this.stubFS.newFile(path.join(targetDirectory, 'objects', path.basename(name)), split[0]);
          split[1].forEach((value, key) => {
            const fieldName = EntityName.applyField(key).defaultNamespace(this.orgNamespace);
            this.stubFS.newFile(
              path.join(
                fieldName.namespace,
                'objects',
                path.basename(name).replace(/.object$/, ''),
                'fields',
                fieldName.fullName() + '.field-meta.xml'
              ),
              `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
${value.replace(/^<fields>\s/, '').replace(/\s<\/fields>$/, '')}
</CustomField>`
            );
          });
        });
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  }

  private splitFields(
    sObjectName: string,
    contents: string,
    alienNamespaces: Set<string>
  ): [string, Map<string, string>] {
    const parser = new XMLParser();
    const objectContents = parser.parse(contents) as SObjectJSON;
    const fields = objectContents?.CustomObject?.fields;
    if (fields) {
      const fieldArray = Array.isArray(fields) ? fields : [fields];
      const alienFields = fieldArray.filter((field) => {
        const name = EntityName.applyField(field.fullName);
        if (name != null) {
          name.defaultNamespace(this.orgNamespace);
          return alienNamespaces.has(name.namespace);
        } else {
          return false;
        }
      });

      const alienContent = new Map<string, string>();
      let updatedContent = contents;
      if (alienFields.length > 0) {
        for (const alienField of alienFields) {
          const re = new RegExp(`<fields>\\s*<fullName>${alienField.fullName}<[\\s\\S]*?<\\/fields>`);
          updatedContent = updatedContent.replace(re, (matched) => {
            alienContent.set(alienField.fullName, matched);
            return '';
          });
        }
      }
      return [updatedContent, alienContent];
    } else {
      return [contents, new Map<string, string>()];
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

  private async queryCustomObjects(namespace: string): Promise<EntityName[]> {
    const customObjects = await this.connection.tooling
      .sobject('EntityDefinition')
      .find<CustomObjectDetail>(
        namespace === null ? "Publisher.Name = '<local>'" : `NamespacePrefix = '${namespace}'`,
        'QualifiedApiName'
      )
      .execute({ autoFetch: true, maxFetch: 100000 });

    return customObjects
      .map((customObject) => EntityName.applySObject(customObject.QualifiedApiName))
      .filter((sobjectName) => sobjectName !== null);
  }

  private async retrieveCustomObjects(names: EntityName[]): Promise<string> {
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
class EntityName {
  public namespace: string;
  public name: string;
  public extension: string;

  public constructor(namespace: string, name: string, extension: string) {
    this.namespace = namespace;
    this.name = name;
    this.extension = extension;
  }

  public static applySObject(name: string): EntityName | null {
    const parts = name.split('__');
    if (parts.length >= 2 && parts.length <= 3) {
      const last = parts[parts.length - 1];
      if (last === 'c' || last === 'mdt' || last === 'e' || last === 'b') {
        if (parts.length === 2) {
          return new EntityName(null, parts[0], parts[1]);
        } else {
          return new EntityName(parts[0], parts[1], parts[2]);
        }
      }
    }
    return null;
  }

  public static applyField(name: string): EntityName | null {
    const parts = name.split('__');
    if (parts.length >= 2 && parts.length <= 3) {
      const last = parts[parts.length - 1];
      if (last === 'c') {
        if (parts.length === 2) {
          return new EntityName(null, parts[0], parts[1]);
        } else {
          return new EntityName(parts[0], parts[1], parts[2]);
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

  public defaultNamespace(namespace: string): EntityName {
    if (namespace != null && this.namespace == null) {
      this.namespace = namespace;
    }
    return this;
  }
}

interface Field {
  fullName: string;
}

interface CustomObject {
  fields?: Field | Field[];
}

interface SObjectJSON {
  CustomObject?: CustomObject;
}
