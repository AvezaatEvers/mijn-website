// Werkstromen: al onze vaste processen als stappenplan. De agent en de werkstromenpagina gebruiken deze lijst.
// Per stap: t (titel), u (uitleg), optioneel link (naar een pagina in het dashboard) en vraag (een vraag voor de agent).
// perKlant: true betekent dat je de werkstroom voor één klant start en de voortgang per klant bijhoudt.

export const GROEPEN = [
  ["ritme", "Dagelijks ritme"],
  ["sales", "Sales"],
  ["onboarding", "Onboarding"],
  ["boekhouding", "Boekhouding"],
  ["aangiftes", "Aangiftes"],
  ["aftersales", "Klantrelatie"],
  ["eigen", "Eigen bedrijf"],
];

export const PROCESSEN = [
  // ---------- Dagelijks ritme ----------
  { id: "dagstart", groep: "ritme", titel: "Dagstart", duur: "15 min", wanneer: "Elke werkdag, als eerste",
    doel: "In een kwartier weten wat vandaag belangrijk is, en niets laten liggen.",
    stappen: [
      { t: "Lees de briefing", u: "Vandaag toont de leads, klanten met aandacht en deadlines. Begin bij 'Doe dit eerst'.", link: "/intern/" },
      { t: "Inbox en WhatsApp door", u: "Beantwoord vragen die binnen 5 minuten kunnen meteen. De rest wordt een taak met datum." },
      { t: "Leg nieuw klantcontact vast", u: "Elk gesprek, appje of mail van een klant: even vastleggen. Dat voedt de inzichten en de NPS-adviezen.", actie: "contact" },
      { t: "Bel of app warme leads", u: "Een lead die te lang wacht, koelt af. Reageer binnen één werkdag.", link: "/intern/klanten.html?status=prospect" },
      { t: "Plan je boekhoudblokken", u: "Kies welke klanten je vandaag verwerkt. Doe het werk in blokken, niet tussen de bedrijven door." },
    ] },
  { id: "dagafsluiting", groep: "ritme", titel: "Dagafsluiting", duur: "10 min", wanneer: "Elke werkdag, aan het eind",
    doel: "Met een lege kop naar huis en morgen meteen verder kunnen.",
    stappen: [
      { t: "Taken bijwerken", u: "Vink af wat klaar is en zet een datum op wat blijft liggen.", link: "/intern/" },
      { t: "Contact van vandaag compleet?", u: "Check of elk klantcontact van vandaag is vastgelegd, ook belletjes onderweg.", link: "/intern/inzichten.html" },
      { t: "Openstaande klantvragen", u: "Niets langer dan één werkdag zonder antwoord. Geen antwoord klaar? Laat de klant weten wanneer wel." },
      { t: "Morgen klaarzetten", u: "Zet de belangrijkste taak voor morgen bovenaan." },
    ] },
  { id: "weekstart", groep: "ritme", titel: "Weekstart met Daan en Koen", duur: "30 min", wanneer: "Maandagochtend",
    doel: "Samen de week verdelen: pijplijn, deadlines en klanten die aandacht nodig hebben.",
    stappen: [
      { t: "Pijplijn doorlopen", u: "Welke leads zijn warm, welke voorstellen staan open, wie zetten we op verloren?", link: "/intern/klanten.html?status=prospect" },
      { t: "Deadlines van deze week", u: "Btw, IB, jaareinde: wat moet er deze week uit?", link: "/intern/kwartaal.html" },
      { t: "Contact en NPS", u: "Bekijk de adviezen en lage scores. Wie belt wie?", link: "/intern/inzichten.html" },
      { t: "Taken verdelen", u: "Gedeelde taken krijgen een eigenaar en een datum.", link: "/intern/" },
      { t: "Eén verbetering kiezen", u: "Wat ging vorige week stroef? Kies één ding om te verbeteren, bijvoorbeeld een kennisbankartikel voor een veelgestelde vraag." },
    ] },

  // ---------- Sales ----------
  { id: "nieuwe-lead", groep: "sales", titel: "Nieuwe lead opvolgen", duur: "20 min", wanneer: "Zodra er een aanvraag binnenkomt", perKlant: true,
    doel: "Binnen één werkdag persoonlijk contact en een kennismaking in de agenda.",
    stappen: [
      { t: "Lead claimen", u: "Zet jezelf als boekhouder bij de lead, zodat de ander weet dat jij hem oppakt.", link: "/intern/klanten.html?status=prospect" },
      { t: "Even googelen", u: "Website, KvK, LinkedIn: wat doet de ondernemer, hoe lang bestaat het bedrijf, welke branche?" },
      { t: "Bellen, dan appen", u: "Bel eerst. Geen gehoor? Stuur meteen een WhatsApp met een voorstel voor een moment." },
      { t: "Kwalificeren", u: "Rechtsvorm, branche, verwachte omzet, btw-plichtig of KOR, klanten in de EU, fiscaal partner, huidige boekhouding en wanneer hij wil starten.", vraag: "Welke vragen stel ik om een nieuwe zzp-lead te kwalificeren?" },
      { t: "Kennismaking inplannen", u: "Plan een gratis kennismaking van 20 minuten, liefst binnen een week." },
      { t: "Contact vastleggen", u: "Leg het gesprek vast met kanaal en onderwerp, dan stijgt de warmtescore mee.", actie: "contact" },
    ] },
  { id: "kennismaking", groep: "sales", titel: "Kennismakingsgesprek", duur: "45 min", wanneer: "Bij elke ingeplande kennismaking", perKlant: true,
    doel: "De ondernemer voelt zich begrepen en krijgt binnen 24 uur een voorstel.",
    stappen: [
      { t: "Voorbereiden", u: "Lees de notities van de lead en de branche. Open de presentatie.", link: "/intern/kennismaking.html" },
      { t: "Situatie in kaart", u: "Wat gaat er nu mis of kost te veel tijd? Wat wil hij zelf niet meer doen?" },
      { t: "Hoe wij werken laten zien", u: "MoneyMonk-app, vaste boekhouder, kwartaalritme, maandgesprek als optie." },
      { t: "Prijs en extra's bespreken", u: "€ 80 per maand. Check ICP, fiscaal partner, overstap en achterstand. Overstap per 1 januari is gratis bij aanmelding t/m 15 december.", vraag: "Wat staat er in ons pakket en wat kost extra?" },
      { t: "Voorstel versturen", u: "Binnen 24 uur, via de voorstelpagina. De herinnering gaat daarna automatisch.", link: "/voorstel.html" },
      { t: "Gesprek vastleggen", u: "Leg vast wat de ondernemer belangrijk vond en welke bezwaren er waren.", actie: "contact" },
    ] },
  { id: "voorstel-opvolgen", groep: "sales", titel: "Voorstel opvolgen tot akkoord", duur: "10 min per keer", wanneer: "Na het versturen van een voorstel", perKlant: true,
    doel: "Een duidelijk ja of nee, zonder te pushen.",
    stappen: [
      { t: "Automatische herinnering", u: "Na 2 werkdagen gaat de herinnering vanzelf. Check of hij verstuurd is op de klantpagina." },
      { t: "Na 5 dagen bellen", u: "Vraag of het voorstel duidelijk is en of er nog vragen zijn. Geen druk, wel helderheid." },
      { t: "Bezwaren beantwoorden", u: "Prijs: reken voor wat een uur administratie hem kost. Twijfel: wijs op de geld-terug-garantie.", vraag: "Hoe ga ik om met het bezwaar dat een boekhouder te duur is?" },
      { t: "Akkoord: Klant geworden", u: "Zet de lead op klant. Daarmee start de onboarding.", link: "/intern/klanten.html?status=prospect" },
      { t: "Geen akkoord: verloren met reden", u: "Zet op verloren en noteer waarom. Die redenen zijn goud voor het verbeteren van het aanbod." },
    ] },

  // ---------- Onboarding ----------
  { id: "onboarding", groep: "onboarding", titel: "Nieuwe klant onboarden", duur: "1 tot 2 uur", wanneer: "Direct na akkoord", perKlant: true,
    doel: "Binnen twee weken draait de administratie en weet de klant precies wat hij moet doen.",
    stappen: [
      { t: "Klantgegevens compleet", u: "Status klant, startdatum, boekhouder, telefoon en e-mail. Daarmee worden de automatische mails ingepland." },
      { t: "Fiscaal profiel invullen", u: "KOR, ICP, fiscaal partner, urencriterium en branche. Dit stuurt de tekst van de mails." },
      { t: "Welkomstmail sturen", u: "Via de klantpagina. Daarin staan de eerste stappen voor de klant." },
      { t: "MoneyMonk inrichten", u: "Account aanmaken of overnemen, ons koppelen als boekhouder, zakelijke bankrekening koppelen.", vraag: "Hoe werkt een klant met MoneyMonk en wat moet hij zelf doen?" },
      { t: "Machtiging Belastingdienst", u: "Regel de machtiging om namens de klant btw- en IB-aangifte te doen. Zonder machtiging kunnen we niet indienen." },
      { t: "Verwerkersovereenkomst", u: "Laat de verwerkersovereenkomst accepteren; die hoort bij de algemene voorwaarden.", link: "/verwerkersovereenkomst" },
      { t: "Beginsituatie vastleggen", u: "Beginbalans of overstapgegevens, openstaande facturen, lopende aangiftes en de hoogte van de voorlopige aanslag." },
      { t: "Check-in na 2 weken", u: "Gaat automatisch. Bel ook even: lukt het met de app en de bonnetjes?" },
    ] },
  { id: "overstap", groep: "onboarding", titel: "Overstap van een andere boekhouder", duur: "1 uur verspreid", wanneer: "Bij overstappers", perKlant: true,
    doel: "Een naadloze overdracht zonder gaten in de aangiftes.",
    stappen: [
      { t: "Opzegging bij de oude boekhouder", u: "Laat de klant opzeggen. Spreek af wie welke aangifte nog doet (bijvoorbeeld het laatste kwartaal)." },
      { t: "Gegevens opvragen", u: "Jaarcijfers vorig jaar, laatste balans, openstaande posten, ingediende btw-aangiftes, voorlopige aanslag." },
      { t: "Beginbalans boeken", u: "Neem de eindbalans van de oude boekhouder over als beginbalans.", vraag: "Hoe zet ik een beginbalans op bij een overstap?" },
      { t: "Machtiging omzetten", u: "De oude machtiging intrekken, de nieuwe op onze naam." },
      { t: "Klant geruststellen", u: "Laat weten dat alles over is en wat er de komende maand gebeurt." },
    ] },

  // ---------- Boekhouding ----------
  { id: "maandverwerking", groep: "boekhouding", titel: "Maandelijkse verwerking per klant", duur: "20 tot 45 min", wanneer: "Elke maand per klant", perKlant: true,
    doel: "Bij en schoon: elke banktransactie geboekt met bewijsstuk.",
    stappen: [
      { t: "Banktransacties ophalen", u: "Controleer of de bankkoppeling werkt en alle transacties binnen zijn.", vraag: "Hoe werkt het importeren en automatisch boeken van banktransacties?" },
      { t: "Automatisch gematchte posten nalopen", u: "Klopt de koppeling met de juiste factuur? Kleine betalingsverschillen wegboeken." },
      { t: "Overige transacties boeken", u: "Kostenrekening en btw-code kiezen. Maak regels voor terugkerende posten." },
      { t: "Ontbrekende bonnetjes verzamelen", u: "Bundel alle vragen in één bericht aan de klant, niet per bon een appje." },
      { t: "Privé en zakelijk scheiden", u: "Privé-uitgaven als privé-opname. Bij veel privéposten: tip om een aparte rekening te nemen.", vraag: "Hoe boek ik privé-uitgaven via de zakelijke rekening?" },
      { t: "Open posten controleren", u: "Facturen over de vervaldatum? Laat de klant weten wie nog moet betalen.", vraag: "Een klant van mijn klant betaalt niet, wat zijn de stappen?" },
      { t: "Kruisposten op nul", u: "Vraagposten en kruisposten moeten leeg zijn voor je de maand afsluit." },
    ] },

  // ---------- Aangiftes ----------
  { id: "btw-kwartaal", groep: "aangiftes", titel: "Btw-kwartaal", duur: "Verspreid over de maand", wanneer: "Januari, april, juli, oktober",
    doel: "Alle aangiftes ruim voor de deadline ingediend, zonder spoed.",
    stappen: [
      { t: "Kwartaalmail op de 3e", u: "Gaat automatisch naar alle klanten zonder KOR." },
      { t: "Stukken binnen afvinken", u: "Op het kwartaalbord per klant. Wie rond de 8e nog niet binnen is, krijgt automatisch een tweede herinnering.", link: "/intern/kwartaal.html" },
      { t: "Kwartaal per klant afronden", u: "Doe eerst de maandverwerking. Daarna controleren: verlegde btw, ICP, privégebruik, KOR-grens.", vraag: "Wat controleer ik voordat ik een btw-aangifte indien?" },
      { t: "Aangifte indienen", u: "Ruim voor de laatste dag van de maand. Laat de klant weten welk bedrag hij moet betalen en vóór wanneer." },
      { t: "ICP-opgave", u: "Voor klanten met EU-klanten: ICP-opgave tegelijk indienen.", vraag: "Hoe werkt de ICP-opgave?" },
      { t: "Kwartaalbord bijwerken", u: "Ingediend en betaald afvinken. Alles groen voor de deadline.", link: "/intern/kwartaal.html" },
    ] },
  { id: "ib-aangifte", groep: "aangiftes", titel: "Aangifte inkomstenbelasting", duur: "1 tot 2 uur per klant", wanneer: "Maart tot en met mei", perKlant: true,
    doel: "Een kloppende aangifte met alle aftrekposten, ruim op tijd.",
    stappen: [
      { t: "Mail op 2 maart", u: "Gaat automatisch, met de lijst van benodigde stukken. Stukken komen per mail binnen, niet via de app." },
      { t: "Jaarcijfers afronden", u: "Laatste kwartaal, afschrijvingen, privégebruik auto, eventuele KIA.", vraag: "Wat moet ik controleren bij de jaarafsluiting van een zzp'er?" },
      { t: "Urencriterium checken", u: "Haalt de klant 1.225 uur? Dat bepaalt de zelfstandigenaftrek.", vraag: "Hoe zit het met de zelfstandigenaftrek en het urencriterium?" },
      { t: "IB-werkblad invullen", u: "Inkomen, box 3, eigen woning, partner, aftrekposten.", link: "/intern/ib-werkblad.html" },
      { t: "Concept naar de klant", u: "Laat zien wat hij moet betalen of terugkrijgt, en waarom. Wacht op akkoord." },
      { t: "Indienen en afvinken", u: "Na akkoord indienen en op de klantpagina afvinken. De NPS-mail gaat een week later." },
      { t: "Voorlopige aanslag volgend jaar", u: "Wijkt de winst flink af? Laat de voorlopige aanslag aanpassen." },
    ] },
  { id: "jaareinde", groep: "aangiftes", titel: "Jaareinde met klanten", duur: "Verspreid over december", wanneer: "Eind november en december",
    doel: "Klanten halen voor 31 december alle voordelen binnen.",
    stappen: [
      { t: "Jaareindemail 25 november", u: "Gaat automatisch, met de checklist." },
      { t: "Investeringen bespreken", u: "Wie zit dicht bij de KIA-drempel? Investeren voor of na 1 januari?", vraag: "Wanneer is investeren voor de jaarwisseling slim?" },
      { t: "Urencriterium in de gaten", u: "Wie zit er krap op? Nu nog uren bijhouden of extra werk plannen." },
      { t: "Oninbare facturen afboeken", u: "Facturen die echt niet meer betaald worden, voor 31 december afboeken." },
      { t: "KOR per 1 januari?", u: "Wie onder de € 20.000 omzet blijft en vooral aan particulieren levert: KOR overwegen. Aanmelden minimaal 4 weken vooraf.", vraag: "Is de KOR interessant voor een klant met weinig omzet?" },
      { t: "Overstappers per 1 januari", u: "Aanmeldingen t/m 15 december zijn gratis. Plan hun onboarding in januari." },
    ] },

  // ---------- Klantrelatie ----------
  { id: "klantvraag", groep: "aftersales", titel: "Klantvraag afhandelen", duur: "5 tot 15 min", wanneer: "Bij elke vraag van een klant", perKlant: true,
    doel: "Snel en goed antwoord, en leren welke vragen we kunnen voorkomen.",
    stappen: [
      { t: "Vastleggen", u: "Kanaal, onderwerp en soort. Was de vraag te voorkomen met betere uitleg?", actie: "contact" },
      { t: "Antwoord opzoeken", u: "Vraag de agent of zoek in de kennisbank. Twijfel je? Overleg met de ander.", vraag: "Zoek in de kennisbank een antwoord op de vraag van mijn klant." },
      { t: "Binnen één werkdag antwoorden", u: "Kort en in je-vorm. Link naar een kennisbankartikel als dat er is." },
      { t: "Opgelost?", u: "Zet het contact op opgelost en noteer hoe de klant reageerde." },
    ] },
  { id: "klacht", groep: "aftersales", titel: "Klacht of lage NPS opvolgen", duur: "30 min", wanneer: "Bij een klacht of NPS van 6 of lager", perKlant: true,
    doel: "Van criticaster naar trouwe klant. Binnen 48 uur bellen.",
    stappen: [
      { t: "Binnen 48 uur bellen", u: "Niet mailen. Luister vooral en vat samen wat je hoort." },
      { t: "Oorzaak benoemen", u: "Wat ging er mis, en ligt het aan ons proces of aan een eenmalige fout?" },
      { t: "Oplossing afspreken", u: "Concreet en met datum. Doe wat je zegt." },
      { t: "Vastleggen", u: "Leg het gesprek vast als klacht, met gevoel en of het te voorkomen was.", actie: "contact" },
      { t: "Na een week checken", u: "Even appen of het nu goed loopt. Dat maakt vaak het verschil." },
      { t: "Proces verbeteren", u: "Komt dit vaker voor? Bespreek het in de weekstart.", link: "/intern/inzichten.html" },
    ] },
  { id: "promoter", groep: "aftersales", titel: "Promoters benutten", duur: "5 min", wanneer: "Bij een NPS van 9 of 10", perKlant: true,
    doel: "Tevreden klanten helpen ons groeien: review en aanbeveling.",
    stappen: [
      { t: "Bedanken", u: "Een persoonlijk appje doet meer dan een standaardmail." },
      { t: "Review vragen", u: "Via de klantpagina, de Google-reviewmail." },
      { t: "Tevreden klant aanvinken", u: "Dan krijgt hij na de IB-aangifte automatisch de aanbevelingsmail." },
    ] },
  { id: "maandgesprek", groep: "aftersales", titel: "Maandgesprek voeren", duur: "30 min", wanneer: "Voor klanten die het maandgesprek kiezen", perKlant: true,
    doel: "De klant snapt zijn cijfers en weet wat hij moet reserveren.",
    stappen: [
      { t: "Voorbereiden", u: "Cijfers van de maand, reservering belasting, openstaande vragen.", link: "/intern/maandgesprek.html" },
      { t: "Cijfers doorlopen", u: "Omzet, kosten, winst tot nu toe, en wat er opzij moet.", vraag: "Hoeveel moet een zzp'er opzij zetten voor belasting?" },
      { t: "Vooruitkijken", u: "Grote uitgaven, investeringen, wijzigingen in werk of privé." },
      { t: "Vastleggen", u: "Leg het gesprek vast met de afspraken.", actie: "contact" },
    ] },
  { id: "offboarding", groep: "aftersales", titel: "Klant stopt", duur: "30 min", wanneer: "Bij opzegging", perKlant: true,
    doel: "Netjes afscheid, alles overgedragen, en leren waarom.",
    stappen: [
      { t: "Reden vragen", u: "Bel en vraag eerlijk waarom. Leg het vast als contact." , actie: "contact" },
      { t: "Afspraken over lopende aangiftes", u: "Welk kwartaal en welke IB-aangifte doen wij nog? Leg het schriftelijk vast." },
      { t: "Gegevens overdragen", u: "Jaarcijfers en eindbalans naar de klant of de nieuwe boekhouder." },
      { t: "Toegang en machtiging intrekken", u: "Koppeling in MoneyMonk en de machtiging bij de Belastingdienst." },
      { t: "Status op gestopt", u: "Dan stoppen alle automatische mails.", link: "/intern/klanten.html" },
    ] },

  // ---------- Eigen bedrijf ----------
  { id: "eigen-facturatie", groep: "eigen", titel: "Eigen facturatie en debiteuren", duur: "30 min", wanneer: "Begin van elke maand",
    doel: "Elke klant betaalt op tijd, en we zien direct wie niet.",
    stappen: [
      { t: "Facturen versturen", u: "Maandbedrag plus extra's (ICP, partner, spoedtoeslag, uren achterstand)." },
      { t: "Open posten nalopen", u: "Wie heeft de vorige factuur nog niet betaald?", vraag: "Een klant betaalt niet, wat zijn de stappen?" },
      { t: "Herinnering en aanmaning", u: "Na de vervaldatum een vriendelijke herinnering, na 14 dagen een aanmaning." },
      { t: "Bij herhaling: gesprek", u: "Bel. Betalingsproblemen zijn vaak een signaal dat de klant hulp nodig heeft." },
    ] },
  { id: "eigen-administratie", groep: "eigen", titel: "Onze eigen administratie", duur: "1 uur", wanneer: "Elk kwartaal",
    doel: "Zelf het goede voorbeeld: op tijd en op orde.",
    stappen: [
      { t: "Eigen boekingen bijwerken", u: "Bankmutaties, bonnetjes, abonnementen (Netlify, Resend, MoneyMonk)." },
      { t: "Eigen btw-aangifte", u: "Zelfde deadline als voor klanten." },
      { t: "Cijfers bespreken", u: "Vaste omzet per maand, kosten, aantal klanten en conversie.", link: "/intern/" },
      { t: "Reservering", u: "Btw en inkomstenbelasting apart zetten." },
    ] },
  { id: "kennisbank-artikel", groep: "eigen", titel: "Kennisbankartikel schrijven", duur: "2 uur", wanneer: "Elk kwartaal, of bij een vraag die vaak terugkomt",
    doel: "Vermijdbare vragen voorkomen en beter gevonden worden in Google.",
    stappen: [
      { t: "Onderwerp kiezen", u: "Kijk welk onderwerp het vaakst te voorkomen was.", link: "/intern/inzichten.html" },
      { t: "Schrijven", u: "Vraag als titel, direct antwoord in de eerste alinea, rekenvoorbeeld, je-vorm." },
      { t: "Publiceren", u: "Op de conceptversie zetten en in de kennisbank-index opnemen." },
      { t: "Gebruiken", u: "Link ernaar in antwoorden aan klanten en in de check-in mail." },
    ] },
];

export function proces(id) { return PROCESSEN.find((p) => p.id === id) || null; }
