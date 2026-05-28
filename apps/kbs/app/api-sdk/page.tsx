import React from "react";
import { kbsOpenApiSpec } from "../../../../packages/kbs-sdk/src";
import { KbsShell } from "../../components/KbsShell";

export default function ApiSdkPage() {
  return (
    <KbsShell active="API & SDK">
      <p>REST and SDK contracts are defined for governed local use. Remote production API maturity is BLOCKED.</p>
      <pre>{JSON.stringify(kbsOpenApiSpec.paths, null, 2)}</pre>
    </KbsShell>
  );
}
