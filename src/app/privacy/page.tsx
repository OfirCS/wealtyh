import type { Metadata } from 'next';
import LegalPage from '@/components/landing/LegalPage';

export const metadata: Metadata = { title: 'Privacy — Pathfinder' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="November 5, 2026">
      <p>Pathfinder is read-only. It can&rsquo;t move your money, and it never sees your bank password.</p>

      <h2>What it reads, and only if you connect it</h2>
      <ul>
        <li><strong>Gmail.</strong> Google&rsquo;s permission covers your inbox. Pathfinder searches it for receipts, refunds, free trials and bank alerts, and opens only those. It doesn&rsquo;t change, send or delete mail.</li>
        <li><strong>Your bank and cards.</strong> Through Plaid, which handles your login. Pathfinder receives transactions and account names.</li>
        <li><strong>Apple Wallet.</strong> Your iPhone sends the amount and store for each tap, through an automation you set up and can turn off.</li>
        <li><strong>Statements.</strong> A CSV is read in your browser. A PDF or a photo goes to our AI provider to be read.</li>
      </ul>

      <h2>Where it goes</h2>
      <ul>
        <li>Your budget is saved in your browser and, encrypted, on our server so it can reach your devices. Bank and Wallet purchases are kept there too.</li>
        <li>Email text passes through our server to Anthropic, which reads it with Claude and returns the purchases. We don&rsquo;t keep that text.</li>
        <li>When Pathfinder sorts a store, spots a one-time purchase, answers a question or makes a plan, the purchases or numbers involved go to Anthropic the same way.</li>
        <li>Bank tokens are stored encrypted. Plaid, Anthropic and our hosting provider Netlify each handle data only to run this service.</li>
      </ul>

      <h2>What we never do</h2>
      <ul>
        <li>We don&rsquo;t sell your data or show ads.</li>
        <li>We don&rsquo;t use your data to train AI.</li>
        <li>We don&rsquo;t let people read your data, unless you ask us to help or the law requires it.</li>
      </ul>

      <h2>Google data</h2>
      <p>Pathfinder&rsquo;s use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>, including its Limited Use requirements.</p>

      <h2>Your choices</h2>
      <ul>
        <li>Signing out clears everything from that browser.</li>
        <li>Disconnect a bank in Accounts. That revokes our access to it.</li>
        <li>Remove Gmail access at any time in your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">Google account</a>.</li>
        <li>Ask us to delete what&rsquo;s on our server and we will. Canadian privacy law (PIPEDA) gives you the right to see it, too.</li>
      </ul>
    </LegalPage>
  );
}
