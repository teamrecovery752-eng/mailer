export interface MarketingTemplate {
  id: string;
  name: string;
  description: string;
  subject: string;
  html: string;
  text: string;
}

const htmlShell = (bodyInner: string, buttonLabel: string, accent = "#6366f1") => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:40px 20px}
.card{background:#fff;border-radius:12px;padding:40px;max-width:560px;margin:0 auto}
h1{color:#111;font-size:22px;margin-bottom:16px}
p{color:#555;line-height:1.7;margin-bottom:16px}
.btn{display:inline-block;background:${accent};color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700}
.footer{text-align:center;margin-top:32px;font-size:12px;color:#999}
</style></head>
<body><div class="card">
${bodyInner}
<a href="https://recoverlance.com/contact" class="btn">${buttonLabel}</a>
<div class="footer">Recoverlance · 2300 Stockton St, San Francisco, CA 94133<br>
<a href="https://recoverlance.com/contact" style="color:#999">Reply STOP to unsubscribe</a></div>
</div></body></html>`;

export const marketingTemplates: MarketingTemplate[] = [
  {
    id: "free-assessment",
    name: "Free Case Assessment",
    description: "General cold outreach inviting a lead to submit their case for a free, confidential review.",
    subject: "Lost or stolen crypto? Get a free case assessment",
    html: htmlShell(
      `<h1>Hi {{name}},</h1>
<p>If you've lost access to a crypto wallet, misplaced a password, or sent funds to a scam, you're not out of options yet.</p>
<p>Recoverlance uses blockchain forensics to trace and recover digital assets — we've helped over 3,240 clients so far. Every case starts with a free, no-obligation assessment so you know exactly where you stand before committing to anything.</p>`,
      "Submit a Free Case Assessment"
    ),
    text: `Hi {{name}},

If you've lost access to a crypto wallet, misplaced a password, or sent funds to a scam, you're not out of options yet.

Recoverlance uses blockchain forensics to trace and recover digital assets — we've helped over 3,240 clients so far. Every case starts with a free, no-obligation assessment so you know exactly where you stand before committing to anything.

Submit your case for a free assessment:
https://recoverlance.com/contact

—
Recoverlance
2300 Stockton St, San Francisco, CA 94133
Reply STOP to unsubscribe`,
  },
  {
    id: "scam-recovery",
    name: "Investment Scam Recovery",
    description: "Targets leads who lost funds to a fake investment platform, exchange, or 'advisor.'",
    subject: "Sent crypto to a fake investment platform? Here's what to do next",
    html: htmlShell(
      `<h1>Hi {{name}},</h1>
<p>Fake trading platforms and "investment managers" that vanish with client funds are one of the most common ways people lose crypto — and one of the hardest losses to face alone.</p>
<p>Our team traces the movement of stolen funds across the blockchain and works to identify recovery paths, including exchange freezes where the funds have landed. It won't work in every case, but it costs nothing to find out where your case stands.</p>`,
      "Get My Free Scam Case Review",
      "#ef4444"
    ),
    text: `Hi {{name}},

Fake trading platforms and "investment managers" that vanish with client funds are one of the most common ways people lose crypto — and one of the hardest losses to face alone.

Our team traces the movement of stolen funds across the blockchain and works to identify recovery paths, including exchange freezes where the funds have landed. It won't work in every case, but it costs nothing to find out where your case stands.

Get a free scam case review:
https://recoverlance.com/contact

—
Recoverlance
2300 Stockton St, San Francisco, CA 94133
Reply STOP to unsubscribe`,
  },
  {
    id: "lost-wallet",
    name: "Lost Wallet Access",
    description: "For people locked out of their own wallet — forgotten password, damaged file, or incomplete seed phrase.",
    subject: "Locked out of your own crypto wallet?",
    html: htmlShell(
      `<h1>Hi {{name}},</h1>
<p>Forgotten a wallet password, lost part of your seed phrase, or found an old wallet file you can no longer open? You may still be able to get back in.</p>
<p>Recoverlance specialises in exactly this — rebuilding access from partial information, corrupted files, and old backups. No custody of your funds ever changes hands during the process.</p>`,
      "Check If My Wallet Can Be Recovered",
      "#22c55e"
    ),
    text: `Hi {{name}},

Forgotten a wallet password, lost part of your seed phrase, or found an old wallet file you can no longer open? You may still be able to get back in.

Recoverlance specialises in exactly this — rebuilding access from partial information, corrupted files, and old backups. No custody of your funds ever changes hands during the process.

Check if your wallet can be recovered:
https://recoverlance.com/contact

—
Recoverlance
2300 Stockton St, San Francisco, CA 94133
Reply STOP to unsubscribe`,
  },
  {
    id: "trust-builder",
    name: "Success Stories & Trust Builder",
    description: "Social-proof email leaning on track record and success rate to move undecided leads forward.",
    subject: "3,240+ clients recovered — see how it works",
    html: htmlShell(
      `<h1>Hi {{name}},</h1>
<p>We know crypto recovery services can be hard to trust — the space has its share of bad actors. Here's our approach: a documented 93% success rate on cases we take on, blockchain forensics you can follow step by step, and a free assessment before you commit to anything.</p>
<p>If you've been sitting on a lost or stolen crypto case, it costs nothing to find out whether it's recoverable.</p>`,
      "See If Your Case Qualifies"
    ),
    text: `Hi {{name}},

We know crypto recovery services can be hard to trust — the space has its share of bad actors. Here's our approach: a documented 93% success rate on cases we take on, blockchain forensics you can follow step by step, and a free assessment before you commit to anything.

If you've been sitting on a lost or stolen crypto case, it costs nothing to find out whether it's recoverable.

See if your case qualifies:
https://recoverlance.com/contact

—
Recoverlance
2300 Stockton St, San Francisco, CA 94133
Reply STOP to unsubscribe`,
  },
  {
    id: "follow-up",
    name: "Follow-Up / Re-Engagement",
    description: "Re-engages a lead who started an inquiry (or was contacted before) but hasn't followed through.",
    subject: "Following up on your crypto recovery case",
    html: htmlShell(
      `<h1>Hi {{name}},</h1>
<p>Just checking in — we know reaching out about lost or stolen crypto isn't easy, and it's normal to sit on it for a while.</p>
<p>One thing worth knowing: the longer stolen funds sit untouched, the harder they can be to trace as they move across wallets and exchanges. If you'd still like a free look at your case, we're here whenever you're ready.</p>`,
      "Continue My Case Assessment",
      "#f59e0b"
    ),
    text: `Hi {{name}},

Just checking in — we know reaching out about lost or stolen crypto isn't easy, and it's normal to sit on it for a while.

One thing worth knowing: the longer stolen funds sit untouched, the harder they can be to trace as they move across wallets and exchanges. If you'd still like a free look at your case, we're here whenever you're ready.

Continue your case assessment:
https://recoverlance.com/contact

—
Recoverlance
2300 Stockton St, San Francisco, CA 94133
Reply STOP to unsubscribe`,
  },
];
