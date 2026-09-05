/**
 * Every string the grower's portal shows, in English.
 *
 * This file is the source of truth in two senses. It is the text that ships,
 * and it is the *shape*: the Malayalam file is typed against these keys, so a
 * missing translation is a compile error rather than a blank label discovered
 * by a grower.
 *
 * Only the portal is here. The public marketing pages are read mostly by
 * buyers, who read English; the growers are the people who may read only
 * Malayalam, and the portal is what they sign into. Widening this later is
 * adding keys, not changing the mechanism.
 *
 * Keep the keys descriptive rather than terse — `nav.harvest`, not `n7`. They
 * are read by whoever reviews the Malayalam beside them, and a key that says
 * what it is saves a round trip asking where a sentence appears.
 */
export const en = {
  /* --- navigation ------------------------------------------------------- */
  "nav.home": "Home",
  "nav.work": "Work",
  "nav.photos": "Photos",
  "nav.money": "Money",
  "nav.harvest": "Harvest",
  "nav.inputs": "Input log",
  "nav.documents": "Documents",
  "nav.messages": "Messages",
  "nav.yourData": "Your data",
  "nav.profile": "Profile",
  "nav.settings": "Settings",
  "nav.signOut": "Sign out",

  /* --- the home screen --------------------------------------------------- */
  "home.cardamomDried": "Cardamom dried",
  "home.thisSeason": "this season",
  "home.saleValue": "Sale value",
  "home.fromHarvests": "from harvests logged",
  "home.spentOnEstate": "Spent on estate",
  "home.labour": "labour",
  "home.inputs": "inputs",
  "home.lastVisit": "Last visit",
  "home.jobsRecorded": "jobs recorded",
  "home.yourEstates": "Your estates",
  "home.viewWork": "View work",
  "home.acres": "acres",
  "home.plants": "plants",
  "home.recentWork": "Recent work",
  "home.seeAll": "See all",
  "home.noWorkYet": "Nothing recorded yet",
  "home.noWorkYetBody":
    "When Jinto visits your estate, the work he does will appear here with photos.",
  "home.somethingToAsk": "Something to ask?",
  "home.messageOnWhatsapp": "Message Jinto directly on WhatsApp.",
  "home.whatsapp": "WhatsApp",
  "home.greeting": "Your estate",
  "home.totalSpend": "Spent so far",
  "home.driedTotal": "Dried so far",
  "home.saleTotal": "Sale value",
  "home.roundsLogged": "Visits logged",
  "home.callJinto": "Call Jinto",

  /* --- the picking round board -------------------------------------------- */
  "rounds.title": "Rounds due",
  "rounds.allOnSchedule": "all on schedule",
  "rounds.cadence": "Picking returns about every 45 days",
  "rounds.nextPickingIn": "Next picking in",
  "rounds.days": "days",
  "rounds.due": "due",
  "rounds.noHarvestYet": "No harvest logged yet",
  "rounds.noHistory": "No history",
  "rounds.overdue": "overdue",
  "rounds.harvest": "Harvest",
  "rounds.fertilizer": "Fertilizer",
  "rounds.spray": "Spray",
  "rounds.nextPickingInDays": "Next picking in {days} days",
  "rounds.nextPickingTomorrow": "Next picking tomorrow",
  "rounds.nextPickingToday": "Next picking due today",
  "rounds.pickingOverdueDays": "Picking {days} days overdue",
  "rounds.pickingOverdueDay": "Picking {days} day overdue",
  "rounds.needAttention": "{count} need attention",
  "rounds.noEstatesYet": "No estates with harvest history yet.",
  "rounds.stagePicking": "Picking",
  "rounds.stageFertilizer": "Fertilizer",
  "rounds.stageSpray": "Spray",
  "rounds.statusOverdue": "Overdue",
  "rounds.statusDueNow": "Due now",

  /* --- the work log ------------------------------------------------------ */
  "work.title": "Work log",
  "work.allWork": "All work",
  "work.allBlocks": "All blocks",
  "work.noneYet": "No work logged yet",
  "work.noneYetBody": "Every visit to your estate will be recorded here.",
  "work.photos": "photos",
  "work.inputs": "inputs",
  "work.on": "on",

  /* --- one visit --------------------------------------------------------- */
  "visit.back": "Work log",
  "visit.recordedBy": "Recorded by",
  "visit.notes": "Notes",
  "visit.whoWorked": "Who worked",
  "visit.inputsApplied": "What was applied",
  "visit.harvestRecord": "Harvest record",
  "visit.greenWeight": "Green weight",
  "visit.afterCuring": "After curing",
  "visit.rate": "Rate",
  "visit.saleValue": "Sale value",
  "visit.gradedInto": "Graded into",
  "visit.grade": "Grade",
  "visit.cost": "Cost",
  "visit.labour": "Labour",
  "visit.materials": "Materials",
  "visit.other": "Other",
  "visit.total": "Total",

  /* --- money ------------------------------------------------------------- */
  "money.title": "What it cost",
  "money.subtitle": "Every rupee spent on your estate, by month.",
  "money.labour": "Labour",
  "money.materials": "Inputs",
  "money.other": "Other",
  "money.total": "Total",
  "money.income": "Sale value",
  "money.noneYet": "No costs recorded yet",

  /* --- harvest ----------------------------------------------------------- */
  "harvest.title": "Harvest",
  "harvest.subtitle": "Every picking round, with what it made.",
  "harvest.green": "Green",
  "harvest.dried": "Dried",
  "harvest.rate": "Rate",
  "harvest.value": "Value",
  "harvest.noneYet": "No harvest recorded yet",
  "harvest.noneYetBody":
    "Each picking round will show here with weights, grade and what it fetched.",
  "harvest.driedTotal": "Dried total",
  "harvest.greenPicked": "Green picked",
  "harvest.averageRate": "Average rate",
  "harvest.perKgDried": "per kg dried",
  "harvest.pickingRounds": "Picking rounds",
  "harvest.seasonTotal": "Season total",

  /* --- photos and documents ---------------------------------------------- */
  "photos.title": "Photos & videos",
  "photos.videos": "Videos",
  "photos.photos": "Photos",
  "photos.noneYet": "No photos yet",
  "photos.noneYetBody":
    "Photos from every visit to your estate will collect here.",
  "photos.add": "Add a photo or video",
  "docs.title": "Documents",
  "docs.noneYet": "No documents yet",
  "docs.noneYetBody":
    "Lab reports, auction slips, invoices and certificates will be filed here.",
  "docs.add": "Add a document",

  /* --- uploading --------------------------------------------------------- */
  "upload.chooseFiles": "Photos or video from your estate",
  "upload.chooseDoc": "A lab report, auction slip, bill or certificate",
  "upload.caption": "A note about it (optional)",
  "upload.captionHint": "Where it was taken, or what it shows",
  "upload.whatIsIt": "What is it?",
  "upload.send": "Upload",
  "upload.sending": "Sending…",
  "upload.cancel": "Cancel",
  "upload.added": "Added.",
  "upload.oneAtATime":
    "Sent one at a time, so a slow connection does not lose the lot.",

  /* --- messages ---------------------------------------------------------- */
  "messages.title": "Messages",
  "messages.placeholder": "Your message",
  "messages.send": "Send",
  "messages.noneYet": "Nothing said yet",
  "messages.noneYetBody": "Write to Jinto here and he will see it.",
  "messages.notInstant":
    "This does not reach his phone on its own — ring or WhatsApp if it cannot wait.",

  /* --- profile and settings ---------------------------------------------- */
  "profile.title": "Your details",
  "profile.estate": "Estate",
  "profile.phone": "Phone",
  "profile.village": "Village",
  "settings.title": "Settings",
  "settings.subtitle": "Your password, and how we reach you.",
  "settings.changePassword": "Change your password",
  "settings.current": "Current password",
  "settings.new": "New password",
  "settings.confirm": "Confirm new password",
  "settings.save": "Change password",
  "settings.language": "Language",
  "settings.languageHint": "The portal will be shown in this language.",
  "settings.english": "English",
  "settings.malayalam": "മലയാളം",

  /* --- catalogue labels ---------------------------------------------------
     These are the words on every badge and every category chip. They live in
     src/lib/constants.ts as the canonical keys; these are how they are read. */
  "activityType.FERTILIZER": "Fertilizer",
  "activityType.SPRAYING": "Spraying",
  "activityType.WEEDING": "Weeding",
  "activityType.IRRIGATION": "Irrigation",
  "activityType.MULCHING": "Mulching",
  "activityType.SHADE": "Shade regulation",
  "activityType.HARVEST": "Harvest",
  "activityType.CURING": "Curing & drying",
  "activityType.PLANTING": "Planting / gap filling",
  "activityType.INSPECTION": "Inspection",
  "activityType.OTHER": "Other work",

  "materialCategory.FERTILIZER": "Fertilizer",
  "materialCategory.PESTICIDE": "Pesticide",
  "materialCategory.FUNGICIDE": "Fungicide",
  "materialCategory.GROWTH": "Growth promoter",
  "materialCategory.OTHER": "Other",

  "docCategory.LAB_REPORT": "Lab / residue report",
  "docCategory.AUCTION": "Auction slip",
  "docCategory.INVOICE": "Invoice / bill",
  "docCategory.LICENCE": "Licence / certificate",
  "docCategory.OTHER": "Other",

  "card.dried": "dried",

  /* --- money page ---------------------------------------------------------- */
  "money.noneYetBody": "Every rupee spent on your estate will be listed here.",
  "money.totalSpent": "Total spent",
  "money.inputsAndMaterials": "Inputs & materials",
  "money.fromHarvests": "from harvests",
  "money.monthByMonth": "Month by month",

  /* --- input log ------------------------------------------------------------ */
  "inputs.title": "Input log",
  "inputs.noneYet": "No inputs recorded yet",
  "inputs.noneYetBody": "Fertilizer and spray applied on your estate will be listed here.",
  "inputs.input": "Input",
  "inputs.quantity": "Quantity",
  "inputs.estate": "Estate",

  /* --- work log filters ----------------------------------------------------- */
  "work.noneUnderFilter": "No work under this filter",
  "work.tryAnother": "Try a different type of work, or view everything.",

  /* --- profile -------------------------------------------------------------- */
  "profile.name": "Name",
  "profile.clientCode": "Client code",
  "profile.email": "Email",
  "profile.address": "Address",
  "profile.withUsSince": "With us since",
  "profile.getInTouch": "Get in touch",

  /* --- your data ------------------------------------------------------------ */
  "data.title": "Your data",
  "data.whatWeHold": "What we hold",

  /* --- filters, tables and the rest of the portal chrome ------------------- */
  "filter.allWork": "All work",
  "filter.allEstates": "All estates",
  "table.date": "Date",
  "table.type": "Type",
  "table.cost": "Cost",
  "inputs.recordTitle": "Your complete input record",
  "inputs.recordBody":
    "Every fertilizer and spray applied to your estate, with the date and quantity. Useful when a buyer or certifying body asks what has gone onto the crop.",
  "photos.videosCount": "Videos",
  "photos.photosCount": "Photos",
  "photos.downloadVideo": "Download the video",
  "messages.askAnything": "Anything you want to ask {name} about your estate. He sees it next time he opens the admin.",
  "messages.placeholderAsk": "Ask about the next round, a cost, anything…",
  "messages.noMessagesYet": "No messages yet",
  "messages.yourMessage": "Your message",
  "profile.estates": "Estates",
  "profile.changeInSettings": "You can change these in Settings.",
  "profile.forAnythingElse": "For anything else, message Jinto and he will update it.",
  "settings.newHint": "Something you will remember",
  "settings.typeAgain": "Type it again",
  "settings.howWeReach": "How we reach you",
  "settings.keepCurrent": "Keep this current — your estate records are sent here.",

  "profile.changeYourselfIn": "You can change your phone, WhatsApp and address yourself in",
  "profile.settingsLink": "Settings",
  "profile.messageJintoForRest": ". For anything else here, message Jinto and he will update it.",

  "settings.atLeast8": "At least 8 characters. Something you will remember matters more than something complicated.",
  "settings.keepCurrentBody": "Keep this current and you will not miss a message about your estate.",
  "settings.saveLabel": "Save",
  "settings.whatsapp": "WhatsApp",

  "video.cannotPlay": "This video cannot play in the browser.",
  "nav.yourProfile": "Your profile",
  "photos.removeYours": "Remove this — you added it",
  "photos.confirmRemove": "Remove {name}? This cannot be undone.",
  "video.download": "Download the video",
  "messages.urgentRing": "Urgent? Ring {name} on",
  "harvest.driedLabel": "Dried",
  "harvest.rateLabel": "Rate",

  "profile.workers": "Workers",
  "settings.emailFixed": "This is what you sign in with. Ring Jinto to change it — we do that by hand so nobody can quietly move your account to a different address.",
  "messages.doNotRing": ". Messages here do not ring his phone.",

  /* --- dates -------------------------------------------------------------- */
  "date.today": "Today",
  "date.yesterday": "Yesterday",
  "date.daysAgo": "{days} days ago",
  "date.oneMonthAgo": "1 month ago",
  "date.monthsAgo": "{months} months ago",

  /* --- shared ------------------------------------------------------------ */
  "common.kg": "kg",
  "common.loading": "Loading…",
  "common.back": "Back",
  "common.close": "Close",
} as const;

export type StringKey = keyof typeof en;
