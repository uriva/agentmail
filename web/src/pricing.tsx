import { KARMA_AMOUNTS, signupKarma } from "../../src/karma-constants.ts";

const signupAccounts = Math.floor(
  signupKarma / Math.abs(KARMA_AMOUNTS.account_created),
);
const packAccounts = Math.floor(
  KARMA_AMOUNTS.money_paid / Math.abs(KARMA_AMOUNTS.account_created),
);

const Pricing = () => (
  <div class="max-w-3xl mx-auto">
    <h1 class="text-3xl font-bold text-white mb-4 text-center">Pricing</h1>
    <p class="text-slate-400 text-center mb-10 max-w-xl mx-auto">
      No subscriptions. No monthly limits. Pay for karma, use it whenever.
    </p>
    <div class="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
      <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-8">
        <div class="text-slate-400 text-sm uppercase tracking-wide mb-2">
          Free
        </div>
        <div class="text-4xl font-bold text-white mb-1">$0</div>
        <div class="text-slate-500 text-sm mb-6">to get started</div>
        <ul class="text-slate-300 text-sm space-y-3">
          <li>{signupKarma} karma on signup</li>
          <li>
            {signupAccounts} email account{signupAccounts === 1 ? "" : "s"}
          </li>
          <li>{signupKarma} sends</li>
          <li>Full API access</li>
          <li>Webhooks</li>
          <li>No time limit</li>
        </ul>
      </div>
      <div class="bg-slate-800/50 border border-blue-600 rounded-xl p-8">
        <div class="text-blue-400 text-sm uppercase tracking-wide mb-2">
          Karma packs
        </div>
        <div class="text-4xl font-bold text-white mb-1">$5</div>
        <div class="text-slate-500 text-sm mb-6">
          per {KARMA_AMOUNTS.money_paid} karma
        </div>
        <ul class="text-slate-300 text-sm space-y-3">
          <li>
            {KARMA_AMOUNTS.money_paid} sends or {packAccounts} accounts per pack
          </li>
          <li>Buy as many as you need</li>
          <li>Karma never expires</li>
          <li>Real-time AI reputation protection</li>
          <li>No inbox limits</li>
          <li>No monthly caps</li>
        </ul>
        <p class="text-slate-400 text-xs mt-6">
          To buy karma, email{" "}
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
        vs. the competition
      </h3>
      <div class="grid grid-cols-3 gap-4 text-sm">
        <div class="text-slate-500" />
        <div class="text-slate-400 text-center font-medium">Others</div>
        <div class="text-blue-400 text-center font-medium">AgentMail</div>

        <div class="text-slate-400">10 inboxes</div>
        <div class="text-slate-300 text-center">$20/mo</div>
        <div class="text-green-400 text-center">$5 once</div>

        <div class="text-slate-400">150 inboxes</div>
        <div class="text-slate-300 text-center">$200/mo</div>
        <div class="text-green-400 text-center">$75 once</div>

        <div class="text-slate-400">Monthly caps</div>
        <div class="text-slate-300 text-center">Yes</div>
        <div class="text-green-400 text-center">No</div>

        <div class="text-slate-400">Karma never expires</div>
        <div class="text-slate-300 text-center">N/A</div>
        <div class="text-green-400 text-center">Yes</div>

        <div class="text-slate-400">AI spam & phishing filter</div>
        <div class="text-slate-300 text-center">No</div>
        <div class="text-green-400 text-center">Yes</div>
      </div>
    </div>
  </div>
);

export { Pricing };
