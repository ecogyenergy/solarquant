import {SimpleChannel} from 'channel-ts';
import cliProgress, {MultiBar} from 'cli-progress'
import {Table} from 'console-table-printer';
import {WriteStream} from 'fs';
import moment from 'moment';
import randomWords from 'random-words'
import {AuthorizationV2Builder, DatumStreamMetadataRegistry} from 'solarnetwork-api-core';
import {Result} from 'true-myth';

import {readConfigFile, SNConfig} from './config.js';
import {
    AggregatedDatum,
    AggregatedLocationDatum,
    ExportDataConfiguration,
    ExportDatumFilter,
    ExportDestinationConfiguration,
    ExportOutputConfiguration,
    ExportSettingsSpecifier,
    ExportTask,
    ExportTypeInfo,
    getDatums,
    getLocationDatums,
    getLocationMeta,
    getMeasurementDescriptor,
    getNodeIds,
    listExportTasks,
    listExportType,
    listSources,
    MeasurementType,
    parseAggregatedDatums,
    parseAggregatedLocationDatums,
    parseRawDatums,
    parseRawLocationDatums,
    RawDatum,
    RawLocationDatum,
    StreamMeta,
    submitExportTask,
    TaggedDatum,
    TaggedLocationDatum,
    TaggedRawDatum,
    TaggedRawResponse,
    TaggedStreamResponse
} from './solarnetwork_api.js'
import {getDateRanges} from './util.js';


function columnName(c: string): string {
    const meta = c.indexOf('$')
    return meta == -1 ? c : c.substring(0, meta)
}

function columnValueLocation(c: string, row: TaggedLocationDatum): string {
    const meta = c.indexOf('$')
    const name = columnName(c)
    let metaName = ''
    if (meta != -1) {
        metaName = c.substring(meta + 1)
    }

    switch (row.state) {
        case 'raw': {
            const [created, locationId, sourceId, localDate, localTime, _tags, samples] =
                row.datum

            if (name === 'created') {
                return created
            } else if (name === 'locationId') {
                return locationId.toString()
            } else if (name === 'sourceId') {
                return sourceId.toString()
            } else if (name === 'localDate') {
                return localDate.toString()
            } else if (name === 'localTime') {
                return localTime.toString()
            }

            const sample = samples.get(name)
            if (sample) {
                return sample.toString()
            }
            return ''
        }
        case 'aggregated': {
            const [created, locationId, sourceId, localDate, localTime, _tags, samples] =
                row.datum

            if (name === 'created') {
                return created
            } else if (name === 'locationId') {
                return locationId.toString()
            } else if (name === 'sourceId') {
                return sourceId.toString()
            } else if (name === 'localDate') {
                return localDate.toString()
            } else if (name === 'localTime') {
                return localTime.toString()
            }

            const sample = samples.get(name)
            if (sample) {
                switch (sample.type) {
                    case 'raw':
                        return sample.value.toString()
                    case 'aggregated':
                        switch (metaName) {
                            case '':
                                return sample.average.toString()
                            case 'average':
                                return sample.average.toString()
                            case 'minimum':
                                return sample.min.toString()
                            case 'maximum':
                                return sample.max.toString()
                            default:
                                throw new Error(`Unrecognized meta value: ${metaName}`)
                        }
                }
            }
            return ''
        }
    }
}

function columnValue(c: string, row: TaggedDatum, m: StreamMeta): string {
    const meta = c.indexOf('$')
    const name = columnName(c)

    const desc = getMeasurementDescriptor(m, name)
    if (!desc) {
        return ''
    }

    let metaName = ''
    if (meta != -1) {
        metaName = c.substring(meta + 1)
    }

    switch (desc.type) {
        case MeasurementType.Instantaneous: {
            switch (row.state) {
                // If it's a raw i datum, we just return the value
                case 'raw': {
                    const [_meta, _timestamp, i, _a, _s, _tags] = row.datum

                    if (i.length <= desc.index) {
                        return ''
                    }

                    const v = i[desc.index]
                    if (v == undefined)
                        return ''

                    return v.toString()
                }

                // Aggregated, depends on the meta value
                case 'aggregated': {
                    const [_meta, _timestamp, i, _a, _s, _tags] = row.datum
                    if (i.length <= desc.index) {
                        return ''
                    }

                    const v = i[desc.index]
                    if (v == undefined)
                        return ''

                    // Deconstruct the meta values
                    const [av, co, min, max] = v

                    switch (metaName) {
                        case '':
                            return av.toString()
                        case 'average':
                            return av.toString()
                        case 'count':
                            return co.toString()
                        case 'minimum':
                            return min.toString()
                        case 'maximum':
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
                case 'raw': {
                    const [_meta, _timestamp, _i, a, _s, _tags] = row.datum
                    if (a.length <= desc.index) {
                        return ''
                    }

                    const v = a[desc.index]
                    if (v == undefined)
                        return ''

                    return v.toString()
                }

                // Aggregated, depends on the meta value
                case 'aggregated': {
                    const [_meta, _timestamp, _i, a, _s, _tags] = row.datum
                    if (a.length <= desc.index) {
                        return ''
                    }

                    const v = a[desc.index]
                    if (v == undefined)
                        return ''

                    // Deconstruct the meta values
                    const [difference, starting, ending] = v

                    switch (metaName) {
                        case '':
                            return ending.toString()
                        case 'difference':
                            return difference.toString()
                        case 'starting':
                            return starting.toString()
                        case 'ending':
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
                return ''
            }

            const v = s[desc.index]
            if (v == undefined)
                return ''

            return v.toString()
        }
    }
}

function chunkArray<T>(arr: T[], n: number): T[][] {
    const chunkLength = Math.max(arr.length / n, 1);
    const chunks = [];
    for (let i = 0; i < n; i++) {
        if (chunkLength * (i + 1) <= arr.length)
            chunks.push(arr.slice(chunkLength * i, chunkLength * (i + 1)));
    }
    return chunks;
}

async function listLocationSourceMeasurements(
    id: string, source: string): Promise<Result<void, Error>> {
    const cfg = readConfigFile()
    if (!cfg.sn) {
        return Result.err(
            new Error('You must authenticate against SolarNetwork'))
    }

    if (!cfg.sn.token) {
        return Result.err(new Error('You must provide a token'))
    }

    if (!cfg.sn.secret) {
        return Result.err(new Error('You must provide a secret'))
    }

    const result = await getLocationDatums(
        cfg.sn, true, id, source, undefined, undefined)
    if (!result.isOk) {
        console.error('Failed to fetch location datums')
        return Result.err(result.error)
    }

    const datum = result.value.response.data.results[0]
    let rows =
        []
    const ignore = new Set([
        'created', 'locationId', 'sourceId', 'localDate', 'localTime',
        'tags'
    ])

    for (const k of Object.keys(datum)) {
        if (ignore.has(k)) {
            continue
        }

        rows.push({
            location: id,
            sourceId: source,
            measurement: k,
            'type': typeof datum[k]
        })
    }

    const p = new Table({
        columns: [
            {name: 'location', alignment: 'left'},
            {name: 'sourceId', alignment: 'left'},
            {name: 'measurement', alignment: 'left'},
            {name: 'type', alignment: 'left'},
        ],
        rows: rows
    })

    p.printTable()

    return Result.ok(void (0))
}

async function listLocationSources(id: string):
    Promise<Result<void, Error>> {
    const cfg = readConfigFile()

    if (!cfg.sn) {
        return Result.err(
            new Error('You must authenticate against SolarNetwork'))
    }

    if (!cfg.sn.token) {
        return Result.err(new Error('You must provide a token'))
    }

    if (!cfg.sn.secret) {
        return Result.err(new Error('You must provide a secret'))
    }

    // const result = await getLocationMeta(cfg.sn, true, id, undefined,
    // undefined, undefined)
    const result = await getLocationMeta(cfg.sn, id)
    if (result.isErr) {
        return Result.err(
            new Error(`Failed to get matching source IDS: ${result.error}`))
    }

    let rows = []
    let collected = new Set()
    let cols =
        [
            {
                name: 'location',
                alignment: 'left',
            },
            {
                name: 'sourceId',
                alignment: 'left',
            },
            {
                name: 'tags',
                alignment: 'left',
            }
        ]

    for (const location of result.value) {
        let obj: any = {
            'location': location.locationId,
            'sourceId': location.sourceId,
            'tags': location.t.toString()
        }

        for (const k of Object.keys(location.m)) {
            obj[k] = location.m[k]

            if (!collected.has(k)) {
                collected.add(k)
                cols.push({name: k, alignment: 'left'})
            }
        }

        rows.push(obj)
    }

    const p = new Table({columns: cols, rows: rows})

    p.printTable()

    return Result.ok(void (0))
}

export async function listLocationMeasurements(
    id: string, source: string | undefined): Promise<Result<void, Error>> {
    if (source === undefined) {
        return await listLocationSources(id)
    } else {
        return await listLocationSourceMeasurements(id, source)
    }
}

export async function listSourceMeasurements(path: string):
    Promise<Result<void, Error>> {
    const cfg = readConfigFile()

    if (!cfg.sn) {
        return Result.err(
            new Error('You must authenticate against SolarNetwork'))
    }

    if (!cfg.sn.token) {
        return Result.err(new Error('You must provide a token'))
    }

    if (!cfg.sn.secret) {
        return Result.err(new Error('You must provide a secret'))
    }

    const ids = await getNodeIds(cfg.sn)
    if (ids.isErr) {
        return Result.err(
            new Error(`Failed to get node IDS: ${ids.error.message}`))
    }

    const result =
        await getDatums(cfg.sn, true, path, ids.value, undefined, undefined)
    if (result.isErr) {
        return Result.err(
            new Error(`Failed to get matching source IDS: ${result.error}`))
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
    return Result.ok(void (0))
}

interface SNChunk {
    response: TaggedStreamResponse,
    total: number
}

async function fetchSNDatumsProducer(
    cfg: SNConfig, chan: SimpleChannel<SNChunk>, bar: MultiBar, ids: any,
    sources: string[], format: string, start: string, end: string,
    opts: any) {
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
                const s = range.beginInclusive.format('YYYY-MM-DD')
                const e = range.endExclusive.format('YYYY-MM-DD')

                total += 1

                b.update(total, {sourceId: source})

                const response = await getDatums(
                    cfg, false, source, ids, s, e, opts['aggregation'])
                if (response.isErr) {
                    console.error(`Warning: some datums failed to be fetched: ${
                        response.error.message}`)
                    continue
                }

                chan.send({response: response.value, total: total})
            }
        } catch (e: any) {
            console.error(`Source ${source} failed: ${e}`)
        }
        bar.remove(b)
    }
}

async function fetchSNDatumsConsumer(
    stream: WriteStream, chan: SimpleChannel<SNChunk>, bar: MultiBar,
    total: number, ids: number[], format: string, start: string,
    end: string, opts: any, cfg: SNConfig, source: string) {
    const columns = format.split(',')
    const b = bar.create(total, 0, {}, {
        format: ' {bar} | Total Progress: {value}/{total} | {eta_formatted}',
        forceRedraw: true,
        noTTYOutput: true
    })

    const haveTimestamp = columns.findIndex(col => col === 'timestamp') != -1

    let recalculating = false
    let recalcStart = 0
    let lastTimestampEnd
    let lastNodeID

    for await (const next of chan) {
        const chunk = next.response

        b.increment()

        if (!chunk.response.success) {
            continue
        }

        const d = new DatumStreamMetadataRegistry(chunk.response.meta)

        let rows: RawDatum[] | AggregatedDatum[] = []
        switch (chunk.state) {
            case 'raw': {
                rows = parseRawDatums(chunk.response)
                break
            }
            case 'aggregated': {
                rows = parseAggregatedDatums(chunk.response)
                break
            }
        }


        for (const row of rows) {
            if (!row) {
                continue
            }

            const m = d.metadataAt(row[0]) as StreamMeta
            const columnExists = (name: string):
                boolean => {
                const desc = getMeasurementDescriptor(m, columnName(name))
                return desc != undefined
            }

            const foundColumns = columns.filter(c => {
                if (c == 'timestamp') return true

                return columnExists(c)
            })

            if (foundColumns.length != columns.length) {
                const empty = opts['empty']
                const partial =
                    opts['partial']
                const isEmpty =
                    haveTimestamp ? foundColumns.length == 1 :
                        foundColumns.length == 0
                const isPartial = haveTimestamp ? foundColumns.length > 1 :
                    foundColumns.length > 0

                if (isEmpty && !empty) {
                    continue
                }
                if (isPartial && !partial && !empty) {
                    continue
                }
            }

            if (m['sourceId']) {
                stream.write(m['sourceId'].toString())
            }
            stream.write(',')

            if (m['objectId']) {
                stream.write(m['objectId'].toString())
            }
            stream.write(',')

            let skip_field_value
            /*
            if (opts['sn_recalculate_skip_field']) {
                for (let i = 0; i < columns.length; i++) {
                    const c = columns[i]
                    if (c == opts['sn_recalculate_skip_field']) {
                        switch (chunk.state) {
                            case 'raw': {
                                skip_field_value = skip_field_value = columnValue(
                                    c, {
                                        state: 'raw',
                                        datum: row as RawDatum,
                                    },
                                    m)
                                break
                            }
                            case 'aggregated': {
                                skip_field_value = skip_field_value = columnValue(
                                    c, {
                                        state: 'aggregated',
                                        datum: row as AggregatedDatum,
                                    },
                                    m)
                                break
                            }
                        }
                    }
                }
            }
             */

            for (let i = 0; i < columns.length; i++) {
                const c = columns[i]
                const sep =
                    (i < (columns.length - 1)) ? ',' : ''

                if (c == 'timestamp') {
                    // TODO: ignoring end?

                    switch (chunk.state) {
                        case 'raw': {
                            const tRow = row as RawDatum
                            stream.write(tRow[1].toString())
                            break
                        }
                        case 'aggregated': {
                            const tRow = row as AggregatedDatum
                            const [_meta, timestamp, _i, _a, _status, _tags] = tRow
                            stream.write(timestamp[0].toString())
                        }
                    }

                    stream.write(sep)
                    continue
                }

                let val
                switch (chunk.state) {
                    case 'raw': {
                        val = val = columnValue(
                            c, {
                                state: 'raw',
                                datum: row as RawDatum,
                            },
                            m)
                        break
                    }
                    case 'aggregated': {
                        val = val = columnValue(
                            c, {
                                state: 'aggregated',
                                datum: row as AggregatedDatum,
                            },
                            m)
                        break
                    }
                }

                const tRow = row as AggregatedDatum
                const [_meta, timestamp, _i, _a, _status, _tags] = tRow

                lastTimestampEnd = timestamp[0]
                lastNodeID = m['objectId']

                /*
                if (c == opts['sn_recalculate_field']) {
                    const tRow = row as AggregatedDatum
                    const [_meta, timestamp, _i, _a, _status, _tags] = tRow

                    if (!recalculating &&
                        val.toString() == opts['sn_recalculate_value']) {
                        if (skip_field_value === undefined ||
                            skip_field_value &&
                            skip_field_value != opts['sn_recalculate_skip_value']) {
                            // console.log("Recalculating BEGIN", timestamp)
                            recalculating = true
                            recalcStart = timestamp[0]
                        }
                    } else if (
                        recalculating &&
                        val.toString() != opts['sn_recalculate_value']) {
                        // console.log("Recalculating END", timestamp)
                        recalculating = false
                        await staleAggregation(
                            cfg, recalcStart, timestamp[0], parseInt(m['objectId']),
                            source)
                    }
                }
                 */

                if (val !== undefined) {
                    stream.write(val.toString())
                }

                stream.write(sep)
            }

            stream.write('\n')
        }
    }

    /*
    if (recalculating && lastTimestampEnd !== undefined &&
        lastNodeID !== undefined) {
        console.log('Recalculating END', lastTimestampEnd)
        await staleAggregation(
            cfg, recalcStart, lastTimestampEnd, parseInt(lastNodeID),
            source)
    }
     */

    stream.write('\n')
}

export interface FetchSourceDirect {
    kind: 'direct';
    source: string
}

export interface FetchSourceLocation {
    kind: 'location';
    locationId: string
}

export type FetchSource = FetchSourceDirect | FetchSourceLocation

export async function fetchLocationDatums(
    cfg: SNConfig, stream: WriteStream, locationId: string, format: string,
    start: string, end: string, opts: any):
    Promise<Result<void, Error>> {
    const columns = format.split(',')
    const haveTimestamp =
        columns.findIndex(col => col === 'timestamp') != -1
    const datums = await getLocationDatums(
        cfg, false, locationId, opts['source'], start, end,
        opts['aggregation'])

    if (datums.isOk) {
        let rows: RawLocationDatum[] | AggregatedLocationDatum[] =
            []
        switch (datums.value.state) {
            case 'raw': {
                rows = parseRawLocationDatums(datums.value.response)
                break
            }
            case 'aggregated': {
                rows = parseAggregatedLocationDatums(datums.value.response)
                break
            }
        }

        for (const row of rows) {
            if (!row) {
                continue
            }

            const fixed = new Set([
                'timestamp', 'created', 'locationId', 'sourceId', 'localDate',
                'localTime', 'tags'
            ])

            const columnExists = (name: string):
                boolean => {
                if (fixed.has(name)) {
                    return true;
                }

                // TODO: need better handling in this case
                if (name.includes('$')) {
                    return true;
                }

                if (datums.value.state === 'raw') {
                    const c: RawLocationDatum = row as RawLocationDatum
                    return c[6].has(name)
                } else {
                    const c: AggregatedLocationDatum =
                        row as AggregatedLocationDatum
                    return c[6].has(name)
                }
            }

            const foundColumns = columns.filter(c => {
                if (c == 'timestamp') return true

                return columnExists(c)
            })

            if (foundColumns.length != columns.length) {
                const empty = opts['empty']
                const partial =
                    opts['partial']
                const isEmpty =
                    haveTimestamp ? foundColumns.length == 1 :
                        foundColumns.length == 0
                const isPartial = haveTimestamp ? foundColumns.length > 1 :
                    foundColumns.length > 0

                if (isEmpty && !empty) {
                    continue
                }
                if (isPartial && !partial && !empty) {
                    continue
                }
            }

            for (let i = 0; i < columns.length; i++) {
                const c = columns[i]
                const sep =
                    (i < (columns.length - 1)) ? ',' : ''

                if (c == 'timestamp') {
                    const funkyDate = moment(row[0].toString())
                    stream.write(funkyDate.valueOf().toString())
                    stream.write(sep)
                    continue
                }

                let val
                switch (datums.value.state) {
                    case 'raw': {
                        val = val = columnValueLocation(c, {
                            state: 'raw',
                            datum: row as RawLocationDatum,
                        })
                        break
                    }
                    case 'aggregated': {
                        val = val = columnValueLocation(c, {
                            state: 'aggregated',
                            datum: row as AggregatedLocationDatum,
                        })
                        break
                    }
                }

                if (val !== undefined) {
                    stream.write(val.toString())
                }
                stream.write(sep)
            }

            stream.write('\n')
        }
    }

    return Result.ok(void (0))
}

export async function getDefaultFormat(source: string):
    Promise<Result<string, Error>> {
    const cfg = readConfigFile()

    if (!cfg.sn) {
        return Result.err(
            new Error('You must authenticate against SolarNetwork'))
    }

    if (!cfg.sn.token) {
        return Result.err(new Error('You must provide a token'))
    }

    if (!cfg.sn.secret) {
        return Result.err(new Error('You must provide a secret'))
    }

    const ids = await getNodeIds(cfg.sn)
    if (ids.isErr) {
        return Result.err(
            new Error(`API call to get nodes failed: ${ids.error.message}`))
    }

    const sources = await listSources(cfg.sn, source, ids.value)
    if (sources.isErr) {
        return Result.err(new Error(
            `Failed to fetch list of sources: ${sources.error.message}`))
    }

    const datums = await getDatums(
        cfg.sn, true, sources.value[0], ids.value, undefined, undefined)
    if (datums.isErr) {
        return Result.err(datums.error)
    }

    if (!datums.value.response.meta) {
        return Result.ok('timestamp')
    }

    const d = datums.value.response.meta[0]
    let format = 'timestamp,'
    if (d.i) {
        for (const i of d.i) {
            format += (i.toString() + ',')
        }
    }
    if (d.a) {
        for (const a of d.a) {
            format += (a.toString() + ',')
        }
    }
    if (d.s) {
        for (const s of d.s) {
            format += (s.toString() + ',')
        }
    }

    return Result.ok(format)
}

export async function fetchSNDatums(
    stream: WriteStream, source: FetchSource, format: string, start: string,
    end: string, opts: any):
    Promise<Result<void, Error>> {
    const cfg = readConfigFile()

    if (!cfg.sn) {
        return Result.err(
            new Error('You must authenticate against SolarNetwork'))
    }

    if (!cfg.sn.token) {
        return Result.err(new Error('You must provide a token'))
    }

    if (!cfg.sn.secret) {
        return Result.err(new Error('You must provide a secret'))
    }

    const ids = await getNodeIds(cfg.sn)
    if (ids.isErr) {
        return Result.err(
            new Error(`API call to get nodes failed: ${ids.error.message}`))
    }

    if (source.kind == 'location') {
        return await fetchLocationDatums(
            cfg.sn, stream, source.locationId, format, start, end, opts)
    }

    const sources = await listSources(cfg.sn, source.source, ids.value)
    if (sources.isErr) {
        return Result.err(new Error(
            `Failed to fetch list of sources: ${sources.error.message}`))
    }

    const coefficient = getDateRanges(moment(start), moment(end)).length

    const bar = new cliProgress.MultiBar(
        {
            etaBuffer: 64,
            clearOnComplete: true,
            hideCursor: true,
            format: ' {bar} | {filename} | {value}/{total}',
            forceRedraw: true,
        },
        cliProgress.Presets.rect)

    try {
        stream.write(`sourceId,objectId,${format}\n`)

        const parallel: number = parseInt(opts['parallel'])

        const chan = new SimpleChannel<SNChunk>();
        const groups = chunkArray(sources.value, parallel)
        const p1 = fetchSNDatumsConsumer(
            stream, chan, bar, sources.value.length * coefficient,
            ids.value, format, start, end, opts, cfg.sn, source.source)
        const sncfg = cfg.sn
        const p2 = Array.from(Array(parallel).keys())
            .map(
                async i => fetchSNDatumsProducer(
                    sncfg, chan, bar, ids.value, groups[i],
                    format, start, end, opts))

        await Promise.all(p2)
        chan.close()

        await p1
    } catch (e) {
        console.error(e)
    }

    bar.stop()
    return Result.ok(void (0))
}

async function fetchExportList(t: string):
    Promise<Result<void, Error>> {
    const cfg = readConfigFile()

    if (!cfg.sn) {
        return Result.err(
            new Error('You must authenticate against SolarNetwork'))
    }

    if (!cfg.sn.token) {
        return Result.err(new Error('You must provide a token'))
    }

    if (!cfg.sn.secret) {
        return Result.err(new Error('You must provide a secret'))
    }

    const result = await listExportType(t, cfg.sn)
    if (result.isErr) {
        return Result.err(new Error(
            `Failed to fetch export types: ${result.error.message}`))
    }

    for (const r of result.value) {
        console.log(`id: ${r.id}`)
        console.log(`locale: ${r.locale}`)
        console.log(`localized name: ${r.localizedName}`)
        console.log(`localized description: ${r.localizedDescription}`)

        const opts = r.localizedInfoMessages

        if (typeof opts === 'object' && !Array.isArray(opts) &&
            opts !== null) {
            for (const [key, value] of Object.entries(opts)) {
                console.log(` - Property '${key}': ${value}`)
            }
        }
    }

    return Result.ok(void (0))
}

export async function fetchCompressionTypes():
    Promise<Result<void, Error>> {
    return await fetchExportList('compression')
}

export async function fetchDestinationTypes():
    Promise<Result<void, Error>> {
    return await fetchExportList('destination')
}

export async function fetchOutputTypes():
    Promise<Result<void, Error>> {
    return await fetchExportList('output')
}

export async function fetchExportTasks():
    Promise<Result<void, Error>> {
    const cfg = readConfigFile()

    if (!cfg.sn) {
        return Result.err(
            new Error('You must authenticate against SolarNetwork'))
    }

    if (!cfg.sn.token) {
        return Result.err(new Error('You must provide a token'))
    }

    if (!cfg.sn.secret) {
        return Result.err(new Error('You must provide a secret'))
    }

    const tasks = await listExportTasks(cfg.sn)
    if (tasks.isErr) {
        return Result.err(
            new Error(`Failed to get export tasks: ${tasks.error.message}`))
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

    return Result.ok(void (0))
}

function splitOnce(str: string, element: string):
    string[] {
    let arr = str.split(element)
    // Combine [1,both.length) into a single string
    arr[1] = arr.reduce((prev, curr, i, arr) => {
        if (i >= 1) {
            return (i == 1) ? prev + arr[i] : (prev + (':' + arr[i]))
        }
        return ''
    }, arr[1])
    return arr.slice(0, 2)
}

export async function startExportTask(
    opts: any): Promise<Result<void, Error>> {
    const cfg = readConfigFile()

    if (!cfg.sn) {
        return Result.err(
            new Error('You must authenticate against SolarNetwork'))
    }

    if (!cfg.sn.token) {
        return Result.err(new Error('You must provide a token'))
    }

    if (!cfg.sn.secret) {
        return Result.err(new Error('You must provide a secret'))
    }

    const ids = await getNodeIds(cfg.sn)
    if (ids.isErr) {
        return Result.err(
            new Error(`API call to get nodes failed: ${ids.error.message}`))
    }

    if (opts['start'] === undefined || opts['end'] === undefined) {
        return Result.err(new Error('Start and end options must be provided'))
    }

    if (opts['source'] === undefined) {
        return Result.err(new Error('Source expression must be provided'))
    }

    if (opts['output'] === undefined) {
        return Result.err(new Error('Output identifier must be provided'))
    }

    if (opts['destination'] === undefined) {
        return Result.err(new Error('Destination identifier must be provided'))
    }

    const start = moment(opts['start'])
    const end = moment(opts['end'])
    const name = randomWords({exactly: 4, join: '-'})

    const compressionTypes = await listExportType('compression', cfg.sn)
    if (compressionTypes.isErr) {
        return Result.err(new Error(`Failed to fetch compression types: ${
            compressionTypes.error.message}`))
    }

    const outputTypes = await listExportType('output', cfg.sn)
    if (outputTypes.isErr) {
        return Result.err(new Error(
            `Failed to fetch output types: ${outputTypes.error.message}`))
    }

    const destinationTypes = await listExportType('destination', cfg.sn)
    if (destinationTypes.isErr) {
        return Result.err(new Error(`Failed to fetch destination types: ${
            destinationTypes.error.message}`))
    }

    // Get the right type
    let compressionType: ExportTypeInfo | undefined =
        compressionTypes.value.find(
            (t: ExportTypeInfo) => {
                return t.id === opts['compression'] ||
                    t.localizedName === opts['compression']
            })
    let outputType: ExportTypeInfo | undefined = outputTypes.value.find(
        (t: ExportTypeInfo) => {
            return t.id === opts['output'] ||
                t.localizedName === opts['output']
        })
    let destinationType: ExportTypeInfo | undefined =
        destinationTypes.value.find(
            (t: ExportTypeInfo) => {
                return t.id === opts['destination'] ||
                    t.localizedName === opts['destination']
            })

    if (compressionType == undefined) {
        return Result.err(
            new Error(`Unknown compression type ${opts['compression']}`))
    }
    if (outputType == undefined) {
        return Result.err(new Error(`Unknown output type ${opts['output']}`))
    }
    if (destinationType == undefined) {
        return Result.err(
            new Error(`Unknown destination type ${opts['destination']}`))
    }

    const outputProps = opts['outputProp'].map((p: string) => {
        const both = splitOnce(p, ':')
        const value = (outputType as ExportTypeInfo)
            .settingSpecifiers.find(
                (s: ExportSettingsSpecifier) => s.key === both[0])
        return [both, value]
    })
    const destinationProps = opts['destinationProp'].map((p: string) => {
        const both = splitOnce(p, ':')
        const value = (destinationType as ExportTypeInfo)
            .settingSpecifiers.find(
                (s: ExportSettingsSpecifier) => s.key === both[0])
        return [both, value]
    })

    // Verify options
    for (const prop of outputProps) {
        if (prop[1] === undefined) {
            return Result.err(
                new Error(`Output property not found: ${prop[0]}`))
        }
    }
    for (const prop of destinationProps) {
        if (prop[1] === undefined) {
            return Result.err(
                new Error(`Destination property not found: ${prop[0]}`))
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

    let outputServiceProperties:
        Record<string, any> = {}
    for (const prop of outputProps) {
        let [[k, v], t] = prop

        if (t['type'] ===
            'net.solarnetwork.settings.ToggleSettingSpecifier') {
            outputServiceProperties[k] = (v === 'true')
        } else {
            outputServiceProperties[k] = <any>v
        }
    }

    let destinationServiceProperties:
        Record<string, any> = {}
    for (const prop of destinationProps) {
        let [[k, v], t] = prop

        if (t['type'] ===
            'net.solarnetwork.settings.ToggleSettingSpecifier') {
            destinationServiceProperties[k] = (v === 'true')
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
            return Result.err(
                new Error(`Failed to get export tasks: ${tasks.error.message}`))
        }

        const task =
            tasks.value.find((t: any) => t['config']['name'] === name)

        if (task == undefined) {
            return Result.err(
                new Error(`Warning: Lost track of task '${name}', aborting.`))
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

    return Result.ok(void (0))
}
