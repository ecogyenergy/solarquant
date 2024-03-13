Getting Started
===============

Installation
------------

To install the SolarQuant environment, you can either use Docker or install directly to your machine. Installing
through docker is the recommended method, as it involves no setup and should work on any operating system and
developer environment. Installing SolarQuant directly to your machine is useful if you want to work on the SolarQuant
code itself.

Installing with Docker
~~~~~~~~~~~~~~~~~~~~~~

Firstly, install Docker [#]_. Once this has been accomplished, you can pull the SolarQuant image from Docker Hub:

.. code-block:: console

    $ docker pull ecogyenergy/solarquant:latest
    $ docker run --rm -it --entrypoint bash ecogyenergy/solarquant:latest
    # sqc -h
      Usage: sqc [options] [command]

      Options:
        --config <configPath>  Path to config file
        -h, --help             display help for command

      Commands:
        config                 Manage authenticated sessions
        projects               Fetch project metadata
        events                 Fetch events
        datums                 Fetch datums from SolarNetwork
        plugin                 Plugin tools
        help [command]         display help for command

The recommended way of using SolarQuant is to use a shell alias on Unix-like shells:

.. code-block:: console

    $ docker pull ecogyenergy/solarquant:latest
    $ docker run --rm -it --entrypoint bash ecogyenergy/solarquant:latest
    $ alias sqc="docker run --privileged -it --rm -v '$PWD:/local' ecogyenergy/solarquant:latest --config /local/sqc.json"
    $ sqc -h
      Usage: sqc [options] [command]
    ...

.. warning::

    When using the alias, your current working directory should be prepended by `/local/` in your commands. This is
    because the previous commands mounts your working directory as a volume inside of the SolarQuant environment at
    this directory.

Installing directly on development machine
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

To install the SolarQuant Environment directly on your machine, clone the code locally and install the package:

.. code-block:: console

    $ git clone git@github.com:ecogyenergy/solarquant.git
    $ cd solarquant
    $ npm install
    [ .. ommitted ]
    $ npx tsc
    $ npm link
    ...
    /home/username/.npm/bin/sqc -> /home/username/.npm/lib/node_modules/solarquant/src/index.js
    /home/username/.npm/lib/node_modules/solarquant -> /home/username/ecogy/solarquant
    ```

To use the `sqc` command, add this to your `PATH` environment variable:

.. code-block:: console

    $ export PATH=$PATH:/home/username/.npm/bin/
    $ sqc -h
    Usage: sqc [options] [command]

    Options:
      -h, --help        display help for command

    Commands:
      config            Manage authenticated sessions
      projects          Fetch project metadata
      events            Fetch events
      datums [options]  Fetch datums from SolarNetwork
      plugin            Plugin tools
      help [command]    display help for command

.. note::

    Exporting the `PATH` variable like this will only survive for as long as your terminal is being used. Consider
    adding this to a script run when your shell starts.

Authentication
--------------

To use SolarQuant, you must authenticate against sources of data. These sources require different information, so
it's advised that you reach out to the respective administrator for help. The information you enter will be stored in
a file called `sqc.json`, and this file can be moved to new installations if needed.

.. warning::

    Be careful of how you enter your data in the terminal. You may have to escape some characters, otherwise your
    terminal will misunderstand your input. This is particularly relevant for random strings, such as tokens and
    secrets.

Authenticating with SolarNetwork
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

To authenticate against SolarNetwork, run the following command:

.. code-block:: console

    $ sqc config authenticate sn

You will be asked to provide the following information:

.. list-table:: SolarNetwork information
   :widths: 25 25 25 50
   :header-rows: 1

   * - Value
     - Required
     - Type
     - Description
   * - URL
     - No
     - string
     - Address of the SolarNetwork server.
   * - token
     - Yes
     - string
     - SolarNetwork token.
   * - secret
     - Yes
     - string
     - SolarNetwork secret.

Ecosuite
~~~~~~~~~

To authenticate against Ecosuite, run the following command:

.. code-block:: console

    $ sqc config authenticate ecosuite

You will be asked to provide the following information:

.. list-table:: SolarNetwork information
   :widths: 15 15 15 50
   :header-rows: 1

   * - Value
     - Required
     - Type
     - Description
   * - region
     - Yes
     - string
     - AWS Cognito pool region. Ask your administrator.
   * - poolId
     - Yes
     - string
     - AWS Cognito pool identifier. Ask your administrator.
   * - clientId
     - Yes
     - string
     - AWS Cognito pool client identifier. Ask your administrator.
   * - username
     - Yes
     - string
     - Ecosuite username.
   * - password
     - Yes
     - string
     - Ecosuite password.

Tutorial: Exporting SolarNetwork Data
-------------------------------------

This section will guide you through the process of exporting data from SolarNetwork. This requires you to authenticate
against the SolarNetwork data source.

Investigating Sources
~~~~~~~~~~~~~~~~~~~~~

Data on SolarNetwork is given by a source identifier, or `sourceId`. Our first task will be to investigate which
sources we have available to us:

.. code-block:: console

    $ sqc projects source
    ┌────────┬────────────────────────────────┐
    │ nodeId │ sourceId                       │
    ├────────┼────────────────────────────────┤
    │ 318    │ /LN/RC/S1/GEN/1                │
    │ 318    │ /LN/RC/S1/GEN/1/FORECAST       │
    │ 318    │ /LN/RC/S1/GEN/1/FORECAST/12    │
    │ 318    │ /LN/RC/S1/GEN/1/FORECAST/24    │
    │ 318    │ /LN/RC/S1/GEN/1/FORECAST/48    │
    │ 318    │ /LN/RC/S1/INV/1                │
    │ 318    │ /LN/RC/S2/GEN/1                │
    ...

Once we have a `sourceId`, we can investigate the measurements available on the source. Measurements correspond to
columns of data:

.. code-block:: console

    $ sqc projects source /LN/RC/S1/GEN/1
    ┌─────────────────┬──────────────────┬───────────────┬──────────────┬────────┐
    │ source          │ field            │ instantaneous │ accumulating │ status │
    ├─────────────────┼──────────────────┼───────────────┼──────────────┼────────┤
    │ /LN/RC/S1/GEN/1 │ watts            │ Y             │              │        │
    │ /LN/RC/S1/GEN/1 │ current          │ Y             │              │        │
    │ /LN/RC/S1/GEN/1 │ voltage          │ Y             │              │        │
    │ /LN/RC/S1/GEN/1 │ frequency        │ Y             │              │        │
    │ /LN/RC/S1/GEN/1 │ powerFactor      │ Y             │              │        │
    │ /LN/RC/S1/GEN/1 │ apparentPower    │ Y             │              │        │
    │ /LN/RC/S1/GEN/1 │ reactivePower    │ Y             │              │        │
    │ /LN/RC/S1/GEN/1 │ current_a        │ Y             │              │        │
    │ /LN/RC/S1/GEN/1 │ current_b        │ Y             │              │        │
    │ /LN/RC/S1/GEN/1 │ current_c        │ Y             │              │        │
    │ /LN/RC/S1/GEN/1 │ voltage_a        │ Y             │              │        │
    │ /LN/RC/S1/GEN/1 │ voltage_b        │ Y             │              │        │
    │ /LN/RC/S1/GEN/1 │ voltage_c        │ Y             │              │        │
    │ /LN/RC/S1/GEN/1 │ voltage_ab       │ Y             │              │        │
    │ /LN/RC/S1/GEN/1 │ voltage_bc       │ Y             │              │        │
    │ /LN/RC/S1/GEN/1 │ voltage_ca       │ Y             │              │        │
    │ /LN/RC/S1/GEN/1 │ lineVoltage      │ Y             │              │        │
    │ /LN/RC/S1/GEN/1 │ wattHours        │               │ Y            │        │
    │ /LN/RC/S1/GEN/1 │ wattHoursReverse │               │ Y            │        │
    │ /LN/RC/S1/GEN/1 │ phase            │               │              │ Y      │
    └─────────────────┴──────────────────┴───────────────┴──────────────┴────────┘

.. note::

    Whenever SolarQuant asks for a `sourceId`, you can use a wildcard expression instead. For instance, you could write
    `/LN/RC/S1/GEN/*` to fetch every source of this type.


Fetching Datums
~~~~~~~~~~~~~~~

Downloading datums from SolarNetwork is accomplished using the datums subcommand. Firstly, let's check the measurements
of a source we'd like to download from:

.. code-block:: console

    $ sqc projects source /MA/PA/S1/INV/4
    ┌─────────────────┬──────────────────┬───────────────┬──────────────┬────────┐
    │ source          │ field            │ instantaneous │ accumulating │ status │
    ├─────────────────┼──────────────────┼───────────────┼──────────────┼────────┤
    │ /MA/PA/S1/INV/4 │ watts            │ Y             │              │        │
    │ /MA/PA/S1/INV/4 │ current          │ Y             │              │        │
    │ /MA/PA/S1/INV/4 │ dcPower          │ Y             │              │        │
    │ /MA/PA/S1/INV/4 │ voltage          │ Y             │              │        │
    │ /MA/PA/S1/INV/4 │ dcVoltage        │ Y             │              │        │
    │ /MA/PA/S1/INV/4 │ frequency        │ Y             │              │        │
    │ /MA/PA/S1/INV/4 │ powerFactor      │ Y             │              │        │
    │ /MA/PA/S1/INV/4 │ apparentPower    │ Y             │              │        │
    │ /MA/PA/S1/INV/4 │ reactivePower    │ Y             │              │        │
    │ /MA/PA/S1/INV/4 │ temp_heatSink    │ Y             │              │        │
    │ /MA/PA/S1/INV/4 │ temp             │ Y             │              │        │
    │ /MA/PA/S1/INV/4 │ temp_other       │ Y             │              │        │
    │ /MA/PA/S1/INV/4 │ temp_transformer │ Y             │              │        │
    │ /MA/PA/S1/INV/4 │ dcCurrent        │ Y             │              │        │
    │ /MA/PA/S1/INV/4 │ wattHours        │               │ Y            │        │
    │ /MA/PA/S1/INV/4 │ phase            │               │              │ Y      │
    │ /MA/PA/S1/INV/4 │ events           │               │              │ Y      │
    │ /MA/PA/S1/INV/4 │ opState          │               │              │ Y      │
    │ /MA/PA/S1/INV/4 │ sunsOpState      │               │              │ Y      │
    └─────────────────┴──────────────────┴───────────────┴──────────────┴────────┘

Now, let's download all of the datums for an entire month. To flex our muscles a bit, let's download from all of the
`INV` sources in all systems of the `MA` project:

.. code-block:: console

    $ sqc datums stream -s /MA/**/INV/* -f timestamp,watts,current,voltage --start 2022-05-01 --end 2022-06-01 -o datums.csv
    $ head datums.csv
    sourceId,objectId,timestamp,watts,current,voltage
    /MA/PA/S1/INV/12,409,1651363240003,0,0,277.86667
    /MA/PA/S1/INV/12,409,1651363300003,0,0,278.46667
    /MA/PA/S1/INV/12,409,1651363360003,0,0,278.03333
    /MA/PA/S1/INV/12,409,1651363420003,0,0,278.06665
    /MA/PA/S1/INV/12,409,1651363480004,0,0,278.33334
    /MA/PA/S1/INV/12,409,1651363540237,0,0,278.33334
    /MA/PA/S1/INV/12,409,1651363600342,0,0,278.33334
    /MA/PA/S1/INV/12,409,1651363660308,0,0,278.33334
    /MA/PA/S1/INV/12,409,1651363720003,0,0,278.33334

The `-f` argument passed to the stream subcommand is called the format parameter, and it corresponds to the goal
CSV header. In this case, we wanted to download the `watts`, `current`, and `voltage` measurements alongside the UNIX
timestamp of when these measurements were recorded.

Tutorial: Exporting to S3
-------------------------------------

This section has similar goals to the previous section, except it will guide you through exporting to S3. Using the
**export** subcommand has three different options to consider:

* **Output**: This specifies the format of the data, for example CSV.
* **Compression**: This controls the compression scheme which SolarNetwork uses.
* **Destination**: This controls where the data is exported to, in our case we're just interested in S3.

Export Options
~~~~~~~~~~~~~~

Firstly, let's investigate our options for these. To see what sort of output options are available to us, use the
`output-types` subcommand:

  .. code-block:: console

    $ sqc datums output-types
    id: net.solarnetwork.central.datum.export.standard.CsvDatumExportOutputFormatService
    locale: en-US
    localized name: CSV
    localized description: Export data in comma separated values (spreadsheet) format.
     - Property 'includeHeader.key': Include Header
     - Property 'includeHeader.desc': Toggle the inclusion of a CSV header row.
    id: net.solarnetwork.central.datum.export.standard.JsonDatumExportOutputFormatService
    locale: en-US
    localized name: JSON
    localized description: Export data in JSON format.

There are two options for the `output` option, one for CSV and one for JSON. You can either use the `id` field to
identify them, or use the much handier `localized name`.

The SolarNetwork API tells us that when using `CSV` as our `output` type, we have access to exactly one additional
property:

.. list-table:: SolarNetwork CSV Properties
   :widths: 25 25 50
   :header-rows: 1

   * - Name
     - Long Name
     - Description
   * - includeHeader
     - Include Header
     - Toggle the inclusion of a CSV header row.

Specifying a destination property is used by using `--destination-prop`, output properties are specified using
`--output-prop` and so on. You can use a similar procedure to investigate properties for compression and destination.

Putting It All Together
~~~~~~~~~~~~~~~~~~~~~~~

Once we've investigated the possible options and properties, we can execute an export. Below is an example export
command:

  .. code-block:: console

    $ sqc datums export \
      --output CSV \
      --compression None \
      --destination S3 \
      --destination-prop path:https://s3-us-east-1.amazonaws.com/solarquant \
      --destination-prop filenameTemplate:adhoc-data-export-{date}.{ext} \
      --destination-prop accessKey:key \
      --destination-prop secretKey:secret \
      --source /MA/** \
      --start 2022-01-01 --end 2022-05-01

Common Issues
-------------

* **Valid source IDs**: SolarNetwork can sometimes behave in unexpected ways if you provide a source ID which your token
  is not allowed to use, or if you're using a pattern which has the same effect. For instance:

  .. code-block:: console

    $ sqc projects source /DOESNT-EXIST/**
    Failed to get matching source IDS: Error: Request failed with status code 403

.. [#] There are multiple ways of installing Docker, follow the relevant instructions for your operating system:
    https://docs.docker.com/get-docker/
