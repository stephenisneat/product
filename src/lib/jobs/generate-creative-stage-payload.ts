import type { CreativeStage, GenerateCreativeStageJobInput } from "@/domain";

export type GenerateCreativeStageJobPayload = {
  jobRunId: string;
  workspaceId: string;
  createdBy: string | null;
  creativeId: string;
  productId: string;
  stage: CreativeStage;
};

export function payloadFromGenerateCreativeStageInput(
  jobRunId: string,
  workspaceId: string,
  createdBy: string | null,
  input: GenerateCreativeStageJobInput,
): GenerateCreativeStageJobPayload {
  return {
    jobRunId,
    workspaceId,
    createdBy,
    creativeId: input.creativeId,
    productId: input.productId,
    stage: input.stage,
  };
}
