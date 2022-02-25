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
import { DescribeSObjectResult } from 'jsforce';

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
      const globalDescribe = await this.connection.describeGlobal();
      const customSObjects = globalDescribe.sobjects
        .flatMap<SObjectName>((sobject) => SObjectName.apply(sobject.name))
        .filter((name) => name !== null)
        .filter((name) => /* name.namespace == null || */this.namespaces.has(name.namespace));
      await this.writeByNamespace(customSObjects);
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

  private async writeByNamespace(sobjectNames: SObjectName[]): Promise<void> {
    const sobjectsByNamespace: Map<string, SObjectName[]> = new Map();
    for (const sobjectName of sobjectNames) {
      const namespace = sobjectName.namespace !== null ? sobjectName.namespace : SObjectReader.UNMANAGED;
      let namespaceSObjects = sobjectsByNamespace.get(namespace);
      if (namespaceSObjects === undefined) {
        namespaceSObjects = [];
        sobjectsByNamespace.set(namespace, namespaceSObjects);
      }
      namespaceSObjects.push(sobjectName);
    }

    for (const namespace of sobjectsByNamespace.keys()) {
      await this.writeNamespace(namespace, sobjectsByNamespace.get(namespace));
    }
  }

  private async writeNamespace(namespace: string, sobjectNames: SObjectName[]): Promise<void> {
    const customObjectDetails = await this.readCustomObjectDetails(namespace, sobjectNames);

    const describes = await this.connection.batchDescribe({
      types: sobjectNames.map((sobjectName) => sobjectName.fullName()),
      autofetch: true,
    });

    for (const describe of describes) {
      const sobjectName = SObjectName.apply(describe.name);
      const customObjectDetail = customObjectDetails.get(describe.name);
      const targetDirectory = sobjectName.namespace === null ? SObjectReader.UNMANAGED : sobjectName.namespace;

      this.stubFS.newFile(
        path.join(targetDirectory, describe.name, `${describe.name}.object-meta.xml`),
        `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
${this.sobjectBody(describe, customObjectDetail)}</CustomObject>
`
      );
    }
  }

  private sobjectBody(describe: DescribeSObjectResult, customObjectDetail: CustomObjectDetail): string {
    let body = '';
    if (describe.customSetting) {
      if (this.isNameNillable(describe)) {
        body += '\t<customSettingsType>Hierarchy</customSettingsType>\n';
      } else {
        body += '\t<customSettingsType>List</customSettingsType>\n';
      }
    }

    body += `\t<sharingModel>${this.mapSharingModel(customObjectDetail.SharingModel)}</sharingModel>\n`;

    return body;
  }

  private async readCustomObjectDetails(
    namespace: string,
    sobjectNames: SObjectName[]
  ): Promise<Map<string, CustomObjectDetail>> {
    const nameMap: Map<string, SObjectName> = new Map();
    sobjectNames.forEach((sobjectName) => nameMap.set(sobjectName.name, sobjectName));

    const developerNames = Array.from(nameMap.keys())
      .map((name) => `'${name}'`)
      .join(',');
    const namespaceClause = namespace === SObjectReader.UNMANAGED ? '' : `NamespacePrefix = '${namespace}' AND`;
    const customObjects = await this.connection.tooling
      .sobject('CustomObject')
      .find<CustomObjectDetail>(
        `${namespaceClause} DeveloperName in (${developerNames})`,
        'DeveloperName, SharingModel'
      )
      .execute({ autoFetch: true, maxFetch: 100000 });

    const resultMap: Map<string, CustomObjectDetail> = new Map();
    for (const customObject of customObjects) {
      const sobjectName = nameMap.get(customObject.DeveloperName);
      if (sobjectName) resultMap.set(sobjectName.fullName(), customObject);
    }
    return resultMap;
  }

  private isNameNillable(describe: DescribeSObjectResult): boolean {
    const nameField = describe.fields.find((field) => field.name == 'Name');
    return nameField !== undefined && nameField.nillable;
  }

  private mapSharingModel(model: string): string {
    if (model == 'None') {
      return 'Private';
    } else if (model == 'Edit') {
      return 'ReadWrite';
    } else {
      return model;
    }
  }
}

interface CustomObjectDetail {
  DeveloperName: string;
  SharingModel: string;
}
class SObjectName {
  public namespace: string;
  public name: string;
  public extension: string;

  constructor(namespace: string, name: string, extension: string) {
    this.namespace = namespace;
    this.name = name;
    this.extension = extension;
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

  public static apply(name: string): SObjectName | null {
    const parts = name.split('__');
    if (parts.length >= 2 && parts.length <= 3) {
      const last = parts[parts.length - 1];
      if (last == 'c' || last == 'mdt' || last == 'e' || last == 'b') {
        if (parts.length == 2) return new SObjectName(null, parts[0], parts[1]);
        else return new SObjectName(parts[0], parts[1], parts[2]);
      }
    }
    return null;
  }
}
