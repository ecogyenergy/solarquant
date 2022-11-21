import {Amplify, Auth} from "aws-amplify";
import {question} from "readline-sync";
import {readConfigFile} from "./config.js";
import { printTable, Table } from "console-table-printer";

export interface AMSOptions {
    // AMS API URL
    amsURL?: string,

    // AMS username
    username?: string,

    // AMS password
    password?: string,

    // Region that the cognito pool lives in (us-east-1, for example)
    region?: string,

    // User pool ID provided by cognito
    userPoolId?: string,

    // The userPoolWebClientId field is just the client ID
    userPoolWebClientId?: string,

    // Project code
    project?: string
}

export async function getAMSProjects(): Promise<string> {
    const cfg = readConfigFile()

    if (!cfg.ams?.session) {
        throw new Error("Must have active AMS authentication")
    }

    const response = await fetch("https://api.ecogytest.io/projects", {
        headers: {
            Authorization: cfg.ams.session
        }
    })

    if (response.status != 200) {
        throw new Error(`Failed to fetch export data, code: ${response.status}, message: ${response.statusText}`)
    }

    const fields = [
        "status",
        "name",
        "state",
        "code",
        "town",
        "timezone",
        "lat",
        "long"
    ]

    const json = await response.json()
    return json["projects"].map((p: any) => p["code"])
}

export async function listAMSProjects(codes: boolean): Promise<void> {
    const cfg = readConfigFile()

    if (!cfg.ams?.session) {
        throw new Error("Must have active AMS authentication")
    }

    const response = await fetch("https://api.ecogytest.io/projects", {
        headers: {
            Authorization: cfg.ams.session
        }
    })

    if (response.status != 200) {
        if (response.status == 401) {
            console.error("The AMS API rejected your authenticated session. Please authenticate again.")
            return
        }

        throw new Error(`Failed to fetch export data, code: ${response.status}, message: ${response.statusText}`)
    }

    const fields = [
        "status",
        "name",
        "state",
        "code",
        "town",
    ]

    response.json().then(resp => {

        const p = new Table({
            columns: fields.map(f => {
                return {
                    name: f,
                    alignment: 'left'
                }
            }),
            rows: resp["projects"].map((p: any) => {
                if (codes) {
                    return
                }

                let v: any = {}
                for (const f of fields) {
                    v[f] = p[f]
                }

                return v
            })
        })

        p.printTable()
    })
}

export async function listAMSSites(project: string): Promise<void> {
    const cfg = readConfigFile()

    if (!cfg.ams?.session) {
        throw new Error("Must have active AMS authentication")
    }

    const response = await fetch("https://api.ecogytest.io/projects", {
        headers: {
            Authorization: cfg.ams.session
        }
    })

    if (response.status != 200) {
        if (response.status == 401) {
            console.error("The AMS API rejected your authenticated session. Please authenticate again.")
            return
        }

        throw new Error(`Failed to fetch export data, code: ${response.status}, message: ${response.statusText}`)
    }

    const r = await response.json()
    const p = r["projects"].find((c: any) => c["code"] == project)
    const sites = p["sites"]

    Object.keys(sites).forEach((key: string) => {
        console.log(key)
    })
}

export async function listAMSSources(project: string, site: string): Promise<void> {
    const cfg = readConfigFile()

    if (!cfg.ams?.session) {
        throw new Error("Must have active AMS authentication")
    }

    const response = await fetch("https://api.ecogytest.io/projects", {
        headers: {
            Authorization: cfg.ams.session
        }
    })

    if (response.status != 200) {
        if (response.status == 401) {
            console.error("The AMS API rejected your authenticated session. Please authenticate again.")
            return
        }

        throw new Error(`Failed to fetch export data, code: ${response.status}, message: ${response.statusText}`)
    }

    const r = await response.json()
    const p = r["projects"].find((c: any) => c["code"] == project)
    const s: any[] = Object.values(p["sites"][site]["systems"])

    let output: any = {}
    for (const system of s) {
        const code: string = system["code"]
        output[code] = system["devices"]
    }

    console.log(JSON.stringify(output, null, 4))
}

export async function listEvents(start: string, end: string): Promise<void> {
    const cfg = readConfigFile()

    if (!cfg.ams?.session) {
        throw new Error("Must have active AMS authentication")
    }

    const response = await fetch(`https://api.ecogytest.io/events?start=${start}&end=${end}`, {
        headers: {
            Authorization: cfg.ams.session
        }
    })

    if (response.status != 200) {
        if (response.status == 401) {
            console.error("The AMS API rejected your authenticated session. Please authenticate again.")
            return
        }

        throw new Error(`Failed to fetch export data, code: ${response.status}, message: ${response.statusText}`)
    }

    const json = await response.json()
    const events = json["events"]

    const properties = [
        "path",
        "assetType",
        "dueDate",
        "userName",
        "priority",
        "updated",
        "userId",
        "startDate",
        "description",
        "id",
        "cause",
        "type"]

    for (let i = 0; i < properties.length; i++) {
        process.stdout.write(properties[i])
        process.stdout.write(i == (properties.length - 1) ? '\n' : ',')
    }

    for (const event of events) {
        for (let i = 0; i < properties.length; i++) {
            const p = properties[i]
            if (event[p]) {
                let str = event[p].toString()
                str = str.replace(/\n/g, "\\n")
                str = str.replace(/\r/g, "\\r")
                str = str.replace(/,/g, "\\,")
                process.stdout.write(str)
            }
            process.stdout.write(i == (properties.length - 1) ? '\n' : ',')
        }
    }
}