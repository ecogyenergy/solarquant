import {question} from "readline-sync";
import {Amplify, Auth} from "aws-amplify";
import {readFileSync, writeFileSync} from "fs";

export interface AMSConfig {
    region?: string,
    poolId?: string,
    clientId?: string,
    username?: string,
    session?: string
}

export interface SNConfig {
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
        const content = readFileSync("./sqc.json").toString()
        return JSON.parse(content)
    } catch (_e) {
        return {}
    }
}

export function writeConfigFile(cfg: ConfigFile) {
    const buf = JSON.stringify(cfg, null, 4)
    writeFileSync("./sqc.json", buf)
}

export async function authenticateAMS(): Promise<void> {
    const cfg = readConfigFile()

    if (!cfg.ams) {
        cfg.ams = {}
    }

    if (!cfg.ams?.region) {
        cfg.ams.region = question("AWS Region: ")
    }
    if (!cfg.ams?.poolId) {
        cfg.ams.poolId = question("Pool ID: ")
    }
    if (!cfg.ams?.clientId) {
        cfg.ams.clientId = question("Client ID: ")
    }
    if (!cfg.ams?.username) {
        cfg.ams.username = question("AMS Username: ")
    }
    const password = question("AMS Password: ", {hideEchoBack: true})

    const AwsConfigAuth = {
        region: cfg.ams.region,
        userPoolId: cfg.ams.poolId,
        userPoolWebClientId: cfg.ams.clientId,
        cookieStorage: {
            domain: "localhost",
            path: "/",
            expires: 365,
            sameSite: "strict",
            secure: true,
        },
        authenticationFlowType: "USER_SRP_AUTH",
    };

    Amplify.configure({ Auth: AwsConfigAuth });
    let user = await Auth.signIn(cfg.ams.username, password);

    if (user.challengeName) {
        const code = question("OTP: ", {hideEchoBack: true})
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

    if (!cfg.sn?.token) {
        cfg.sn.token = question("SolarNetwork Token: ")
    }
    if (!cfg.sn?.secret) {
        cfg.sn.secret = question("SolarNetwork Secret: ", {hideEchoBack: true})
    }

    writeConfigFile(cfg)
}

export async function authenticateS3(): Promise<void> {
    const cfg = readConfigFile()

    if (!cfg.s3) {
        cfg.s3 = {}
    }

    if (!cfg.s3?.bucketPath) {
        cfg.s3.bucketPath = question("Bucket Path: ")
    }
    if (!cfg.s3?.accessToken) {
        cfg.s3.accessToken = question("Access Token: ")
    }
    if (!cfg.s3?.accessSecret) {
        cfg.s3.accessSecret = question("Access Secret: ",{hideEchoBack: true})
    }

    writeConfigFile(cfg)
}
