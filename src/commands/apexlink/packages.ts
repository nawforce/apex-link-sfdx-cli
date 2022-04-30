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

import { SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { Gulp as GulpRunner } from 'apexlink-gulp';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('apexlink', 'packages');

export default class Packages extends SfdxCommand {
  public static description = messages.getMessage('commandDescription');

  public static examples = ['$ sfdx apexlink:packages', '$ sfdx apexlink:packages --debug"'];

  protected static flagsConfig = {};

  protected static requiresUsername = true;
  protected static supportsDevhubUsername = false;
  protected static requiresProject = true;

  public async run(): Promise<void> {
    const connection = this.org.getConnection();
    connection.metadata.pollTimeout = 10 * 60 * 1000;
    connection.metadata.pollInterval = 15 * 1000;

    const runner = new GulpRunner();
    const packages = await runner.getOrgPackageNamespaces(null, connection);

    if (this.flags.json) {
      this.ux.logJson(packages);
    } else {
      packages.map((pkg) => {
        this.ux.log(`${pkg.namespace}: ${pkg.description}`);
      });
    }
  }
}
