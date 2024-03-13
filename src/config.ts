import {Amplify, Auth} from 'aws-amplify';
import {readFileSync, writeFileSync} from 'fs';
import {question} from 'readline-sync';

export let configPath = './sqc.json'

export function setConfigPath(v: string) {
    configPath = v
}

export interface AMSConfig {
    url?: string,
    region?: string,
    poolId?: string,
    clientId?: string,
    username?: string,
    session?: string
}

export interface SNConfig {
    url?: string,
    token?: string,
    secret?: string
}

export interface S3Config {
    bucketPath?: string,
    accessToken?: string,
    accessSecret?: string
}

export interface ConfigFile {
    ams?: AMSConfig,
    sn?: SNConfig,
    s3?: S3Config
}

export function readConfigFile(): ConfigFile {
    try {
        const content = readFileSync(configPath).toString()
        return JSON.parse(content)
    } catch (_e) {
        return {}
    }
}

export function writeConfigFile(cfg: ConfigFile) {
    const buf = JSON.stringify(cfg, null, 4)
    writeFileSync(configPath, buf)
}

export async function authenticateAMS(): Promise<void> {
    const cfg = readConfigFile()

    if (!cfg.ams) {
        cfg.ams = {}
    }

    if (!cfg.ams?.url) {
        const def = 'https://api.ecogytest.io'
        cfg.ams.url = question(`Ecosuite URL [${def}]: `, {defaultInput: def})
    }
    if (!cfg.ams?.region) {
        cfg.ams.region = question('AWS Region: ')
    }
    if (!cfg.ams?.poolId) {
        cfg.ams.poolId = question('Pool ID: ')
    }
    if (!cfg.ams?.clientId) {
        cfg.ams.clientId = question('Client ID: ')
    }
    if (!cfg.ams?.username) {
        cfg.ams.username = question('Ecosuite Username: ')
    }
    const password = question('Ecosuite Password: ', {hideEchoBack: true})

    const AwsConfigAuth = {
        region: cfg.ams.region,
        userPoolId: cfg.ams.poolId,
        userPoolWebClientId: cfg.ams.clientId,
    };

    Amplify.configure({Auth: AwsConfigAuth});
    let user = await Auth.signIn(cfg.ams.username, password);

    if (user.challengeName) {
        const code = question('OTP: ', {hideEchoBack: true})
        user = await Auth.confirmSignIn(user, code, user.challengeName)
    }

    cfg.ams.session = user.getSignInUserSession().getIdToken().getJwtToken()
    writeConfigFile(cfg)
}

export async function authenticateSolarNetwork(): Promise<void> {
    const cfg = readConfigFile()

    if (!cfg.sn) {
        cfg.sn = {}
    }

    if (!cfg.sn?.url) {
        const def = 'https://data.solarnetwork.net'
        cfg.sn.url = question(`SolarNetwork URL [${def}]: `, {defaultInput: def})
    }
    if (!cfg.sn?.token) {
        cfg.sn.token = question('SolarNetwork Token: ')
    }
    if (!cfg.sn?.secret) {
        cfg.sn.secret = question('SolarNetwork Secret: ', {hideEchoBack: true})
    }

    writeConfigFile(cfg)
}
