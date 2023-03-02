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
    StreamMeta, StreamResponse,
    TaggedDatum, TaggedRawDatum, TaggedStreamResponse,
    ExportTypeInfo, listExportType, submitExportTask, ExportSettingsSpecifier,
    listExportTasks,
    ExportDatumFilter, ExportDataConfiguration, ExportDestinationConfiguration, ExportOutputConfiguration, ExportTask
} from "./solarnetwork_api.js"


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

export async function listSourceMeasurements(path: string): Promise<void> {
    const cfg = readConfigFile()

    if (!cfg.sn) {
        throw new Error("You must authenticate against SolarNetwork")
    }

    if (!cfg.sn.token) {
        throw new Error("You must provide a token")
    }

    if (!cfg.sn.secret) {
        throw new Error("You must provide a secret")
    }

    const ids = await getNodeIds(cfg.sn)
    const result = await getDatums(cfg.sn, true, path, ids, undefined, undefined)

    let rows = []
    for (const source of result.response.meta) {
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

                chan.send({
                    response: response,
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

export async function fetchSNDatums(source: string, format: string, start: string, end: string, opts: any): Promise<void> {
    const cfg = readConfigFile()

    if (!cfg.sn) {
        throw new Error("You must authenticate against SolarNetwork")
    }

    if (!cfg.sn.token) {
        throw new Error("You must provide a token")
    }

    if (!cfg.sn.secret) {
        throw new Error("You must provide a secret")
    }

    const ids = await getNodeIds(cfg.sn)
    const sources = await listSources(cfg.sn, cfg.sn.secret, ids)
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

        const secret: string = cfg.sn.secret
        const parallel: number = parseInt(opts['parallel'])

        const chan = new SimpleChannel<SNChunk>();
        const groups = chunkArray(sources, parallel)
        const p1 = fetchSNDatumsConsumer(chan, bar, sources.length * coefficient, ids, format, start, end, opts)
        const sncfg = cfg.sn
        const p2 = Array.from(Array(parallel).keys()).map(async i => fetchSNDatumsProducer(sncfg, chan, bar, ids, groups[i], format, start, end, opts))

        await Promise.all(p2)
        chan.close()

        await p1
    } catch (e) {
        console.error(e)
    }

    bar.stop()
}

async function fetchExportList(t: string): Promise<void> {
    const cfg = readConfigFile()

    if (!cfg.sn) {
        throw new Error("You must authenticate against SolarNetwork")
    }

    if (!cfg.sn.token) {
        throw new Error("You must provide a token")
    }

    if (!cfg.sn.secret) {
        throw new Error("You must provide a secret")
    }

    const result = await listExportType(t, cfg.sn)

    for (const r of result) {
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
}

export async function fetchCompressionTypes(): Promise<void> {
    await fetchExportList("compression")
}

export async function fetchDestinationTypes(): Promise<void> {
    await fetchExportList("destination")
}

export async function fetchOutputTypes(): Promise<void> {
    await fetchExportList("output")
}

export async function fetchExportTasks(): Promise<void> {
    const cfg = readConfigFile()

    if (!cfg.sn) {
        throw new Error("You must authenticate against SolarNetwork")
    }

    if (!cfg.sn.token) {
        throw new Error("You must provide a token")
    }

    if (!cfg.sn.secret) {
        throw new Error("You must provide a secret")
    }

    const tasks = await listExportTasks(cfg.sn)
    for (const task of tasks) {
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
}

export async function startExportTask(opts: any): Promise<void> {
    const cfg = readConfigFile()

    if (!cfg.sn) {
        throw new Error("You must authenticate against SolarNetwork")
    }

    if (!cfg.sn.token) {
        throw new Error("You must provide a token")
    }

    if (!cfg.sn.secret) {
        throw new Error("You must provide a secret")
    }

    const ids = await getNodeIds(cfg.sn)

    if (opts['start'] === undefined || opts['end'] === undefined) {
        throw new Error("Start and end options must be provided")
    }

    if (opts['source'] === undefined) {
        throw new Error("Source expression must be provided")
    }

    if (opts['output'] === undefined) {
        throw new Error("Output identifier must be provided")
    }

    if (opts['destination'] === undefined) {
        throw new Error("Destination identifier must be provided")
    }

    const start = moment(opts['start'])
    const end = moment(opts['end'])
    const name = randomWords({exactly: 4, join: '-'})

    const compressionTypes = await listExportType("compression", cfg.sn)
    const outputTypes = await listExportType("output", cfg.sn)
    const destinationTypes = await listExportType("destination", cfg.sn)

    // Get the right type
    let compressionType: ExportTypeInfo | undefined = compressionTypes.find((t: ExportTypeInfo) => {
        return t.id === opts['compression'] || t.localizedName === opts['compression']
    })
    let outputType: ExportTypeInfo | undefined = outputTypes.find((t: ExportTypeInfo) => {
        return t.id === opts['output'] || t.localizedName === opts['output']
    })
    let destinationType: ExportTypeInfo | undefined = destinationTypes.find((t: ExportTypeInfo) => {
        return t.id === opts['destination'] || t.localizedName === opts['destination']
    })

    if (compressionType == undefined) {
        throw new Error(`Unknown compression type ${opts['compression']}`)
    }
    if (outputType == undefined) {
        throw new Error(`Unknown output type ${opts['output']}`)
    }
    if (destinationType == undefined) {
        throw new Error(`Unknown destination type ${opts['destination']}`)
    }

    const outputProps = opts['outputProp'].map((p: string) => {
        const both = p.split(":")
        const value = (outputType as ExportTypeInfo).settingSpecifiers.find((s: ExportSettingsSpecifier) => s.key === both[0])
        return [both, value]
    })
    const destinationProps = opts['destinationProp'].map((p: string) => {
        const both = p.split(":")
        const value = (destinationType as ExportTypeInfo).settingSpecifiers.find((s: ExportSettingsSpecifier) => s.key === both[0])
        return [both, value]
    })

    // Verify options
    for (const prop of outputProps) {
        if (prop[1] === undefined) {
            throw new Error(`Output property not found: ${prop}`)
        }
    }
    for (const prop of destinationProps) {
        if (prop[1] === undefined) {
            throw new Error(`Destination property not found: ${prop}`)
        }
    }

    const filter: ExportDatumFilter = {
        startDate: start.valueOf(),
        endDate: end.valueOf(),
        aggregation: opts['aggregation'],
        nodeIds: ids,
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
            destinationServiceProperties[k] = <any>k
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
        const task = tasks.find((t: any) => t['config']['name'] === name)
        if (task == undefined) {
            console.error(`Warning: Lost track of task '${name}', aborting.`)
            return
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
}

