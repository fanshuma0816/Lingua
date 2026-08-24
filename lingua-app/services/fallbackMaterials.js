// Offline fallback learning texts (Dutch only).
// Used when the live AI ("Find something to learn") is slow or unavailable, so the
// user still gets varied, level-appropriate material instead of the same few texts.
//
// Organised by: tier (matches the duration plans) × topic × ~2 variants, with the
// CEFR level spread across A1–C1. The picker in services/api.js selects by
// tier + chosen topic and skips anything already shown (by text signature).
//
// tier:  "short"  -> 10-15 min  (40-70 words)
//        "medium" -> 25-35 min  (90-150 words)
//        "long"   -> 45-60 min  (140-240 words)
// topic slugs: daily | news | culture | travel | work | food | tech | society

// Map both English and Chinese interest labels (same order in uiText.js) to a slug.
const TOPIC_KEYS = {
  "Daily life": "daily", "日常生活": "daily",
  "News": "news", "新闻": "news",
  "Culture": "culture", "文化": "culture",
  "Travel": "travel", "旅行": "travel",
  "Work & study": "work", "工作与学习": "work",
  "Food": "food", "食物": "food",
  "Technology": "tech", "科技": "tech",
  "Society": "society", "社会": "society",
};
function topicKey(label) { return TOPIC_KEYS[String(label || "").trim()] || null; }

const FALLBACK_DUTCH = [
  // ================= SHORT (40-70 words) =================
  // --- daily ---
  { level:"A1", tier:"short", topic:"daily", source:"Daily story", title:"Een gewone ochtend",
    text:`Lisa wordt om zeven uur wakker. Ze staat op en doet het raam open. Buiten is het rustig en koel. Lisa maakt thee en eet een boterham met kaas. Daarna borstelt ze haar tanden en pakt ze haar tas. Om acht uur gaat ze naar buiten. Ze loopt naar de bus en groet de buurman. Het is een gewone, fijne ochtend.` },
  { level:"A1", tier:"short", topic:"daily", source:"Daily story", title:"Boodschappen doen",
    text:`Sam gaat naar de winkel. Hij heeft brood, melk en fruit nodig. In de winkel pakt hij een mandje. Hij zoekt de appels en legt er vijf in het mandje. Bij de kassa wacht hij even. De man voor hem betaalt met zijn kaart. Dan is Sam aan de beurt. Hij betaalt en zegt: "Dank u wel." Buiten schijnt de zon. Sam loopt blij naar huis.` },
  { level:"B1", tier:"short", topic:"daily", source:"Daily story", title:"Een kleine tegenslag",
    text:`Op weg naar zijn werk merkt Daan dat zijn band lek is. Hij baalt, want hij is al laat. Toch blijft hij rustig: hij zet zijn fiets op slot en pakt de tram. Onderweg stuurt hij een berichtje naar een collega. "Ik kom tien minuten later." Het is niet ideaal, maar zo blijft het probleem klein. Vanavond maakt hij de band gewoon zelf.` },

  // --- news ---
  { level:"A2", tier:"short", topic:"news", source:"News explainer", title:"Meer bomen in de wijk",
    text:`In een wijk in Rotterdam komen dit jaar honderd nieuwe bomen. De gemeente wil zo meer schaduw en frisse lucht maken. In de zomer wordt het namelijk erg warm tussen de huizen. Veel bewoners zijn blij met het plan. Sommige mensen vragen zich af wie de bomen water geeft. De gemeente zegt dat vrijwilligers daarbij helpen.` },
  { level:"B1", tier:"short", topic:"news", source:"News explainer", title:"Rustiger in het centrum",
    text:`Vanaf volgende maand mogen er in het centrum minder auto's komen. De gemeente hoopt op schonere lucht en meer ruimte voor voetgangers en fietsers. Winkeliers zijn verdeeld: sommige vrezen minder klanten, andere verwachten juist meer bezoekers die rustig willen rondlopen. Duidelijk is dat de straten er anders uit gaan zien. Of het plan slaagt, moet het komende jaar blijken.` },

  // --- culture ---
  { level:"A2", tier:"short", topic:"culture", source:"Culture note", title:"Met de fiets naar school",
    text:`In Nederland gaan veel kinderen op de fiets naar school. Ook als het regent, pakken ze gewoon hun regenjas. Ouders fietsen vaak mee, soms met een klein kind voorop. Op het schoolplein staan tientallen fietsen naast elkaar. Voor veel Nederlanders is fietsen heel normaal. Ze doen het niet voor de sport, maar omdat het snel en makkelijk is.` },
  { level:"B1", tier:"short", topic:"culture", source:"Culture note", title:"De zondag in een klein dorp",
    text:`In sommige kleine dorpen is de zondag nog altijd een rustige dag. De winkels zijn dicht en op straat is het stil. 's Ochtends luiden de kerkklokken, en later maken mensen een wandeling of gaan ze bij familie op bezoek. Niet iedereen is gelovig, maar de gewoonte blijft. Voor veel bewoners hoort die rust gewoon bij het weekend.` },

  // --- travel ---
  { level:"A2", tier:"short", topic:"travel", source:"Practical situation", title:"Naar het station",
    text:`Nadia wil met de trein naar Utrecht. Ze koopt eerst een kaartje bij de automaat. Op het scherm kiest ze de stad en de tijd. Dan checkt ze in met haar OV-chipkaart. Op het bord ziet ze dat de trein op spoor vijf vertrekt. Nadia loopt rustig naar het perron en wacht. De trein komt precies op tijd. Ze stapt in en zoekt een plek bij het raam.` },
  { level:"A1", tier:"short", topic:"travel", source:"Daily story", title:"Een dag aan zee",
    text:`Vandaag gaat Bram naar het strand. Hij neemt de trein naar Zandvoort. In zijn tas zitten brood, water en een handdoek. Op het strand is het niet druk. Bram loopt langs de zee en zoekt mooie schelpen. De zon schijnt en de wind is koel. 's Middags eet hij een ijsje. Daarna gaat hij moe maar blij naar huis.` },

  // --- work ---
  { level:"A2", tier:"short", topic:"work", source:"Practical situation", title:"De eerste werkdag",
    text:`Vandaag is de eerste werkdag van Emre. Hij komt op tijd en geeft iedereen een hand. Een collega laat hem de keuken en zijn bureau zien. Emre krijgt een laptop en een lijst met taken. In het begin is alles nieuw en een beetje spannend. Maar de mensen zijn aardig en leggen rustig uit. Aan het eind van de dag voelt hij zich al iets meer thuis.` },
  { level:"B1", tier:"short", topic:"work", source:"Dialogue", title:"Even overleggen",
    text:`Karin: Heb je heel even tijd? Ik loop vast met de planning.
Joost: Tuurlijk. Wat is er precies aan de hand?
Karin: We hebben twee afspraken op hetzelfde moment gezet. Eén moet verschoven.
Joost: Verplaats de klant naar de middag, dan houden we de ochtend vrij voor het team.
Karin: Goed idee. Ik stuur meteen een mailtje. Fijn, dat scheelt.` },

  // --- food ---
  { level:"A1", tier:"short", topic:"food", source:"Daily story", title:"Soep maken",
    text:`Vanavond maakt Fatima soep. Ze snijdt een ui, een wortel en een aardappel. Ze doet alles in een pan met water. De soep kookt langzaam op het vuur. Fatima voegt een beetje zout toe en proeft. Het ruikt lekker in de keuken. Na een half uur is de soep klaar. Ze eet samen met haar broer aan tafel.` },
  { level:"A2", tier:"short", topic:"food", source:"Practical situation", title:"Op de markt",
    text:`Op zaterdag gaat Pjotr naar de markt. Hij wil kaas en groente kopen. Bij de kaaskraam mag hij eerst een klein stukje proeven. "Lekker," zegt hij, en hij koopt een half pond jonge kaas. Daarna koopt hij tomaten en een bos bloemen. De verkoper geeft hem wat korting. Met volle tassen loopt Pjotr tevreden naar huis.` },

  // --- tech ---
  { level:"A2", tier:"short", topic:"tech", source:"Daily story", title:"Mijn telefoon is leeg",
    text:`Onderweg naar huis ziet Lena dat haar telefoon bijna leeg is. Ze wil nog een bericht sturen, maar het scherm gaat uit. Gelukkig heeft ze in haar tas een kleine oplader. In de trein vindt ze een stopcontact bij haar stoel. Ze laadt de telefoon een beetje op. Na tien minuten kan ze weer een bericht sturen. "Ik ben over een half uur thuis," typt ze.` },
  { level:"B1", tier:"short", topic:"tech", source:"News explainer", title:"Een app voor de buurt",
    text:`Steeds meer buurten gebruiken een app om dingen te delen. Iemand zoekt een boormachine, een ander biedt oude planten aan. Zo hoef je niet alles nieuw te kopen. De app maakt het ook makkelijk om hulp te vragen, bijvoorbeeld bij het verhuizen. Toch is niet iedereen enthousiast: sommige mensen vinden het te druk met berichten. Maar veel gebruikers zeggen dat ze hun buren nu beter kennen.` },

  // --- society ---
  { level:"A2", tier:"short", topic:"society", source:"Practical situation", title:"Afval scheiden",
    text:`In veel Nederlandse huizen staan meerdere bakken voor afval. Papier gaat apart, en ook glas en groente hebben een eigen bak. In het begin is dat even wennen. Waar hoort een pizzadoos? En plastic? Op de bakken staan kleine plaatjes die helpen. Als je afval goed scheidt, kan er meer worden hergebruikt. Zo maakt een klein gebaar toch verschil.` },
  { level:"B1", tier:"short", topic:"society", source:"Culture note", title:"Vrijwilligers in de buurt",
    text:`In bijna elke buurt zijn er mensen die vrijwilligerswerk doen. Ze helpen in het buurthuis, geven bijles of doen boodschappen voor ouderen. Ze krijgen er geen geld voor, maar wel waardering en contact. Voor veel vrijwilligers is dat juist de reden om te blijven. Zonder hen zouden veel activiteiten stoppen. Zo houden gewone mensen samen hun buurt levend.` },

  // ================= MEDIUM (90-150 words) =================
  // --- daily ---
  { level:"A2", tier:"medium", topic:"daily", source:"Daily story", title:"Een drukke woensdag",
    text:`Woensdag is voor Rosa altijd een drukke dag. 's Ochtends brengt ze haar dochter naar school en gaat ze daarna snel naar haar werk. In de pauze doet ze even boodschappen, want de koelkast is bijna leeg. Na het werk haalt ze haar dochter weer op. Samen fietsen ze naar de bibliotheek om een nieuw boek te zoeken.
Thuis maakt Rosa het eten klaar terwijl haar dochter tekent. Na het eten ruimen ze samen de tafel af. 's Avonds is Rosa moe, maar tevreden. Ze leest nog een kort verhaaltje voor en gaat daarna zelf ook vroeg naar bed. Morgen is er weer genoeg te doen.` },
  { level:"B1", tier:"medium", topic:"daily", source:"Daily story", title:"De buren leren kennen",
    text:`Toen Milan net verhuisd was, kende hij niemand in de straat. De eerste weken groette hij alleen even bij de voordeur. Dat veranderde toen hij een keer hielp om een zware kast naar boven te dragen. De buren nodigden hem daarna uit voor een kop koffie.
Langzaam leerde hij steeds meer mensen kennen. Nu let iemand op zijn planten als hij weg is, en hij haalt soms een pakketje voor de buurvrouw. Het zijn kleine dingen, maar ze maken een groot verschil. Milan merkt dat een straat pas echt een buurt wordt zodra je elkaars naam kent. Verhuizen was zwaar, maar hier voelt hij zich inmiddels thuis.` },

  // --- news ---
  { level:"B1", tier:"medium", topic:"news", source:"News explainer", title:"Waarom er steeds meer pakketten door de stad rijden",
    text:`Steeds meer mensen in Nederland bestellen spullen online. Kleding, boeken en zelfs boodschappen komen tegenwoordig gewoon aan de deur. Dat is handig, maar het zorgt ook voor problemen. Elke dag rijden er duizenden busjes door de steden om pakketten te bezorgen. Daardoor worden smalle straten drukker en is er meer uitstoot.
Sommige gemeenten zoeken naar oplossingen. Ze proberen bijvoorbeeld om pakketten op één centraal punt te verzamelen, zodat niet elke winkel apart hoeft te bezorgen. Ook vragen ze bewoners om hun pakket bij een afhaalpunt op te halen in plaats van thuis.
Toch is het lastig om gewoontes te veranderen. Veel mensen willen hun bestelling snel en gratis thuis. De vraag is dus niet alleen hoe we sneller bezorgen, maar ook hoe we dat op een slimmere manier doen.` },
  { level:"C1", tier:"medium", topic:"news", source:"News explainer", title:"De terugkeer van de nachttrein",
    text:`Na jaren van verwaarlozing beleeft de nachttrein in Europa een opmerkelijke comeback. Waar reizigers lang kozen voor goedkope vluchten, groeit nu de belangstelling voor een langzamere, maar bewustere manier van reizen. Slapend de grens over en 's ochtends uitgerust aankomen: het idee spreekt opnieuw tot de verbeelding.
Achter die romantiek schuilt echter een taai vraagstuk. Nachttreinen zijn duur om te exploiteren, en zonder steun van overheden zijn de kaartjes moeilijk betaalbaar te houden. Bovendien lopen de spoorregels per land uiteen, wat internationale verbindingen ingewikkeld maakt.
Of de nachttrein werkelijk terugkeert, hangt dus niet alleen af van nostalgie of goede bedoelingen. Het vraagt om investeringen en samenwerking die verder reiken dan de grenzen van één land.` },

  // --- culture ---
  { level:"B2", tier:"medium", topic:"culture", source:"Culture note", title:"De ongeschreven regels van de verjaardag",
    text:`Wie voor het eerst een Nederlandse verjaardag bezoekt, merkt al snel dat er ongeschreven regels bestaan. Vaak zitten de gasten in een kring, en je wordt geacht niet alleen de jarige, maar iedereen in de kamer te feliciteren. Voor buitenstaanders voelt dat soms wat ongemakkelijk.
Ook het eten volgt een bepaald ritme. Eerst is er koffie met precies één stukje taart. Pas later op de avond komen de hartige snacks en de drankjes tevoorschijn. Wie meteen een tweede stuk taart pakt, valt op.
Deze gewoonten lijken klein, maar ze zeggen iets over de cultuur. Ze draaien om gelijkheid en bescheidenheid: niemand krijgt te veel aandacht, en overdaad wordt vermeden. Juist in zulke alledaagse rituelen wordt zichtbaar wat een samenleving belangrijk vindt.` },
  { level:"B1", tier:"medium", topic:"culture", source:"Culture note", title:"Koningsdag in het oranje",
    text:`Eén dag per jaar kleurt heel Nederland oranje. Op Koningsdag vieren mensen de verjaardag van de koning, maar het feest is allang van iedereen geworden. In de steden is het druk, met muziek op straat en boten vol mensen in de grachten.
Het bekendste onderdeel is de vrijmarkt. Overal zitten kinderen en volwassenen op een kleedje om oude spullen te verkopen. Speelgoed, kleren en kleine spelletjes wisselen voor een paar euro van eigenaar. Sommige kinderen spelen viool of verkopen zelfgemaakte koekjes om wat geld te verdienen.
Aan het eind van de dag liggen de straten vol met lege kleedjes. Voor veel Nederlanders is Koningsdag niet zozeer een politiek feest, maar vooral een gezellige dag buiten met familie en vrienden.` },

  // --- travel ---
  { level:"B1", tier:"medium", topic:"travel", source:"Dialogue", title:"Een reis plannen",
    text:`Sofie: Zullen we in de herfstvakantie een paar dagen naar Berlijn gaan?
Ravi: Leuk! Nemen we het vliegtuig of de trein?
Sofie: Ik zou liever de trein nemen. Het duurt langer, maar je ziet onderweg veel meer.
Ravi: Dat is waar. En we kunnen dan gewoon werken of lezen in de trein.
Sofie: Precies. Ik kijk vanavond naar de tijden en de prijzen.
Ravi: Goed. Zoek jij de treinkaartjes, dan regel ik een hotel in het centrum.
Sofie: Afgesproken. Als we vroeg boeken, is het meestal goedkoper.
Ravi: Slim. Ik heb nu al zin om te gaan.` },
  { level:"B2", tier:"medium", topic:"travel", source:"News explainer", title:"Reizen buiten het hoogseizoen",
    text:`Steeds meer reizigers ontdekken de voordelen van reizen buiten het hoogseizoen. In het voor- en najaar zijn populaire steden minder druk, de prijzen liggen lager en de sfeer is vaak ontspannener. Wie in oktober door een Italiaanse stad loopt, hoeft niet in de rij te staan voor elk museum.
Toch zijn er ook nadelen. Het weer is minder zeker, sommige bezienswaardigheden zijn korter open, en niet elke badplaats is dan nog levendig. Reizen in het laagseizoen vraagt dus wat flexibiliteit.
Voor drukke bestemmingen kan die verschuiving bovendien helpen. Als bezoekers zich over het jaar verspreiden, wordt de last voor bewoners kleiner. Zo is rustiger reizen niet alleen prettiger voor de toerist, maar ook eerlijker tegenover de plek zelf.` },

  // --- work ---
  { level:"B1", tier:"medium", topic:"work", source:"News explainer", title:"Thuiswerken of naar kantoor",
    text:`Sinds een paar jaar werken veel mensen een deel van de week thuis. Voor sommigen is dat ideaal: geen reistijd, meer rust en makkelijker taken combineren met het gezin. Ze zeggen dat ze thuis vaak beter kunnen nadenken.
Toch mist niet iedereen het kantoor voor niets. Een kort gesprek bij de koffie, snel iets vragen aan een collega of samen een probleem oplossen gaat op afstand lastiger. Ook voelen sommige mensen zich thuis eenzaam.
Daarom kiezen veel bedrijven nu voor een mengvorm. Een paar dagen thuis, een paar dagen samen op kantoor. De grote vraag is niet meer óf mensen thuiswerken, maar welke taken je het beste waar doet.` },
  { level:"B2", tier:"medium", topic:"work", source:"Culture note", title:"Feedback geven zonder te kwetsen",
    text:`Goede feedback geven is een vak apart. Zeg je te weinig, dan verandert er niets; ben je te hard, dan slaat de ander dicht. De kunst zit in de balans tussen eerlijk en vriendelijk.
Veel mensen beginnen met iets positiefs, noemen daarna het punt dat beter kan en sluiten af met vertrouwen. Belangrijker dan die volgorde is echter de toon. Gaat het je werkelijk om de ander vooruithelpen, of vooral om je eigen gelijk?
In Nederland wordt directheid vaak gewaardeerd, maar directheid zonder respect voelt al snel bot. Wie kritiek concreet maakt en aan gedrag koppelt in plaats van aan iemands karakter, geeft de ander iets om mee te werken. Zo wordt feedback geen aanval, maar een uitnodiging.` },

  // --- food ---
  { level:"A2", tier:"medium", topic:"food", source:"Culture note", title:"Patat met",
    text:`In Nederland eten veel mensen graag patat. Je vindt een patatzaak in bijna elke stad. Vaak vraagt de verkoper: "Met mayonaise?" Voor veel Nederlanders hoort die saus er gewoon bij. Sommige mensen kiezen ketchup of pindasaus, en de combinatie van mayonaise, ketchup en ui heet "patatje oorlog".
Vroeger aten mensen patat vooral op vrijdag of in het weekend. Nu is het een snack voor elk moment: na het zwemmen, tijdens een dagje uit, of laat op de avond. Toch blijft patat iets bijzonders. Het is goedkoop, warm en makkelijk om samen te delen.
Wie in Nederland op bezoek komt, moet het een keer proberen. Bestel gewoon "een kleine patat met", en je krijgt meteen een stukje Nederlandse eetcultuur.` },
  { level:"B1", tier:"medium", topic:"food", source:"Culture note", title:"Waarom Nederlanders vroeg eten",
    text:`Wie in Nederland bij iemand thuis eet, merkt vaak dat het avondeten vroeg op tafel staat. In veel gezinnen wordt er al rond zes uur gegeten. Voor bezoekers uit Zuid-Europa is dat soms een verrassing, want daar begint het diner vaak pas veel later.
De gewoonte heeft praktische redenen. Vroeger werkten veel mensen op het land of in de fabriek en stonden ze 's ochtends heel vroeg op. Een vroege maaltijd paste goed bij dat ritme.
Vandaag de dag zijn de werktijden veranderd, maar de gewoonte blijft. Na het eten is de avond nog lang, met tijd voor een wandeling, sport of familie. Voor veel Nederlanders is dat vroege eten dus niet ouderwets, maar juist handig.` },

  // --- tech ---
  { level:"B1", tier:"medium", topic:"tech", source:"News explainer", title:"Betalen zonder contant geld",
    text:`In Nederland betalen steeds meer mensen zonder contant geld. In veel winkels, cafés en zelfs op de markt kun je gewoon met je pas of telefoon betalen. Voor veel klanten is dat snel en makkelijk.
Toch heeft die ontwikkeling ook een keerzijde. Niet iedereen kan even goed met een telefoon of pinpas omgaan, vooral sommige ouderen niet. En als een systeem een keer uitvalt, kun je opeens niets meer betalen.
Daarom vragen sommige mensen om aandacht voor wie nog wél contant geld gebruikt. Winkels mogen munten en briefjes niet zomaar weigeren. De vraag is hoe we het gemak van digitaal betalen combineren met een systeem dat voor iedereen blijft werken.` },
  { level:"B2", tier:"medium", topic:"tech", source:"News explainer", title:"Wat een slimme meter wel en niet doet",
    text:`In veel huizen hangt tegenwoordig een slimme meter, die het energieverbruik automatisch doorgeeft. Het idee is aantrekkelijk: wie precies ziet hoeveel stroom hij gebruikt, gaat er misschien zuiniger mee om. Sommige mensen passen inderdaad hun gewoonten aan als ze de cijfers zien.
Toch werkt techniek alleen niet. Een meter meet, maar hij bespaart niets uit zichzelf. Zonder duidelijke informatie blijven de getallen abstract, en veel gebruikers kijken er na een tijdje niet meer naar.
De echte winst ontstaat pas als de gegevens iets betekenen: een tip op het juiste moment, of inzicht in welk apparaat veel verbruikt. De slimme meter is dus geen oplossing op zich, maar een hulpmiddel dat pas werkt in combinatie met bewuste keuzes.` },

  // --- society ---
  { level:"B2", tier:"medium", topic:"society", source:"News explainer", title:"Waarom vrijwilligers onmisbaar zijn",
    text:`Achter veel activiteiten die we vanzelfsprekend vinden, staan mensen die er niets voor betaald krijgen. Sportclubs, buurthuizen, voedselbanken en festivals draaien voor een groot deel op vrijwilligers. Zonder hen zou een flink deel van het dagelijks leven simpelweg stilvallen.
Toch staat het vrijwilligerswerk onder druk. Mensen hebben het druk, verhuizen vaker en binden zich minder lang aan één organisatie. Clubs merken dat het steeds moeilijker wordt om vaste helpers te vinden.
De oplossing ligt deels in flexibiliteit. Wie niet elke week kan, wil misschien wel af en toe helpen bij een klus. Als organisaties dat mogelijk maken, blijft de deur open. Waardering en een beetje structuur doen de rest, want de meeste vrijwilligers blijven vooral omdat het werk zin geeft.` },
  { level:"C1", tier:"medium", topic:"society", source:"News explainer", title:"De stad die van iedereen is",
    text:`Een plein, een park of een stoep lijken vanzelfsprekend, maar juist die gedeelde ruimte bepaalt hoe een stad voelt. Waar mensen elkaar toevallig tegenkomen, ontstaat een vorm van samenleven die je niet kunt afdwingen. Publieke ruimte is daarmee meer dan lege grond tussen gebouwen.
Toch staat die ruimte voortdurend onder druk. Terrassen, reclame en geparkeerde auto's nemen plek in, en niet iedereen voelt zich overal even welkom. Wie ontwerpt voor de één, sluit soms ongemerkt de ander uit.
De vraag wie de straat mag gebruiken, is dan ook nooit puur praktisch. Ze raakt aan gelijkheid en aan de vraag van wie de stad eigenlijk is. Een plek die werkelijk van iedereen is, vraagt om voortdurende afweging, niet om één definitief antwoord.` },

  // ================= LONG (140-240 words) =================
  // --- daily ---
  { level:"B1", tier:"long", topic:"daily", source:"Daily story", title:"Een weekend zonder plannen",
    text:`Voor het eerst in weken had Iris een weekend zonder afspraken. Geen verjaardag, geen klus, geen lijst met dingen die af moesten. Eerst voelde dat vreemd, bijna ongemakkelijk. Ze was gewend om altijd bezig te zijn.
Op zaterdagochtend bleef ze langer in bed liggen en dronk ze rustig haar koffie bij het raam. Later maakte ze een lange wandeling door het park, zonder te letten op de tijd. Ze zag dingen die haar normaal niet opvielen: een man die zijn hond leerde zwemmen, kinderen die bladeren verzamelden.
's Middags belde ze een oude vriendin die ze lang niet had gesproken. Ze praatten bijna een uur, zomaar, over niets bijzonders. 's Avonds las Iris een paar hoofdstukken van een boek dat al maanden op haar nachtkastje lag.
Toen ze zondagavond terugkeek, had ze eigenlijk niets "gedaan". Toch voelde ze zich uitgeruster dan na een druk weekend. Misschien, dacht ze, is niksen ook een soort bezigheid die je af en toe nodig hebt.` },
  { level:"B2", tier:"long", topic:"daily", source:"News explainer", title:"De kunst van het niksen",
    text:`In een tijd waarin bijna iedereen het druk zegt te hebben, klinkt "niksen" bijna als een luxe of zelfs als luiheid. Toch groeit de aandacht voor het bewust doen van niets. Het Nederlandse woord is de laatste jaren zelfs in andere landen bekend geworden.
Niksen betekent niet hetzelfde als ontspannen met een doel. Het is geen meditatie en geen hobby. Het gaat juist om even helemaal niets nuttigs doen: uit het raam staren, op een bankje zitten, gedachten laten dwalen. Precies dat voelt voor veel mensen ongemakkelijk, omdat het lijkt op tijdverlies.
Onderzoekers wijzen er echter op dat het brein die lege momenten nodig heeft. Wie voortdurend prikkels binnenkrijgt, komt nauwelijks toe aan verwerken en nadenken. Ideeën ontstaan vaak juist tijdens verveling, niet tijdens de zoveelste taak.
De uitdaging is dat niksen zich slecht laat plannen. Zodra je het tot doel maakt, verdwijnt het effect. Misschien is de echte kunst dus niet om beter te niksen, maar om de schuldgevoelens los te laten die we eraan hebben gekoppeld.` },

  // --- news ---
  { level:"B2", tier:"long", topic:"news", source:"News explainer", title:"Leven onder de zeespiegel",
    text:`Een groot deel van Nederland ligt onder de zeespiegel, en toch wonen daar miljoenen mensen zonder er dagelijks bij stil te staan. Dijken, gemalen en duinen houden het water tegen, vaak zo onzichtbaar dat bewoners het gevaar vergeten. Dat vertrouwen is knap, maar ook riskant.
Door de klimaatverandering stijgt de zeespiegel langzaam, en tegelijk zakt op sommige plekken de bodem. De combinatie maakt de opgave groter dan ooit. Waterschappen moeten dijken verhogen en tegelijk ruimte zoeken voor rivieren die bij hevige regen veel water afvoeren.
Opvallend is dat de oplossing niet altijd hoger en sterker is. Steeds vaker kiezen deskundigen ervoor om het water juist ruimte te geven, met extra bergingsgebieden en natuurlijke oevers. Zo werkt men mét het water in plaats van er alleen tegen te vechten.
De grote vraag voor de komende decennia is hoeveel risico een samenleving wil accepteren, en wie de rekening betaalt. Water heeft in Nederland altijd geschiedenis geschreven, en dat verhaal is nog lang niet af.` },
  { level:"C1", tier:"long", topic:"news", source:"News explainer", title:"De strijd om de stilte",
    text:`Stilte lijkt gratis en vanzelfsprekend, maar in een dichtbevolkt land is ze een schaars goed geworden. Wegen, vliegroutes, terrassen en warmtepompen produceren samen een voortdurend achtergrondgeluid dat velen nauwelijks nog opmerken. Pas wie een echt stille plek bezoekt, beseft hoe zeldzaam die is geworden.
Geluidsoverlast is meer dan een kwestie van comfort. Onderzoek verbindt langdurige blootstelling aan lawaai met slechter slapen, stress en zelfs gezondheidsklachten. Toch krijgt geluid in beleid vaak minder aandacht dan zichtbare vormen van vervuiling, misschien juist omdat het ongrijpbaar is.
Bovendien botsen belangen voortdurend. De één zijn levendige terras is de ander zijn slapeloze nacht; economische bedrijvigheid en rust laten zich niet altijd verzoenen. Wie stilte wil beschermen, moet dus keuzes maken over hoe we de ruimte verdelen.
Sommige gemeenten wijzen daarom bewust "stille gebieden" aan, waar geluid zo veel mogelijk wordt beperkt. Of zulke plekken standhouden, hangt af van hoe zwaar we rust laten wegen tegenover alles wat nu eenmaal geluid maakt. De strijd om de stilte is uiteindelijk een strijd om prioriteiten.` },

  // --- culture ---
  { level:"B2", tier:"long", topic:"culture", source:"Culture note", title:"Waarom de gordijnen openblijven",
    text:`Buitenlanders die door een Nederlandse straat lopen, valt vaak iets op: 's avonds branden de lampen, maar de gordijnen blijven open. Je kijkt zo bij mensen naar binnen, waar ze aan tafel zitten of tv-kijken. Voor veel bezoekers voelt dat verrassend, bijna te open.
Er bestaan verschillende verklaringen voor de gewoonte. Een populaire, maar omstreden theorie verwijst naar een protestants verleden, waarin je niets te verbergen zou moeten hebben. Anderen wijzen simpelweg op de liefde voor daglicht in een land met veel grijze dagen.
Wat de oorsprong ook is, de gewoonte zegt iets over de omgang met privacy. Nederlanders trekken een duidelijke grens tussen wat openbaar zichtbaar mag zijn en wat echt privé blijft. Zien is niet hetzelfde als binnenkomen; je kijkt hooguit even, maar je staart niet.
Tegelijk verandert het beeld langzaam. In grote steden gaan gordijnen vaker dicht, uit behoefte aan rust of anonimiteit. Toch blijft de open gordijn voor velen een klein, alledaags symbool van vertrouwen in de buurt.` },
  { level:"C1", tier:"long", topic:"culture", source:"Culture note", title:"Gedogen: leven met de grijze zone",
    text:`Weinig woorden zijn zo Nederlands en zo lastig te vertalen als "gedogen". Het betekent iets officieel niet toestaan, maar het in de praktijk toch laten gebeuren. Iets is verboden op papier, terwijl de overheid bewust besluit niet in te grijpen. Voor buitenstaanders klinkt dat verwarrend, misschien zelfs slordig.
Toch zit er een bepaalde logica achter. Gedogen ontstaat vaak wanneer een strikte regel in de werkelijkheid onhoudbaar blijkt, maar afschaffen politiek te gevoelig ligt. In plaats van een scherpe keuze ontstaat een grijze zone, met richtlijnen die aangeven hoe ver iets mag gaan.
Critici vinden die aanpak oneerlijk en onduidelijk. Wat vandaag wordt gedoogd, kan morgen toch worden bestraft, en niet iedereen weet waar hij aan toe is. De regel verliest zo een deel van haar gezag.
Voorstanders zien juist pragmatisme: liever een werkbare praktijk dan een wet die niemand naleeft. In die spanning schuilt iets typerends voor de Nederlandse bestuurscultuur, waarin compromis en werkbaarheid vaak zwaarder wegen dan het zuivere principe.` },

  // --- travel ---
  { level:"B1", tier:"long", topic:"travel", source:"Daily story", title:"Een fietstocht door de polder",
    text:`Op een heldere zaterdag besloten Wout en zijn vriendin een lange fietstocht te maken. Ze pakten wat brood, twee flessen water en een kaart, en vertrokken vroeg de stad uit. Al snel lag de drukte achter hen en reden ze door open polderland.
Het landschap was vlak en wijd. Aan beide kanten lagen weilanden met koeien, en in de sloten zwommen eenden. De wind stond stevig, wat het fietsen soms zwaar maakte, maar de rust maakte veel goed. Ze stopten bij een klein bruggetje om te eten.
Onderweg kwamen ze door een dorp met maar één winkel en een oude kerk. Ze dronken koffie op een terrasje en praatten met een vriendelijke man die vertelde over het gebied.
's Middags fietsten ze langzaam terug, met de wind nu in de rug. Ze waren moe, maar voldaan. Zo'n dag hoefde niet ver of bijzonder te zijn, merkten ze; soms is een tocht door de eigen omgeving al genoeg om je vrij te voelen.` },
  { level:"B2", tier:"long", topic:"travel", source:"Daily story", title:"De veerboot naar het eiland",
    text:`De overtocht naar het Waddeneiland duurde ruim een uur, en dat uur hoorde er voor Noor helemaal bij. Ze stond het liefst buiten aan de reling, ook als het waaide. Achter de boot verdween langzaam de haven, en vóór haar lag alleen nog water en lucht.
Het reizen naar een eiland heeft iets bijzonders. Je kunt er niet even heen rijden; je bent afhankelijk van de tijden van de veerboot en van het weer. Juist dat maakt de aankomst waardevoller. Wie eenmaal aan land is, voelt de haast van het vasteland afnemen.
Op het eiland ging bijna alles op de fiets. Auto's waren er weinig, en de wegen liepen langs duinen en weilanden. 's Avonds was het er donker en stil, met een sterrenhemel die Noor thuis nooit zo helder zag.
Toen ze na een paar dagen terugvoer, keek ze anders naar de drukte die haar opwachtte. Het eiland had haar niets nieuws geleerd, maar wel iets ouds teruggegeven: het besef dat afstand en tijd soms precies zijn wat een plek bijzonder maakt.` },

  // --- work ---
  { level:"B1", tier:"long", topic:"work", source:"Dialogue", title:"Samen studeren",
    text:`Tim: Hoe gaat het met je scriptie? Je zei vorige week dat je een beetje vastzat.
Ella: Het gaat nu iets beter, denk ik. Ik had te veel tegelijk willen doen, en daardoor kwam ik nergens.
Tim: Dat herken ik. Wat heeft geholpen?
Ella: Ik ben begonnen met kleine doelen. Elke dag schrijf ik maar één alinea, ook als ik geen zin heb. Zo blijft het overzichtelijk.
Tim: Slim. Ik merk zelf dat ik beter werk als ik 's ochtends begin. 's Middags word ik snel afgeleid door mijn telefoon.
Ella: Misschien moeten we samen in de bibliotheek afspreken. Als iemand naast me zit, blijf ik langer geconcentreerd.
Tim: Goed idee. Dan spreken we af dat we eerst een uur stil werken en daarna samen koffie halen.
Ella: Perfect. En als ik weer twijfel over mijn onderwerp, help jij me dan even nadenken?
Tim: Natuurlijk. Soms heb je gewoon iemand nodig die de juiste vragen stelt.` },
  { level:"B2", tier:"long", topic:"work", source:"News explainer", title:"De vergadering die een wandeling werd",
    text:`Steeds meer mensen ontdekken dat je niet elke bespreking aan een tafel hoeft te houden. In plaats van in een benauwde vergaderkamer te zitten, lopen collega's samen een rondje buiten terwijl ze praten. De wandelvergadering, ooit een uitzondering, wint langzaam terrein.
De voordelen liggen voor de hand. Bewegen is goed voor lichaam en hoofd, en frisse lucht maakt gesprekken vaak losser. Wie naast elkaar loopt in plaats van tegenover elkaar zit, voelt zich soms vrijer om eerlijk te zijn. Bovendien onderbreekt niemand het gesprek om even op een scherm te kijken.
Toch is de aanpak niet voor alles geschikt. Je kunt onderweg lastig aantekeningen maken of een presentatie laten zien, en bij grote groepen wordt het al snel rommelig. Ook het weer speelt een rol; niet elke dag nodigt uit tot buiten lopen.
Het beste is dan ook om te kiezen per soort gesprek. Voor korte overleggen, brainstormen of een lastig persoonlijk onderwerp kan een wandeling wonderen doen. Voor beslissingen die documentatie vragen, blijft de tafel handiger. De vorm van een gesprek, zo blijkt, beïnvloedt vaak de inhoud.` },

  // --- food ---
  { level:"B1", tier:"long", topic:"food", source:"Culture note", title:"Stamppot voor een koude avond",
    text:`Als het buiten koud en donker is, staat er in veel Nederlandse huizen stamppot op tafel. Het is een eenvoudig gerecht: aardappels die je samen met groente fijnstampt. De bekendste soort is boerenkool met worst, maar ook andijvie of hutspot met wortel en ui zijn populair.
Vroeger was stamppot vooral eten voor gewone werkdagen. Het was goedkoop, voedzaam en makkelijk te maken in één pan. Boeren en arbeiders hadden na een lange dag behoefte aan een warme, stevige maaltijd.
Vandaag de dag eten mensen gevarieerder, en stamppot is niet meer van elke week. Toch blijft het gerecht geliefd, juist omdat het herinneringen oproept aan vroeger en aan thuis. Veel mensen maken het zoals hun ouders het maakten.
In restaurants zie je soms modernere versies, met andere groenten of kruiden. Maar voor de meeste Nederlanders hoeft dat niet zo bijzonder. Een bord stamppot met een kuiltje jus is precies goed zoals het is: simpel, warm en vertrouwd op een koude avond.` },
  { level:"B2", tier:"long", topic:"food", source:"News explainer", title:"De opmars van de seizoensgroente",
    text:`Jarenlang lag in de supermarkt het hele jaar door vrijwel alles: aardbeien in december, tomaten in februari. Nu groeit langzaam de belangstelling voor eten dat past bij het seizoen. Steeds meer mensen kopen groente en fruit dat op dat moment in de eigen regio rijp is.
Achter die verschuiving zitten meerdere redenen. Seizoensgroente hoeft niet van ver te komen of in verwarmde kassen te groeien, wat beter kan zijn voor het milieu. Bovendien smaakt product dat op het juiste moment is geoogst vaak gewoon beter. Sommige mensen ontdekken via een groentepakket ineens soorten die ze nooit eerder kochten.
Toch is de omslag niet eenvoudig. Koken met het seizoen vraagt meer flexibiliteit, want je weet niet altijd van tevoren wat er in de kist zit. Wie gewend is aan vaste recepten, moet leren improviseren met wat er beschikbaar is.
Misschien is dat juist de winst. Eten met het seizoen dwingt tot aandacht voor waar voedsel vandaan komt en hoe het groeit. Wat begon als een praktische keuze, wordt zo ook een andere manier van kijken naar de maaltijd.` },

  // --- tech ---
  { level:"B2", tier:"long", topic:"tech", source:"News explainer", title:"Kunstmatige intelligentie op het werk",
    text:`Kunstmatige intelligentie duikt steeds vaker op in gewone kantoorbanen. Programma's die teksten schrijven, mails samenvatten of afspraken plannen, worden in korte tijd onmisbaar voor sommige werknemers. De grote vraag is niet langer óf deze technologie ons werk verandert, maar hóé we ermee omgaan.
Voorstanders wijzen op de tijdwinst. Saai, herhalend werk kan door software worden overgenomen, zodat mensen zich kunnen richten op taken die creativiteit of menselijk inzicht vragen. Wie de tools slim gebruikt, houdt meer ruimte over voor het werk dat er echt toe doet.
Toch zijn er ook zorgen. Niet elke functie profiteert evenveel, en sommige medewerkers vrezen dat hun taken overbodig worden. Bovendien maken deze systemen fouten die op het eerste gezicht overtuigend lijken. Wie te veel vertrouwt op een automatisch antwoord, loopt het risico onzin door te sturen zonder het te merken.
Waarschijnlijk ligt de oplossing in de combinatie. De technologie neemt het routinewerk over, terwijl de mens verantwoordelijk blijft voor het oordeel. Juist dat evenwicht bepaalt of kunstmatige intelligentie een hulpmiddel wordt of een probleem.` },
  { level:"C1", tier:"long", topic:"tech", source:"News explainer", title:"Het recht om vergeten te worden",
    text:`Alles wat we online doen, laat sporen na. Een oude foto, een verwijderd account, een bericht van jaren geleden: het internet vergeet zelden iets uit zichzelf. Juist daarom groeide de afgelopen jaren de aandacht voor een opmerkelijk idee, het recht om vergeten te worden.
Het principe klinkt eenvoudig. Onder bepaalde voorwaarden kun je vragen om informatie over jezelf te laten verwijderen, bijvoorbeeld uit de resultaten van een zoekmachine. Wie ooit een fout maakte, hoeft daar niet eindeloos op afgerekend te worden. Mensen veranderen, en hun digitale verleden zou dat moeten kunnen volgen.
Toch botst dit recht met een ander belang: de vrijheid van informatie. Wat de één als privé beschouwt, kan voor de ander nieuwswaardig zijn. Een politicus die zijn verleden wil wissen, is iets anders dan een gewone burger die met rust gelaten wil worden. De grens is zelden scherp.
Daardoor blijft het een voortdurende afweging tussen privacy en openbaarheid, tussen vergeten en herinneren. Wie mag bepalen wat verdwijnt, en wat bewaard blijft? Het antwoord verschilt per geval, en juist die onzekerheid maakt het onderwerp zo lastig.` },

  // --- society ---
  { level:"C1", tier:"long", topic:"society", source:"News explainer", title:"Wonen in een land dat vol lijkt",
    text:`Weinig onderwerpen roepen in Nederland zoveel emotie op als de woningmarkt. Wie tegenwoordig een betaalbare woning zoekt, stuit al snel op lange wachtlijsten, torenhoge prijzen en een gevoel van machteloosheid. Toch is "het land is vol" een te makkelijke verklaring voor een probleem dat vooral met keuzes te maken heeft.
De ruimte in Nederland is schaars, dat klopt, maar ze wordt ook ongelijk verdeeld. Terwijl starters en studenten nauwelijks iets kunnen vinden, staan elders kantoren leeg en liggen bouwplannen jarenlang stil door procedures en bezwaren. Het tekort is dus niet alleen fysiek, maar ook bestuurlijk en politiek van aard.
Bovendien botsen belangen voortdurend. Wie nieuwbouw wil, moet rekening houden met natuur, met bestaande bewoners en met de vraag wie de rekening betaalt. Elke oplossing die de één vooruithelpt, raakt de belangen van de ander.
Misschien is dat de kern van de kwestie. De woningnood laat zich niet oplossen met één ingreep, maar vraagt om lastige afwegingen die zelden iedereen tevredenstellen. Zolang we blijven doen alsof er een simpel antwoord bestaat, schuiven we het echte gesprek voor ons uit.` },
  { level:"C1", tier:"long", topic:"society", source:"News explainer", title:"De prijs van altijd bereikbaar zijn",
    text:`De grens tussen werk en privé is de afgelopen jaren geruisloos vervaagd. Waar de werkdag vroeger eindigde zodra je het kantoor verliet, blijft hij nu doorlopen op de telefoon in onze broekzak. Een berichtje 's avonds, een mail in het weekend: op zichzelf onschuldig, maar samen vormen ze een verwachting die zwaar kan wegen.
Opvallend is dat niemand die verwachting echt heeft opgelegd. Er bestaat zelden een regel die zegt dat je altijd moet reageren. Toch voelen veel mensen de druk om beschikbaar te blijven, uit angst om lui of ongeïnteresseerd over te komen. Zo houden we een systeem in stand dat eigenlijk niemand bewust heeft gekozen.
Sommige landen en bedrijven proberen tegenwicht te bieden, bijvoorbeeld met een "recht om onbereikbaar te zijn". Zulke afspraken helpen, maar ze raken niet de kern. Zolang we rust zien als een teken van gebrek aan inzet, zal geen enkele regel ons echt beschermen.
Uiteindelijk gaat het om een cultuurverandering. Pas als we accepteren dat wie soms niet reageert niet minder toegewijd is, ontstaat er ruimte om werkelijk los te laten.` },
];

export { FALLBACK_DUTCH, topicKey };
