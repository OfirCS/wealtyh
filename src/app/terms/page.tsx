import type { Metadata } from 'next';
import LegalPage from '@/components/landing/LegalPage';

export const metadata: Metadata = { title: 'Terms — Pathfinder' };

export default function TermsPage() {
  return (
    <LegalPage title="Terms" updated="November 5, 2026">
      <p>By using Pathfinder you agree to these terms.</p>

      <h2>What it is</h2>
      <p>Pathfinder sorts your spending and helps you plan. It&rsquo;s for information only. It isn&rsquo;t financial, tax or legal advice, and it isn&rsquo;t a bank. Check anything important before you act on it.</p>

      <h2>What it can get wrong</h2>
      <p>The agent reads receipts and bank data automatically, and it can make mistakes: a wrong category, a missed purchase, a date that&rsquo;s off. Deadlines it shows are a helpful reminder, not a guarantee. The store&rsquo;s or bank&rsquo;s own records always win.</p>

      <h2>Your account</h2>
      <p>Connect only accounts that are yours, or that you have permission to use. Keep your sign-in safe. Don&rsquo;t try to break, overload or copy the service.</p>

      <h2>Plans and payment</h2>
      <p>The Free plan stays free. Family renews until you cancel, and you can cancel at any time. It then runs to the end of the period you paid for. Prices are in Canadian dollars.</p>

      <h2>Changes and ending</h2>
      <p>We may change the service or these terms, and we&rsquo;ll say so here. You can stop at any time. We may close an account that abuses the service.</p>

      <h2>Liability</h2>
      <p>The service is provided as it is. As far as the law allows, we aren&rsquo;t liable for losses from relying on it, and our total liability is limited to what you paid us in the last 12 months. Ontario law applies.</p>
    </LegalPage>
  );
}
