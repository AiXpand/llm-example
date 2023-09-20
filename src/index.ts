import express, { Application, Request, Response } from 'express';
import * as bodyParser from 'body-parser';
import * as dotenv from 'dotenv';
import * as process from 'process';
import { AiXpandClient, AiXpandClientEvent, AiXpandClientOptions, CacheType, MqttOptions, Void } from '@aixpand/client';
import { LLM_CODEGEN_01, LLMCodegen01 } from './llm.codegen.01.plugin';

// Setup & Config
dotenv.config();

let httpServerListening = false;
const LLM_EXAMPLE_PIPELINE_NAME = 'llm-example';
const LLM_EXAMPLE_INSTANCE_NAME = 'llm-example-instance';
const pendingResponses = {};
const app: Application = express();
const PORT = process.env.APP_PORT;
const preferredNode = process.env.AIXPAND_NODE;
const aixpOptions: AiXpandClientOptions = {
    mqtt: <MqttOptions>{
        protocol: process.env.MQTT_PROTOCOL,
        host: process.env.MQTT_HOST,
        port: parseInt(process.env.MQTT_PORT),
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
        session: {
            clean: true,
            clientId: null,
        },
    },
    name: 'llm-app-example',
    options: {
        offlineTimeout: 60,
        bufferPayloadsWhileBooting: false,
        cacheType: CacheType.MEMORY,
    },
    fleet: [preferredNode],
    plugins: {},
};

// Boot AiXpand network client
const client = new AiXpandClient(aixpOptions);
client.boot();

// Report Boot progress
console.log('AiXpand network client booting...');
client.on(AiXpandClientEvent.AIXP_CLIENT_CONNECTED, (data) => {
    console.log(`Connected to AiXpand broker at: ${data.upstream}`);
});

client.on(AiXpandClientEvent.AIXP_CLIENT_BOOTED, (err, status) => {
    console.log(`AiXpand network client successfully booted! ${new Date()}`);
});

client.on(AiXpandClientEvent.AIXP_CLIENT_SYS_TOPIC_SUBSCRIBE, (err, data) => {
    if (err) {
        console.log('Encountered error while attempting to subscribe to topic:');
        console.error(err);
        return;
    }

    console.log(`Listening for "${data.event}" events on topic "${data.topic}".`);
});

// Register /prompt route on express instance
app.post('/prompt', bodyParser.json(), (req: Request, res: Response): void => {
    if (!req.body.requestId || !req.body.prompt || !req.body.history) {
        res.status(400).send('Request body must have: requestId, prompt and history[]. History array should contain objects of type {prompt: string, response: string}');
        return;
    }

    const requestId = req.body.requestId;
    const promptContent = req.body.prompt;
    const history = req.body.history.map((entry) => {
        return {
            request: entry.prompt,
            response: entry.response,
        };
    });

    const LLMPluginInstance = client.getPipeline(preferredNode, LLM_EXAMPLE_PIPELINE_NAME).getPluginInstance(LLM_EXAMPLE_INSTANCE_NAME);

    pendingResponses[`${requestId}`] = res;

    LLMPluginInstance.sendCommand({
        history,
        request_id: requestId,
        request: promptContent,
    }); // TODO: listen for errors and return to client.
});

// Register LLM callback on client
client.on(LLM_CODEGEN_01, (context, err, payload) => {
    if (err) {
        // TODO: treat error
        return;
    }

    const requestId = payload.REQUEST_ID;
    const responseContent = payload.RESPONSE;

    pendingResponses[`${requestId}`].json({
        response: responseContent,
    });

    delete pendingResponses[`${requestId}`];
});

// This function returns bool, it checks for LLM Pipeline existence but also creates all necessary
// assets for the pipeline to run.
const checkLLMPipeline = () => {
    let pipelineFound = false;
    client.getHostPipelines(preferredNode).forEach((pipeline) => {
        if (pipeline.name === LLM_EXAMPLE_PIPELINE_NAME) {
            pipelineFound = true;
        }
    });

    if (pipelineFound) {
        console.log(`LLM pipeline "${LLM_EXAMPLE_PIPELINE_NAME}" found on ${preferredNode}.`);
        const pipeline = client.getPipeline(preferredNode, LLM_EXAMPLE_PIPELINE_NAME);
        let instance = pipeline.getPluginInstance(LLM_EXAMPLE_INSTANCE_NAME);

        if (!instance) {
            console.log(`Instance with name ${LLM_EXAMPLE_INSTANCE_NAME} not found. Deploying...`);
            instance = LLMCodegen01.make({}, LLM_EXAMPLE_INSTANCE_NAME);

            return  pipeline.attachPluginInstance(instance).deploy().then(
                (response) => {
                    console.log(`Successfully deployed ${LLM_EXAMPLE_INSTANCE_NAME} on pipeline ${LLM_EXAMPLE_PIPELINE_NAME}.`);

                    return true;
                },
                (error) => {
                    console.log(`Encountered errors while deploying ${LLM_EXAMPLE_INSTANCE_NAME} on pipeline ${LLM_EXAMPLE_PIPELINE_NAME}.`);
                    console.error(error);

                    return false;
                },
            );
        }

        console.log(`LLM instance "${LLM_EXAMPLE_INSTANCE_NAME}" found.`);

        return true;
    }

    const pipeline = client.createPipeline(preferredNode, Void.make(), LLM_EXAMPLE_PIPELINE_NAME);
    const instance = LLMCodegen01.make({}, LLM_EXAMPLE_INSTANCE_NAME);

    return pipeline.attachPluginInstance(instance).deploy().then(
        (response) => {
            console.log(`Successfully deployed ${LLM_EXAMPLE_INSTANCE_NAME} on newly created pipeline ${LLM_EXAMPLE_PIPELINE_NAME}.`);

            return  true;
        },
        (error) => {
            console.log(`Encountered errors while deploying ${LLM_EXAMPLE_INSTANCE_NAME} or creating pipeline ${LLM_EXAMPLE_PIPELINE_NAME}.`);
            console.error(error);

            return false;
        },
    );
};

// On first heartbeat, check reqs and boot HTTP Server
client.on(AiXpandClientEvent.AIXP_RECEIVED_HEARTBEAT_FROM_ENGINE, async (data) => {
    if (data.executionEngine === preferredNode && !httpServerListening && await checkLLMPipeline()) {
        app.listen(PORT, (): void => {
            httpServerListening = true;
            console.log(`Got heartbeat from ${preferredNode}. HTTP server started on port: ${PORT}`);
        });
    }
});
