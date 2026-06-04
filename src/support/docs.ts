import supportDocsManifest from "../../data/support-docs.json" with { type: "json" };

export type SupportDocStatus = "READY" | "PREVIEW" | "BLOCKED";
export type SupportDocAudience = "users" | "operators";

export type SupportDoc = {
  id: string;
  title: string;
  path: string;
  status: SupportDocStatus;
  audience: SupportDocAudience;
  summary: string;
};

export type SupportDocsManifest = {
  schema: "maataa.support.docs.v1";
  productionReady: false;
  finalStatus: "GOVERNED_PRODUCTION_NO_GO";
  supportMode: "PREVIEW_AND_LOCAL_VALIDATION";
  documents: SupportDoc[];
};

export const supportDocs = supportDocsManifest as SupportDocsManifest;

export function listSupportDocs(audience?: SupportDocAudience): SupportDoc[] {
  return audience ? supportDocs.documents.filter((doc) => doc.audience === audience) : supportDocs.documents;
}
