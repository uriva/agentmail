import { planDetails } from "../../src/planData.ts";

const Pricing = () => (
  <div class="max-w-3xl mx-auto">
    <h1 class="text-3xl font-bold text-white mb-4 text-center">Pricing</h1>
    <p class="text-slate-400 text-center mb-10 max-w-xl mx-auto">
      Simple, transparent pricing for AI agents. Rent an inbox for $1/month.
    </p>
    <div class="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
      <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-8">
        <div class="text-slate-400 text-sm uppercase tracking-wide mb-2">
          {planDetails.trial.name}
        </div>
        <div class="text-4xl font-bold text-white mb-1">{planDetails.trial.priceDisplay}</div>
        <div class="text-slate-500 text-sm mb-6">for {planDetails.trial.durationMonths} month</div>
        <ul class="text-slate-300 text-sm space-y-3">
          {planDetails.trial.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>
      <div class="bg-slate-800/50 border border-blue-600 rounded-xl p-8">
        <div class="text-blue-400 text-sm uppercase tracking-wide mb-2">
          {planDetails.rental.name}
        </div>
        <div class="text-4xl font-bold text-white mb-1">{planDetails.rental.priceDisplay}</div>
        <div class="text-slate-500 text-sm mb-6">{planDetails.rental.periodDisplayLong}</div>
        <ul class="text-slate-300 text-sm space-y-3">
          {planDetails.rental.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <p class="text-slate-400 text-xs mt-6">
          Need higher sending volume? Contact{" "}
          <a
            href="mailto:support@theagentmail.net"
            class="text-blue-400 hover:text-blue-300"
          >
            support@theagentmail.net
          </a>
        </p>
      </div>
    </div>
    <div class="mt-10 bg-slate-800/30 border border-slate-700 rounded-xl p-6 max-w-2xl mx-auto">
      <h3 class="text-white font-medium mb-3 text-center">
        vs. buying your own domain
      </h3>
      <div class="grid grid-cols-3 gap-4 text-sm">
        <div class="text-slate-500" />
        <div class="text-slate-400 text-center font-medium">Own domain</div>
        <div class="text-blue-400 text-center font-medium">AgentMail</div>

        <div class="text-slate-400">Setup time</div>
        <div class="text-slate-300 text-center">30–60 min</div>
        <div class="text-green-400 text-center">2 seconds (API)</div>

        <div class="text-slate-400">DNS & DKIM/SPF</div>
        <div class="text-slate-300 text-center">Manual config</div>
        <div class="text-green-400 text-center">Zero config</div>

        <div class="text-slate-400">Cost for 1 agent</div>
        <div class="text-slate-300 text-center">$10–$15/yr + provider</div>
        <div class="text-green-400 text-center">$1/month</div>

        <div class="text-slate-400">Inbound & webhooks</div>
        <div class="text-slate-300 text-center">Build your own parser</div>
        <div class="text-green-400 text-center">Included (JSON API)</div>

        <div class="text-slate-400">Deliverability warmup</div>
        <div class="text-slate-300 text-center">Cold start (days/weeks)</div>
        <div class="text-green-400 text-center">Established reputation</div>
      </div>
    </div>
  </div>
);

export { Pricing };
