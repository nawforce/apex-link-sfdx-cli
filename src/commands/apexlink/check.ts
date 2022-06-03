/*
 Copyright (c) 2019 Kevin Jones, All rights reserved.
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

import * as fs from 'fs';
import * as path from 'path';
import { ChildProcess } from 'child_process';
import { SfdxCommand, flags } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import LocateJavaHome from 'locate-java-home';
import { IJavaHomeInfo } from 'locate-java-home/js/es5/lib/interfaces';
import spawn = require('cross-spawn');

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('apexlink', 'check');

export default class Check extends SfdxCommand {
  public static description = messages.getMessage('commandDescription');

  public static examples = [
    '$ sfdx apexlink:check',
    '$ sfdx apexlink:check --verbose $HOME/myproject',
    '$ sfdx apexlink:check --json --depends $HOME/myproject',
  ];

  public static args = [
    { name: 'directory', description: 'directory to search for metadata files, defaults to current directory' },
  ];

  protected static flagsConfig = {
    depends: flags.boolean({
      description: 'output class dependencies rather than issues, in CSV (default) or JSON format',
    }),
    verbose: flags.builtin({ description: 'show warning messages' }),
    unused: flags.boolean({ description: 'show unused messages, requires --verbose' }),
    nocache: flags.boolean({ description: "don't use cache during loading" }),
    json: flags.boolean({ description: 'show output in json format (disables --verbose)' }),
    debug: flags.boolean({ description: 'show debug log' }),
  };

  protected static requiresUsername = false;
  protected static supportsDevhubUsername = false;
  protected static requiresProject = false;

  public async run(): Promise<AnyJson> {
    const jarFile = path.join(__dirname, '..', '..', '..', 'jars', 'apexlink-2.3.3.jar');
    if (!fs.existsSync(jarFile) || !fs.lstatSync(jarFile).isFile()) {
      throw new SfdxError(messages.getMessage('errorNoJarFile', [jarFile]));
    }

    const jvms = await this.getJavaHome();
    if (jvms.length === 0) {
      throw new SfdxError(messages.getMessage('errorNoJVM'));
    }

    const javaExecutable = jvms[0].executables.java;
    if (jvms.length > 1 && this.flags.verbose) {
      this.ux.log(messages.getMessage('errorManyJVM', [javaExecutable]));
    }

    const directory = (this.args.directory as string) || process.cwd();
    if (!fs.existsSync(directory) || !fs.lstatSync(directory).isDirectory()) {
      throw new SfdxError(messages.getMessage('errorNotDir', [directory]));
    }

    const execArgs = ['-Dfile.encoding=UTF-8', '-jar', jarFile];
    if (this.flags.verbose) execArgs.push('-verbose');
    if (this.flags.json) execArgs.push('-json');
    if (this.flags.unused) execArgs.push('-unused');
    if (this.flags.depends) execArgs.push('-depends');
    if (this.flags.nocache) execArgs.push('-nocache');
    if (this.flags.debug) execArgs.push('-debug');

    execArgs.push(directory);
    return this.execute(javaExecutable, execArgs, this.flags.json as boolean);
  }

  private getJavaHome(): Promise<IJavaHomeInfo[]> {
    return new Promise<IJavaHomeInfo[]>(function (resolve, reject) {
      LocateJavaHome({ version: '>=1.8', mustBe64Bit: true }, function (error, javaHomes) {
        if (error != null) reject(error);
        else resolve(javaHomes);
      });
    });
  }

  private execute(javaCmd: string, args: string[], json: boolean): Promise<AnyJson> {
    let jsonData = '';
    return new Promise<AnyJson>(function (resolve, reject) {
      try {
        const child: ChildProcess = spawn(javaCmd, args, json ? {} : { stdio: 'inherit' });
        if (json) {
          child.stdout.on('data', (data) => {
            jsonData += (data as Buffer).toString('utf8');
          });
        }
        child.on('close', (code) => {
          process.exitCode = code;
          if (json) resolve(JSON.parse(jsonData) as AnyJson);
          else resolve({});
        });
      } catch (e) {
        reject(e);
      }
    });
  }
}
