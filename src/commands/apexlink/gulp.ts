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

import { SfdxCommand, flags } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import { LabelReader } from '../../gulp/labels';
import { StubFS } from '../../gulp/stubfs';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('apexlink', 'gulp');

export default class Gulp extends SfdxCommand {
  public static description = messages.getMessage('commandDescription');

  public static examples = ['$ sfdx apexlink:gulp', '$ sfdx apexlink:gulp --debug --namespaces="ns1,ns2"'];

  protected static flagsConfig = {
    namespaces: flags.array({
      description: 'gulp metadata for the passed namespaces, unmanaged metadata is guled by default',
    }),
    debug: flags.boolean({ description: 'show progress messages' }),
  };

  protected static requiresUsername = true;
  protected static supportsDevhubUsername = false;
  protected static requiresProject = true;

  public async run(): Promise<AnyJson> {
    const connection = this.org.getConnection();
    const namespaces = this.flags.namespaces || [];

    const stubFS = new StubFS();

    const labelsReader = new LabelReader(connection, namespaces, stubFS).run();

    const results = {
      labels: await labelsReader,
    };
    console.log(stubFS)

    return Promise.resolve({});
  }
}
