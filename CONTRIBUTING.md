# Contributing to OpenShield

Thank you for helping make online terms and checkout interfaces more transparent for everyday consumers.

## Principles for Rule Contributions

1. **Evidence First**: Every detection rule in `shared/rules/clause-rules.ts` and `extension/constants.js` must match specific, contextual contractual or dark-pattern phrasing rather than single generic words.
2. **Prevent False Positives**: Always include `negativePatterns` for consumer-friendly disclosures (for example, ensuring *"This plan never auto-renews"* or *"We never sell your personal information"* does not trigger a warning).
3. **Neutral, Non-Defamatory Explanations**: Explain what a clause or pattern means in plain English without labeling a business a "scam" or making legal verdicts.
4. **Unit Tests Required**: Every new or updated rule must include both a positive match test and a false-positive exclusion test in `tests/rules/engine.test.ts` or `tests/extension/scanner.test.ts`.

## Development Workflow

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the unit test suite:
   ```bash
   npm test
   ```
3. Verify TypeScript compilation:
   ```bash
   npm run lint
   ```
4. Start the local development server on port 3000:
   ```bash
   npm run dev
   ```
