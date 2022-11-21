## SolarQuant

This repository contains the SolarQuant environment tooling, which allows
the user to easily source training data to be used for training machine
learning predictors. SolarQuant works by consuming OrangeButton and
SolarNetwork data, both of which are free and open source.

### Using The SolarQuant Environment

The recommended way of using the SolarQuant Environment is by using the
docker image contained in this repository. You can either build it yourself,
or pull it from dockerhub:

```shell
$ docker pull thomaspassmore/solarquant:latest
$ docker run --rm -it --entrypoint bash thomaspassmore:solarquant
# sqc -h
Usage: sqc [options] [command]

Options:
  -h, --help        display help for command

Commands:
  config
  projects
  events
  datums [options]
  help [command]    display help for command
```

### Authentication

To fetch data for your predictor, you should first authenticate with Ecogy
AMS and/or SolarNetwork. The Ecogy AMS provides metadata which is useful for
training purposes, and for examining the projects and data sources which
can be fetched from SolarNetwork.

The Ecogy AMS authentication process may need to be completed regularly.

#### Ecogy AMS

To authenticate against the Ecogy AMS, run the following command:

```shell
$ sqc authenticte ams
```

You will be asked to provide the following information:

| Value    | Type   | Description                                                 |
|----------|--------|-------------------------------------------------------------|
| region   | string | AWS Cognito pool region. Ask your administrator.            |
| poolId   | string | AWS Cognito pool identifier. Ask your administrator.        |
| clientId | string | AWS Cognito pool client identifier. Ask your administrator. |
| username | string | Ecogy AMS username.                                         |
| password | string | Ecogy AMS password.                                         |

#### SolarNetwork

To authenticate against SolarNetwork, run the following command:

```shell
$ sqc authenticte sn
```

You will be asked to provide the following information:

| Value  | Type   | Description          |
|--------|--------|----------------------|
| token  | string | SolarNetwork token.  |
| secret | string | SolarNetwork secret. |

### Investigating Datums

To determine which datums to fetch, we should first investigate what data is available
to us. Firstly, we can list the projects which can be used:

```shell
$ sqc projects list
```

To determine which sources to use, we can take a project code from the list and ask for
the relevant sources:

```shell
$ sqc projects source /MA1/**
┌────────────────────────────────┬──────────────────┬───────────────┬──────────────┬────────┐
│ source                         │ field            │ instantaneous │ accumulating │ status │
├────────────────────────────────┼──────────────────┼───────────────┼──────────────┼────────┤
│ /MA1/ANNE/R1/GEN/1             │ watts            │ Y             │              │        │
│ /MA1/ANNE/R1/GEN/1             │ current          │ Y             │              │        │
..
```

### Fetching Training Datums

To fetch training data from SolarNetwork, you should use the `sqc datums stream` command.
The stream command accepts a source string and a format string. The source string is
an expression which SolarNetwork uses to establish which sources you are requesting,
and accepts wildcards. The format string is a string which represents the columns of
the resulting CSV file.

For example, to fetch datums for all sources in the `MA` project, we can use the following
command:

```shell
$ sqc datums stream /MA/** timestamp,voltage\$average,voltage\$minimum,voltage\$maximum --aggregation Hour
```

The output should look something like the following:

```
sourceId,objectId,timestamp,voltage$average,voltage$minimum,voltage$maximum
/MA/PA/S1/GEN/1/FORECAST,409,1616025600000,1616025600000,1616025600000,1616025600000
...
```

#### Datum Format Strings

##### `timestamp` column

The `timestamp` column is a builtin value which corresponds to the UNIX millisecond timestamp when
the datum was recorded.

##### Meta column names

The `$` character is used to delineate between the column name, and the type of value.
For instance, instantaneous measurements using the aggregation option provide the `$average`,
`$count`, `$minimum` and `$maximum` values.

##### Filtering Rows

By default, rows are only recorded if the matching datum is able to fulfill the entire format
string. For example, a format string `timestamp,voltage$maximum,watts$count` will only include
results from datums which provide both `voltage` and `watts` measurements.

To allow partial rows (for instance, rows which only contain `voltage`) use the `--partial` flag.
To allow empty rows, use the `--empty` flag.
