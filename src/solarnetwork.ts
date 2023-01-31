import {URL, URLSearchParams} from "url";
import axios from "axios";
import {AuthorizationV2Builder, DatumStreamMetadataRegistry} from "solarnetwork-api-core";
import {readConfigFile, SNConfig} from "./config.js";
import cliProgress, {MultiBar} from "cli-progress"
import {SimpleChannel} from "channel-ts";
import {getDateRanges} from "./util.js";
import moment from "moment";
import {Table} from "console-table-printer";

function encodeSolarNetworkUrl(url: any) {
    return url.toString().replace(/\+/g, "%20") // SolarNetwork doesn't support + for space character encoding
}

async function getNodeIds(cfg: SNConfig, auth: any, secret: string) {
    const url = `${cfg.url}/solarquery/api/v1/sec/nodes`
    const authHeader = auth.snDate(true).url(url).build(secret)

    const response = await axios.get(url, {
        headers: {
            Authorization: authHeader,
            "X-SN-Date": auth.requestDateHeaderValue,
            "Accept-Encoding": "UTF8"
        }
    })

    return response.data.data
}

async function getDatums(cfg: SNConfig, mostRecent: boolean, source: string, auth: any, secret: string, ids: any, start?: string, end?: string, aggregation?: string) {

    let raw: any = {
        nodeIds: ids,
        sourceId: source,
        mostRecent: mostRecent
    }

    if (end)
        raw.endDate = end

    if (start)
        raw.startDate = start

    if (aggregation)
        raw.aggregation = aggregation

    const params = new URLSearchParams(raw)
    const url = `${cfg.url}/solarquery/api/v1/sec/datum/stream/datum`

    const fetchUrl = new URL(url)
    fetchUrl.search = params.toString()
    const urlString = encodeSolarNetworkUrl(fetchUrl)

    const authHeader = auth.snDate(true).url(urlString).build(secret)

    const response = await axios.get(urlString, {
        headers: {
            Authorization: authHeader,
            "X-SN-Date": auth.requestDateHeaderValue,
            "Accept-Encoding": "UTF8"
        }
    })

    return response.data
}

async function listSources(cfg: SNConfig, source: string, auth: any, secret: string, ids: any): Promise<string[]> {
    const result = await getDatums(cfg, true, source, auth, secret, ids, undefined, undefined)
    return result.meta.map((m: any) => m['sourceId'])
}

function columnName(c: string): string {
    const meta = c.indexOf("$")
    return meta == -1 ? c : c.substring(0, meta)
}

function columnExists(m: any, name: string): boolean {
    const columnTypes = ['i', 'a', 's']

    for (const t of columnTypes) {
        const indx = m[t].findIndex((v: any) => v == name)
        if (indx) {
            return true
        }
    }

    return false
}

function columnValue(aggregated: boolean, c: string, row: any, m: any): string {
    const meta = c.indexOf("$")
    const name = columnName(c)

    const columnTypes = ['i', 'a', 's']

    let columnType
    let columnOffset = 0
    let indx

    for (const t of columnTypes) {
        columnType = t
        indx = m[t] ? m[t].findIndex((v: any) => v == name) : -1

        if (indx >= 0) {
            break
        }

        columnOffset += m[t] ? m[t].length : 0
    }

    const arrayType = aggregated && (columnType == 'i' || columnType == 'a')

    if (row[2 + columnOffset + indx] === undefined) {
        return ""
    }

    if (meta != -1) {
        const metaValue = c.substring(meta + 1)

        if (!arrayType && metaValue != "count") {
            return row[2 + columnOffset + indx]
        } else if (!arrayType && metaValue == "count") {
            return "1"
        }

        if (columnType == 'i') {
            if (metaValue == "average") {
                return row[2 + columnOffset + indx][0]
            } else if (metaValue == "count") {
                return row[2 + columnOffset + indx][1]
            } else if (metaValue == "minimum") {
                return row[2 + columnOffset + indx][2]
            } else if (metaValue == "maximum") {
                return row[2 + columnOffset + indx][3]
            } else {
                throw new Error("unknown meta description")
            }
        } else if (columnType == 'a') {
            if (metaValue == "difference") {
                return row[2 + columnOffset + indx][0]
            } else if (metaValue == "starting") {
                return row[2 + columnOffset + indx][1]
            } else if (metaValue == "ending") {
                return row[2 + columnOffset + indx][2]
            } else {
                throw new Error("unknown meta description")
            }
        } else {
            throw new Error("unreachable")
        }
    } else {
        // return average for 'i', difference for 'a'
        return arrayType ? row[2 + columnOffset + indx][0] : row[2 + columnOffset + indx]
    }
}

function chunkArray<T>(arr: T[], n: number): T[][] {
    var chunkLength = Math.max(arr.length / n, 1);
    var chunks = [];
    for (var i = 0; i < n; i++) {
        if (chunkLength * (i + 1) <= arr.length) chunks.push(arr.slice(chunkLength * i, chunkLength * (i + 1)));
    }
    return chunks;
}

export async function listAllSources() {
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

    const auth = new AuthorizationV2Builder(cfg.sn.token)
    const secret: string = cfg.sn.secret
    const ids = await getNodeIds(cfg.sn, auth, cfg.sn.secret)

    const b1 = new cliProgress.SingleBar({
        format: 'Downloading node meta data | {bar} | nodeId={nodeId} | {value}/{total}',
        hideCursor: true,
        clearOnComplete: true
    });

    b1.start(ids.length, 0, {
        nodeId: ids[0]
    })

    let rows = []
    for (const id of ids) {
        const meta = await getNodeMetadata(id, cfg.sn, auth, secret)

        b1.update({
            nodeId: id
        })

        if (Array.isArray(meta['results'])) {
            for (const result of meta['results']) {
                rows.push({
                    'nodeId': result['nodeId'],
                    'sourceId': result['sourceId']
                })
            }
        }

        b1.increment();
    }

    b1.stop()

    const p = new Table({
        columns: [
            {
                name: 'nodeId',
                alignment: 'left',
            },
            {
                name: 'sourceId',
                alignment: 'left',
            },
        ],
        rows: rows
    })

    p.printTable()
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

    const auth = new AuthorizationV2Builder(cfg.sn.token)
    const secret: string = cfg.sn.secret
    const ids = await getNodeIds(cfg.sn, auth, cfg.sn.secret)

    const result = await getDatums(cfg.sn, true, path, auth, secret, ids, undefined, undefined)

    let rows = []
    for (const source of result.meta) {
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
    datums: any,
    total: number
}

async function fetchSNDatumsProducer(cfg: SNConfig, chan: SimpleChannel<SNChunk>, bar: MultiBar, auth: any, secret: string, ids: any, sources: string[], format: string, start: string, end: string, opts: any) {
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

                const datums = await getDatums(cfg, false, source, auth, secret, ids, s, e, opts['aggregation'])

                chan.send({
                    datums: datums,
                    total: total
                })
            }
        } catch (e: any) {
            console.error(e)
            console.log("ERROR: " + e.config.url)
        }
        bar.remove(b)
    }
}

async function fetchSNDatumsConsumer(chan: SimpleChannel<SNChunk>, bar: MultiBar, total: number, auth: any, secret: string, ids: any, format: string, start: string, end: string, opts: any) {

    const columns = format.split(",")
    const b = bar.create(total, 0, {}, {
        format: ' {bar} | Total Progress: {value}/{total} | {eta_formatted}',
    })

    for await(const next of chan) {
        const datums = next.datums

        b.increment()

        if (!datums.data || !datums.meta) {
            continue
        }

        const d = new DatumStreamMetadataRegistry(datums.meta)

        for (const row of datums.data) {
            if (!row) {
                continue
            }

            const m = d.metadataAt(row[0])

            const foundColumns = columns.filter(c => {
                if (c == "timestamp")
                    return true

                return columnExists(m, columnName(c))
            })

            if (foundColumns.length != columns.length) {
                const empty = opts['empty']
                const partial = opts['partial']
                const isEmpty = foundColumns.length == 1
                const isPartial = foundColumns.length > 1

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
                    if (opts['aggregations'] != undefined) {
                        if (row[1][0]) {
                            process.stdout.write(row[1][0].toString())
                        }
                    } else {
                        if (row[1]) {
                            process.stdout.write(row[1].toString())
                        }
                    }
                    continue
                }

                const val = columnValue(opts['aggregation'] != undefined, c, row, m)

                if (val !== undefined) {
                    process.stdout.write(val.toString())
                }
                process.stdout.write(sep)
            }

            process.stdout.write("\n")
        }
    }

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

    const auth = new AuthorizationV2Builder(cfg.sn.token)

    const ids = await getNodeIds(cfg.sn, auth, cfg.sn.secret)
    const sources = await listSources(cfg.sn, source, auth, cfg.sn.secret, ids)
    const coefficient = getDateRanges(moment(start), moment(end)).length

    const bar = new cliProgress.MultiBar({
        etaBuffer: 64,
        clearOnComplete: true,
        hideCursor: true,
        format: ' {bar} | {filename} | {value}/{total}',
        forceRedraw: true,
    }, cliProgress.Presets.rect)

    console.log("sourceId,objectId," + format)

    const secret: string = cfg.sn.secret
    const parallel: number = parseInt(opts['parallel'])

    const chan = new SimpleChannel<SNChunk>();
    const groups = chunkArray(sources, parallel)
    const p1 = fetchSNDatumsConsumer(chan, bar, sources.length * coefficient, auth, secret, ids, format, start, end, opts)
    const sncfg = cfg.sn
    const p2 = Array.from(Array(parallel).keys()).map(async i => fetchSNDatumsProducer(sncfg, chan, bar, auth, secret, ids, groups[i], format, start, end, opts))

    await Promise.all(p2)
    chan.close()
    await p1

    bar.stop()
}
