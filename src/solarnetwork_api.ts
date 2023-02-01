import {SNConfig} from "./config";
import axios from "axios";
import {URL, URLSearchParams} from "url";

interface NodesResponse {
    success: boolean
    data: number[]
}

export async function getNodeIds(cfg: SNConfig, auth: any, secret: string): Promise<number[]> {
    const url = `${cfg.url}/solarquery/api/v1/sec/nodes`
    const authHeader = auth.snDate(true).url(url).build(secret)

    const response = await axios.get<NodesResponse>(url, {
        headers: {
            Authorization: authHeader,
            "X-SN-Date": auth.requestDateHeaderValue,
            "Accept-Encoding": "UTF8"
        }
    })

    if (!response.data.success) {
        throw new Error("SolarNetwork API call failed: /solarquery/api/v1/sec/nodes")
    }

    return response.data.data
}

function encodeSolarNetworkUrl(url: any) {
    return url.toString().replace(/\+/g, "%20") // SolarNetwork doesn't support + for space character encoding
}

export interface StreamMeta {
    streamId: string
    zone: string
    kind: string
    objectId: string
    sourceId: string
    i?: string[]
    a?: string[]
    s?: string[]
}

export enum MeasurementType {
    Instantaneous = 'i',
    Accumulating = 'a',
    Status = 's'
}

export interface MeasurementDescriptor {
    type: MeasurementType
    index: number
}

export interface RawInstantaneousMeasurement {
    status: "raw"
    value: number
}

export interface AggregatedInstantaneousMeasurement {
    status: "aggregated"
    average: number
    count: number
    minimum: number
    maximum: number
}

export interface RawAccumulatingMeasurement {
    status: "raw"
    value: number
}

export interface AggregatedAccumulatingMeasurement {
    status: "aggregated"
    difference: number
    starting: number
    ending: number
}

export interface RawStatusMeasurement {
    status: "raw"
    value: string
}

export interface AggregatedStatusMeasurement {
    status: "aggregated"
    value: string
}

export type RawMeasurement = RawInstantaneousMeasurement | RawAccumulatingMeasurement | RawStatusMeasurement
export type AggregatedMeasurement =
    AggregatedInstantaneousMeasurement
    | AggregatedAccumulatingMeasurement
    | AggregatedStatusMeasurement

export type RawDatum = [
    meta: number,
    timestamp: number,
    i: (number | undefined)[],
    a: (number | undefined) [],
    s: (string | undefined) [],
    tags: string[],
]
export type AggregatedDatum = [
    meta: number,
    timestamp: [start: number, end?: number],
    i: ([average: number, count: number, minimum: number, maximum: number] | undefined) [],
    a: ([difference: number, starting: number, ending: number] | undefined) [],
    status: (string | undefined) [],
    tags: string[],
]

export interface StreamResponse {
    success: boolean
    meta: StreamMeta[]
    data: any[]
}

export interface TaggedRawResponse {
    state: "raw",
    response: StreamResponse
}

export interface TaggedAggregatedResponse {
    state: "aggregated",
    response: StreamResponse
}

export type TaggedStreamResponse = TaggedRawResponse | TaggedAggregatedResponse

export interface TaggedRawDatum {
    state: "raw"
    datum: RawDatum
}

export interface TaggedAggregatedDatum {
    state: "aggregated"
    datum: AggregatedDatum
}

export type TaggedDatum = TaggedRawDatum | TaggedAggregatedDatum

export function parseRawDatums(response: StreamResponse): RawDatum[] {

    return response.data.map(datum => {
        const meta: number = datum[0]
        const timestamp: number = datum[1]
        const m = response.meta[meta]

        const i_len = m.i ? m.i.length : 0
        const a_len = m.a ? m.a.length : 0
        const s_len = m.s ? m.s.length : 0

        let i: number[] = []
        let a: number[] = []
        let s: string[] = []
        let tags: string[] = []

        if (i_len > 0) {
            for (let j = 0; j < i_len; j++) {
                i.push(datum[2 + j])
            }
        }

        if (a_len > 0) {
            for (let j = 0; j < a_len; j++) {
                a.push(datum[2 + i_len + j])
            }
        }

        if (s_len > 0) {
            for (let j = 0; j < s_len; j++) {
                s.push(datum[2 + i_len + a_len + j])
            }
        }

        //if (2 + i_len + a_len + s_len < datum.length) {
        //    for (let j = 0; j < response.meta[meta].s.length; j++) {
        //        s.push(datum[2 + i_len + a_len + j])
        //    }
        //}

        return [meta, timestamp, i, a, s, tags]
    })


}

export function parseAggregatedDatums(response: StreamResponse): AggregatedDatum[] {

    return response.data.map(datum => {
        const meta: number = datum[0]
        const timestamp: [start: number, end: number] = datum[1]
        const m = response.meta[meta]

        const i_len = m.i ? m.i.length : 0
        const a_len = m.a ? m.a.length : 0
        const s_len = m.s ? m.s.length : 0

        let i: [number, number, number, number][] = []
        let a: [number, number, number][] = []
        let s: string[] = []
        let tags: string[] = []

        if (i_len > 0) {
            for (let j = 0; j < i_len; j++) {
                i.push(datum[2 + j])
            }
        }

        if (a_len > 0) {
            for (let j = 0; j < a_len; j++) {
                a.push(datum[2 + i_len + j])
            }
        }

        if (s_len > 0) {
            for (let j = 0; j < s_len; j++) {
                s.push(datum[2 + i_len + a_len + j])
            }
        }

        //if (2 + i_len + a_len + s_len < datum.length) {
        //    for (let j = 0; j < response.meta[meta].s.length; j++) {
        //        s.push(datum[2 + i_len + a_len + j])
        //    }
        //}

        return [meta, timestamp, i, a, s, tags]
    })


}

export function getMeasurementDescriptor(meta: StreamMeta, measurement: string): MeasurementDescriptor | undefined {
    let search

    if (meta.i) {
        search = meta.i.findIndex(v => v == measurement)
        if (search != -1) {
            return {
                type: MeasurementType.Instantaneous,
                index: search
            }
        }
    }

    if (meta.a) {
        search = meta.a.findIndex(v => v == measurement)
        if (search != -1) {
            return {
                type: MeasurementType.Accumulating,
                index: search
            }
        }
    }

    if (meta.s) {
        search = meta.s.findIndex(v => v == measurement)
        if (search != -1) {
            return {
                type: MeasurementType.Status,
                index: search
            }
        }
    }

    return undefined
}

export async function getDatums(cfg: SNConfig,
                                mostRecent: boolean,
                                source: string,
                                auth: any,
                                secret: string,
                                ids: any,
                                start?: string,
                                end?: string,
                                aggregation?: string): Promise<TaggedStreamResponse> {

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

    let response: TaggedStreamResponse

    if (aggregation) {

        const rawResponse = (await axios.get<StreamResponse>(urlString, {
            headers: {
                Authorization: authHeader,
                "X-SN-Date": auth.requestDateHeaderValue,
                "Accept-Encoding": "UTF8"
            }
        })).data

        response = {
            state: "aggregated",
            response: rawResponse
        }
    } else {
        const rawResponse = (await axios.get<StreamResponse>(urlString, {
            headers: {
                Authorization: authHeader,
                "X-SN-Date": auth.requestDateHeaderValue,
                "Accept-Encoding": "UTF8"
            }
        })).data

        response = {
            state: "raw",
            response: rawResponse
        }
    }

    if (!response.response.success) {
        throw new Error("SolarNetwork API call failed: /solarquery/api/v1/sec/datum/stream/datum")
    }

    return response
}


export async function listSources(cfg: SNConfig, source: string, auth: any, secret: string, ids: any): Promise<string[]> {
    const result = await getDatums(cfg, true, source, auth, secret, ids, undefined, undefined)
    return result.response.meta.map((m: any) => m['sourceId'])
}
