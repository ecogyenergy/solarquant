#!/usr/bin/env -S NODE_OPTIONS=--no-warnings node

process.env.NODE_NO_WARNINGS = "1";

import {Command} from "commander";
import {listAMSProjects, listAMSSites, listAMSSources, listEvents} from "./ams.js"
import {authenticateAMS, authenticateSolarNetwork} from "./config.js";
import {fetchSNDatums, listSourceMeasurements, fetchCompressionTypes, fetchDestinationTypes, fetchOutputTypes, fetchExportTasks, startExportTask} from "./solarnetwork.js";

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
        try {
            if (!source) {
                source = "/**"
            }
            await listSourceMeasurements(source)
        } catch (e) {
            console.error(e)
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
    .option("-a, --aggregation <aggregation>", "Aggregation for datums")
    .option("--parallel <parallel>", "Number of requests at once", "32")
    .option("-p, --partial", "Allow partial row matches")
    .option("-e, --empty", "Allow empty row matches")
    .command("stream <source> <format> <start> <end>")
    .description("Dump datums specified by source")
    .action(async (source: string, format: string, start: string, end: string) => {
        try {
            const opts = datums.opts()
            await fetchSNDatums(source, format, start, end, opts)
        } catch (e: any) {
            console.error(e)
            console.log(e.config.url)
        }
    })

datums
    .command("compression-types")
    .description("List export compression types")
    .action(async () => {
        try {
            await fetchCompressionTypes()
        } catch (e: any) {
            console.error(e)
            console.log(e.config.url)
        }
    })

datums
    .command("destination-types")
    .description("List export destination types")
    .action(async () => {
        try {
            await fetchDestinationTypes()
        } catch (e: any) {
            console.error(e)
            console.log(e.config.url)
        }
    })

datums
    .command("output-types")
    .description("List export output types")
    .action(async () => {
        try {
            await fetchOutputTypes()
        } catch (e: any) {
            console.error(e)
            console.log(e.config.url)
        }
    })

datums
    .command("exports")
    .description("List export tasks")
    .action(async () => {
        try {
            await fetchExportTasks()
        } catch (e: any) {
            console.error(e)
            console.log(e.config.url)
        }
    })

function collect (val: string, memo: string[]): string[] {
    memo.push(val);
    return memo;
}

datums
    .option("--start <startDate>", "Start date for query")
    .option("--end <endDate>", "Start date for query")
    .option("-s, --source <sourceId>", "Source ID pattern")
    .option("--compression <compressionId>", "Compression identifier")
    .option("--output <outputId>", "Output identifier")
    .option("--output-prop <key>", "Output property (key:value)", collect, [])
    .option("--destination <destinationId>", "Destination identifier")
    .option("--destination-prop <key>", "Destination property (key:value)", collect, [])
    .command("export")
    .description("Export data")
    .action(async () => {
        try {
            const opts = datums.opts()
            await startExportTask(opts)
        } catch (e: any) {
            console.error(e)
            console.log(e.config.url)
        }
    })

quant
    .addCommand(config)
    .addCommand(projects)
    .addCommand(events)
    .addCommand(datums)

quant.parse(process.argv)
