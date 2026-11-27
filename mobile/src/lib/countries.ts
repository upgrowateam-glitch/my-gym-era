// Countries with their phone (dialling) codes, for the phone number fields.
// Flags are emoji built from the 2-letter country code (no images needed).
// India is the default. Where several countries share a code (+1, +7, +44),
// the first one listed is used when reading a saved number.

export interface Country { code: string; name: string; dial: string }

const RAW = `IN India 91|US United States 1|GB United Kingdom 44|AE United Arab Emirates 971|SA Saudi Arabia 966|QA Qatar 974|KW Kuwait 965|OM Oman 968|BH Bahrain 973|SG Singapore 65|MY Malaysia 60|LK Sri Lanka 94|NP Nepal 977|BD Bangladesh 880|PK Pakistan 92|CA Canada 1|AU Australia 61|NZ New Zealand 64|AF Afghanistan 93|AL Albania 355|DZ Algeria 213|AD Andorra 376|AO Angola 244|AR Argentina 54|AM Armenia 374|AT Austria 43|AZ Azerbaijan 994|BS Bahamas 1|BY Belarus 375|BE Belgium 32|BZ Belize 501|BJ Benin 229|BT Bhutan 975|BO Bolivia 591|BA Bosnia and Herzegovina 387|BW Botswana 267|BR Brazil 55|BN Brunei 673|BG Bulgaria 359|BF Burkina Faso 226|BI Burundi 257|KH Cambodia 855|CM Cameroon 237|CV Cape Verde 238|CF Central African Republic 236|TD Chad 235|CL Chile 56|CN China 86|CO Colombia 57|KM Comoros 269|CG Congo 242|CD Congo (DRC) 243|CR Costa Rica 506|CI Côte d'Ivoire 225|HR Croatia 385|CU Cuba 53|CY Cyprus 357|CZ Czechia 420|DK Denmark 45|DJ Djibouti 253|DO Dominican Republic 1|EC Ecuador 593|EG Egypt 20|SV El Salvador 503|GQ Equatorial Guinea 240|ER Eritrea 291|EE Estonia 372|SZ Eswatini 268|ET Ethiopia 251|FJ Fiji 679|FI Finland 358|FR France 33|GA Gabon 241|GM Gambia 220|GE Georgia 995|DE Germany 49|GH Ghana 233|GR Greece 30|GT Guatemala 502|GN Guinea 224|GY Guyana 592|HT Haiti 509|HN Honduras 504|HK Hong Kong 852|HU Hungary 36|IS Iceland 354|ID Indonesia 62|IR Iran 98|IQ Iraq 964|IE Ireland 353|IL Israel 972|IT Italy 39|JM Jamaica 1|JP Japan 81|JO Jordan 962|KZ Kazakhstan 7|KE Kenya 254|KG Kyrgyzstan 996|LA Laos 856|LV Latvia 371|LB Lebanon 961|LS Lesotho 266|LR Liberia 231|LY Libya 218|LI Liechtenstein 423|LT Lithuania 370|LU Luxembourg 352|MO Macau 853|MG Madagascar 261|MW Malawi 265|MV Maldives 960|ML Mali 223|MT Malta 356|MR Mauritania 222|MU Mauritius 230|MX Mexico 52|MD Moldova 373|MC Monaco 377|MN Mongolia 976|ME Montenegro 382|MA Morocco 212|MZ Mozambique 258|MM Myanmar 95|NA Namibia 264|NL Netherlands 31|NI Nicaragua 505|NE Niger 227|NG Nigeria 234|KP North Korea 850|MK North Macedonia 389|NO Norway 47|PS Palestine 970|PA Panama 507|PG Papua New Guinea 675|PY Paraguay 595|PE Peru 51|PH Philippines 63|PL Poland 48|PT Portugal 351|PR Puerto Rico 1|RO Romania 40|RU Russia 7|RW Rwanda 250|SM San Marino 378|SN Senegal 221|RS Serbia 381|SC Seychelles 248|SL Sierra Leone 232|SK Slovakia 421|SI Slovenia 386|SO Somalia 252|ZA South Africa 27|KR South Korea 82|SS South Sudan 211|ES Spain 34|SD Sudan 249|SR Suriname 597|SE Sweden 46|CH Switzerland 41|SY Syria 963|TW Taiwan 886|TJ Tajikistan 992|TZ Tanzania 255|TH Thailand 66|TL Timor-Leste 670|TG Togo 228|TT Trinidad and Tobago 1|TN Tunisia 216|TR Türkiye 90|TM Turkmenistan 993|UG Uganda 256|UA Ukraine 380|UY Uruguay 598|UZ Uzbekistan 998|VE Venezuela 58|VN Vietnam 84|YE Yemen 967|ZM Zambia 260|ZW Zimbabwe 263`;

export const COUNTRIES: Country[] = RAW.split('|').map((entry) => {
  const parts = entry.trim().split(' ');
  return { code: parts[0], dial: parts[parts.length - 1], name: parts.slice(1, -1).join(' ') };
});

export const DEFAULT_COUNTRY = COUNTRIES[0]; // India

/** 🇮🇳 from "IN". */
export function flagOf(code: string): string {
  return String.fromCodePoint(...[...code.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

/** "+91 98765 43210" → { country: India, national: "98765 43210" }. Numbers without + are taken as India. */
export function splitPhone(value: string | null | undefined): { country: Country; national: string } {
  const v = (value ?? '').trim();
  if (!v.startsWith('+')) return { country: DEFAULT_COUNTRY, national: v };
  const digits = v.slice(1).replace(/[^\d]/g, '');
  // Longest matching code first (e.g. +971 before +97).
  for (const len of [4, 3, 2, 1]) {
    const found = COUNTRIES.find((c) => c.dial === digits.slice(0, len));
    if (found) {
      const rest = v.slice(1).replace(/^[\s-]*/, '');
      // Drop the code (and any spaces after it) from the original text, keeping the person's spacing.
      let i = 0, seen = 0;
      while (i < rest.length && seen < found.dial.length) { if (/\d/.test(rest[i])) seen++; i++; }
      return { country: found, national: rest.slice(i).trim() };
    }
  }
  return { country: DEFAULT_COUNTRY, national: v };
}

/** Country + typed number → "+91 98765 43210" ('' when no number is typed). */
export function joinPhone(country: Country, national: string): string {
  const n = national.trim().replace(/^0+/, ''); // a leading 0 (trunk prefix) is not used with a country code
  return n ? `+${country.dial} ${n}` : '';
}
