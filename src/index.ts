#!/usr/bin/env -S NODE_OPTIONS=--no-warnings node

process.env.NODE_NO_WARNINGS = "1";

import {Command} from "commander";
import {listAMSProjects, listAMSSites, listAMSSources, listEvents} from "./ams.js"
import {authenticateAMS, authenticateSolarNetwork} from "./config.js";
import {
    fetchSNDatums,
    listSourceMeasurements,
    fetchCompressionTypes,
    fetchDestinationTypes,
    fetchOutputTypes,
    fetchExportTasks,
    startExportTask
} from "./solarnetwork.js";

const quant = new Command("sqc")
const config = new Command("config").description("Manage authenticated sessions")
const projects = new Command("projects").description("Fetch project metadata")
const events = new Command("events").description("Fetch events")
const datums = new Command("datums").description("Fetch datums from SolarNetwork")

config
    .command("authenticate <type>")
    .description("Authenticate against a portal of a given type. Supports 'ams' and 'sn'.")
    .action(async (type: string) => {
        try {
            if (type.toLowerCase() == "ams") {
                await authenticateAMS()
            } else if (type.toLowerCase() == "sn") {
                await authenticateSolarNetwork()
            }
        } catch (e) {
            console.error(e)
        }
    })

projects
    .command("list")
    .description("List project codes")
    .option("-c, --codes", "Only print project codes", false)
    .action(async (opts) => {
        try {
            await listAMSProjects(opts["codes"])
        } catch (e) {
            console.error(e)
        }
    })

projects
    .command("list-sites <project>")
    .description("List site codes for a project")
    .action(async (project: string) => {
        try {
            await listAMSSites(project)
        } catch (e) {
            console.error(e)
        }
    })

projects
    .command("list-sources <project> <site>")
    .description("List sources for site")
    .action(async (project: string, site: string) => {
        try {
            await listAMSSources(project, site)
        } catch (e) {
            console.error(e)
        }
    })

projects
    .command("source [path]")
    .description("Show measurements given by source")
    .action(async (source?: string) => {
        if (!source) {
            source = "/**"
        }
        const result = await listSourceMeasurements(source)
        if (result.isErr) {
            console.error(result.error.message)
        }
    })

events
    .command("list <start> <end>")
    .description("List events")
    .action(async (start: string, end: string, project: string) => {
        try {
            await listEvents(start, end)
        } catch (e) {
            console.error(e)
        }
    })

datums
    .option("-a, --aggregation <aggregation>",
        `Aggregation for datums. If this option is given, the datums provided by SolarQuant will be modified. \
        Specifically, datums will be combined in intervals given by this option.`)
    .option("--parallel <parallel>",
        `Number of requests to execute at once. Increasing this value may make your downloads complete faster, \
        although this depends on how SolarQuant splits your data into chunks.`, "32")
    .option("-p, --partial",
        `Allow partial rows in the output. By default, if a row of data is missing one of the columns you \
        have provided, it will be omitted by the output. If you want to include rows which are missing all data, use \
        the --empty flag.`)
    .option("-e, --empty", `Allow empty rows in the output. Read the --partial flag documentation for \
    for information.`)
    .command("stream <source> <format> <start> <end>")
    .description("Dump datums specified by source")
    .action(async (source: string, format: string, start: string, end: string) => {
        const opts = datums.opts()
        const result = await fetchSNDatums(source, format, start, end, opts)
        if (result.isErr) {
            console.error(result.error.message)
        }
    })

datums
    .command("compression-types")
    .description("List the compression types which are available.")
    .action(async () => {
        const result = await fetchCompressionTypes()
        if (result.isErr) {
            console.error(result.error.message)
        }
    })

datums
    .command("destination-types")
    .description("List the destination types which are available.")
    .action(async () => {
        const result = await fetchDestinationTypes()
        if (result.isErr) {
            console.error(result.error.message)
        }
    })

datums
    .command("output-types")
    .description("List the export types which are available.")
    .action(async () => {
        const result = await fetchOutputTypes()
        if (result.isErr) {
            console.error(result.error.message)
        }
    })

datums
    .command("exports")
    .description("List the currently active export tasks.")
    .action(async () => {
        const result = await fetchExportTasks()
        if (result.isErr) {
            console.error(result.error.message)
        }
    })

function collect(val: string, memo: string[]): string[] {
    memo.push(val);
    return memo;
}

datums
    .option("--start <startDate>",
        `Start date for query. This value is given in ISO 8601 format, for instance '2022-05-1'.`)
    .option("--end <endDate>", `End date for query. Read help for --start for more details.`)
    .option("-s, --source <sourceId>",
        `Source ID pattern. This may be a source ID exactly, or it may be a wildcard pattern.`)
    .option("--compression <compressionId>",
        `Compression type to be used. You may either use the ID, or the localized name.`)
    .option("--output <outputId>",
        `Output type to be used. You may either use the ID, or the localized name.`)
    .option("--output-prop <key>", "Output property (key:value)", collect, [])
    .option("--destination <destinationId>",
    `Destination type to be used. You may either use the ID, or the localized name.`)
.option("--destination-prop <key>", "Destination property (key:value)", collect, [])
    .command("export")
    .description("Export data")
    .action(async () => {
        const opts = datums.opts()
        const result = await startExportTask(opts)
        if (result.isErr) {
            console.error(result.error.message)
        }
    })

quant
    .addCommand(config)
    .addCommand(projects)
    .addCommand(events)
    .addCommand(datums)

quant.parse(process.argv)
