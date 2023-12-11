import { readConfigFile } from "./config.js";
import { Table } from "console-table-printer";
import axios from "axios";

export async function listAMSProjects(codes: boolean): Promise<void> {
  const cfg = readConfigFile()

  if (!cfg.ams?.session) {
    throw new Error("Must have active AMS authentication")
  }

  try {
    const response = await axios.get(`${cfg.ams.url}/projects`, {
      headers: {
        Authorization: cfg.ams.session,
        "Accept-Encoding": "UTF8"
      }
    })

    const fields = [
      "status",
      "name",
      "state",
      "code",
      "town",
    ]

    const resp = response.data
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
  } catch (e) {
    if (e instanceof axios.AxiosError) {
      if (e.response?.status != 200) {
        if (e.response?.status == 401) {
          console.error("The AMS API rejected your authenticated session. Please authenticate again.")
          return
        }

        throw new Error(`Failed to fetch export data, code: ${e.response?.status}`)
      }
    } else {
      throw e
    }
  }

}

export async function listAMSSites(project: string): Promise<void> {
  const cfg = readConfigFile()

  if (!cfg.ams?.session) {
    throw new Error("Must have active AMS authentication")
  }

  try {
    const response = await axios.get(`${cfg.ams.url}/projects`, {
      headers: {
        Authorization: cfg.ams.session,
        "Accept-Encoding": "UTF8"
      }
    })

    if (response.status != 200) {
      if (response.status == 401) {
        console.error("The AMS API rejected your authenticated session. Please authenticate again.")
        return
      }

      throw new Error(`Failed to fetch export data, code: ${response.status}, message: ${response.statusText}`)
    }

    const r = await response.data
    const p = r["projects"].find((c: any) => c["code"] == project)
    const sites = p["sites"]

    Object.keys(sites).forEach((key: string) => {
      console.log(key)
    })
  } catch (e) {
    if (e instanceof axios.AxiosError) {
      if (e.response?.status != 200) {
        if (e.response?.status == 401) {
          console.error("The AMS API rejected your authenticated session. Please authenticate again.")
          return
        }

        throw new Error(`Failed to fetch export data, code: ${e.response?.status}`)
      }
    } else {
      throw e
    }
  }
}

export async function listAMSSources(project: string, site: string): Promise<void> {
  const cfg = readConfigFile()

  if (!cfg.ams?.session) {
    throw new Error("Must have active AMS authentication")
  }

  try {
    const response = await axios.get(`${cfg.ams.url}/projects`, {
      headers: {
        Authorization: cfg.ams.session,
        "Accept-Encoding": "UTF8"
      }
    })

    if (response.status != 200) {
      if (response.status == 401) {
        console.error("The AMS API rejected your authenticated session. Please authenticate again.")
        return
      }

      throw new Error(`Failed to fetch export data, code: ${response.status}, message: ${response.statusText}`)
    }

    const r = await response.data
    const p = r["projects"].find((c: any) => c["code"] == project)
    const s: any[] = Object.values(p["sites"][site]["systems"])

    let output: any = {}
    for (const system of s) {
      const code: string = system["code"]
      output[code] = system["devices"]
    }

    console.log(JSON.stringify(output, null, 4))
  } catch (e) {
    if (e instanceof axios.AxiosError) {
      if (e.response?.status != 200) {
        if (e.response?.status == 401) {
          console.error("The AMS API rejected your authenticated session. Please authenticate again.")
          return
        }

        throw new Error(`Failed to fetch export data, code: ${e.response?.status}`)
      }
    } else {
      throw e
    }
  }
}

export async function listEvents(start: string, end: string): Promise<void> {
  const cfg = readConfigFile()

  if (!cfg.ams?.session) {
    throw new Error("Must have active AMS authentication")
  }

  try {
    const response = await axios.get(`${cfg.ams.url}/events?start=${start}&end=${end}`, {
      headers: {
        Authorization: cfg.ams.session,
        "Accept-Encoding": "UTF8"
      }
    })

    if (response.status != 200) {
      if (response.status == 401) {
        console.error("The AMS API rejected your authenticated session. Please authenticate again.")
        return
      }

      throw new Error(`Failed to fetch export data, code: ${response.status}, message: ${response.statusText}`)
    }

    const json = await response.data
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
  } catch (e) {
    if (e instanceof axios.AxiosError) {
      if (e.response?.status != 200) {
        if (e.response?.status == 401) {
          console.error("The AMS API rejected your authenticated session. Please authenticate again.")
          return
        }

        throw new Error(`Failed to fetch export data, code: ${e.response?.status}`)
      }
    } else {
      throw e
    }
  }
}
