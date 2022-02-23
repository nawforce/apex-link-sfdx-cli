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
import { Connection, SfdxError } from '@salesforce/core';
import { DescribeGlobalSObjectResult } from 'jsforce';
import { StubFS } from './stubfs';

export class SObjectReader {
  private connection: Connection;
  private namespaces: Set<string>;
  private stubFS: StubFS;

  public constructor(connection: Connection, namespaces: string[], stubFS: StubFS) {
    this.connection = connection;
    this.namespaces = new Set(namespaces);
    this.stubFS = stubFS;
  }

  public async run(): Promise<SfdxError | void> {
    const byNamespace: Map<string, [string[], DescribeGlobalSObjectResult][]> = new Map();

    return this.connection.describeGlobal().then(
      (describeResult) => {
        const customSObjects = describeResult.sobjects
          .map<[string[], DescribeGlobalSObjectResult]>((sobject) => {
            return [this.splitName(sobject.name), sobject];
          })
          .filter((nameAndDescribe) => nameAndDescribe[0].length != 0)
          .filter(
            (nameAndDescribe) => nameAndDescribe[0][0] == 'unmanaged' || this.namespaces.has(nameAndDescribe[0][0])
          );

        customSObjects.forEach((nameAndDescribe) => {
          let namespaceObjects = byNamespace.get(nameAndDescribe[0][0]);
          if (namespaceObjects === undefined) {
            namespaceObjects = [];
            byNamespace.set(nameAndDescribe[0][0], namespaceObjects);
          }
          namespaceObjects.push(nameAndDescribe);
        });

        this.write(byNamespace);
      },
      (err) => {
        if (typeof err === 'string' || err instanceof Error) return SfdxError.wrap(err);
      }
    );
  }

  private write(sobjects: Map<string, [string[], DescribeGlobalSObjectResult][]>) {
    sobjects.forEach((nameAndDescribes, namespace) => {
      for (const sobject of nameAndDescribes) {
        this.stubFS.newFile(path.join(namespace, 'objects', sobject[1].name, `${sobject[1].name}.object-meta.xml`), '');
      }
    });
  }

  private splitName(name: string): string[] {
    const parts = name.split('__');
    if (parts.length >= 2 && parts.length <= 3) {
      const last = parts[parts.length - 1];
      if (last == 'c' || last == 'mdt' || last == 'e' || last == 'b') {
        if (parts.length == 2) return ['unmanaged'].concat(parts);
        else return parts;
      }
    }
    return [];
  }
}
