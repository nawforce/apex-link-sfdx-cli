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

export class SObjectReader {
  private connection: Connection;
  private namespaces: string[];
  private stubFS: StubFS;

  public constructor(connection: Connection, namespaces: string[], stubFS: StubFS) {
    this.connection = connection;
    this.namespaces = namespaces;
    this.stubFS = stubFS;
  }

  public async run(): Promise<SfdxError | void> {
    return this.connection.tooling.describeGlobal().then(
      (describeResult) => {
        const customSObjects = describeResult.sobjects.filter((sobject) => sobject.name.endsWith('__c'));
        console.log(customSObjects.length);
      },
      (err) => {
        if (typeof err === 'string' || err instanceof Error) return SfdxError.wrap(err);
      }
    );
  }
}
