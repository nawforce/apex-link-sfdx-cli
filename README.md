## ApexLink

SFDX CLI plugin for the [apex-link](https://github.com/nawforce/apex-link) Salesforce metadata static analysis library. This plugin provides a simple 'check' command that can be used to examine metadata for errors, in addition it can report on various warnings such as unused fields & methods or variable shadowing. The command can also be used to obtain Apex class dependencies in either CSV or JSON format.
 
### SFDX CLI

To install the CLI plugin (from npm)

    sfdx plugins:install apexlink

Check the installation was successful with

    sfdx plugins
     
This should show apexlink in the plugin list.      

To perform a simple validity check use:

    sfdx apexlink:check <directory>

This parses and performs semantic checks on the code and reports any errors, such as types not being found. The library
contains a pretty comprehensive set of platform types that it validates against. This command does not require an sfdx project, if you omit the directory it will search the current directory for metadata. To also see warnings add the argument "--verbose".

### Unused fields, properties & methods

You can use the check command to report on unused fields, properties and methods of Apex classes. 

    sfdx apexlink:check --verbose --unused <directory>


### Class dependencies

The check command can also report Apex class dependencies with:

    sfdx apexlink:check --depends --json <directory>

If you omit the --json the dependency default format is CSV.  


### Downloading metadata

To download metadata for use by apexlink use:

  sfdx apexlink:gulp --namespaces="unmanaged,ns1"

If you org does not have a namespace you can use "unmanaged" to download umanaged metadata, if the org does have a
namespaces you should use it instead. The metadata will be stored in a .apexlink/gulp directory within your workspace. Note: to make use of the metadata you need to add settings to sfdx-project.json, see apex-assist README for instructions.   

### Usage

<!-- toc -->

<!-- tocstop -->
<!-- install -->
<!-- usage -->
```sh-session
$ npm install -g apexlink
$ sfdx COMMAND
running command...
$ sfdx (-v|--version|version)
apexlink/2.3.4 darwin-x64 node-v16.6.0
$ sfdx --help [COMMAND]
USAGE
  $ sfdx COMMAND
...
```
<!-- usagestop -->
<!-- commands -->
* [`sfdx apexlink:check [--depends] [--unused] [--nocache] [--debug] [--verbose] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-apexlinkcheck---depends---unused---nocache---debug---verbose---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx apexlink:gulp [--namespaces <array>] [--debug] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-apexlinkgulp---namespaces-array---debug--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx apexlink:packages [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-apexlinkpackages--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)

## `sfdx apexlink:check [--depends] [--unused] [--nocache] [--debug] [--verbose] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Validate Apex code in current or passed directories

```
USAGE
  $ sfdx apexlink:check [--depends] [--unused] [--nocache] [--debug] [--verbose] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

ARGUMENTS
  DIRECTORY  directory to search for metadata files, defaults to current directory

OPTIONS
  --debug                                                                           show debug log

  --depends                                                                         output class dependencies rather
                                                                                    than issues, in CSV (default) or
                                                                                    JSON format

  --json                                                                            show output in json format (disables
                                                                                    --verbose)

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --nocache                                                                         don't use cache during loading

  --unused                                                                          show unused messages, requires
                                                                                    --verbose

  --verbose                                                                         show warning messages

EXAMPLES
  $ sfdx apexlink:check
  $ sfdx apexlink:check --verbose $HOME/myproject
  $ sfdx apexlink:check --json --depends $HOME/myproject
```

_See code: [src/commands/apexlink/check.ts](https://github.com/nawforce/apexlink/blob/v2.3.4/src/commands/apexlink/check.ts)_

## `sfdx apexlink:gulp [--namespaces <array>] [--debug] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Download metadata to enable apex-link semantic analysis

```
USAGE
  $ sfdx apexlink:gulp [--namespaces <array>] [--debug] [-u <string>] [--apiversion <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --debug                                                                           show progress messages

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --namespaces=namespaces                                                           gulp metadata for these namespaces,
                                                                                    unmanaged metadata is gulped by
                                                                                    default

EXAMPLES
  $ sfdx apexlink:gulp
  $ sfdx apexlink:gulp --debug --namespaces="ns1,ns2"
```

_See code: [src/commands/apexlink/gulp.ts](https://github.com/nawforce/apexlink/blob/v2.3.4/src/commands/apexlink/gulp.ts)_

## `sfdx apexlink:packages [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Display information about installed packages

```
USAGE
  $ sfdx apexlink:packages [-u <string>] [--apiversion <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLES
  $ sfdx apexlink:packages
  $ sfdx apexlink:packages --debug"
```

_See code: [src/commands/apexlink/packages.ts](https://github.com/nawforce/apexlink/blob/v2.3.4/src/commands/apexlink/packages.ts)_
<!-- commandsstop -->

[![Version](https://img.shields.io/npm/v/apexlink.svg)](https://npmjs.org/package/apexlink)
[![License](https://img.shields.io/npm/l/apexlink.svg)](https://github.com/nawforce/apexlink/blob/master/package.json)
[![Known Vulnerabilities](https://snyk.io/test/github/nawforce/apexlink/badge.svg)](https://snyk.io/test/github/nawforce/apexlink)
