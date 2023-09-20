import { AiXpandPlugin, AiXpandPluginInstance, DataCaptureThreadType, PluginInstance } from '@aixpand/client';

export const LLM_CODEGEN_01 = 'LLM_CODEGEN_01';

@PluginInstance(LLM_CODEGEN_01)
export class LLMCodegen01 extends AiXpandPlugin {
    type: string = LLM_CODEGEN_01;

    static make(rawConfig: any = {}, useId?: string): AiXpandPluginInstance<LLMCodegen01> {
        if (!useId) {
            useId = LLMCodegen01.generateId();
        }

        const instance = new LLMCodegen01();

        return new AiXpandPluginInstance(useId, instance);
    }

    static getSchema() {
        return {
            name: 'LLM Codegen 01',
            description: 'Description.',
            type: LLM_CODEGEN_01,
            fields: [],
            dct: {
                types: [
                    DataCaptureThreadType.VOID_STREAM,
                ],
            },
        };
    }
}
