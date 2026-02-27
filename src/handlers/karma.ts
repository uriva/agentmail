import { getBalance } from "../services/karma.ts";
import type { ApiResponse } from "../types.ts";

const getKarmaBalance = async (
  _req: Request,
  _params: Record<string, string>,
  orgId: string,
): Promise<Response> => {
  const balance = await getBalance(orgId);
  return Response.json({ data: balance } satisfies ApiResponse<unknown>);
};

export { getKarmaBalance };
