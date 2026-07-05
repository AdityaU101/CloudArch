import type { IconType } from "react-icons";
import { FaAws } from "react-icons/fa";
import { VscAzure } from "react-icons/vsc";
import { SiGooglecloud } from "react-icons/si";

export type CloudProvider = "aws" | "azure" | "gcp";

export interface ProviderMeta {
  id: CloudProvider;
  label: string;
  /** Full name used in prose ("a costed, editable AWS design") */
  name: string;
  icon: IconType;
}

export const CLOUD_PROVIDERS: ProviderMeta[] = [
  { id: "aws", label: "AWS", name: "AWS", icon: FaAws },
  { id: "azure", label: "Azure", name: "Microsoft Azure", icon: VscAzure },
  { id: "gcp", label: "Google Cloud", name: "Google Cloud", icon: SiGooglecloud },
];

export function providerMeta(provider?: string): ProviderMeta {
  return CLOUD_PROVIDERS.find((p) => p.id === provider) ?? CLOUD_PROVIDERS[0];
}
