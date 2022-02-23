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
import { StubFS } from './stubfs';

export class LabelReader {
  private connection: Connection;
  private namespaces: string[];
  private stubFS: StubFS;

  public constructor(connection: Connection, namespaces: string[], stubFS: StubFS) {
    this.connection = connection;
    this.namespaces = namespaces;
    this.stubFS = stubFS;
  }

  public async run(): Promise<SfdxError | void> {
    return this.connection.tooling
      .sobject('ExternalString')
      .find<LabelInfo>(this.labelsQuery(), 'Name, NamespacePrefix')
      .execute({ autoFetch: true, maxFetch: 100000 })
      .then(
        (records) => {
          this.writeLabels(records);
        },
        (err) => {
          if (typeof err === 'string' || err instanceof Error) return SfdxError.wrap(err);
        }
      );
  }

  private labelsQuery(): string {
    const conditions = this.namespaces.map((namespace) => `(NamespacePrefix = '${namespace}' AND IsProtected = false)`);
    conditions.push('NamespacePrefix = null');
    return conditions.join(' OR ');
  }

  private writeLabels(labels: LabelInfo[]): void {
    const byNamespace: Map<string, string[]> = new Map();

    for (const label of labels) {
      let namespaceLabels = byNamespace.get(label.NamespacePrefix);
      if (namespaceLabels === undefined) {
        namespaceLabels = [];
        byNamespace.set(label.NamespacePrefix, namespaceLabels);
      }
      namespaceLabels.push(label.Name);
    }

    byNamespace.forEach((namespaceLabels, namespace) => {
      const targetDirectory = namespace === null ? 'unmanaged' : namespace;
      this.stubFS.newFile(
        path.join(targetDirectory, 'CustomLabels.labels-meta.xml'),
        this.createLabels(namespaceLabels)
      );
    });
  }

  private createLabels(labelNames: string[]): string {
    const labelDefinitions = labelNames
      .map((name) => {
        return `   <labels>
        <fullName>${name}</fullName>
        <language>en_US</language>
        <protected>false</protected>
        <shortDescription></shortDescription>
        <value></value>
    </labels>`;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata">
${labelDefinitions}
</CustomLabels>
`;
  }
}

interface LabelInfo {
  Name: string;
  NamespacePrefix: string;
}
