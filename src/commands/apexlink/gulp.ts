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

import { SfdxCommand, flags, UX } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { Gulp as GulpRunner, Logger as GulpLogger, LoggerStage } from 'apexlink-gulp';

// import { AnyJson } from '@salesforce/ts-types';

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
      description: "gulp metadata for these namespaces, if not set 'unmanaged' is loaded",
    }),
    debug: flags.boolean({ description: 'show progress messages' }),
  };

  protected static requiresUsername = true;
  protected static supportsDevhubUsername = false;
  protected static requiresProject = true;

  public async run(): Promise<void> {
    const gulpLogger = new LocalLogger(this.ux, (this.flags.debug as boolean) || false);
    const connection = this.org.getConnection();

    const runner = new GulpRunner();
    return runner.update(
      this.project.getPath(),
      gulpLogger,
      connection,
      (this.flags.namespaces as string[]) || ['unmanaged'],
      true
    );
  }
}

class LocalLogger implements GulpLogger {
  private ux: UX;
  private debugOn: boolean;
  private phases = new Set([
    LoggerStage.CLASSES,
    LoggerStage.COMPONENTS,
    LoggerStage.CUSTOM_SOBJECTS,
    LoggerStage.FLOWS,
    LoggerStage.LABELS,
    LoggerStage.PAGES,
    LoggerStage.STANDARD_SOBJECTS,
  ]);

  public constructor(ux: UX, debugOn: boolean) {
    this.ux = ux;
    this.debugOn = debugOn;
    ux.startSpinner('Updating metadata in .apexlink', 'starting');
    this.reportProgress();
  }

  public debug(message: string): void {
    if (this.debugOn) this.ux.log(`${new Date().toLocaleString()} ${message}`);
  }

  public complete(stage: LoggerStage): void {
    this.phases.delete(stage);
    this.reportProgress();
  }

  private reportProgress(): void {
    this.ux.setSpinnerStatus(`Waiting for ${[...this.phases].join(', ')}`);
  }
}
