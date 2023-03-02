import {AuthorizationV2Builder, DatumStreamMetadataRegistry} from "solarnetwork-api-core";
import {readConfigFile, SNConfig} from "./config.js";
import cliProgress, {MultiBar} from "cli-progress"
import {SimpleChannel} from "channel-ts";
import {getDateRanges} from "./util.js";
import moment from "moment";
import {Table} from "console-table-printer";
import randomWords from "random-words"
import {
    AggregatedDatum,
    getDatums,
    getMeasurementDescriptor,
    getNodeIds,
    listSources,
    MeasurementType, parseAggregatedDatums, parseRawDatums, RawDatum,
    StreamMeta,
    TaggedDatum, TaggedStreamResponse,
    ExportTypeInfo, listExportType, submitExportTask, ExportSettingsSpecifier,
    listExportTasks,
    ExportDatumFilter, ExportDataConfiguration, ExportDestinationConfiguration, ExportOutputConfiguration, ExportTask
} from "./solarnetwork_api.js"
import {Result} from "true-myth";


function columnName(c: string): string {
    const meta = c.indexOf("$")
    return meta == -1 ? c : c.substring(0, meta)
}

function columnValue(c: string, row: TaggedDatum, m: StreamMeta): string {
    const meta = c.indexOf("$")
    const name = columnName(c)

    const desc = getMeasurementDescriptor(m, name)
    if (!desc) {
        return ""
    }

    let metaName = ""
    if (meta != -1) {
        metaName = c.substring(meta + 1)
    }

    switch (desc.type) {
        case MeasurementType.Instantaneous: {

            switch (row.state) {
                // If it's a raw i datum, we just return the value
                case "raw": {
                    const [_meta, _timestamp, i, _a, _s, _tags] = row.datum

                    if (i.length <= desc.index) {
                        return ""
                    }

                    const v = i[desc.index]
                    if (v == undefined)
                        return ""

                    return v.toString()
                }

                // Aggregated, depends on the meta value
                case "aggregated": {
                    const [_meta, _timestamp, i, _a, _s, _tags] = row.datum
                    if (i.length <= desc.index) {
                        return ""
                    }

                    const v = i[desc.index]
                    if (v == undefined)
                        return ""

                    // Deconstruct the meta values
                    const [av, co, min, max] = v

                    switch (metaName) {
                        case "":
                            return av.toString()
                        case "average":
                            return av.toString()
                        case "count":
                            return co.toString()
                        case "minimum":
                            return min.toString()
                        case "maximum":
                            return max.toString()
                        default:
                            throw new Error(`Unrecognized meta value: ${metaName}`)
                    }
                }
            }

        }

        case MeasurementType.Accumulating: {
            switch (row.state) {
                // If it's a raw a datum, we just return the value
                case "raw": {
                    const [_meta, _timestamp, _i, a, _s, _tags] = row.datum
                    if (a.length <= desc.index) {
                        return ""
                    }

                    const v = a[desc.index]
                    if (v == undefined)
                        return ""

                    return v.toString()
                }

                // Aggregated, depends on the meta value
                case "aggregated": {
                    const [_meta, _timestamp, _i, a, _s, _tags] = row.datum
                    if (a.length <= desc.index) {
                        return ""
                    }

                    const v = a[desc.index]
                    if (v == undefined)
                        return ""

                    // Deconstruct the meta values
                    const [difference, starting, ending] = v

                    switch (metaName) {
                        case "":
                            return ending.toString()
                        case "difference":
                            return difference.toString()
                        case "starting":
                            return starting.toString()
                        case "ending":
                            return ending.toString()
                        default:
                            throw new Error(`Unrecognized meta value: ${metaName}`)
                    }
                }
            }
        }

        case MeasurementType.Status: {
            const [_meta, _timestamp, _i, _a, s, _tags] = row.datum
            if (s.length <= desc.index) {
                return ""
            }

            const v = s[desc.index]
            if (v == undefined)
                return ""

            return v.toString()
        }
    }
}

function chunkArray<T>(arr: T[], n: number): T[][] {
    const chunkLength = Math.max(arr.length / n, 1);
    const chunks = [];
    for (let i = 0; i < n; i++) {
        if (chunkLength * (i + 1) <= arr.length) chunks.push(arr.slice(chunkLength * i, chunkLength * (i + 1)));
    }
    return chunks;
}

export async function listSourceMeasurements(path: string): Promise<Result<void, Error>> {
    const cfg = readConfigFile()

    if (!cfg.sn) {
        return Result.err(new Error("You must authenticate against SolarNetwork"))
    }

    if (!cfg.sn.token) {
        return Result.err(new Error("You must provide a token"))
    }

    if (!cfg.sn.secret) {
        return Result.err(new Error("You must provide a secret"))
    }

    const ids = await getNodeIds(cfg.sn)
    if (ids.isErr) {
        return Result.err(new Error(`Failed to get node IDS: ${ids.error.message}`))
    }

    const result = await getDatums(cfg.sn, true, path, ids.value, undefined, undefined)
    if (result.isErr) {
        return Result.err(new Error(`Failed to get matching source IDS: ${result.error}`))
    }

    let rows = []
    for (const source of result.value.response.meta) {
        if (source['i']) {
            for (const i of source['i']) {
                rows.push({
                    'source': source['sourceId'],
                    'field': i,
                    'instantaneous': 'Y',
                    'accumulating': '',
                    'status': '',
                })
            }
        }
        if (source['a']) {
            for (const a of source['a']) {
                rows.push({
                    'source': source['sourceId'],
                    'field': a,
                    'instantaneous': '',
                    'accumulating': 'Y',
                    'status': '',
                })
            }
        }
        if (source['s']) {
            for (const s of source['s']) {
                rows.push({
                    'source': source['sourceId'],
                    'field': s,
                    'instantaneous': '',
                    'accumulating': '',
                    'status': 'Y',
                })
            }
        }
    }

    const p = new Table({
        columns: [
            {
                name: 'source',
                alignment: 'left',
            },
            {
                name: 'field',
                alignment: 'left',
            },
            {
                name: 'instantaneous',
                alignment: 'left',
            },
            {
                name: 'accumulating',
                alignment: 'left',
            },
            {
                name: 'status',
                alignment: 'left',
            }
        ],
        rows: rows
    })

    p.printTable()
    return Result.ok(void(0))
}

interface SNChunk {
    response: TaggedStreamResponse,
    total: number
}

async function fetchSNDatumsProducer(cfg: SNConfig, chan: SimpleChannel<SNChunk>, bar: MultiBar, ids: any, sources: string[], format: string, start: string, end: string, opts: any) {
    if (!sources) {
        return
    }

    const ranges = getDateRanges(moment(start), moment(end))

    for (const source of sources) {
        const b = bar.create(ranges.length, 0, {}, {
            format: ' {bar} | {sourceId}',
        })
        try {
            let total = 0

            for (const range of ranges) {
                const s = range.beginInclusive.format("YYYY-MM-DD")
                const e = range.endExclusive.format("YYYY-MM-DD")

                total += 1

                b.update(total, {sourceId: source})

                const response = await getDatums(cfg, false, source, ids, s, e, opts['aggregation'])
                if (response.isErr) {
                    console.error(`Warning: some datums failed to be fetched: ${response.error.message}`)
                    continue
                }

                chan.send({
                    response: response.value,
                    total: total
                })
            }
        } catch (e: any) {
            console.error(`Source ${source} failed: ${e}`)
        }
        bar.remove(b)
    }
}

async function fetchSNDatumsConsumer(chan: SimpleChannel<SNChunk>, bar: MultiBar, total: number,  ids: any, format: string, start: string, end: string, opts: any) {

    const columns = format.split(",")
    const b = bar.create(total, 0, {}, {
        format: ' {bar} | Total Progress: {value}/{total} | {eta_formatted}',
    })

    const haveTimestamp = columns.findIndex(col => col === "timestamp") != -1

    for await(const next of chan) {
        const chunk = next.response

        b.increment()

        if (!chunk.response.success) {
            continue
        }

        const d = new DatumStreamMetadataRegistry(chunk.response.meta)

        let rows: RawDatum[] | AggregatedDatum[] = []
        switch (chunk.state) {
            case "raw": {
                rows = parseRawDatums(chunk.response)
                break
            }
            case "aggregated": {
                rows = parseAggregatedDatums(chunk.response)
                break
            }
        }

        for (const row of rows) {
            if (!row) {
                continue
            }

            const m = d.metadataAt(row[0]) as StreamMeta
            const columnExists = (name: string): boolean => {
                const desc = getMeasurementDescriptor(m, columnName(name))
                return desc != undefined
            }

            const foundColumns = columns.filter(c => {
                if (c == "timestamp")
                    return true

                return columnExists(c)
            })

            if (foundColumns.length != columns.length) {
                const empty = opts['empty']
                const partial = opts['partial']
                const isEmpty = haveTimestamp ? foundColumns.length == 1 : foundColumns.length == 0
                const isPartial = haveTimestamp ? foundColumns.length > 1 : foundColumns.length > 0

                if (isEmpty && !empty) {
                    continue
                }
                if (isPartial && !partial && !empty) {
                    continue
                }
            }

            if (m['sourceId']) {
                process.stdout.write(m['sourceId'].toString())
            }
            process.stdout.write(',')

            if (m['objectId']) {
                process.stdout.write(m['objectId'].toString())
            }
            process.stdout.write(',')

            for (let i = 0; i < columns.length; i++) {
                const c = columns[i]
                const sep = (i < (columns.length - 1)) ? ',' : ''

                if (c == "timestamp") {

                    // TODO: ignoring end?

                    switch (chunk.state) {
                        case "raw": {
                            const tRow = row as RawDatum
                            process.stdout.write(tRow[1].toString())
                            break
                        }
                        case "aggregated": {
                            const tRow = row as AggregatedDatum
                            const [_meta, timestamp, _i, _a, _status, _tags] = tRow
                            process.stdout.write(timestamp[0].toString())
                        }
                    }

                    process.stdout.write(sep)
                    continue
                }

                let val
                switch (chunk.state) {
                    case "raw": {
                        val = val = columnValue(c, {
                            state: "raw",
                            datum: row as RawDatum,
                        }, m)
                        break
                    }
                    case "aggregated": {
                        val = val = columnValue(c, {
                            state: "aggregated",
                            datum: row as AggregatedDatum,
                        }, m)
                        break
                    }
                }

                if (val !== undefined) {
                    process.stdout.write(val.toString())
                }
                process.stdout.write(sep)
            }

            process.stdout.write("\n")
        }
    }

    process.stdout.write("\n")
}

export async function fetchSNDatums(source: string, format: string, start: string, end: string, opts: any): Promise<Result<void, Error>> {
    const cfg = readConfigFile()

    if (!cfg.sn) {
        return Result.err(new Error("You must authenticate against SolarNetwork"))
    }

    if (!cfg.sn.token) {
        return Result.err(new Error("You must provide a token"))
    }

    if (!cfg.sn.secret) {
        return Result.err(new Error("You must provide a secret"))
    }

    const ids = await getNodeIds(cfg.sn)
    if (ids.isErr) {
        return Result.err(new Error(`API call to get nodes failed: ${ids.error.message}`))
    }

    const sources = await listSources(cfg.sn, cfg.sn.secret, ids)
    if (sources.isErr) {
        return Result.err(new Error(`Failed to fetch list of sources: ${sources.error.message}`))
    }

    const coefficient = getDateRanges(moment(start), moment(end)).length

    const bar = new cliProgress.MultiBar({
        etaBuffer: 64,
        clearOnComplete: true,
        hideCursor: true,
        format: ' {bar} | {filename} | {value}/{total}',
        forceRedraw: true,
    }, cliProgress.Presets.rect)

    try {
        console.log("sourceId,objectId," + format)

        const parallel: number = parseInt(opts['parallel'])

        const chan = new SimpleChannel<SNChunk>();
        const groups = chunkArray(sources.value, parallel)
        const p1 = fetchSNDatumsConsumer(chan, bar, sources.value.length * coefficient, ids, format, start, end, opts)
        const sncfg = cfg.sn
        const p2 = Array.from(Array(parallel).keys()).map(async i => fetchSNDatumsProducer(sncfg, chan, bar, ids, groups[i], format, start, end, opts))

        await Promise.all(p2)
        chan.close()

        await p1
    } catch (e) {
        console.error(e)
    }

    bar.stop()
    return Result.ok(void(0))
}

async function fetchExportList(t: string): Promise<Result<void, Error>> {
    const cfg = readConfigFile()

    if (!cfg.sn) {
        return Result.err(new Error("You must authenticate against SolarNetwork"))
    }

    if (!cfg.sn.token) {
        return Result.err(new Error("You must provide a token"))
    }

    if (!cfg.sn.secret) {
        return Result.err(new Error("You must provide a secret"))
    }

    const result = await listExportType(t, cfg.sn)
    if (result.isErr) {
        return Result.err(new Error(`Failed to fetch export types: ${result.error.message}`))
    }

    for (const r of result.value) {
        console.log(`id: ${r.id}`)
        console.log(`locale: ${r.locale}`)
        console.log(`localized name: ${r.localizedName}`)
        console.log(`localized description: ${r.localizedDescription}`)

        const opts = r.localizedInfoMessages

        if (typeof opts === 'object' && !Array.isArray(opts) && opts !== null) {
            for (const [key, value] of Object.entries(opts)) {
                console.log(` - Property '${key}': ${value}`)
            }
        }
    }

    return Result.ok(void(0))
}

export async function fetchCompressionTypes(): Promise<Result<void, Error>> {
    return await fetchExportList("compression")
}

export async function fetchDestinationTypes(): Promise<Result<void, Error>> {
    return await fetchExportList("destination")
}

export async function fetchOutputTypes(): Promise<Result<void, Error>> {
    return await fetchExportList("output")
}

export async function fetchExportTasks(): Promise<Result<void, Error>> {
    const cfg = readConfigFile()

    if (!cfg.sn) {
        return Result.err(new Error("You must authenticate against SolarNetwork"))
    }

    if (!cfg.sn.token) {
        return Result.err(new Error("You must provide a token"))
    }

    if (!cfg.sn.secret) {
        return Result.err(new Error("You must provide a secret"))
    }

    const tasks = await listExportTasks(cfg.sn)
    if (tasks.isErr) {
        return Result.err(new Error(`Failed to get export tasks: ${tasks.error.message}`))
    }

    for (const task of tasks.value) {
        const config = task['config']
        const t = task['task']

        console.log(config['name'])
        if (t['statusKey'] !== undefined) {
            console.log(` - Status: ${t['statusKey']}`)
        }
        if (t['message'] !== undefined) {
            console.log(` - Message: ${t['message']}`)
        }
    }

    return Result.ok(void(0))
}

function splitOnce(str: string, element: string): string[] {
    let arr = str.split(element)
    // Combine [1,both.length) into a single string
    arr[1] = arr.reduce((prev, curr, i, arr) => {
        if (i >= 1) {
            return (i == 1) ? prev + arr[i] : (prev + (":" + arr[i]))
        }
        return ""
    }, arr[1])
    return arr.slice(0, 2)
}

export async function startExportTask(opts: any): Promise<Result<void, Error>> {
    const cfg = readConfigFile()

    if (!cfg.sn) {
        return Result.err(new Error("You must authenticate against SolarNetwork"))
    }

    if (!cfg.sn.token) {
        return Result.err(new Error("You must provide a token"))
    }

    if (!cfg.sn.secret) {
        return Result.err(new Error("You must provide a secret"))
    }

    const ids = await getNodeIds(cfg.sn)
    if (ids.isErr) {
        return Result.err(new Error(`API call to get nodes failed: ${ids.error.message}`))
    }

    if (opts['start'] === undefined || opts['end'] === undefined) {
        return Result.err(new Error("Start and end options must be provided"))
    }

    if (opts['source'] === undefined) {
        return Result.err(new Error("Source expression must be provided"))
    }

    if (opts['output'] === undefined) {
        return Result.err(new Error("Output identifier must be provided"))
    }

    if (opts['destination'] === undefined) {
        return Result.err(new Error("Destination identifier must be provided"))
    }

    const start = moment(opts['start'])
    const end = moment(opts['end'])
    const name = randomWords({exactly: 4, join: '-'})

    const compressionTypes = await listExportType("compression", cfg.sn)
    if (compressionTypes.isErr) {
        return Result.err(new Error(`Failed to fetch compression types: ${compressionTypes.error.message}`))
    }

    const outputTypes = await listExportType("output", cfg.sn)
    if (outputTypes.isErr) {
        return Result.err(new Error(`Failed to fetch compression types: ${outputTypes.error.message}`))
    }

    const destinationTypes = await listExportType("destination", cfg.sn)
    if (destinationTypes.isErr) {
        return Result.err(new Error(`Failed to fetch compression types: ${destinationTypes.error.message}`))
    }

    // Get the right type
    let compressionType: ExportTypeInfo | undefined = compressionTypes.value.find((t: ExportTypeInfo) => {
        return t.id === opts['compression'] || t.localizedName === opts['compression']
    })
    let outputType: ExportTypeInfo | undefined = outputTypes.value.find((t: ExportTypeInfo) => {
        return t.id === opts['output'] || t.localizedName === opts['output']
    })
    let destinationType: ExportTypeInfo | undefined = destinationTypes.value.find((t: ExportTypeInfo) => {
        return t.id === opts['destination'] || t.localizedName === opts['destination']
    })

    if (compressionType == undefined) {
        return Result.err(new Error(`Unknown compression type ${opts['compression']}`))
    }
    if (outputType == undefined) {
        return Result.err(new Error(`Unknown output type ${opts['output']}`))
    }
    if (destinationType == undefined) {
        return Result.err(new Error(`Unknown destination type ${opts['destination']}`))
    }

    const outputProps = opts['outputProp'].map((p: string) => {
        const both = splitOnce(p, ":")
        const value = (outputType as ExportTypeInfo).settingSpecifiers.find((s: ExportSettingsSpecifier) => s.key === both[0])
        return [both, value]
    })
    const destinationProps = opts['destinationProp'].map((p: string) => {
        const both = splitOnce(p, ":")
        const value = (destinationType as ExportTypeInfo).settingSpecifiers.find((s: ExportSettingsSpecifier) => s.key === both[0])
        return [both, value]
    })

    // Verify options
    for (const prop of outputProps) {
        if (prop[1] === undefined) {
            return Result.err(new Error(`Output property not found: ${prop[0]}`))
        }
    }
    for (const prop of destinationProps) {
        if (prop[1] === undefined) {
            return Result.err(new Error(`Destination property not found: ${prop[0]}`))
        }
    }

    const filter: ExportDatumFilter = {
        startDate: start.valueOf(),
        endDate: end.valueOf(),
        aggregation: opts['aggregation'],
        nodeIds: ids.value,
        sourceId: opts['source'],
    }
    const data: ExportDataConfiguration = {
        datumFilter: filter,
    }

    let outputServiceProperties: Record<string, any> = {}
    for (const prop of outputProps) {
        let [[k, v], t] = prop

        if (t['type'] === "net.solarnetwork.settings.ToggleSettingSpecifier") {
            outputServiceProperties[k] = (v === "true")
        } else {
            outputServiceProperties[k] = <any>v
        }
    }

    let destinationServiceProperties: Record<string, any> = {}
    for (const prop of destinationProps) {
        let [[k, v], t] = prop

        if (t['type'] === "net.solarnetwork.settings.ToggleSettingSpecifier") {
            destinationServiceProperties[k] = (v === "true")
        } else {
            destinationServiceProperties[k] = <any>v
        }
    }

    const output: ExportOutputConfiguration = {
        compressionTypeKey: compressionType.id,
        serviceIdentifier: outputType.id,
        serviceProperties: outputServiceProperties
    }

    const destination: ExportDestinationConfiguration = {
        serviceIdentifier: destinationType.id,
        serviceProperties: destinationServiceProperties
    }

    const request: ExportTask = {
        name: name,
        dataConfiguration: data,
        outputConfiguration: output,
        destinationConfiguration: destination
    }

    await submitExportTask(request, cfg.sn)

    // Wait for the API to give us an answer
    // TODO: types
    while (true) {
        const tasks = await listExportTasks(cfg.sn)
        if (tasks.isErr) {
            return Result.err(new Error(`Failed to get export tasks: ${tasks.error.message}`))
        }

        const task = tasks.value.find((t: any) => t['config']['name'] === name)

        if (task == undefined) {
            return Result.err(new Error(`Warning: Lost track of task '${name}', aborting.`))
        }

        const result = task['task']

        if (!result['success']) {
            if (result['statusKey'] === 'q' || result['message'] == undefined) {
                continue
            }

            // Error
            if (result['statusKey'] === 'c') {
                console.error(`Export task failed: ${result['message']}`)
                break
            }
        } else {
            break
        }
    }

    return Result.ok(void(0))
}

