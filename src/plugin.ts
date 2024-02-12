import * as child_process from 'child_process';
import {appendFileSync} from 'fs';
import {fileSync} from 'tmp';

const spec = `
openapi: 3.0.0
info:
  description: SolarQuant Predictor
  version: "1.0.0"
  title: SolarQuant Predictor
  contact:
    email: thomas@ecogyenergy.com
  license:
    name: Apache 2.0
    url: 'http://www.apache.org/licenses/LICENSE-2.0.html'
tags:
  - name: predict
    description: Interact with predictions
  - name: measure
    description: Handle incoming measurements
paths:
  /predict:
    post:
      tags:
        - predict
      summary: Gets new prediction
      operationId: getPredictions
      description: |
        By passing in timestamp ranges, obtain a set of predictions
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                datums:
                  type: array
                  items:
                    $ref: '#/components/schemas/Datum'
                  
            
      responses:
        '200':
          description: Datum predictions
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Datum'
        '400':
          description: bad input
          
  /measure:
    post:
      tags:
        - measure
      summary: Notifies new measurement
      operationId: postMeasurements
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                datums:
                  type: array
                  items:
                    $ref: '#/components/schemas/Datum'
                  
            
      responses:
        '200':
          description: Datum predictions
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Datum'
        '400':
          description: bad input

components:
  schemas:
    Datum:
      type: object
      required:
        - timestamp
      properties:
        timestamp:
          type: number
        i:
          type: object
          example:
            watts: 400
            voltage: 12.6
        a:
          type: object
          example:
            wattHours: 8
        s:
          type: object
          example:
            phase: true
`

export async function initPlugin(
    outputDir: string, generator: string, tool: string): Promise<void> {
  const tmpf = fileSync()
  appendFileSync(tmpf.name, new Buffer(spec))

  const cmd = `/usr/bin/${
      tool} run --rm -v "/:/local" --cgroup-manager=cgroupfs --events-backend=file docker.io/openapitools/openapi-generator-cli generate \
		-i /local${tmpf.name} \
		-g ${generator} \
		-o /local${outputDir}`

  child_process.execSync(cmd)
}
