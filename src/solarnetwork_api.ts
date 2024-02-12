import axios from 'axios';
import moment from 'moment';
import {AuthorizationV2Builder, HttpHeaders} from 'solarnetwork-api-core';
import {Result} from 'true-myth'
import {URL, URLSearchParams} from 'url';

import {SNConfig} from './config';

interface NodesResponse {
    success: boolean
    data: number[]
}

export async function getNodeIds(cfg: SNConfig):
    Promise<Result<number[], Error>> {
    const url = `${cfg.url}/solarquery/api/v1/sec/nodes`
    const auth = new AuthorizationV2Builder(cfg.token).saveSigningKey(cfg.secret)
    const authHeader = auth.reset().snDate(true).url(url).buildWithSavedKey()

    try {
        const response = await axios.get<NodesResponse>(url, {
            headers: {
                Authorization: authHeader,
                'X-SN-Date': auth.requestDateHeaderValue,
                'Accept-Encoding': 'UTF8'
            }
        })

        if (!response.data.success) {
            return Result.err(new Error(
                'SolarNetwork API call failed: /solarquery/api/v1/sec/nodes'))
        }

        return Result.ok(response.data.data)
    } catch (e) {
        return Result.err(new Error((e as Error).message))
    }
}

function encodeSolarNetworkUrl(url: any) {
    return url.toString().replace(
        /\+/g,
        '%20')  // SolarNetwork doesn't support + for space character encoding
}

export interface ExportSettingsSpecifier {
    key: string
    defaultValue: any
    type: string
    // ignored
}

// https://github.com/SolarNetwork/solarnetwork/wiki/SolarUser-Datum-Export-API#list-compression-types-response
export interface ExportTypeInfo {
    id: string
    settingSpecifiers: ExportSettingsSpecifier[]
    locale: string
    localizedName: string
    localizedDescription: string
    localizedInfoMessages: any
}

export interface ExportResponse<T> {
    success: boolean
    data: T
}

export async function listExportType(
    t: string, cfg: SNConfig): Promise<Result<ExportTypeInfo[], Error>> {
    const url = `${cfg.url}/solaruser/api/v1/sec/user/export/services/${t}`
    const auth = new AuthorizationV2Builder(cfg.token).saveSigningKey(cfg.secret)
    const authHeader = auth.snDate(true).url(url).build(cfg.secret)

    try {
        const response = await axios.get<ExportResponse<ExportTypeInfo[]>>(url, {
            headers: {
                Authorization: authHeader,
                'X-SN-Date': auth.requestDateHeaderValue,
                'Accept-Encoding': 'UTF8'
            }
        })

        if (!response.data.success) {
            return Result.err(new Error(`SolarNetwork API call failed: ${url}`))
        }

        return Result.ok(response.data.data)
    } catch (e) {
        return Result.err(new Error((e as Error).message))
    }
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
    status: 'raw'
    value: number
}

export interface AggregatedInstantaneousMeasurement {
    status: 'aggregated'
    average: number
    count: number
    minimum: number
    maximum: number
}

export interface RawAccumulatingMeasurement {
    status: 'raw'
    value: number
}

export interface AggregatedAccumulatingMeasurement {
    status: 'aggregated'
    difference: number
    starting: number
    ending: number
}

export interface RawStatusMeasurement {
    status: 'raw'
    value: string
}

export interface AggregatedStatusMeasurement {
    status: 'aggregated'
    value: string
}

export type RawMeasurement =
    RawInstantaneousMeasurement | RawAccumulatingMeasurement | RawStatusMeasurement
export type AggregatedMeasurement = AggregatedInstantaneousMeasurement |
    AggregatedAccumulatingMeasurement | AggregatedStatusMeasurement

export type RawDatum =
    [
        meta: number,
        timestamp: number,
        i: (number | undefined)[],
        a: (number | undefined)[],
        s: (string | undefined)[],
        tags: string[],
    ]
export type AggregatedDatum =
    [
        meta: number,
        timestamp: [start: number, end?: number],
        i: ([
            average: number, count: number, minimum: number, maximum: number
        ] | undefined)[],
        a: ([difference: number, starting: number, ending: number] |
            undefined)[],
        status: (string | undefined)[],
        tags: string[],
    ]
export type RawLocationDatum =
    [
        created: string, locationId: number, sourceId: string,
        localDate: string, localTime: string, tags: string[],
        samples: Map<string, string | number>
    ]

export interface TaggedRawLocSample {
    type: 'raw'
    value: string | number
}

export interface TaggedAggregatedLocSample {
    type: 'aggregated'
    average: number
    min: number
    max: number
}

export type AggregatedLocationDatum =
    [
        created: string, locationId: number, sourceId: string, localDate: string,
        localTime: string, tags: string[],
        samples: Map<string, TaggedAggregatedLocSample | TaggedRawLocSample>
    ]

export interface StreamResponse {
    success: boolean
    meta: StreamMeta[]
    data: any[]
}

export interface LocationData {
    totalResults: number,
    startingOffset: number,
    returnedResultCount: number,
    results: any[]
}

export interface LocationResponse {
    success: boolean
    data: LocationData,
}

export interface TaggedRawLocationResponse {
    state: 'raw',
    response: LocationResponse
}

export interface TaggedAggregatedLocationResponse {
    state: 'aggregated',
    response: LocationResponse
}

export interface TaggedRawResponse {
    state: 'raw',
    response: StreamResponse
}

export interface TaggedAggregatedResponse {
    state: 'aggregated',
    response: StreamResponse
}

export type TaggedStreamResponse = TaggedRawResponse | TaggedAggregatedResponse
export type TaggedLocationResponse =
    TaggedRawLocationResponse | TaggedAggregatedLocationResponse

export interface TaggedRawDatum {
    state: 'raw'
    datum: RawDatum
}

export interface TaggedAggregatedDatum {
    state: 'aggregated'
    datum: AggregatedDatum
}

export interface TaggedRawLocationDatum {
    state: 'raw'
    datum: RawLocationDatum
}

export interface TaggedAggregatedLocationDatum {
    state: 'aggregated'
    datum: AggregatedLocationDatum
}

export type TaggedDatum = TaggedRawDatum | TaggedAggregatedDatum
export type TaggedLocationDatum =
    TaggedRawLocationDatum | TaggedAggregatedLocationDatum

// We need to sanitize the datum values given from the SolarNetwork API because
// they are very rarely not the correct types. This causes issues later on, so
// we make sure undefined or null values are converted to their typed
// counterparts -- NaN for numbers and "" for strings
function ensureNumberType(value: any):
    number {
    return (typeof value === 'number') ? value : NaN
}

function ensureStringType(value: any):
    string {
    return (typeof value === 'string') ? value : ''
}

export function parseRawLocationDatums(response: LocationResponse):
    RawLocationDatum[] {
    return response.data.results.map(datum => {
        const samples: Map<string, string | number> = new Map()
        const ignore = new Set([
            'created', 'locationId', 'sourceId', 'localDate', 'localTime', 'tags'
        ])

        for (const key in datum) {
            if (ignore.has(key)) {
                continue;
            }

            samples.set(key, datum[key])
        }

        return [
            datum['created'], datum['locationId'] as number, datum['sourceId'],
            datum['localDate'], datum['localTime'],
            datum['tags'] ? datum['tags'] : [], samples
        ]
    })
}

export function parseAggregatedLocationDatums(response: LocationResponse):
    AggregatedLocationDatum[] {
    return response.data.results.map(datum => {
        const samples:
            Map<string, (TaggedAggregatedLocSample) | TaggedRawLocSample> =
            new Map()
        const ignore = new Set([
            'created', 'locationId', 'sourceId', 'localDate', 'localTime', 'tags'
        ])

        for (const key in datum) {
            if (ignore.has(key)) {
                continue;
            }

            if (key.includes('_')) {
                continue
            }

            const base = key
            const average = datum[key]
            const min =
                datum[base + '_min']
            const max = datum[base + '_max']

            if (min === undefined || max === undefined) {
                samples.set(key, {type: 'raw', value: average})
            } else {
                samples.set(
                    key, {type: 'aggregated', average: average, min: min, max: max})
            }
        }

        return [
            datum['created'], datum['locationId'] as number, datum['sourceId'],
            datum['localDate'], datum['localTime'],
            datum['tags'] ? datum['tags'] : [], samples
        ]
    })
}

export function parseRawDatums(response: StreamResponse):
    RawDatum[] {
    return response.data.map(datum => {
        const meta: number = datum[0]
        const timestamp: number =
            datum[1]
        const m = response.meta[meta]

        const i_len = m.i ? m.i.length : 0
        const a_len = m.a ? m.a.length : 0
        const s_len = m.s ? m.s.length : 0

        let i: number[] = []
        let a: number[] = []
        let s: string[] =
            []
        let tags: string[] = []

        if (i_len > 0) {
            for (let j = 0; j < i_len; j++) {
                i.push(ensureNumberType(datum[2 + j]))
            }
        }

        if (a_len > 0) {
            for (let j = 0; j < a_len; j++) {
                a.push(ensureNumberType(datum[2 + i_len + j]))
            }
        }

        if (s_len > 0) {
            for (let j = 0; j < s_len; j++) {
                s.push(ensureStringType(datum[2 + i_len + a_len + j]))
            }
        }

        return [meta, timestamp, i, a, s, tags]
    })
}

export function parseAggregatedDatums(response: StreamResponse):
    AggregatedDatum[] {
    return response.data.map(datum => {
        const meta: number =
            datum[0]
        const timestamp: [start: number, end: number] =
            datum[1]
        const m = response.meta[meta]

        const i_len = m.i ? m.i.length : 0
        const a_len = m.a ? m.a.length : 0
        const s_len = m.s ? m.s.length : 0

        let i: [number, number, number, number][] =
            []
        let a: [number, number, number][] = []
        let s: string[] =
            []
        let tags: string[] = []

        if (i_len > 0) {
            for (let j = 0; j < i_len; j++) {
                if (!Array.isArray(datum[2 + j])) {
                    i.push([NaN, NaN, NaN, NaN])
                } else {
                    i.push(datum[2 + j].map((v: any) => ensureNumberType(v)))
                }
            }
        }

        if (a_len > 0) {
            for (let j = 0; j < a_len; j++) {
                if (!Array.isArray(datum[2 + i_len + j])) {
                    a.push([NaN, NaN, NaN])
                } else {
                    a.push(datum[2 + i_len + j].map((v: any) => ensureNumberType(v)))
                }
            }
        }

        if (s_len > 0) {
            for (let j = 0; j < s_len; j++) {
                s.push(ensureStringType(datum[2 + i_len + a_len + j]))
            }
        }

        return [meta, timestamp, i, a, s, tags]
    })
}

export function getMeasurementDescriptor(meta: StreamMeta, measurement: string):
    MeasurementDescriptor | undefined {
    let search

    if (meta.i) {
        search = meta.i.findIndex(v => v == measurement)
        if (search != -1) {
            return {
                type: MeasurementType.Instantaneous, index: search
            }
        }
    }

    if (meta.a) {
        search = meta.a.findIndex(v => v == measurement)
        if (search != -1) {
            return {
                type: MeasurementType.Accumulating, index: search
            }
        }
    }

    if (meta.s) {
        search = meta.s.findIndex(v => v == measurement)
        if (search != -1) {
            return {
                type: MeasurementType.Status, index: search
            }
        }
    }

    return undefined
}

export async function getDatums(
    cfg: SNConfig, mostRecent: boolean, source: string, ids: any,
    start?: string, end?: string, aggregation?: string):
    Promise<Result<TaggedStreamResponse, Error>> {
    const auth =
        new AuthorizationV2Builder(cfg.token).saveSigningKey(cfg.secret)

    let raw: any = {nodeIds: ids, sourceId: source, mostRecent: mostRecent}

    if (end)
        raw.endDate = end

    if (start) raw.startDate = start

    if (aggregation) raw.aggregation = aggregation

    const params = new URLSearchParams(raw)
    const url = `${cfg.url}/solarquery/api/v1/sec/datum/stream/datum`

    const fetchUrl = new URL(url)
    fetchUrl.search = params.toString()
    const urlString = encodeSolarNetworkUrl(fetchUrl)

    const authHeader = auth.snDate(true).url(urlString).build(cfg.secret)

    try {
        let response: TaggedStreamResponse

        if (aggregation) {
            const rawResponse = (await axios.get<StreamResponse>(urlString, {
                headers: {
                    Authorization: authHeader,
                    'X-SN-Date': auth.requestDateHeaderValue,
                    'Accept-Encoding': 'UTF8'
                }
            })).data

            response = {state: 'aggregated', response: rawResponse}
        } else {
            const rawResponse = (await axios.get<StreamResponse>(urlString, {
                headers: {
                    Authorization: authHeader,
                    'X-SN-Date': auth.requestDateHeaderValue,
                    'Accept-Encoding': 'UTF8'
                }
            })).data

            response = {state: 'raw', response: rawResponse}
        }

        if (!response.response.success) {
            return Result.err(Error(
                'SolarNetwork API call failed: /solarquery/api/v1/sec/datum/stream/datum'))
        }

        return Result.ok(response)
    } catch (e) {
        return Result.err(new Error((e as Error).message))
    }
}

export async function getLocationDatums(
    cfg: SNConfig, mostRecent: boolean, locationId: string, sourceId: string,
    start?: string, end?: string, aggregation?: string):
    Promise<Result<TaggedLocationResponse, Error>> {
    const auth =
        new AuthorizationV2Builder(cfg.token).saveSigningKey(cfg.secret)

    let raw: any = {
        locationId: locationId,
        sourceIds: 'OpenWeatherMap',
        mostRecent: mostRecent
    }

    if (end)
        raw.endDate = end

    if (start) raw.startDate = start

    if (aggregation) raw.aggregation = aggregation

    const params = new URLSearchParams(raw)
    const url = `${cfg.url}/solarquery/api/v1/sec/location/datum/list`

    const fetchUrl = new URL(url)
    fetchUrl.search = params.toString()
    const urlString = encodeSolarNetworkUrl(fetchUrl)

    const authHeader = auth.snDate(true).url(urlString).build(cfg.secret)

    try {
        let response: TaggedLocationResponse

        if (aggregation) {
            const rawResponse = (await axios.get<LocationResponse>(urlString, {
                headers: {
                    Authorization: authHeader,
                    'X-SN-Date': auth.requestDateHeaderValue,
                    'Accept-Encoding': 'UTF8'
                }
            })).data

            response = {state: 'aggregated', response: rawResponse}
        } else {
            const rawResponse = (await axios.get<LocationResponse>(urlString, {
                headers: {
                    Authorization: authHeader,
                    'X-SN-Date': auth.requestDateHeaderValue,
                    'Accept-Encoding': 'UTF8'
                }
            })).data

            response = {state: 'raw', response: rawResponse}
        }

        if (!response.response.success) {
            return Result.err(Error(
                'SolarNetwork API call failed: /solarquery/api/v1/sec/location/datum/list'))
        }

        return Result.ok(response)
    } catch (e) {
        return Result.err(new Error((e as Error).message))
    }
}

interface LocationMeta {
    locationId: number
    sourceId: string
    m: Record<string, string>,
    t: string[]
}

interface LocationMetaPage {
    totalResults: number
    startingOffset: number
    returnedResultCount: number
    results: LocationMeta[]
}

interface LocationMetaResponse {
    success: boolean
    data: LocationMetaPage
}

export async function getLocationMeta(
    cfg: SNConfig, locationId: string): Promise<Result<LocationMeta[], Error>> {
    const auth = new AuthorizationV2Builder(cfg.token).saveSigningKey(cfg.secret)

    const url = `${cfg.url}/solarquery/api/v1/sec/location/meta/${locationId}`

    const fetchUrl = new URL(url)
    const urlString = encodeSolarNetworkUrl(fetchUrl)

    const authHeader = auth.snDate(true).url(urlString).build(cfg.secret)

    try {
        const response = (await axios.get<LocationResponse>(urlString, {
            headers: {
                Authorization: authHeader,
                'X-SN-Date': auth.requestDateHeaderValue,
                'Accept-Encoding': 'UTF8'
            }
        })).data

        if (!response.success) {
            return Result.err(Error(
                'SolarNetwork API call failed: /solarquery/api/v1/sec/location/meta'))
        }

        return Result.ok(response.data.results)
    } catch (e) {
        return Result.err(new Error((e as Error).message))
    }
}

export async function listSources(
    cfg: SNConfig, source: string, ids: any): Promise<Result<string[], Error>> {
    const result = await getDatums(cfg, true, source, ids, undefined, undefined)
    if (result.isErr) {
        return Result.err(result.error)
    }

    if (!result.value.response.meta) {
        return Result.ok([])
    }

    return Result.ok(result.value.response.meta.map((m: any) => m['sourceId']))
}

export interface ExportDatumFilter {
    startDate: number  // epoch MS
    endDate: number    // epoch MS
    aggregation?: string
    nodeId?: number
    nodeIds?: number[]
    sourceId?: string
    sourceIds?: string[]
    nodeIdMaps?: string[]
    sourceIdMaps?: string[]
}

export interface ExportDataConfiguration {
    datumFilter: ExportDatumFilter
}

export interface ExportOutputConfiguration {
    compressionTypeKey: string
    serviceIdentifier: string
    serviceProperties: Record<string, any>
}

export interface ExportDestinationConfiguration {
    serviceIdentifier: string
    serviceProperties: Record<string, any>
}

export interface ExportTask {
    name: string,
    dataConfiguration: ExportDataConfiguration,
    outputConfiguration: ExportOutputConfiguration,
    destinationConfiguration: ExportDestinationConfiguration
}

export async function submitExportTask(
    task: ExportTask, cfg: SNConfig): Promise<Result<void, Error>> {
    const url = `${cfg.url}/solaruser/api/v1/sec/user/export/adhoc`
    const js = JSON.stringify(task)

    const auth = new AuthorizationV2Builder(cfg.token).saveSigningKey(cfg.secret)
    let authHeader = auth.snDate(true)
        .method('POST')
        .contentType('application/json; charset=UTF-8')
        .url(url)
        .computeContentDigest(js)
        .build(cfg.secret)

    let headers: Record<string, any> = {}
    headers[HttpHeaders.DIGEST] =
        auth.httpHeaders.firstValue(HttpHeaders.DIGEST)
    headers[HttpHeaders.X_SN_DATE] = auth.requestDateHeaderValue
    headers[HttpHeaders.AUTHORIZATION] = authHeader
    headers[HttpHeaders.CONTENT_TYPE] = 'application/json; charset=UTF-8'

    try {
        const response =
            await axios.post<ExportResponse<null>>(url, js, {headers: headers})

        if (!response.data.success) {
            return Result.err(new Error(`SolarNetwork API call failed: ${url}`))
        }
    } catch (e) {
        return Result.err(new Error((e as Error).message))
    }

    return Result.ok(void (0))
}

export async function listExportTasks(cfg: SNConfig):
    Promise<Result<any, Error>> {
    const url = `${cfg.url}/solaruser/api/v1/sec/user/export/adhoc`
    const auth = new AuthorizationV2Builder(cfg.token).saveSigningKey(cfg.secret)
    const authHeader = auth.snDate(true).method('GET').url(url).build(cfg.secret)

    try {
        const response = await axios.get<ExportResponse<any>>(url, {
            headers: {
                Authorization: authHeader,
                'X-SN-Date': auth.requestDateHeaderValue,
                'Accept-Encoding': 'UTF8'
            }
        })

        if (!response.data.success) {
            return Result.err(new Error(`SolarNetwork API call failed: ${url}`))
        }

        return Result.ok(response.data.data)
    } catch (e) {
        return Result.err(new Error((e as Error).message))
    }
}

export async function staleAggregation(
    cfg: SNConfig, start: number, end: number, nodeId: number,
    sourceId: string) {
    const startDate = moment(start).format('YYYY-MM-DDTHH:mm')
    const endDate = moment(end).format('YYYY-MM-DDTHH:mm')
    // console.log("STALE", startDate, endDate, sourceId)

    let raw: any = {
        endDate: endDate,
        startDate: startDate,
        nodeId: nodeId,
        sourceIds: sourceId
    }

    const params = new URLSearchParams(raw)
    const url = `${cfg.url}/solaruser/api/v1/sec/datum/maint/agg/stale`

    const fetchUrl = new URL(url)
    fetchUrl.search = params.toString()
    const urlString = encodeSolarNetworkUrl(fetchUrl)

    const auth = new AuthorizationV2Builder(cfg.token).saveSigningKey(cfg.secret)
    let authHeader = auth.snDate(true)
        .method('POST')
        .contentType('application/x-www-form-urlencoded')
        .url(urlString)
        .build(cfg.secret)

    let headers: Record<string, any> = {}
    headers[HttpHeaders.X_SN_DATE] =
        auth.requestDateHeaderValue
    headers[HttpHeaders.AUTHORIZATION] = authHeader
    headers[HttpHeaders.CONTENT_TYPE] = 'application/x-www-form-urlencoded'

    try {
        const response = await axios.post<ExportResponse<null>>(url, raw, {
            headers: headers,
            paramsSerializer: function (params) {
                var result = '';
                // Build the query string
                return result;
            }
        })

        if (!response.data.success) {
            return Result.err(new Error(`SolarNetwork API call failed: ${url}`))
        }
    } catch (e) {
        console.log(e)
        return Result.err(new Error((e as Error).message))
    }

    return Result.ok(void (0))
}
