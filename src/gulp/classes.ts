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
import { Connection } from 'jsforce';
import { SfdxError } from '@salesforce/core';
import { StubFS } from './stubfs';

export class ClassReader {
  private connection: Connection;
  private orgNamespace: string;
  private namespaces: string[];
  private stubFS: StubFS;

  public constructor(connection: Connection, orgNamespace: string, namespaces: string[], stubFS: StubFS) {
    this.connection = connection;
    this.orgNamespace = orgNamespace;
    this.namespaces = namespaces;
    this.stubFS = stubFS;
  }

  public async run(): Promise<SfdxError | void> {
    return this.connection.tooling
      .sobject('ApexClass')
      .find<ClassInfo>(this.query(), 'Name, NamespacePrefix, Body')
      .execute({ autoFetch: true, maxFetch: 100000 })
      .then(
        (records) => {
          this.write(records);
        },
        (err) => {
          if (typeof err === 'string' || err instanceof Error) return SfdxError.wrap(err);
        }
      );
  }

  private query(): string {
    const conditions = this.namespaces.map((namespace) => `NamespacePrefix = '${namespace}'`);
    conditions.push(`NamespacePrefix = ${this.orgNamespace == null ? 'null' : "'" + this.orgNamespace + "'"}`);
    return `Status = 'Active' AND (${conditions.join(' OR ')})`;
  }

  private write(classes: ClassInfo[]): void {
    const byNamespace: Map<string, ClassInfo[]> = new Map();

    for (const cls of classes) {
      if (cls.Body !== '(hidden)') {
        let namespaceClasses = byNamespace.get(cls.NamespacePrefix);
        if (namespaceClasses === undefined) {
          namespaceClasses = [];
          byNamespace.set(cls.NamespacePrefix, namespaceClasses);
        }
        namespaceClasses.push(cls);
      }
    }

    byNamespace.forEach((namespaceClasses, namespace) => {
      const targetDirectory = namespace === null ? 'unmanaged' : namespace;
      for (const cls of namespaceClasses) {
        this.stubFS.newFile(path.join(targetDirectory, 'classes', `${cls.Name}.cls`), cls.Body);
      }
    });
  }
}

interface ClassInfo {
  Name: string;
  NamespacePrefix: string;
  Body: string;
}
