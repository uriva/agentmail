import prerenderIso from "preact-iso/prerender";
import { locationStub } from "preact-iso/prerender";
import { App_ } from "./main.tsx";

type RouteMeta = {
  readonly title: string;
  readonly description: string;
};

const defaultMeta: RouteMeta = {
  title: "AgentMail — Open Source Email for AI Agents",
  description:
    "100% open source (MIT) email infrastructure for AI agents. Give every agent its own @theagentmail.net address with REST API, remote MCP, webhooks, and AI spam guard. 1 mailbox free for 30 days, then $1/mo.",
};

const routeMeta: Record<string, RouteMeta> = {
  "/": defaultMeta,
  "/docs": {
    title: "AgentMail API & Remote MCP Docs — theagentmail.net",
    description:
      "REST API, Streamable HTTP remote MCP server, webhooks, and scoped API key documentation for AgentMail (theagentmail.net).",
  },
  "/pricing": {
    title: "AgentMail Pricing — $1/mo per AI Agent Mailbox",
    description:
      "1 mailbox free for 30 days, then $1/month per active mailbox with a $5 prepaid balance that never expires. Zero platform fees.",
  },
  "/compare": {
    title: "AgentMail (theagentmail.net) vs agentmail.to vs DIY",
    description:
      "Side-by-side comparison of open-source AgentMail ($1/mo flat, MIT, Cloudflare Workers) vs agentmail.to ($200/mo Startup) and DIY email.",
  },
  "/guides/mcp": {
    title: "Remote MCP Server for AI Agent Email — AgentMail",
    description:
      "Connect Claude Code, Cursor, Hermes Agent, OpenClaw, or OpenCode to a dedicated @theagentmail.net inbox via Streamable HTTP MCP.",
  },
  "/guides/hermes-openclaw": {
    title: "Give Hermes Agent or OpenClaw an Email Inbox — AgentMail",
    description:
      "Connect Hermes Agent or OpenClaw to an isolated @theagentmail.net mailbox via remote MCP, AgentSkill, or native plugin.",
  },
  "/guides/python": {
    title: "Give a Python, LangGraph, or CrewAI Agent an Email Inbox — AgentMail",
    description:
      "Send, read, thread replies, and handle HMAC-signed webhooks in Python using plain requests, LangGraph tools, or FastAPI. MIT open source, $1/mo.",
  },
  "/self-host": {
    title: "Self-Host Open-Source Email for AI Agents — AgentMail (MIT)",
    description:
      "Deploy AgentMail on your own Cloudflare Workers account with InstantDB and Resend. 100% MIT licensed.",
  },
  "/blog/shared-email-domain-for-ai-agents": {
    title:
      "What actually happens when you run a shared email domain for AI agents",
    description:
      "Phishing blasts, burner OTP farms, prompt-injected webhook exfiltration, and the Cloudflare Durable Object + AI spam guard stack we use to stop them.",
  },
  "/privacy": {
    title: "Privacy Policy — AgentMail",
    description: "Privacy policy for AgentMail (theagentmail.net).",
  },
  "/terms": {
    title: "Terms of Service — AgentMail",
    description: "Terms of service for AgentMail (theagentmail.net).",
  },
};

export const prerender = async ({ url }: { url: string }) => {
  locationStub(url);
  const res = await prerenderIso(<App_ />);
  const meta = routeMeta[url] ?? defaultMeta;
  const canonicalUrl = url === "/"
    ? "https://theagentmail.net/"
    : `https://theagentmail.net${url}`;
  return {
    ...res,
    head: {
      title: meta.title,
      elements: new Set([
        {
          type: "meta",
          props: { name: "description", content: meta.description },
        },
        { type: "meta", props: { property: "og:title", content: meta.title } },
        {
          type: "meta",
          props: { property: "og:description", content: meta.description },
        },
        { type: "meta", props: { property: "og:url", content: canonicalUrl } },
        { type: "meta", props: { name: "twitter:title", content: meta.title } },
        {
          type: "meta",
          props: { name: "twitter:description", content: meta.description },
        },
        { type: "link", props: { rel: "canonical", href: canonicalUrl } },
      ]),
    },
  };
};
