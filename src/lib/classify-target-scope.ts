/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ClassifiedTargets {
  ips: string[];
  domains: string[];
  urls: string[];
  environments: string[];
  includedAssets: string[];
}

export function classifyTargetScope(rawText: string): ClassifiedTargets {
  if (!rawText) {
    return { ips: [], domains: [], urls: [], environments: [], includedAssets: [] };
  }

  // Split by newlines, commas, semicolons or spaces
  const tokens = rawText
    .split(/[\n,;\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const ips: string[] = [];
  const domains: string[] = [];
  const urls: string[] = [];
  const environments: string[] = [];
  const includedAssets: string[] = [];

  // Regex rules
  const ipCidrRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
  const urlRegex = /^https?:\/\/.+/i;
  const domainRegex = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?$/;

  for (const token of tokens) {
    if (urlRegex.test(token)) {
      if (!urls.includes(token)) urls.push(token);
    } else if (ipCidrRegex.test(token)) {
      if (!ips.includes(token)) ips.push(token);
    } else if (domainRegex.test(token)) {
      if (!domains.includes(token)) domains.push(token);
    } else if (
      token.toLowerCase().includes('prod') ||
      token.toLowerCase().includes('dev') ||
      token.toLowerCase().includes('stage') ||
      token.toLowerCase().includes('qa') ||
      token.toLowerCase().includes('test')
    ) {
      if (!environments.includes(token)) environments.push(token);
    } else {
      if (!includedAssets.includes(token)) includedAssets.push(token);
    }
  }

  return { ips, domains, urls, environments, includedAssets };
}
