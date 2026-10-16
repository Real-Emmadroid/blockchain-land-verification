export type Role = "registrar" | "owner";
export type PropertyType = "land" | "building";
export type DocType = "title_deed" | "certificate_of_occupancy" | "deed_of_assignment" | "survey_plan" | "receipt" | "other";
export type ChainStatus = "pending" | "confirmed" | "failed";
export type TransferStatus = "pending" | "processing" | "completed" | "rejected";
export type PropertyStatus = "registered" | "transfer_pending";
export type VerifyResult = "authentic" | "revoked" | "not_found";

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  identifier: string;
}

export interface User extends SessionUser {
  isActive: boolean;
  createdAt: string;
}

export interface Property {
  id: number;
  propertyCode: string;
  title: string;
  propertyType: PropertyType;
  location: string;
  sizeSqm: number | null;
  description: string;
  currentOwnerId: number;
  currentOwnerName: string;
  status: PropertyStatus;
  documentCount: number;
  createdAt: string;
}

export interface Doc {
  id: number;
  propertyId: number;
  propertyCode: string;
  docType: DocType;
  fileName: string;
  fileType: string;
  fileSize: number;
  sha256: string;
  chainStatus: ChainStatus;
  txHash: string | null;
  chainError: string | null;
  revoked: boolean;
  revokeReason: string | null;
  uploadedByName: string;
  createdAt: string;
}

export interface OwnershipEntry {
  ownerId: number;
  ownerName: string;
  since: string;
  deedSha256: string;
  txHash: string | null;
}

export interface Transfer {
  id: number;
  propertyId: number;
  propertyCode: string;
  propertyTitle: string;
  fromOwnerId: number;
  fromOwnerName: string;
  toOwnerId: number;
  toOwnerName: string;
  note: string | null;
  status: TransferStatus;
  rejectionReason: string | null;
  deedDocumentId: number | null;
  txHash: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface VerifyResponse {
  result: VerifyResult;
  sha256: string;
  propertyCode: string | null;
  docType: DocType | null;
  registeredAt: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
  txHash: string | null;
  explorerUrl: string | null;
}

export interface VerificationLogItem {
  id: number;
  sha256: string;
  result: VerifyResult;
  createdAt: string;
}

export interface Overview {
  totals: { properties: number; documents: number; owners: number; revokedDocuments: number };
  byChainStatus: Record<ChainStatus, number>;
  transfers: Record<TransferStatus, number>;
  verifications: Record<VerifyResult, number>;
  recentNotFound: VerificationLogItem[];
}

export interface ChainStatusInfo {
  configured: boolean;
  connected: boolean;
  chainId: number | null;
  blockNumber: number | null;
  contractAddress: string | null;
  contractSource: "env" | "auto" | null;
  operatorAddress: string | null;
  operatorBalanceEth: string | null;
  contractOperatorMatches: boolean | null;
}

export interface AppConfig {
  chainId: number | null;
  explorerTxBase: string;
  contractAddress: string | null;
  maxFileMb: number;
}

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  title_deed: "Title deed",
  certificate_of_occupancy: "Certificate of occupancy",
  deed_of_assignment: "Deed of assignment",
  survey_plan: "Survey plan",
  receipt: "Receipt",
  other: "Other",
};
