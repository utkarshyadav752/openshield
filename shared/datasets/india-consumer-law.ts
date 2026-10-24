/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield India-First Consumer Intelligence & Hindi Localization Dataset
 * Provides verifiable Indian statutory/regulatory references (Consumer Protection Act 2019,
 * CCPA Dark Patterns Guidelines 2023, RBI e-Mandate Framework, DPDP Act 2023)
 * and Hindi translations for explanations and recommendations while keeping
 * original contractual quotations strictly untouched.
 */

import { ClauseCategory } from '../schemas/analysis';

export type SupportedLanguage = 'en' | 'hi';

export interface IndiaLegalReference {
  statuteName: string;
  provision: string;
  relevanceSummary: string;
  relevanceSummaryHi: string;
  officialSourceUrl: string;
  lastVerified: string;
  isStatutoryRequirement: boolean;
  uncertaintyNote: string;
}

export interface HindiClauseTranslation {
  titleHi: string;
  explanationHi: string;
  whyItMattersHi: string;
  whatRemainsUnclearHi: string;
  whatToCheckHi: string;
}

export const INDIA_LEGAL_REFERENCES: Record<ClauseCategory, IndiaLegalReference> = {
  [ClauseCategory.HIDDEN_FEES]: {
    statuteName: 'CCPA Guidelines for Prevention and Regulation of Dark Patterns, 2023',
    provision: 'Annexure 1, Clause 5 (Drip Pricing)',
    relevanceSummary:
      'Indian consumer protection guidelines define "Drip Pricing" as a dark pattern where elements of cost are not revealed upfront or are disclosed only at final checkout.',
    relevanceSummaryHi:
      'भारतीय उपभोक्ता संरक्षण दिशानिर्देश (CCPA 2023) "ड्रिप प्राइसिंग" को एक डार्क पैटर्न मानते हैं जहाँ अतिरिक्त शुल्क शुरू में छिपाए जाते हैं और केवल अंतिम भुगतान के समय दिखाए जाते हैं।',
    officialSourceUrl: 'https://consumeraffairs.nic.in',
    lastVerified: '2025-02-15',
    isStatutoryRequirement: true,
    uncertaintyNote:
      'Applicability depends on whether the platform offers goods or services to consumers in India and whether the fee was genuinely optional or disclosed upfront.',
  },
  [ClauseCategory.AUTO_RENEWAL]: {
    statuteName: 'RBI Framework for Processing of e-Mandates for Recurring Online Transactions & CCPA 2023',
    provision: 'RBI Circular CO.DPSS.POLC.No.S-518 / CCPA Annexure 1 Clause 7 (Subscription Trap)',
    relevanceSummary:
      'For Indian cards, UPI AutoPay, and bank mandates, RBI guidelines require a pre-debit notification at least 24 hours prior to the actual charge and an online facility to withdraw or cancel the recurring mandate.',
    relevanceSummaryHi:
      'भारतीय कार्ड और UPI ऑटो-पे (AutoPay) के लिए, RBI नियमों के अनुसार शुल्क कटने से कम से कम 24 घंटे पहले पूर्व-सूचना (pre-debit notification) भेजना और ऑनलाइन मैंडेट रद्द करने की सुविधा देना आवश्यक है।',
    officialSourceUrl: 'https://www.rbi.org.in',
    lastVerified: '2025-02-15',
    isStatutoryRequirement: true,
    uncertaintyNote:
      'Applies to recurring payment instruments issued by RBI-regulated entities in India; international payment processors may follow different regional rules.',
  },
  [ClauseCategory.CANCELLATION_RESTRICTIONS]: {
    statuteName: 'CCPA Guidelines for Prevention and Regulation of Dark Patterns, 2023',
    provision: 'Annexure 1, Clause 7 (Subscription Trap)',
    relevanceSummary:
      'Making cancellation impossible, complex, or significantly more cumbersome than the sign-up process is classified as a "Subscription Trap" under Indian dark-pattern regulations.',
    relevanceSummaryHi:
      'सदस्यता रद्द करने की प्रक्रिया को साइन-अप की तुलना में जटिल, लंबा या कठिन बनाना भारतीय डार्क पैटर्न नियमों (CCPA 2023) के तहत "सब्सक्रिप्शन ट्रैप" माना जाता है।',
    officialSourceUrl: 'https://consumeraffairs.nic.in',
    lastVerified: '2025-02-15',
    isStatutoryRequirement: true,
    uncertaintyNote:
      'Whether a specific notice window or cancellation procedure is unfair depends on the nature of the contract and jurisdiction.',
  },
  [ClauseCategory.NON_REFUNDABLE]: {
    statuteName: 'Consumer Protection Act, 2019 (India)',
    provision: 'Section 2(46) (Unfair Contract) & Section 2(47) (Unfair Trade Practice)',
    relevanceSummary:
      'Blanket "no refund under any circumstances" terms may be scrutinized under Section 2(46) if they impose disproportionate penalties or refuse refunds even for deficient services.',
    relevanceSummaryHi:
      'उपभोक्ता संरक्षण अधिनियम, 2019 की धारा 2(46) के अंतर्गत ऐसे एकतरफा अनुबंधों की समीक्षा की जा सकती है जो दोषपूर्ण सेवा होने पर भी किसी भी प्रकार के रिफंड से पूरी तरह इनकार करते हैं।',
    officialSourceUrl: 'https://consumeraffairs.nic.in',
    lastVerified: '2025-02-15',
    isStatutoryRequirement: false,
    uncertaintyNote:
      'Non-refundable terms for validly delivered digital goods or custom services may still be enforceable unless deficiency in service is established.',
  },
  [ClauseCategory.FORCED_ARBITRATION]: {
    statuteName: 'Consumer Protection Act, 2019 & Arbitration and Conciliation Act, 1996 (India)',
    provision: 'Section 34 & Section 100 of the Consumer Protection Act, 2019',
    relevanceSummary:
      'Supreme Court of India precedents (such as Emaar MGF Land Ltd v. Aftab Singh) hold that remedies under the Consumer Protection Act are additional to general law, allowing consumers in India to approach Consumer Commissions despite standard-form arbitration clauses.',
    relevanceSummaryHi:
      'भारत के सर्वोच्च न्यायालय के निर्णयों के अनुसार, मानक अनुबंधों में मध्यस्थता (Arbitration) की शर्त होने के बावजूद उपभोक्ता अक्सर उपभोक्ता आयोग (Consumer Commission) में शिकायत दर्ज कर सकते हैं।',
    officialSourceUrl: 'https://consumeraffairs.nic.in',
    lastVerified: '2025-02-15',
    isStatutoryRequirement: false,
    uncertaintyNote:
      'Jurisdictional applicability depends on where the consumer resides and whether the transaction falls within the Consumer Protection Act, 2019.',
  },
  [ClauseCategory.CLASS_ACTION_WAIVER]: {
    statuteName: 'Consumer Protection Act, 2019 (India)',
    provision: 'Section 2(5)(v) & Section 35(1)(c) (Class / Representative Consumer Complaints)',
    relevanceSummary:
      'Section 35(1)(c) of the Consumer Protection Act, 2019 permits one or more consumers having the same interest to file a representative complaint before a Consumer Commission with permission.',
    relevanceSummaryHi:
      'उपभोक्ता संरक्षण अधिनियम, 2019 की धारा 35(1)(c) समान हित वाले एक या अधिक उपभोक्ताओं को सामूहिक शिकायत दर्ज करने की अनुमति देती है।',
    officialSourceUrl: 'https://consumeraffairs.nic.in',
    lastVerified: '2025-02-15',
    isStatutoryRequirement: false,
    uncertaintyNote:
      'Enforceability of contractual waivers against statutory representative complaints depends on forum jurisdiction.',
  },
  [ClauseCategory.DATA_SHARING]: {
    statuteName: 'Digital Personal Data Protection Act, 2023 (DPDP Act, India)',
    provision: 'Section 6 (Consent) & Section 11 (Rights of Data Principal)',
    relevanceSummary:
      'Under the DPDP Act, 2023, consent for processing personal data must be free, specific, informed, unconditional, and unambiguous, and Data Principals have the right to withdraw consent as easily as it was given.',
    relevanceSummaryHi:
      'डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम, 2023 (DPDP Act) की धारा 6 के अनुसार, व्यक्तिगत डेटा के उपयोग के लिए सहमति स्पष्ट, सूचित और स्वतंत्र होनी चाहिए, तथा उपयोगकर्ता को सहमति वापस लेने का सरल अधिकार होना चाहिए।',
    officialSourceUrl: 'https://www.meity.gov.in',
    lastVerified: '2025-02-15',
    isStatutoryRequirement: true,
    uncertaintyNote:
      'Specific compliance timelines and rulemaking notifications under the DPDP Act depend on phased government implementation.',
  },
  [ClauseCategory.CONTENT_LICENSE]: {
    statuteName: 'Copyright Act, 1957 & Consumer Protection Act, 2019 (India)',
    provision: 'Section 19 & Section 57 (Author’s Special Rights / Moral Rights)',
    relevanceSummary:
      'Under Section 57 of the Indian Copyright Act, 1957, authors retain statutory moral rights regarding paternity and integrity of their work, and broad perpetual assignments in boilerplate consumer terms merit careful scrutiny.',
    relevanceSummaryHi:
      'भारतीय कॉपीराइट अधिनियम, 1957 की धारा 57 के तहत रचनाकार के नैतिक अधिकार संरक्षित हैं; मानक शर्तों में स्थायी व्यावसायिक लाइसेंस की सावधानीपूर्वक समीक्षा करें।',
    officialSourceUrl: 'https://copyright.gov.in',
    lastVerified: '2025-02-15',
    isStatutoryRequirement: false,
    uncertaintyNote:
      'Scope of platform licenses depends on whether content is uploaded publicly or stored privately.',
  },
  [ClauseCategory.PRESELECTED_ADDONS]: {
    statuteName: 'CCPA Guidelines for Prevention and Regulation of Dark Patterns, 2023',
    provision: 'Annexure 1, Clause 2 (Basket Sneaking)',
    relevanceSummary:
      'Automatically including additional paid items, warranties, or donations at checkout without explicit opt-in consent is defined as "Basket Sneaking" under CCPA guidelines.',
    relevanceSummaryHi:
      'उपभोक्ता की स्पष्ट सहमति के बिना कार्ट या चेकआउट में अतिरिक्त सशुल्क सेवाएँ या वारंटी पहले से जोड़ देना CCPA 2023 दिशानिर्देशों के तहत "बास्केट स्नीकिंग" कहलाता है।',
    officialSourceUrl: 'https://consumeraffairs.nic.in',
    lastVerified: '2025-02-15',
    isStatutoryRequirement: true,
    uncertaintyNote:
      'Applies to e-commerce entities and sellers operating in or targeting consumers in India.',
  },
  [ClauseCategory.COUNTDOWN_SCARCITY]: {
    statuteName: 'CCPA Guidelines for Prevention and Regulation of Dark Patterns, 2023',
    provision: 'Annexure 1, Clause 1 (False Urgency)',
    relevanceSummary:
      'Falsely stating or implying sense of urgency or scarcity (such as fake countdown timers or misleading low-stock alerts) to mislead a user into making an immediate purchase is prohibited as "False Urgency".',
    relevanceSummaryHi:
      'ग्राहक पर तुरंत खरीदारी का दबाव बनाने के लिए भ्रामक काउंटडाउन टाइमर या झूठी स्टॉक की कमी दिखाना CCPA 2023 के तहत "फॉल्स अर्जेंसी" (False Urgency) माना जाता है।',
    officialSourceUrl: 'https://consumeraffairs.nic.in',
    lastVerified: '2025-02-15',
    isStatutoryRequirement: true,
    uncertaintyNote:
      'A countdown timer is only a dark pattern if the deadline or scarcity claim is artificial or resets repeatedly.',
  },
  [ClauseCategory.CONFIRM_SHAMING]: {
    statuteName: 'CCPA Guidelines for Prevention and Regulation of Dark Patterns, 2023',
    provision: 'Annexure 1, Clause 3 (Confirm Shaming) & Clause 6 (Interface Interference)',
    relevanceSummary:
      'Using phrasing that creates fear, shame, or guilt to nudge a user into opting in—or visually obscuring the reject option—is classified under Confirm Shaming and Interface Interference.',
    relevanceSummaryHi:
      'ऑफर अस्वीकार करने वाले विकल्प में अपराधबोध या शर्मिंदगी पैदा करने वाली भाषा का प्रयोग करना CCPA 2023 दिशानिर्देशों के अंतर्गत "कन्फर्म शेमिंग" है।',
    officialSourceUrl: 'https://consumeraffairs.nic.in',
    lastVerified: '2025-02-15',
    isStatutoryRequirement: true,
    uncertaintyNote:
      'Evaluated based on the specific wording and visual prominence of consent choices.',
  },
  [ClauseCategory.TRIAL_CONVERSION]: {
    statuteName: 'CCPA Guidelines for Dark Patterns, 2023 & RBI e-Mandate Rules',
    provision: 'Annexure 1, Clause 4 (Forced Action / Subscription Trap)',
    relevanceSummary:
      'Converting a free trial into a paid subscription silently without clear upfront disclosure and pre-debit notice warrants careful review under Indian subscription and payment rules.',
    relevanceSummaryHi:
      'स्पष्ट पूर्व-सूचना के बिना फ्री ट्रायल को अपने-आप सशुल्क सदस्यता में बदलना भारतीय भुगतान और उपभोक्ता नियमों के तहत विशेष ध्यान देने योग्य है।',
    officialSourceUrl: 'https://consumeraffairs.nic.in',
    lastVerified: '2025-02-15',
    isStatutoryRequirement: true,
    uncertaintyNote:
      'Check whether your payment method (UPI AutoPay or card) shows an active recurring mandate limit.',
  },
  [ClauseCategory.UNILATERAL_CHANGES]: {
    statuteName: 'Consumer Protection Act, 2019 (India)',
    provision: 'Section 2(46)(v) — Unfair Contract (Unilateral Modification)',
    relevanceSummary:
      'Section 2(46) of the Consumer Protection Act, 2019 identifies terms that permit one party to unilaterally alter a contract without reasonable cause or advance notice as a factor in evaluating unfair contracts.',
    relevanceSummaryHi:
      'उपभोक्ता संरक्षण अधिनियम, 2019 की धारा 2(46) के तहत बिना पूर्व सूचना के एकतरफा शर्तें या कीमतें बदलने के अधिकार को अनुचित अनुबंध (Unfair Contract) के आकलन में देखा जाता है।',
    officialSourceUrl: 'https://consumeraffairs.nic.in',
    lastVerified: '2025-02-15',
    isStatutoryRequirement: false,
    uncertaintyNote:
      'Courts and commissions evaluate whether advance notice and a penalty-free exit option were provided.',
  },
  [ClauseCategory.LIABILITY_LIMITATIONS]: {
    statuteName: 'Consumer Protection Act, 2019 (India)',
    provision: 'Section 2(46) (Unfair Contract) & Section 2(11) (Deficiency in Service)',
    relevanceSummary:
      'Contractual clauses that cap liability at a token sum or disclaim responsibility for deficiency in service may be challenged before Consumer Commissions if they impose unreasonable disadvantage on consumers.',
    relevanceSummaryHi:
      'उपभोक्ता संरक्षण अधिनियम, 2019 के तहत सेवा में कमी (Deficiency in Service) की जिम्मेदारी को नाममात्र की राशि तक सीमित करने वाली शर्तों की समीक्षा की जा सकती है।',
    officialSourceUrl: 'https://consumeraffairs.nic.in',
    lastVerified: '2025-02-15',
    isStatutoryRequirement: false,
    uncertaintyNote:
      'Enforceability depends on whether the claim involves statutory deficiency in service or commercial business-to-business loss.',
  },
  [ClauseCategory.ACCOUNT_DELETION]: {
    statuteName: 'Digital Personal Data Protection Act, 2023 & CCPA Dark Patterns Guidelines, 2023',
    provision: 'DPDP Act Section 12 (Right to Correction and Erasure) & CCPA Subscription Trap',
    relevanceSummary:
      'Under the DPDP Act, 2023, Data Principals have the right to request erasure of personal data once the specified purpose is no longer served, and continuing to bill after account deactivation is a subscription trap risk.',
    relevanceSummaryHi:
      'DPDP अधिनियम, 2023 की धारा 12 के तहत उपयोगकर्ता को अपना व्यक्तिगत डेटा मिटाने (Erasure) का अनुरोध करने का अधिकार है।',
    officialSourceUrl: 'https://www.meity.gov.in',
    lastVerified: '2025-02-15',
    isStatutoryRequirement: true,
    uncertaintyNote:
      'Statutory record-keeping obligations (such as tax invoices) may permit limited archival retention even after account deletion.',
  },
  [ClauseCategory.DISPUTE_RESTRICTIONS]: {
    statuteName: 'Indian Contract Act, 1872 & Consumer Protection Act, 2019',
    provision: 'Section 28 of Indian Contract Act (Agreements in Restraint of Legal Proceedings) & CPA Section 34',
    relevanceSummary:
      'Section 28 of the Indian Contract Act renders void agreements that restrict a party from enforcing legal rights or shorten the statutory limitation period, and CPA 2019 allows consumers to file complaints where they reside or work.',
    relevanceSummaryHi:
      'भारतीय अनुबंध अधिनियम, 1872 की धारा 28 कानूनी कार्रवाई की समय-सीमा को कम करने वाले प्रावधानों को प्रतिबंधित करती है, और उपभोक्ता अपने निवास स्थान के आयोग में शिकायत दर्ज कर सकते हैं।',
    officialSourceUrl: 'https://consumeraffairs.nic.in',
    lastVerified: '2025-02-15',
    isStatutoryRequirement: true,
    uncertaintyNote:
      'Applies to contracts governed by Indian law or consumer transactions within Indian jurisdiction.',
  },
  [ClauseCategory.UNUSUAL_PENALTIES]: {
    statuteName: 'Indian Contract Act, 1872 & Consumer Protection Act, 2019',
    provision: 'Section 74 of Indian Contract Act (Compensation for Breach where Penalty Stipulated) & CPA Section 2(46)',
    relevanceSummary:
      'Under Section 74 of the Indian Contract Act, courts award only reasonable compensation not exceeding the stipulated penalty upon proof of actual loss, rather than enforcing punitive liquidated damages automatically.',
    relevanceSummaryHi:
      'भारतीय अनुबंध अधिनियम की धारा 74 के अनुसार, अनुचित दंड शुल्क (Liquidated Damages) स्वतः लागू नहीं होते; केवल वास्तविक और उचित नुकसान की ही भरपाई माननीय होती है।',
    officialSourceUrl: 'https://consumeraffairs.nic.in',
    lastVerified: '2025-02-15',
    isStatutoryRequirement: true,
    uncertaintyNote:
      'Non-disparagement and punitive penalty clauses in consumer form contracts face strict scrutiny under unfair-contract principles.',
  },
};

export const HINDI_CLAUSE_TRANSLATIONS: Record<ClauseCategory, HindiClauseTranslation> = {
  [ClauseCategory.HIDDEN_FEES]: {
    titleHi: 'छिपे हुए शुल्क और अतिरिक्त प्रभार (Hidden Fees)',
    explanationHi:
      'शर्तों में कहा गया है कि विज्ञापित मुख्य कीमत के अलावा अतिरिक्त सेवा शुल्क, प्रोसेसिंग शुल्क या प्रशासनिक शुल्क जोड़े जा सकते हैं।',
    whyItMattersHi:
      'अंतिम भुगतान के समय कुल कीमत बढ़ सकती है या रिफंड के समय प्रोसेसिंग शुल्क काटा जा सकता है।',
    whatRemainsUnclearHi:
      'यह स्पष्ट नहीं है कि चेकआउट के समय कर (Tax) और प्लेटफॉर्म शुल्क मिलाकर कुल अंतिम राशि कितनी होगी।',
    whatToCheckHi:
      'भुगतान करने से पहले अंतिम बिल (Itemized Total) की जाँच करें और देखें कि कौन-से शुल्क नॉन-रिफंडेबल हैं।',
  },
  [ClauseCategory.AUTO_RENEWAL]: {
    titleHi: 'स्वचालित सदस्यता नवीनीकरण (Automatic Subscription Renewal)',
    explanationHi:
      'आपकी सदस्यता तय समय पर अपने-आप नवीनीकृत (Auto-renew) हो जाएगी और आपके भुगतान माध्यम से शुल्क कटता रहेगा जब तक आप समय रहते इसे रद्द नहीं करते।',
    whyItMattersHi:
      'यदि आप तय समय-सीमा से पहले रद्द नहीं करते हैं, तो अगले महीने या वर्ष का पूरा शुल्क आपके खाते से कट सकता है।',
    whatRemainsUnclearHi:
      'नवीनीकरण के समय छूट समाप्त होने के बाद लागू होने वाली सटीक मानक दर (Standard Rate) इस वाक्य में स्पष्ट नहीं हो सकती।',
    whatToCheckHi:
      'नवीनीकरण की तारीख, अग्रिम नोटिस की समय-सीमा (जैसे 30 दिन पहले), और अपने UPI AutoPay / कार्ड मैंडेट सेटिंग्स की जाँच करें।',
  },
  [ClauseCategory.CANCELLATION_RESTRICTIONS]: {
    titleHi: 'कठिन रद्दीकरण और रिफंड प्रतिबंध (Cancellation & Refund Restrictions)',
    explanationHi:
      'यह नीति बचे हुए समय के रिफंड को रोकती है, समय से पहले रद्द करने पर जुर्माना लगाती है, या ऑनलाइन रद्द करने के बजाय कॉल/डाक भेजने की शर्त रखती है।',
    whyItMattersHi:
      'सेवा बंद करने या प्लान छोड़ने पर आपको भारी रद्दीकरण शुल्क देना पड़ सकता है या प्रीपेड राशि जब्त हो सकती है।',
    whatRemainsUnclearHi:
      'क्या खाता सेटिंग्स में एक-क्लिक ऑनलाइन रद्दीकरण बटन उपलब्ध है या केवल ग्राहक सेवा के माध्यम से ही रद्दीकरण संभव है।',
    whatToCheckHi:
      'साइन-अप करने से पहले जाँचें कि क्या आप अपने अकाउंट डैशबोर्ड से ऑनलाइन सदस्यता रद्द कर सकते हैं।',
  },
  [ClauseCategory.NON_REFUNDABLE]: {
    titleHi: 'गैर-वापसी योग्य भुगतान नीति (Non-Refundable Policy)',
    explanationHi:
      'शर्तों के अनुसार भुगतान किया गया शुल्क पूरी तरह से नॉन-रिफंडेबल है और आंशिक उपयोग के लिए कोई क्रेडिट या धनवापसी नहीं दी जाएगी।',
    whyItMattersHi:
      'यदि आप सेवा से संतुष्ट नहीं होते हैं या बीच में ही प्लान रद्द करते हैं, तो भी आपको पैसे वापस नहीं मिलेंगे।',
    whatRemainsUnclearHi:
      'क्या सेवा में तकनीकी खराबी या त्रुटिपूर्ण बिलिंग होने पर कोई अपवाद लागू होता है।',
    whatToCheckHi:
      'वार्षिक प्लान लेने से पहले मासिक विकल्प या रिफंड अपवाद शर्तों की पुष्टि करें।',
  },
  [ClauseCategory.FORCED_ARBITRATION]: {
    titleHi: 'अनिवार्य मध्यस्थता की शर्त (Forced Arbitration Clause)',
    explanationHi:
      'किसी भी विवाद का समाधान सामान्य न्यायालय (Court) के बजाय निजी बाध्यकारी मध्यस्थता (Binding Arbitration) के माध्यम से किया जाएगा।',
    whyItMattersHi:
      'यह सार्वजनिक न्यायालय में मुकदमा दायर करने के आपके सामान्य अधिकार को सीमित कर सकता है।',
    whatRemainsUnclearHi:
      'मध्यस्थता का स्थान, शुल्क का विभाजन, और क्या आपके क्षेत्र के उपभोक्ता संरक्षण कानून इस शर्त से ऊपर हैं।',
    whatToCheckHi:
      'विवाद समाधान अनुभाग में "30-दिन के ऑप्ट-आउट" (Opt-out) विकल्प और स्थानीय उपभोक्ता आयोग के अधिकारों की जाँच करें।',
  },
  [ClauseCategory.CLASS_ACTION_WAIVER]: {
    titleHi: 'सामूहिक मुकदमे के अधिकार का त्याग (Class-Action Waiver)',
    explanationHi:
      'आप केवल व्यक्तिगत रूप से ही दावा कर सकते हैं और किसी सामूहिक मुकदमे (Class Action) में शामिल नहीं हो सकते।',
    whyItMattersHi:
      'छोटे वित्तीय नुकसान के मामलों में अकेले कानूनी कार्रवाई करना अक्सर महंगा और कठिन होता है।',
    whatRemainsUnclearHi:
      'क्या यह शर्त आपके देश या राज्य के उपभोक्ता संरक्षण कानूनों के तहत मान्य है।',
    whatToCheckHi:
      'जाँचें कि क्या समझौते में छोटे दावों के न्यायालय (Small Claims / Consumer Forum) के लिए छूट दी गई है।',
  },
  [ClauseCategory.DATA_SHARING]: {
    titleHi: 'तृतीय-पक्ष के साथ व्यापक डेटा साझाकरण या बिक्री (Third-Party Data Sharing)',
    explanationHi:
      'यह नीति आपके व्यक्तिगत डेटा और ब्राउज़िंग जानकारी को विज्ञापन नेटवर्क, डेटा ब्रोकर्स या बाहरी व्यावसायिक भागीदारों के साथ साझा या बेचने की अनुमति देती है।',
    whyItMattersHi:
      'आपकी संपर्क जानकारी और उपयोग का डेटा बाहरी मार्केटिंग कंपनियों तक पहुँच सकता है।',
    whatRemainsUnclearHi:
      'किन विशिष्ट तृतीय-पक्ष कंपनियों के साथ डेटा साझा किया जाता है और डेटा कितने समय तक रखा जाता है।',
    whatToCheckHi:
      'गोपनीयता सेटिंग्स में डेटा शेयरिंग से ऑप्ट-आउट (Opt-out) करने या सहमति वापस लेने के विकल्प की तलाश करें।',
  },
  [ClauseCategory.CONTENT_LICENSE]: {
    titleHi: 'सामग्री पर स्थायी और व्यापक लाइसेंस (Perpetual Content License)',
    explanationHi:
      'आपके द्वारा अपलोड की गई सामग्री पर कंपनी को स्थायी, अपरिवर्तनीय और विश्वव्यापी व्यावसायिक उपयोग का लाइसेंस मिलता है।',
    whyItMattersHi:
      'खाता हटाने के बाद भी आपकी फ़ाइलों, फ़ोटो या सामग्री का उपयोग व्यावसायिक रूप से या AI मॉडल प्रशिक्षण के लिए किया जा सकता है।',
    whatRemainsUnclearHi:
      'क्या यह लाइसेंस निजी दस्तावेज़ों पर भी लागू होता है या केवल सार्वजनिक पोस्ट पर।',
    whatToCheckHi:
      'संवेदनशील या कॉपीराइट सामग्री अपलोड करने से पहले AI प्रशिक्षण और व्यावसायिक उपयोग के ऑप्ट-आउट की जाँच करें।',
  },
  [ClauseCategory.UNILATERAL_CHANGES]: {
    titleHi: 'बिना पूर्व सूचना के शर्तों में एकतरफा बदलाव (Unilateral Changes)',
    explanationHi:
      'कंपनी बिना किसी पूर्व सूचना के किसी भी समय अपनी शर्तों, नियमों या कीमतों में बदलाव करने का अधिकार सुरक्षित रखती है।',
    whyItMattersHi:
      'साइन-अप करने के बाद आपके अधिकार या शुल्क बिना किसी ईमेल अलर्ट के बदल सकते हैं।',
    whatRemainsUnclearHi:
      'यदि शर्तों में बड़ा बदलाव होता है, तो क्या आपको बिना जुर्माने के सदस्यता रद्द करने का अवसर मिलेगा।',
    whatToCheckHi:
      'जाँचें कि क्या कंपनी महत्वपूर्ण बदलावों से पहले ईमेल सूचना देने का वादा करती है।',
  },
  [ClauseCategory.LIABILITY_LIMITATIONS]: {
    titleHi: 'अत्यधिक दायित्व सीमा (Excessive Liability Limitations)',
    explanationHi:
      'यह समझौता कंपनी की अधिकतम वित्तीय जिम्मेदारी को बहुत छोटी राशि तक सीमित करता है और डेटा हानि या सेवा बाधित होने की जिम्मेदारी से पल्ला झाड़ता है।',
    whyItMattersHi:
      'यदि सेवा की गलती से आपको बड़ा नुकसान होता है, तो भी मुआवजा नाममात्र की राशि तक सीमित हो सकता है।',
    whatRemainsUnclearHi:
      'क्या यह सीमा गंभीर लापरवाही या डेटा सुरक्षा उल्लंघन पर भी लागू होती है।',
    whatToCheckHi:
      'महत्वपूर्ण डेटा का स्वतंत्र बैकअप रखें और सेवा स्तर समझौते (SLA) की जाँच करें।',
  },
  [ClauseCategory.PRESELECTED_ADDONS]: {
    titleHi: 'पहले से चुने गए सशुल्क ऐड-ऑन (Preselected Paid Add-Ons)',
    explanationHi:
      'कोई वैकल्पिक सशुल्क सेवा, बीमा या वारंटी आपके कार्ट में पहले से ही जोड़ी गई है जब तक आप स्वयं उसे हटाते नहीं हैं।',
    whyItMattersHi:
      'ध्यान न देने पर चेकआउट के समय आपसे अनचाही अतिरिक्त सेवाओं के लिए शुल्क लिया जा सकता है।',
    whatRemainsUnclearHi:
      'क्या यह ऐड-ऑन एक बार का शुल्क है या हर महीने दोहराया जाने वाला शुल्क।',
    whatToCheckHi:
      'भुगतान करने से पहले सभी पहले से टिक किए गए (Pre-checked) बॉक्स को ध्यान से देखें और अनावश्यक ऐड-ऑन हटा दें।',
  },
  [ClauseCategory.COUNTDOWN_SCARCITY]: {
    titleHi: 'भ्रामक काउंटडाउन टाइमर और कमी के दावे (Urgency & Scarcity Claims)',
    explanationHi:
      'पेज पर तुरंत निर्णय लेने का दबाव बनाने के लिए काउंटडाउन टाइमर या सीमित स्टॉक की चेतावनी दिखाई जा रही है।',
    whyItMattersHi:
      'ऐसे दबाव के कारण ग्राहक अक्सर बिना शर्तें पढ़े या कीमतों की तुलना किए जल्दबाजी में भुगतान कर देते हैं।',
    whatRemainsUnclearHi:
      'क्या यह समय-सीमा वास्तविक है या पेज रिफ्रेश करने पर टाइमर फिर से शुरू हो जाता है।',
    whatToCheckHi:
      'जल्दबाजी न करें—शर्तों को आराम से पढ़ें और देखें कि क्या रिफ्रेश करने पर टाइमर रीसेट होता है।',
  },
  [ClauseCategory.CONFIRM_SHAMING]: {
    titleHi: 'कन्फर्म-शेमिंग और भ्रामक सहमति विकल्प (Confirm-Shaming)',
    explanationHi:
      'ऑफर या ट्रैकिंग को अस्वीकार करने वाले बटन में तटस्थ भाषा के बजाय अपराधबोध कराने वाली भाषा का उपयोग किया गया है।',
    whyItMattersHi:
      'यह उपयोगकर्ताओं को अनचाहे सब्सक्रिप्शन या डेटा ट्रैकिंग स्वीकार करने के लिए प्रेरित करने का एक मनोवैज्ञानिक तरीका है।',
    whatRemainsUnclearHi:
      'क्या छोटे या धुंधले लिंक पर क्लिक करने से सभी अतिरिक्त शुल्क पूरी तरह हट जाते हैं।',
    whatToCheckHi:
      'यदि आप ऑफर नहीं चाहते हैं, तो छोटे अस्वीकार (Decline) विकल्प को ध्यान से चुनें।',
  },
  [ClauseCategory.TRIAL_CONVERSION]: {
    titleHi: 'फ्री ट्रायल का अपने-आप सशुल्क प्लान में बदलना (Trial-to-Paid Conversion)',
    explanationHi:
      'आपका फ्री ट्रायल समाप्त होते ही बिना किसी अतिरिक्त अनुस्मारक के अपने-आप सशुल्क सदस्यता में बदल जाएगा।',
    whyItMattersHi:
      'कई ग्राहक ट्रायल रद्द करना भूल जाते हैं और उनसे पूरे महीने या साल का शुल्क वसूल लिया जाता है।',
    whatRemainsUnclearHi:
      'ट्रायल समाप्त होने की सटीक तारीख और समय क्षेत्र (Time Zone) क्या है।',
    whatToCheckHi:
      'ट्रायल समाप्त होने से 48 घंटे पहले का कैलेंडर रिमाइंडर लगाएं और जाँचें कि क्या तुरंत रद्द करने से ट्रायल तुरंत बंद हो जाता है।',
  },
  [ClauseCategory.ACCOUNT_DELETION]: {
    titleHi: 'खाता बंद करने या हटाने पर प्रतिबंध (Account Deletion Restrictions)',
    explanationHi:
      'खाता हटाने के लिए नोटरीकृत फॉर्म या भौतिक डाक की मांग की जाती है, या खाता निष्क्रिय करने पर भी ऑटो-बिलिंग चालू रहती है।',
    whyItMattersHi:
      'केवल ऐप हटाने या अकाउंट डीएक्टिवेट करने से आपकी मासिक बिलिंग बंद नहीं होती।',
    whatRemainsUnclearHi:
      'खाता हटाने के अनुरोध के कितने दिनों बाद आपका व्यक्तिगत डेटा सर्वर से स्थायी रूप से हटाया जाएगा।',
    whatToCheckHi:
      'खाता हटाने से पहले हमेशा अपनी सक्रिय सदस्यता (Subscription) को अलग से रद्द करें।',
  },
  [ClauseCategory.DISPUTE_RESTRICTIONS]: {
    titleHi: 'विवाद समाधान पर कड़े स्थान या समय प्रतिबंध (Dispute Restrictions)',
    explanationHi:
      'यह अनुबंध शिकायत दर्ज करने की समय-सीमा को बहुत कम (जैसे 30 दिन से 6 महीने) कर देता है या दूरस्थ न्यायालय क्षेत्राधिकार को अनिवार्य बनाता है।',
    whyItMattersHi:
      'कम समय-सीमा या विदेशी/दूरस्थ न्यायालय की शर्त के कारण वैध शिकायत करना व्यावहारिक रूप से कठिन हो सकता है।',
    whatRemainsUnclearHi:
      'क्या स्थानीय उपभोक्ता संरक्षण कानून आपको अपने गृह जिले में शिकायत दर्ज करने की अनुमति देते हैं।',
    whatToCheckHi:
      'बिलिंग विवाद उठाने की समय-सीमा नोट करें और अपने स्थानीय उपभोक्ता अधिकारों की जाँच करें।',
  },
  [ClauseCategory.UNUSUAL_PENALTIES]: {
    titleHi: 'असामान्य जुर्माना या नकारात्मक समीक्षा पर प्रतिबंध (Unusual Penalties)',
    explanationHi:
      'यह दस्तावेज़ नकारात्मक सार्वजनिक समीक्षा (Review) लिखने या भुगतान विवाद उठाने पर भारी जुर्माने (Liquidated Damages) की शर्त रखता है।',
    whyItMattersHi:
      'ग्राहकों को ईमानदार फीडबैक साझा करने या गलत शुल्क का विरोध करने से रोकने के लिए ऐसे प्रावधान उपयोग किए जाते हैं।',
    whatRemainsUnclearHi:
      'क्या ऐसे जुर्माने के प्रावधान आपके क्षेत्राधिकार में कानूनी रूप से लागू करने योग्य हैं।',
    whatToCheckHi:
      'ऐसे किसी भी समझौते से सावधान रहें जो ईमानदार ग्राहक समीक्षा लिखने पर जुर्माना लगाता है।',
  },
};
