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

export class ComponentReader {
  private connection: Connection;
  private namespaces: string[];
  private stubFS: StubFS;

  public constructor(connection: Connection, namespaces: string[], stubFS: StubFS) {
    this.connection = connection;
    this.namespaces = namespaces;
    this.stubFS = stubFS;
  }

  public async run(): Promise<SfdxError | void> {
    try {
      const components = await this.connection.tooling
        .sobject('ApexComponent')
        .find<ComponentInfo>(this.query(), 'Name, NamespacePrefix, Markup')
        .execute({ autoFetch: true, maxFetch: 100000 });
      this.write(components);
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
    conditions.push('NamespacePrefix = null');
    return conditions.join(' OR ');
  }

  private write(components: ComponentInfo[]): void {
    const byNamespace: Map<string, ComponentInfo[]> = new Map();

    for (const component of components) {
      if (component.Markup !== '(hidden)') {
        let namespaceComponents = byNamespace.get(component.NamespacePrefix);
        if (namespaceComponents === undefined) {
          namespaceComponents = [];
          byNamespace.set(component.NamespacePrefix, namespaceComponents);
        }
        namespaceComponents.push(component);
      }
    }

    byNamespace.forEach((namespaceComponents, namespace) => {
      const targetDirectory = namespace === null ? 'unmanaged' : namespace;
      for (const component of namespaceComponents) {
        this.stubFS.newFile(path.join(targetDirectory, 'components', `${component.Name}.component`), component.Markup);
      }
    });
  }
}

interface ComponentInfo {
  Name: string;
  NamespacePrefix: string;
  Markup: string;
}
