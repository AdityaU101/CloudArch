import { createContext, useContext } from "react";
import type { CloudProvider } from "@/lib/cloud-providers";

/**
 * Which cloud the studio is currently rendering. Set once per canvas from the
 * architecture being viewed; nodes and the palette read it to resolve catalog
 * entries (service names, illustrative pricing) for that provider.
 */
export const StudioProviderContext = createContext<CloudProvider>("aws");

export function useStudioProvider(): CloudProvider {
  return useContext(StudioProviderContext);
}
