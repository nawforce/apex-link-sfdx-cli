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

export class FlowReader {
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
    try {
      const pages = await this.connection.tooling
        .sobject('FlowDefinition')
        .find<FlowInfo>(this.query(), 'DeveloperName, NamespacePrefix')
        .execute({ autoFetch: true, maxFetch: 100000 });
      this.write(pages);
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

  private query(): string {
    const conditions = this.namespaces.map((namespace) => `NamespacePrefix = '${namespace}'`);
    conditions.push(`NamespacePrefix = ${this.orgNamespace == null ? 'null' : "'" + this.orgNamespace + "'"}`);
    return conditions.join(' OR ');
  }

  private write(flows: FlowInfo[]): void {
    const byNamespace: Map<string, FlowInfo[]> = new Map();

    for (const flow of flows) {
      let namespacePages = byNamespace.get(flow.NamespacePrefix);
      if (namespacePages === undefined) {
        namespacePages = [];
        byNamespace.set(flow.NamespacePrefix, namespacePages);
      }
      namespacePages.push(flow);
    }

    byNamespace.forEach((namespaceFlows, namespace) => {
      const targetDirectory = namespace === null ? 'unmanaged' : namespace;
      for (const flow of namespaceFlows) {
        this.stubFS.newFile(path.join(targetDirectory, 'flows', `${flow.DeveloperName}.flow`), '');
      }
    });
  }
}

interface FlowInfo {
  DeveloperName: string;
  NamespacePrefix: string;
}
