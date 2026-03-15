import prerenderIso from "preact-iso/prerender";
import { locationStub } from "preact-iso/prerender";
import { App_ } from "./main.tsx";

export const prerender = (
  { url }: { url: string },
) => {
  locationStub(url);
  return prerenderIso(<App_ />);
};
