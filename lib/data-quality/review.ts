import type { QualityPerson } from "./data.server";
import type { Catalog } from "./format";

export type DuplicateReview = {
  left: QualityPerson;
  right: QualityPerson;
  catalog: Catalog;
  token: string;
  canWrite: boolean;
};

export function parseDuplicatePair(pair: string | null): [string, string] | null {
  const ids = pair?.toLowerCase().split(":");
  if (!ids || ids.length !== 2 || ids[0] === ids[1] ||
      ids.some(id => !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id))) return null;
  return ids.sort() as [string, string];
}
