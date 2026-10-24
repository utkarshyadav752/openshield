/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * Realistic Consumer Policy Presets for Deterministic Verification & Testing
 * Every sample contains authentic contractual clauses so users can inspect
 * how OpenShield detects hidden fees, auto-renewals, arbitration, India INR e-mandate terms, and dark patterns.
 */

export interface SamplePolicyPreset {
  id: string;
  name: string;
  url: string;
  domain: string;
  badge: string;
  description: string;
  htmlContent: string;
}

export const SAMPLE_POLICY_PRESETS: SamplePolicyPreset[] = [
  {
    id: 'streamplus-tos',
    name: 'StreamPlus Media — Subscription & Terms of Use',
    url: 'https://www.netflix.com/legal/termsofuse',
    domain: 'netflix.com',
    badge: 'Streaming & Auto-Renewal',
    description:
      'Includes trial-to-paid conversion, automatic monthly renewal ($24.99/mo), non-refundable partial billing periods, binding arbitration, and class-action waiver.',
    htmlContent: `
      <!doctype html>
      <html>
      <head><title>StreamPlus Media — Terms of Use & Subscription Agreement</title></head>
      <body>
        <h1>StreamPlus Subscription Terms of Use</h1>
        <h2>1. Free Trials and Introductory Offers</h2>
        <p>Your 7-day free trial automatically converts to a paid monthly subscription of $24.99 without further notice unless you cancel at least 24 hours before the trial period expires. Canceling during the trial period immediately terminates your trial access.</p>
        <h2>2. Automatic Renewal and Billing</h2>
        <p>Unless you notify us at least 30 days before the end of the current billing period, your subscription will automatically renew for successive 12-month terms at the then-current non-promotional rate. All payments and subscription fees are final and non-refundable, and there are no refunds or credits for partial or unused subscription periods.</p>
        <h2>3. Mandatory Binding Arbitration and Class Action Waiver</h2>
        <p>You and Company agree that any dispute, claim, or controversy arising out of or relating to these Terms shall be resolved exclusively through final and binding individual arbitration administered by the American Arbitration Association, and you waive your constitutional and statutory rights to go to court and have a trial in front of a judge or a jury. You agree to bring claims only in your individual capacity, and not as a plaintiff or class member in any purported class, collective, or representative proceeding.</p>
        <h2>4. Privacy & Advertising Partners</h2>
        <p>We may disclose personal identifiers and browsing activity to advertising networks and commercial partners for cross-context behavioral advertising and combine your data with offline records acquired from data brokers.</p>
        <footer>
          <a href="https://www.netflix.com/cancelplan">Cancel Subscription</a>
          <a href="https://help.netflix.com/legal/privacy">Privacy Policy</a>
          <a href="https://help.netflix.com/legal/termsofuse">Terms of Use</a>
        </footer>
      </body>
      </html>
    `,
  },
  {
    id: 'streambharat-inr',
    name: 'StreamBharat OTT & EdTech Pass — India INR Auto-Pay Terms',
    url: 'https://www.streambharat.in/legal/subscription-terms',
    domain: 'streambharat.in',
    badge: 'India ₹999/mo & Dark Patterns',
    description:
      'Demonstrates ₹999/month recurring subscription, 7-day free trial conversion, ₹250 processing fee, preselected ₹199 add-on, and non-refundable cancellation restrictions.',
    htmlContent: `
      <!doctype html>
      <html>
      <head><title>StreamBharat Pro — Subscription, Auto-Debit & Consumer Terms (India)</title></head>
      <body>
        <h1>StreamBharat Pro — Terms of Subscription & Billing</h1>
        <h2>1. Introductory Trial and Monthly Auto-Debit</h2>
        <p>Your 7-day free trial automatically converts to a paid monthly subscription of ₹999 per month unless you cancel at least 48 hours before the trial period expires. Unless you cancel before your renewal date, your subscription will automatically renew each month via your registered UPI AutoPay or card mandate.</p>
        <h2>2. Processing Fees and Preselected Add-Ons</h2>
        <p>Advertised plan prices exclude a mandatory non-refundable processing fee of ₹250 charged at initial activation. Priority exam mentor protection (₹199) has been automatically added to your cart; uncheck this box if you do not wish to purchase the optional add-on.</p>
        <h2>3. Cancellation & Refund Policy</h2>
        <p>All payments and subscription fees are final and non-refundable, and there are no refunds or credits for partial or unused subscription periods. Cancellation requests must be submitted by calling our customer retention desk during standard weekday hours.</p>
        <h2>4. Dispute Resolution & Governing Law</h2>
        <p>Any dispute or claim arising out of these Terms shall be resolved exclusively through final and binding individual arbitration, and you waive any right to participate in a class or representative action. We may share personal identifiers and usage telemetry with third-party advertising networks and marketing partners.</p>
        <footer>
          <a href="https://www.streambharat.in/account/cancel">Cancel Subscription</a>
          <a href="https://www.streambharat.in/legal/privacy">Privacy Policy</a>
          <a href="https://www.streambharat.in/legal/refunds">Refund Policy</a>
        </footer>
      </body>
      </html>
    `,
  },
  {
    id: 'adobe-creative-plan',
    name: 'CreativePro Cloud — Annual Plan Billed Monthly',
    url: 'https://www.adobe.com/legal/subscription-terms.html',
    domain: 'adobe.com',
    badge: 'Early Termination Fee',
    description:
      'Demonstrates annual lock-in billed monthly with a 50% early cancellation penalty and broad perpetual content licensing.',
    htmlContent: `
      <!doctype html>
      <html>
      <head><title>CreativePro Cloud — Subscription & Cancellation Terms</title></head>
      <body>
        <h1>Subscription and Cancellation Terms</h1>
        <h2>Section 1: Annual Contract Billed Monthly</h2>
        <p>Your subscription of $59.99 per month will continue to renew automatically on your annual anniversary date until you cancel. Should you cancel after 14 days, you will be charged 50% of your remaining contract obligation as a non-refundable early termination fee of 50%.</p>
        <h2>Section 2: User Content & AI Training License</h2>
        <p>By uploading files to the service, you grant us an irrevocable, perpetual, worldwide, royalty-free, sublicensable license to use, reproduce, modify, adapt, publish, monetize, and train artificial intelligence models on your content. You waive all moral rights in uploaded content in perpetuity.</p>
        <h2>Section 3: Account Deactivation vs. Deletion</h2>
        <p>Deactivating your account does not stop recurring subscription billing. To delete your account, you must submit a notarized affidavit by postal mail to our legal compliance department.</p>
        <footer>
          <a href="https://account.adobe.com/plans">Manage or Cancel Plan</a>
          <a href="https://www.adobe.com/privacy.html">Privacy Notice</a>
        </footer>
      </body>
      </html>
    `,
  },
  {
    id: 'flashcart-checkout',
    name: 'FlashCart Express — Checkout & Promotional Terms',
    url: 'https://www.amazon.com/gp/help/customer/display.html',
    domain: 'amazon.com',
    badge: 'Drip Pricing & Dark Patterns',
    description:
      'Demonstrates drip pricing service fees, preselected warranty add-ons, countdown scarcity pressure, and confirm-shaming.',
    htmlContent: `
      <!doctype html>
      <html>
      <head><title>FlashCart Express — Checkout Terms & VIP Bundle</title></head>
      <body>
        <h1>Order Summary & Promotional Terms</h1>
        <h2>1. Pricing, Surcharges, and Drip Fees</h2>
        <p>Advertised item prices exclude mandatory service fees; a non-refundable processing fee and a surcharge of 14% will be assessed at final billing. Returns are subject to an administrative fee of $19.95.</p>
        <h2>2. Optional VIP Protection & Preselected Add-ons</h2>
        <p>Shipping protection ($6.99) has been automatically added to your bag. Uncheck this box if you do not wish to purchase the optional $14.99 VIP protection plan. Auto-renewal is enabled by default for VIP Club perks.</p>
        <h2>3. Promotional Urgency & Opt-Out</h2>
        <p>Offer expires in 04:59 — act now! Only 2 left at this price — 38 people have this in their cart right now. To decline VIP membership, click "No thanks, I prefer paying full price and accept full financial risk."</p>
      </body>
      </html>
    `,
  },
];
