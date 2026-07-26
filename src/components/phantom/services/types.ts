/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ServiceType = 
  | 'API Testing'
  | 'Web Application Testing (OWASP)'
  | 'Infrastructure Pentest'
  | 'SAST Static Analysis'
  | 'Cloud & Container Security';

export type ScopeType = 'single' | 'multiple';

export interface ServiceScope {
  type: ScopeType;
  singleTarget?: string; // e.g. "https://api.empresa.com/v1" or "192.168.1.100"
  multipleTargets?: string[]; // e.g. ["192.168.1.1", "192.168.1.2", "api.empresa.com"]
  targetsFileName?: string; // default "targets.txt"
  sastArchiveName?: string; // e.g. "project_source_v1.zip"
  notes?: string;
}

export type TestCaseStatus = 'pending' | 'running' | 'passed' | 'vulnerable' | 'skipped';

export interface SecurityTestCase {
  id: string;
  code: string; // e.g. "API1:2023", "WSTG-INJV-01"
  title: string;
  category: string;
  serviceType: ServiceType;
  description: string;
  status: TestCaseStatus;
  commandTemplate: string; // e.g. "curl -X GET {TARGET}/users" or "nmap -sV -iL {TARGETS_FILE}"
  computedCommand: string; // With target embedded!
  evidenceNotes?: string;
  evidenceProduced?: {
    rawOutput?: string;
    screenshots?: string[];
  };
  derivedVulnerabilitiesCount: number;
}

export type VulnerabilitySeverity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';

export interface ServiceVulnerability {
  id: string;
  code: string;
  title: string;
  severity: VulnerabilitySeverity;
  cvss: number;
  testCaseId: string; // Linked test case for full traceability!
  testCaseTitle: string;
  affectedTarget: string; // Target from SoW
  description: string;
  remediation: string;
  createdAt: string;
}

export interface PhantomService {
  id: string;
  code: string;
  name: string;
  clientName: string;
  type: ServiceType;
  scope: ServiceScope;
  executionMode: 'tools_file' | 'manual';
  status: 'draft' | 'in_progress' | 'completed';
  testCases: SecurityTestCase[];
  vulnerabilities: ServiceVulnerability[];
  toolFiles?: { name: string; tool: string; size: string; date: string }[];
  createdAt: string;
  updatedAt: string;
}

export type ServicesCatalogViewMode = 'grid' | 'list';
