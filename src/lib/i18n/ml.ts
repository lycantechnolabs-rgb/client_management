import type { StringKey } from "./en";

/**
 * Malayalam — A FIRST DRAFT, NOT REVIEWED BY A MALAYALAM SPEAKER.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  Every string in this file was drafted by the machine that wrote the rest
 *  of this application. None of it has been read by a person who speaks
 *  Malayalam. Treat it as a starting point for review, not as finished text.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * It is here rather than left blank because Jinto reads Malayalam and can
 * correct it directly in the admin — the corrections live in the database and
 * win over anything written here, so reviewing is editing a box rather than
 * shipping a code change. `/admin/language` lists every string with the English
 * beside it and marks which have been checked.
 *
 * The words most likely to be wrong are the ones that matter most: the estate
 * vocabulary. `വിളവെടുപ്പ്` for harvest, `തോട്ടം` for the estate, `ഏലം` for
 * cardamom — these are the everyday words as far as this can judge, but a
 * grower in Idukki may simply say something else, and the local word is the
 * right one. Grades and product names are deliberately left in English:
 * "Alleppey Green Extra Bold" is what the auction floor says.
 *
 * The privacy notice is NOT translated here. That is legal text, it lives in
 * docs/dpdp/malayalam-translation.md, and it needs a translator rather than a
 * review — a mistranslated notice misinforms where a missing one merely omits.
 */
export const ml: Record<StringKey, string> = {
  /* --- navigation ------------------------------------------------------- */
  "nav.home": "ഹോം",
  "nav.work": "പണി",
  "nav.photos": "ഫോട്ടോകൾ",
  "nav.money": "ചെലവ്",
  "nav.harvest": "വിളവെടുപ്പ്",
  "nav.inputs": "വളവും മരുന്നും",
  "nav.documents": "രേഖകൾ",
  "nav.messages": "സന്ദേശങ്ങൾ",
  "nav.yourData": "നിങ്ങളുടെ വിവരങ്ങൾ",
  "nav.profile": "പ്രൊഫൈൽ",
  "nav.settings": "ക്രമീകരണങ്ങൾ",
  "nav.signOut": "പുറത്തുകടക്കുക",

  /* --- the home screen --------------------------------------------------- */
  "home.cardamomDried": "ഉണക്കിയ ഏലം",
  "home.thisSeason": "ഈ സീസണിൽ",
  "home.saleValue": "വിൽപ്പന തുക",
  "home.fromHarvests": "രേഖപ്പെടുത്തിയ വിളവെടുപ്പുകളിൽ നിന്ന്",
  "home.spentOnEstate": "തോട്ടത്തിൽ ചെലവായത്",
  "home.labour": "കൂലി",
  "home.inputs": "വളവും മരുന്നും",
  "home.lastVisit": "അവസാന സന്ദർശനം",
  "home.jobsRecorded": "പണികൾ രേഖപ്പെടുത്തി",
  "home.yourEstates": "നിങ്ങളുടെ തോട്ടങ്ങൾ",
  "home.viewWork": "പണി കാണുക",
  "home.acres": "ഏക്കർ",
  "home.plants": "ചെടികൾ",
  "home.recentWork": "അടുത്തിടെ ചെയ്ത പണി",
  "home.seeAll": "എല്ലാം കാണുക",
  "home.noWorkYet": "ഇതുവരെ ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല",
  "home.noWorkYetBody":
    "ജിന്റോ നിങ്ങളുടെ തോട്ടത്തിൽ വരുമ്പോൾ ചെയ്യുന്ന പണി ഫോട്ടോ സഹിതം ഇവിടെ കാണാം.",
  "home.somethingToAsk": "എന്തെങ്കിലും ചോദിക്കാനുണ്ടോ?",
  "home.messageOnWhatsapp": "ജിന്റോയ്ക്ക് നേരിട്ട് വാട്‌സ്ആപ്പിൽ സന്ദേശം അയയ്ക്കൂ.",
  "home.whatsapp": "വാട്‌സ്ആപ്പ്",
  "home.greeting": "നിങ്ങളുടെ തോട്ടം",
  "home.totalSpend": "ഇതുവരെയുള്ള ചെലവ്",
  "home.driedTotal": "ഉണക്കിയത്",
  "home.saleTotal": "വിൽപ്പന തുക",
  "home.roundsLogged": "രേഖപ്പെടുത്തിയ സന്ദർശനങ്ങൾ",
  "home.callJinto": "ജിന്റോയെ വിളിക്കുക",

  /* --- the picking round board -------------------------------------------- */
  "rounds.title": "അടുത്ത റൗണ്ടുകൾ",
  "rounds.allOnSchedule": "എല്ലാം സമയത്ത്",
  "rounds.cadence": "ഏകദേശം 45 ദിവസം കൂടുമ്പോൾ പറിക്കാറാകും",
  "rounds.nextPickingIn": "അടുത്ത പറിക്കൽ",
  "rounds.days": "ദിവസത്തിൽ",
  "rounds.due": "തീയതി",
  "rounds.noHarvestYet": "ഇതുവരെ വിളവെടുപ്പ് രേഖപ്പെടുത്തിയിട്ടില്ല",
  "rounds.noHistory": "രേഖയില്ല",
  "rounds.overdue": "വൈകി",
  "rounds.harvest": "വിളവെടുപ്പ്",
  "rounds.fertilizer": "വളം",
  "rounds.spray": "മരുന്ന്",
  "rounds.nextPickingInDays": "അടുത്ത പറിക്കൽ {days} ദിവസത്തിൽ",
  "rounds.nextPickingTomorrow": "അടുത്ത പറിക്കൽ നാളെ",
  "rounds.nextPickingToday": "അടുത്ത പറിക്കൽ ഇന്ന്",
  "rounds.pickingOverdueDays": "പറിക്കൽ {days} ദിവസം വൈകി",
  "rounds.pickingOverdueDay": "പറിക്കൽ {days} ദിവസം വൈകി",
  "rounds.needAttention": "{count} എണ്ണം ശ്രദ്ധ വേണം",
  "rounds.noEstatesYet": "വിളവെടുപ്പ് രേഖയുള്ള തോട്ടങ്ങളൊന്നുമില്ല.",
  "rounds.stagePicking": "പറിക്കൽ",
  "rounds.stageFertilizer": "വളം",
  "rounds.stageSpray": "മരുന്ന്",
  "rounds.statusOverdue": "വൈകി",
  "rounds.statusDueNow": "ഇപ്പോൾ വേണം",

  /* --- the work log ------------------------------------------------------ */
  "work.title": "പണിയുടെ രേഖ",
  "work.allWork": "എല്ലാ പണിയും",
  "work.allBlocks": "എല്ലാ ഭാഗങ്ങളും",
  "work.noneYet": "ഇതുവരെ പണിയൊന്നും രേഖപ്പെടുത്തിയിട്ടില്ല",
  "work.noneYetBody":
    "നിങ്ങളുടെ തോട്ടത്തിലേക്കുള്ള ഓരോ സന്ദർശനവും ഇവിടെ രേഖപ്പെടുത്തും.",
  "work.photos": "ഫോട്ടോകൾ",
  "work.inputs": "വളം/മരുന്ന്",
  "work.on": "ൽ",

  /* --- one visit --------------------------------------------------------- */
  "visit.back": "പണിയുടെ രേഖ",
  "visit.recordedBy": "രേഖപ്പെടുത്തിയത്",
  "visit.notes": "കുറിപ്പുകൾ",
  "visit.whoWorked": "പണിയെടുത്തവർ",
  "visit.inputsApplied": "ഉപയോഗിച്ചത്",
  "visit.harvestRecord": "വിളവെടുപ്പിന്റെ രേഖ",
  "visit.greenWeight": "പച്ചത്തൂക്കം",
  "visit.afterCuring": "ഉണക്കിയ ശേഷം",
  "visit.rate": "വില",
  "visit.saleValue": "വിൽപ്പന തുക",
  "visit.gradedInto": "തരം തിരിച്ചത്",
  "visit.grade": "തരം",
  "visit.cost": "ചെലവ്",
  "visit.labour": "കൂലി",
  "visit.materials": "വളവും മരുന്നും",
  "visit.other": "മറ്റുള്ളവ",
  "visit.total": "ആകെ",

  /* --- money ------------------------------------------------------------- */
  "money.title": "ചെലവ് എത്ര",
  "money.subtitle": "നിങ്ങളുടെ തോട്ടത്തിൽ ചെലവായ ഓരോ രൂപയും, മാസം തിരിച്ച്.",
  "money.labour": "കൂലി",
  "money.materials": "വളവും മരുന്നും",
  "money.other": "മറ്റുള്ളവ",
  "money.total": "ആകെ",
  "money.income": "വിൽപ്പന തുക",
  "money.noneYet": "ഇതുവരെ ചെലവൊന്നും രേഖപ്പെടുത്തിയിട്ടില്ല",

  /* --- harvest ----------------------------------------------------------- */
  "harvest.title": "വിളവെടുപ്പ്",
  "harvest.subtitle": "ഓരോ വിളവെടുപ്പും, അതിൽ നിന്ന് കിട്ടിയതും.",
  "harvest.green": "പച്ച",
  "harvest.dried": "ഉണങ്ങിയത്",
  "harvest.rate": "വില",
  "harvest.value": "തുക",
  "harvest.noneYet": "ഇതുവരെ വിളവെടുപ്പ് രേഖപ്പെടുത്തിയിട്ടില്ല",
  "harvest.noneYetBody":
    "ഓരോ വിളവെടുപ്പും തൂക്കം, തരം, കിട്ടിയ തുക എന്നിവയോടെ ഇവിടെ കാണാം.",
  "harvest.driedTotal": "ആകെ ഉണങ്ങിയത്",
  "harvest.greenPicked": "പറിച്ച പച്ച",
  "harvest.averageRate": "ശരാശരി വില",
  "harvest.perKgDried": "ഉണങ്ങിയ ഒരു കിലോയ്ക്ക്",
  "harvest.pickingRounds": "വിളവെടുപ്പുകൾ",
  "harvest.seasonTotal": "സീസണിലെ ആകെ",

  /* --- photos and documents ---------------------------------------------- */
  "photos.title": "ഫോട്ടോകളും വീഡിയോകളും",
  "photos.videos": "വീഡിയോകൾ",
  "photos.photos": "ഫോട്ടോകൾ",
  "photos.noneYet": "ഇതുവരെ ഫോട്ടോകളില്ല",
  "photos.noneYetBody":
    "ഓരോ സന്ദർശനത്തിലെയും ഫോട്ടോകൾ ഇവിടെ ശേഖരിക്കപ്പെടും.",
  "photos.add": "ഒരു ഫോട്ടോയോ വീഡിയോയോ ചേർക്കുക",
  "docs.title": "രേഖകൾ",
  "docs.noneYet": "ഇതുവരെ രേഖകളില്ല",
  "docs.noneYetBody":
    "ലാബ് റിപ്പോർട്ടുകൾ, ലേല സ്ലിപ്പുകൾ, ബില്ലുകൾ, സർട്ടിഫിക്കറ്റുകൾ എന്നിവ ഇവിടെ സൂക്ഷിക്കും.",
  "docs.add": "ഒരു രേഖ ചേർക്കുക",

  /* --- uploading --------------------------------------------------------- */
  "upload.chooseFiles": "നിങ്ങളുടെ തോട്ടത്തിലെ ഫോട്ടോകളോ വീഡിയോയോ",
  "upload.chooseDoc": "ലാബ് റിപ്പോർട്ട്, ലേല സ്ലിപ്പ്, ബിൽ അല്ലെങ്കിൽ സർട്ടിഫിക്കറ്റ്",
  "upload.caption": "അതിനെപ്പറ്റി ഒരു കുറിപ്പ് (നിർബന്ധമില്ല)",
  "upload.captionHint": "എവിടെ എടുത്തത്, അല്ലെങ്കിൽ എന്താണ് കാണിക്കുന്നത്",
  "upload.whatIsIt": "ഇത് എന്താണ്?",
  "upload.send": "അപ്‌ലോഡ് ചെയ്യുക",
  "upload.sending": "അയയ്ക്കുന്നു…",
  "upload.cancel": "വേണ്ട",
  "upload.added": "ചേർത്തു.",
  "upload.oneAtATime":
    "ഓരോന്നായി അയയ്ക്കുന്നു, അതിനാൽ കണക്ഷൻ പതുക്കെയായാലും എല്ലാം നഷ്ടപ്പെടില്ല.",

  /* --- messages ---------------------------------------------------------- */
  "messages.title": "സന്ദേശങ്ങൾ",
  "messages.placeholder": "നിങ്ങളുടെ സന്ദേശം",
  "messages.send": "അയയ്ക്കുക",
  "messages.noneYet": "ഇതുവരെ ഒന്നും പറഞ്ഞിട്ടില്ല",
  "messages.noneYetBody": "ജിന്റോയ്ക്ക് ഇവിടെ എഴുതൂ, അദ്ദേഹം കാണും.",
  "messages.notInstant":
    "ഇത് നേരിട്ട് അദ്ദേഹത്തിന്റെ ഫോണിൽ എത്തില്ല — അത്യാവശ്യമാണെങ്കിൽ വിളിക്കുക അല്ലെങ്കിൽ വാട്‌സ്ആപ്പ് ചെയ്യുക.",

  /* --- profile and settings ---------------------------------------------- */
  "profile.title": "നിങ്ങളുടെ വിവരങ്ങൾ",
  "profile.estate": "തോട്ടം",
  "profile.phone": "ഫോൺ",
  "profile.village": "സ്ഥലം",
  "settings.title": "ക്രമീകരണങ്ങൾ",
  "settings.subtitle": "നിങ്ങളുടെ പാസ്‌വേഡ്, ഞങ്ങൾ എങ്ങനെ ബന്ധപ്പെടും എന്നത്.",
  "settings.changePassword": "പാസ്‌വേഡ് മാറ്റുക",
  "settings.current": "ഇപ്പോഴത്തെ പാസ്‌വേഡ്",
  "settings.new": "പുതിയ പാസ്‌വേഡ്",
  "settings.confirm": "പുതിയ പാസ്‌വേഡ് ഒന്നുകൂടി",
  "settings.save": "പാസ്‌വേഡ് മാറ്റുക",
  "settings.language": "ഭാഷ",
  "settings.languageHint": "ഈ ഭാഷയിലായിരിക്കും പോർട്ടൽ കാണിക്കുക.",
  "settings.english": "English",
  "settings.malayalam": "മലയാളം",

  /* --- catalogue labels --------------------------------------------------- */
  "activityType.FERTILIZER": "വളമിടൽ",
  "activityType.SPRAYING": "മരുന്നടി",
  "activityType.WEEDING": "കള പറിക്കൽ",
  "activityType.IRRIGATION": "നനയ്ക്കൽ",
  "activityType.MULCHING": "പുതയിടൽ",
  "activityType.SHADE": "തണൽ ക്രമീകരണം",
  "activityType.HARVEST": "വിളവെടുപ്പ്",
  "activityType.CURING": "ഉണക്കൽ",
  "activityType.PLANTING": "നടീൽ / കുഴി നികത്തൽ",
  "activityType.INSPECTION": "പരിശോധന",
  "activityType.OTHER": "മറ്റു പണികൾ",

  "materialCategory.FERTILIZER": "വളം",
  "materialCategory.PESTICIDE": "കീടനാശിനി",
  "materialCategory.FUNGICIDE": "കുമിൾനാശിനി",
  "materialCategory.GROWTH": "വളർച്ചാ ഉത്തേജകം",
  "materialCategory.OTHER": "മറ്റുള്ളവ",

  "docCategory.LAB_REPORT": "ലാബ് / അവശിഷ്ട പരിശോധന റിപ്പോർട്ട്",
  "docCategory.AUCTION": "ലേല സ്ലിപ്പ്",
  "docCategory.INVOICE": "ബിൽ / ഇൻവോയ്സ്",
  "docCategory.LICENCE": "ലൈസൻസ് / സർട്ടിഫിക്കറ്റ്",
  "docCategory.OTHER": "മറ്റുള്ളവ",

  "card.dried": "ഉണങ്ങിയത്",

  /* --- money page ---------------------------------------------------------- */
  "money.noneYetBody": "നിങ്ങളുടെ തോട്ടത്തിൽ ചെലവായ ഓരോ രൂപയും ഇവിടെ കാണാം.",
  "money.totalSpent": "ആകെ ചെലവ്",
  "money.inputsAndMaterials": "വളവും മരുന്നും",
  "money.fromHarvests": "വിളവെടുപ്പിൽ നിന്ന്",
  "money.monthByMonth": "മാസം തിരിച്ച്",

  /* --- input log ------------------------------------------------------------ */
  "inputs.title": "വളവും മരുന്നും",
  "inputs.noneYet": "ഇതുവരെ ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല",
  "inputs.noneYetBody": "തോട്ടത്തിൽ ഇട്ട വളവും അടിച്ച മരുന്നും ഇവിടെ കാണാം.",
  "inputs.input": "വളം/മരുന്ന്",
  "inputs.quantity": "അളവ്",
  "inputs.estate": "തോട്ടം",

  /* --- work log filters ----------------------------------------------------- */
  "work.noneUnderFilter": "ഈ തിരഞ്ഞെടുപ്പിൽ പണിയൊന്നുമില്ല",
  "work.tryAnother": "മറ്റൊരു തരം പണി നോക്കുക, അല്ലെങ്കിൽ എല്ലാം കാണുക.",

  /* --- profile -------------------------------------------------------------- */
  "profile.name": "പേര്",
  "profile.clientCode": "ക്ലയന്റ് കോഡ്",
  "profile.email": "ഇമെയിൽ",
  "profile.address": "വിലാസം",
  "profile.withUsSince": "ഞങ്ങളോടൊപ്പം മുതൽ",
  "profile.getInTouch": "ബന്ധപ്പെടുക",

  /* --- your data ------------------------------------------------------------ */
  "data.title": "നിങ്ങളുടെ വിവരങ്ങൾ",
  "data.whatWeHold": "ഞങ്ങളുടെ പക്കലുള്ളത്",

  /* --- filters, tables and the rest of the portal chrome ------------------- */
  "filter.allWork": "എല്ലാ പണിയും",
  "filter.allEstates": "എല്ലാ തോട്ടങ്ങളും",
  "table.date": "തീയതി",
  "table.type": "തരം",
  "table.cost": "ചെലവ്",
  "inputs.recordTitle": "നിങ്ങളുടെ പൂർണ്ണമായ വളം-മരുന്ന് രേഖ",
  "inputs.recordBody":
    "തോട്ടത്തിൽ ഇട്ട ഓരോ വളവും അടിച്ച ഓരോ മരുന്നും, തീയതിയും അളവും സഹിതം. ഒരു വാങ്ങുന്നയാളോ സർട്ടിഫിക്കറ്റ് നൽകുന്നവരോ ചോദിക്കുമ്പോൾ ഇത് ഉപകാരപ്പെടും.",
  "photos.videosCount": "വീഡിയോകൾ",
  "photos.photosCount": "ഫോട്ടോകൾ",
  "photos.downloadVideo": "വീഡിയോ ഡൗൺലോഡ് ചെയ്യുക",
  "messages.askAnything": "നിങ്ങളുടെ തോട്ടത്തെപ്പറ്റി {name}യോട് എന്തും ചോദിക്കാം. അടുത്ത തവണ അഡ്മിൻ തുറക്കുമ്പോൾ അദ്ദേഹം കാണും.",
  "messages.placeholderAsk": "അടുത്ത റൗണ്ട്, ചെലവ്, എന്തും ചോദിക്കൂ…",
  "messages.noMessagesYet": "ഇതുവരെ സന്ദേശങ്ങളില്ല",
  "messages.yourMessage": "നിങ്ങളുടെ സന്ദേശം",
  "profile.estates": "തോട്ടങ്ങൾ",
  "profile.changeInSettings": "ഇവ ക്രമീകരണങ്ങളിൽ മാറ്റാം.",
  "profile.forAnythingElse": "മറ്റെന്തിനും ജിന്റോയ്ക്ക് സന്ദേശം അയയ്ക്കൂ, അദ്ദേഹം അപ്ഡേറ്റ് ചെയ്യും.",
  "settings.newHint": "ഓർത്തിരിക്കാൻ പറ്റുന്ന ഒന്ന്",
  "settings.typeAgain": "ഒന്നുകൂടി ടൈപ്പ് ചെയ്യുക",
  "settings.howWeReach": "ഞങ്ങൾ എങ്ങനെ ബന്ധപ്പെടും",
  "settings.keepCurrent": "ഇത് കൃത്യമായി സൂക്ഷിക്കുക — നിങ്ങളുടെ തോട്ട രേഖകൾ ഇവിടേക്കാണ് അയയ്ക്കുന്നത്.",

  "profile.changeYourselfIn": "നിങ്ങളുടെ ഫോൺ, വാട്‌സ്ആപ്പ്, വിലാസം എന്നിവ സ്വയം മാറ്റാം —",
  "profile.settingsLink": "ക്രമീകരണങ്ങൾ",
  "profile.messageJintoForRest": ". മറ്റെന്തിനും ജിന്റോയ്ക്ക് സന്ദേശം അയയ്ക്കൂ, അദ്ദേഹം അപ്ഡേറ്റ് ചെയ്യും.",

  "settings.atLeast8": "കുറഞ്ഞത് 8 അക്ഷരം. സങ്കീർണ്ണമായതിനെക്കാൾ നിങ്ങൾ ഓർത്തിരിക്കുന്നതാണ് നല്ലത്.",
  "settings.keepCurrentBody": "ഇത് കൃത്യമായി സൂക്ഷിച്ചാൽ തോട്ടത്തെപ്പറ്റിയുള്ള ഒരു സന്ദേശവും നഷ്ടപ്പെടില്ല.",
  "settings.saveLabel": "സേവ് ചെയ്യുക",
  "settings.whatsapp": "വാട്‌സ്ആപ്പ്",

  "video.cannotPlay": "ഈ വീഡിയോ ബ്രൗസറിൽ പ്ലേ ചെയ്യാൻ കഴിയില്ല.",
  "nav.yourProfile": "നിങ്ങളുടെ പ്രൊഫൈൽ",
  "photos.removeYours": "ഇത് നീക്കം — നിങ്ങൾ ചേർത്തതാണ്",
  "photos.confirmRemove": "{name} നീക്കണോ? ഇത് തിരികെ എടുക്കാനാകില്ല.",
  "video.download": "വീഡിയോ ഡൗൺലോഡ് ചെയ്യുക",
  "messages.urgentRing": "അത്യാവശ്യമാണോ? {name}യെ വിളിക്കൂ",
  "harvest.driedLabel": "ഉണങ്ങിയത്",
  "harvest.rateLabel": "വില",

  "profile.workers": "പണിക്കാർ",
  "settings.emailFixed": "ഇതുപയോഗിച്ചാണ് നിങ്ങൾ സൈൻ ഇൻ ചെയ്യുന്നത്. മാറ്റാൻ ജിന്റോയെ വിളിക്കുക — ആരും നിങ്ങളുടെ അക്കൗണ്ട് മറ്റൊരു വിലാസത്തിലേക്ക് മാറ്റാതിരിക്കാൻ ഞങ്ങൾ അത് നേരിട്ടാണ് ചെയ്യുന്നത്.",
  "messages.doNotRing": ". ഇവിടത്തെ സന്ദേശങ്ങൾ അദ്ദേഹത്തിന്റെ ഫോൺ അടിക്കില്ല.",

  /* --- dates -------------------------------------------------------------- */
  "date.today": "ഇന്ന്",
  "date.yesterday": "ഇന്നലെ",
  "date.daysAgo": "{days} ദിവസം മുൻപ്",
  "date.oneMonthAgo": "ഒരു മാസം മുൻപ്",
  "date.monthsAgo": "{months} മാസം മുൻപ്",

  /* --- shared ------------------------------------------------------------ */
  "common.kg": "കിലോ",
  "common.loading": "ലോഡ് ചെയ്യുന്നു…",
  "common.back": "തിരികെ",
  "common.close": "അടയ്ക്കുക",
};

/**
 * True while nobody has confirmed the draft above.
 *
 * Read by the admin screen to show the banner, and by nothing else — a grower
 * is never told their language is provisional, because that is a message about
 * how the software was built rather than about their estate.
 */
export const ML_IS_DRAFT = true;
