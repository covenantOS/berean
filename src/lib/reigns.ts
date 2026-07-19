/**
 * Prophets, priests, regents, and judges: chronological tables of Israel's
 * rulers and the voices sent to them, hand-built for the Tools pane. Each
 * row carries its years, one honest line of note, and a key reference
 * deep-linked into the reader.
 *
 * Chronology: the kings' dates follow Ussher, the same chronology the
 * Timeline pane renders (data/timeline/events.json), so the two agree:
 * Saul 1095, David 1055, Solomon 1015, the division 975, Samaria's fall
 * 721, Jerusalem's fall 588. Thiele's scheme, the other common one, runs
 * about forty years later for the early divided kingdom. The judges' years
 * are approximate ranges: the book's oppressions and rests plausibly
 * overlap, and the sum does not sit easily beside the 480 years of
 * 1 Kings 6:1, a dispute the table acknowledges rather than settles. The
 * prophets' dates are the usual conservative ranges; Joel's and Obadiah's
 * are the most uncertain, and are placed early here. The high priests are
 * listed only where Scripture names the succession.
 *
 * Sources: Ussher's Annals of the World for the regnal dates (public
 * domain; rights id "ussher-chronology"); the reign formulas of Kings and
 * Chronicles for the regnal lengths (e.g. 1 Kings 15:9-10, 2 Kings 15:33);
 * the books' own superscriptions for the prophets' spheres (Isaiah 1:1,
 * Hosea 1:1, Jeremiah 1:1-3); the New Bible Dictionary and ISBE for the
 * contested dates.
 */

export interface ReignRef {
  book: string;
  chapter: number;
  /** The display label, verse included, e.g. "1 Kings 12:16". */
  label: string;
}

export interface ReignRow {
  name: string;
  /** Reign or service years; "~" marks the approximate ones. */
  years: string;
  note: string;
  ref?: ReignRef;
}

export interface ReignTable {
  id: string;
  label: string;
  /** The table's dating caveat, rendered beneath it. */
  note: string;
  rows: ReignRow[];
}

export const REIGN_TABLES: ReignTable[] = [
  {
    id: "united",
    label: "United Kingdom",
    note: "Dates follow Ussher's chronology, the same the Timeline pane uses.",
    rows: [
      {
        name: "Saul",
        years: "1095–1055 BC",
        note: "Israel's ask for a king; disobeyed at Gilgal and Amalek, fell on Gilboa.",
        ref: { book: "1-samuel", chapter: 15, label: "1 Samuel 15:22" },
      },
      {
        name: "David",
        years: "1055–1015 BC",
        note: "The man after God's heart; the covenant of an everlasting throne.",
        ref: { book: "2-samuel", chapter: 7, label: "2 Samuel 7:16" },
      },
      {
        name: "Solomon",
        years: "1015–975 BC",
        note: "Wisdom, glory, and the temple; many wives turned his heart, and the kingdom tore.",
        ref: { book: "1-kings", chapter: 8, label: "1 Kings 8:22" },
      },
    ],
  },
  {
    id: "judah",
    label: "Kings of Judah",
    note: "Dates follow Ussher's chronology; Thiele's dates run about forty years later for the early rows.",
    rows: [
      {
        name: "Rehoboam",
        years: "975–958 BC",
        note: "Forsook the elders' counsel; the kingdom split under him.",
        ref: { book: "1-kings", chapter: 12, label: "1 Kings 12:16" },
      },
      {
        name: "Abijam",
        years: "958–955 BC",
        note: "Walked in his father's sins, yet for David's sake the lamp stayed.",
        ref: { book: "1-kings", chapter: 15, label: "1 Kings 15:4" },
      },
      {
        name: "Asa",
        years: "955–914 BC",
        note: "A heart whole with the LORD; took away the idols and prayed against the million.",
        ref: { book: "1-kings", chapter: 15, label: "1 Kings 15:14" },
      },
      {
        name: "Jehoshaphat",
        years: "914–889 BC",
        note: "Sent teachers of the law through Judah; stood still and saw the battle won.",
        ref: { book: "2-chronicles", chapter: 17, label: "2 Chronicles 17:9" },
      },
      {
        name: "Jehoram",
        years: "889–885 BC",
        note: "Married Ahab's daughter and walked in Ahab's way; Elijah's letter told his end.",
        ref: { book: "2-kings", chapter: 8, label: "2 Kings 8:18" },
      },
      {
        name: "Ahaziah",
        years: "885 BC",
        note: "One year in Athaliah's counsel; fell with Joram at Jehu's rising.",
        ref: { book: "2-kings", chapter: 9, label: "2 Kings 9:27" },
      },
      {
        name: "Athaliah",
        years: "884–878 BC",
        note: "Ahab's daughter, the only queen; destroyed the seed royal save one hidden child.",
        ref: { book: "2-kings", chapter: 11, label: "2 Kings 11:1" },
      },
      {
        name: "Joash",
        years: "878–838 BC",
        note: "Seven years hidden in the temple; repaired it, then bowed after Jehoiada died.",
        ref: { book: "2-kings", chapter: 12, label: "2 Kings 12:2" },
      },
      {
        name: "Amaziah",
        years: "838–809 BC",
        note: "Did right, not with a whole heart; proud after Edom, beaten by Jehoash.",
        ref: { book: "2-kings", chapter: 14, label: "2 Kings 14:3" },
      },
      {
        name: "Uzziah",
        years: "809–757 BC",
        note: "Sought God and prospered; the censer he seized brought leprosy.",
        ref: { book: "2-chronicles", chapter: 26, label: "2 Chronicles 26:16" },
      },
      {
        name: "Jotham",
        years: "757–741 BC",
        note: "Did right and grew mighty, while the people still did corruptly.",
        ref: { book: "2-chronicles", chapter: 27, label: "2 Chronicles 27:6" },
      },
      {
        name: "Ahaz",
        years: "741–725 BC",
        note: "Shut the temple doors and sacrificed to the gods that struck him.",
        ref: { book: "2-kings", chapter: 16, label: "2 Kings 16:2" },
      },
      {
        name: "Hezekiah",
        years: "725–696 BC",
        note: "Trusted the LORD like none before or after; prayed, and Sennacherib's host fell.",
        ref: { book: "2-kings", chapter: 18, label: "2 Kings 18:5" },
      },
      {
        name: "Manasseh",
        years: "696–641 BC",
        note: "The longest reign and the worst sins; humbled in Babylon, he prayed and was heard.",
        ref: { book: "2-chronicles", chapter: 33, label: "2 Chronicles 33:12" },
      },
      {
        name: "Amon",
        years: "641–639 BC",
        note: "Sinned as his father had and did not humble himself; his servants slew him.",
        ref: { book: "2-kings", chapter: 21, label: "2 Kings 21:21" },
      },
      {
        name: "Josiah",
        years: "641–609 BC",
        note: "Turned to the LORD with all his heart; the found book, the kept Passover.",
        ref: { book: "2-kings", chapter: 22, label: "2 Kings 22:2" },
      },
      {
        name: "Jehoahaz",
        years: "609 BC",
        note: "Three months on the throne; Pharaoh carried him to Egypt.",
        ref: { book: "2-kings", chapter: 23, label: "2 Kings 23:33" },
      },
      {
        name: "Jehoiakim",
        years: "609–598 BC",
        note: "Cut and burned Jeremiah's scroll; died under Babylon's hand.",
        ref: { book: "jeremiah", chapter: 36, label: "Jeremiah 36:23" },
      },
      {
        name: "Jehoiachin",
        years: "598 BC",
        note: "Three months, then Babylon; lifted up there in the thirty-seventh year.",
        ref: { book: "2-kings", chapter: 24, label: "2 Kings 24:12" },
      },
      {
        name: "Zedekiah",
        years: "598–588 BC",
        note: "The last king; saw his sons slain, then blinded and bound for Babylon.",
        ref: { book: "2-kings", chapter: 25, label: "2 Kings 25:7" },
      },
    ],
  },
  {
    id: "israel",
    label: "Kings of Israel",
    note: "Dates follow Ussher's chronology; every king of the north kept the calves of Bethel and Dan.",
    rows: [
      {
        name: "Jeroboam I",
        years: "975–954 BC",
        note: "Made Israel sin: the golden calves at Bethel and Dan.",
        ref: { book: "1-kings", chapter: 12, label: "1 Kings 12:28" },
      },
      {
        name: "Nadab",
        years: "954–953 BC",
        note: "Two years in his father's way; Baasha slew him at Gibbethon.",
        ref: { book: "1-kings", chapter: 15, label: "1 Kings 15:27" },
      },
      {
        name: "Baasha",
        years: "953–930 BC",
        note: "Struck the house of Jeroboam, then walked in the same way.",
        ref: { book: "1-kings", chapter: 15, label: "1 Kings 15:34" },
      },
      {
        name: "Elah",
        years: "930–929 BC",
        note: "Drank himself drunk; Zimri killed him in his steward's house.",
        ref: { book: "1-kings", chapter: 16, label: "1 Kings 16:10" },
      },
      {
        name: "Zimri",
        years: "929 BC",
        note: "Seven days; burned the king's house down over himself.",
        ref: { book: "1-kings", chapter: 16, label: "1 Kings 16:18" },
      },
      {
        name: "Omri",
        years: "929–918 BC",
        note: "Out-sinned all before him; bought the hill and built Samaria.",
        ref: { book: "1-kings", chapter: 16, label: "1 Kings 16:24" },
      },
      {
        name: "Ahab",
        years: "918–897 BC",
        note: "Married Jezebel and sold himself to work evil; Naboth's vineyard answered at Jezreel.",
        ref: { book: "1-kings", chapter: 21, label: "1 Kings 21:19" },
      },
      {
        name: "Ahaziah",
        years: "897–895 BC",
        note: "Sent to Baal-zebub for his sickness; Elijah answered with fire.",
        ref: { book: "2-kings", chapter: 1, label: "2 Kings 1:4" },
      },
      {
        name: "Joram",
        years: "895–884 BC",
        note: "Put away Baal's pillar but kept the calves; Jehu's arrow found him in Naboth's field.",
        ref: { book: "2-kings", chapter: 9, label: "2 Kings 9:24" },
      },
      {
        name: "Jehu",
        years: "884–856 BC",
        note: "Destroyed Baal's house and Ahab's, and kept the golden calves.",
        ref: { book: "2-kings", chapter: 10, label: "2 Kings 10:29" },
      },
      {
        name: "Jehoahaz",
        years: "856–839 BC",
        note: "Sought the LORD under Syria's hand and was heard; the calves stayed.",
        ref: { book: "2-kings", chapter: 13, label: "2 Kings 13:4" },
      },
      {
        name: "Jehoash",
        years: "839–825 BC",
        note: "Wept over dying Elisha; struck the ground three times and beat Syria thrice.",
        ref: { book: "2-kings", chapter: 13, label: "2 Kings 13:19" },
      },
      {
        name: "Jeroboam II",
        years: "825–784 BC",
        note: "Restored Israel's borders as Jonah prophesied; the LORD saved, though the calves stayed.",
        ref: { book: "2-kings", chapter: 14, label: "2 Kings 14:25" },
      },
      {
        name: "Zechariah",
        years: "784 BC",
        note: "Six months; Shallum struck him down before the people.",
        ref: { book: "2-kings", chapter: 15, label: "2 Kings 15:10" },
      },
      {
        name: "Shallum",
        years: "784 BC",
        note: "One month; Menahem came up from Tirzah and slew him.",
        ref: { book: "2-kings", chapter: 15, label: "2 Kings 15:14" },
      },
      {
        name: "Menahem",
        years: "784–773 BC",
        note: "Ten years of cruelty; paid Pul a thousand talents to steady his throne.",
        ref: { book: "2-kings", chapter: 15, label: "2 Kings 15:19" },
      },
      {
        name: "Pekahiah",
        years: "773–759 BC",
        note: "Two years; Pekah his captain conspired and slew him.",
        ref: { book: "2-kings", chapter: 15, label: "2 Kings 15:25" },
      },
      {
        name: "Pekah",
        years: "759–739 BC",
        note: "Twenty years; Tiglath-pileser stripped Gilead and Galilee, and Hoshea slew him.",
        ref: { book: "2-kings", chapter: 15, label: "2 Kings 15:29" },
      },
      {
        name: "Hoshea",
        years: "739–721 BC",
        note: "The last king; conspired with Egypt, and Assyria carried Israel away.",
        ref: { book: "2-kings", chapter: 17, label: "2 Kings 17:6" },
      },
    ],
  },
  {
    id: "judges",
    label: "Judges",
    note: "Approximate ranges; the book's oppressions and rests plausibly overlap, and chronologies differ.",
    rows: [
      {
        name: "Othniel",
        years: "~1375–1335 BC",
        note: "Caleb's nephew; broke Cushan's eight years, and the land rested forty.",
        ref: { book: "judges", chapter: 3, label: "Judges 3:9" },
      },
      {
        name: "Ehud",
        years: "~1330–1250 BC",
        note: "The left-handed man; Eglon fell to his cubit blade, and the land rested eighty years.",
        ref: { book: "judges", chapter: 3, label: "Judges 3:21" },
      },
      {
        name: "Deborah and Barak",
        years: "~1250–1210 BC",
        note: "A prophetess under the palm and a reluctant captain; Sisera's iron broke at Kishon.",
        ref: { book: "judges", chapter: 4, label: "Judges 4:4" },
      },
      {
        name: "Gideon",
        years: "~1210–1170 BC",
        note: "Threshing in secret to leading three hundred; Midian broke at the trumpets.",
        ref: { book: "judges", chapter: 7, label: "Judges 7:7" },
      },
      {
        name: "Tola",
        years: "~1170–1147 BC",
        note: "Of Issachar, judging from Shamir; twenty-three years, and little else told.",
        ref: { book: "judges", chapter: 10, label: "Judges 10:1" },
      },
      {
        name: "Jair",
        years: "~1147–1125 BC",
        note: "The Gileadite; thirty sons on thirty colts in thirty cities.",
        ref: { book: "judges", chapter: 10, label: "Judges 10:3" },
      },
      {
        name: "Jephthah",
        years: "~1120–1114 BC",
        note: "The outcast called back; Ammon fell, and the vow cost his daughter.",
        ref: { book: "judges", chapter: 11, label: "Judges 11:33" },
      },
      {
        name: "Ibzan",
        years: "~1114–1107 BC",
        note: "Of Bethlehem; thirty sons and thirty daughters sent out, thirty brought in.",
        ref: { book: "judges", chapter: 12, label: "Judges 12:8" },
      },
      {
        name: "Elon",
        years: "~1107–1097 BC",
        note: "The Zebulonite; ten years, and a burial at Aijalon.",
        ref: { book: "judges", chapter: 12, label: "Judges 12:11" },
      },
      {
        name: "Abdon",
        years: "~1097–1089 BC",
        note: "The Pirathonite; forty sons and thirty grandsons on seventy colts.",
        ref: { book: "judges", chapter: 12, label: "Judges 12:13" },
      },
      {
        name: "Samson",
        years: "~1120–1100 BC",
        note: "The Nazirite of Dan against the Philistines; his years likely overlap the others.",
        ref: { book: "judges", chapter: 16, label: "Judges 16:30" },
      },
      {
        name: "Eli",
        years: "~1110–1070 BC",
        note: "Priest and judge forty years; his sons' sins brought the ark's capture.",
        ref: { book: "1-samuel", chapter: 4, label: "1 Samuel 4:18" },
      },
      {
        name: "Samuel",
        years: "~1070–1050 BC",
        note: "The last judge; circuit rider, kingmaker, and the voice Israel asked a king against.",
        ref: { book: "1-samuel", chapter: 7, label: "1 Samuel 7:15" },
      },
    ],
  },
  {
    id: "prophets",
    label: "Prophets",
    note: "Usual conservative ranges; Joel's and Obadiah's dates are the most uncertain, placed early here.",
    rows: [
      {
        name: "Elijah",
        years: "~875–845 BC",
        note: "The Tishbite against Ahab's Baal; fire on Carmel, and the whirlwind's chariot.",
        ref: { book: "1-kings", chapter: 17, label: "1 Kings 17:1" },
      },
      {
        name: "Elisha",
        years: "~855–800 BC",
        note: "Elijah's double portion; Naaman healed, the widow's oil, dead bones raised at his grave.",
        ref: { book: "2-kings", chapter: 2, label: "2 Kings 2:9" },
      },
      {
        name: "Obadiah",
        years: "~840 BC",
        note: "Against Edom for the day of Jerusalem's fall; the Old Testament's shortest book.",
        ref: { book: "obadiah", chapter: 1, label: "Obadiah 1:15" },
      },
      {
        name: "Joel",
        years: "~830 BC",
        note: "The locust plague and the day of the LORD; the Spirit poured out, quoted at Pentecost.",
        ref: { book: "joel", chapter: 2, label: "Joel 2:28" },
      },
      {
        name: "Jonah",
        years: "~780 BC",
        note: "Sent to Nineveh and fled to Tarshish; the great fish, and a city on its knees.",
        ref: { book: "jonah", chapter: 1, label: "Jonah 1:1" },
      },
      {
        name: "Amos",
        years: "~760–750 BC",
        note: "A herdsman of Tekoa sent north: let justice roll down like waters.",
        ref: { book: "amos", chapter: 1, label: "Amos 1:1" },
      },
      {
        name: "Hosea",
        years: "~750–715 BC",
        note: "Married Gomer and lived Israel's unfaithfulness; love that will not let go.",
        ref: { book: "hosea", chapter: 1, label: "Hosea 1:2" },
      },
      {
        name: "Isaiah",
        years: "~740–680 BC",
        note: "Court prophet of Judah under four kings; the evangelical prophet, Holy, Holy, Holy.",
        ref: { book: "isaiah", chapter: 6, label: "Isaiah 6:3" },
      },
      {
        name: "Micah",
        years: "~735–700 BC",
        note: "Moresheth's voice to both kingdoms: justice, mercy, and Bethlehem named.",
        ref: { book: "micah", chapter: 6, label: "Micah 6:8" },
      },
      {
        name: "Nahum",
        years: "~650–630 BC",
        note: "Nineveh's doom a century after Jonah; slow to anger, and will not acquit.",
        ref: { book: "nahum", chapter: 1, label: "Nahum 1:3" },
      },
      {
        name: "Zephaniah",
        years: "~630–620 BC",
        note: "Hezekiah's line in Josiah's day; the day of the LORD near, and a singing God beyond it.",
        ref: { book: "zephaniah", chapter: 3, label: "Zephaniah 3:17" },
      },
      {
        name: "Jeremiah",
        years: "~627–580 BC",
        note: "The weeping prophet from Josiah to the fall; the new covenant written on hearts.",
        ref: { book: "jeremiah", chapter: 31, label: "Jeremiah 31:33" },
      },
      {
        name: "Habakkuk",
        years: "~615–605 BC",
        note: "Asked why, and heard: the just shall live by his faith.",
        ref: { book: "habakkuk", chapter: 2, label: "Habakkuk 2:4" },
      },
      {
        name: "Daniel",
        years: "~605–535 BC",
        note: "Exile in Babylon's court; the lions' den, the seventy weeks, the Ancient of Days.",
        ref: { book: "daniel", chapter: 6, label: "Daniel 6:22" },
      },
      {
        name: "Ezekiel",
        years: "~593–570 BC",
        note: "Priest among the exiles by Chebar; dry bones, and the glory's return.",
        ref: { book: "ezekiel", chapter: 37, label: "Ezekiel 37:5" },
      },
      {
        name: "Haggai",
        years: "520 BC",
        note: "Stirred Zerubbabel to finish the house: consider your ways.",
        ref: { book: "haggai", chapter: 1, label: "Haggai 1:7" },
      },
      {
        name: "Zechariah",
        years: "520–480 BC",
        note: "Built beside Haggai; the Branch, the pierced one, the king on a colt.",
        ref: { book: "zechariah", chapter: 9, label: "Zechariah 9:9" },
      },
      {
        name: "Malachi",
        years: "~430 BC",
        note: "The last word before the silence: the Sun of righteousness rises.",
        ref: { book: "malachi", chapter: 4, label: "Malachi 4:2" },
      },
    ],
  },
  {
    id: "priests",
    label: "High Priests",
    note: "Listed where Scripture names the succession; the gaps (Phinehas to Eli, Jeshua to the intertestamental house) stand unfilled.",
    rows: [
      {
        name: "Aaron",
        years: "from ~1495 BC",
        note: "Moses' brother, first of the line; the rod that budded.",
        ref: { book: "exodus", chapter: 28, label: "Exodus 28:1" },
      },
      {
        name: "Eleazar",
        years: "from ~1452 BC",
        note: "Aaron's son, clothed in the garments on Hor; divided the land beside Joshua.",
        ref: { book: "numbers", chapter: 20, label: "Numbers 20:28" },
      },
      {
        name: "Phinehas",
        years: "from ~1425 BC",
        note: "The zeal that stopped the plague; the covenant of an everlasting priesthood.",
        ref: { book: "numbers", chapter: 25, label: "Numbers 25:13" },
      },
      {
        name: "Eli",
        years: "~1110–1070 BC",
        note: "Priest at Shiloh and judge; the lamp went out in his house.",
        ref: { book: "1-samuel", chapter: 1, label: "1 Samuel 1:9" },
      },
      {
        name: "Zadok",
        years: "from ~1015 BC",
        note: "David's faithful priest; anointed Solomon, and his line keeps Ezekiel's temple.",
        ref: { book: "1-kings", chapter: 1, label: "1 Kings 1:39" },
      },
      {
        name: "Jehoiada",
        years: "~878–840 BC",
        note: "Hid Joash six years and crowned him at seven; tore Baal's house down.",
        ref: { book: "2-kings", chapter: 11, label: "2 Kings 11:17" },
      },
      {
        name: "Hilkiah",
        years: "~620s BC",
        note: "Found the book of the Law in Josiah's repairs and read it to the king.",
        ref: { book: "2-kings", chapter: 22, label: "2 Kings 22:8" },
      },
      {
        name: "Seraiah",
        years: "to 588 BC",
        note: "The last high priest of the first temple; slain at Riblah.",
        ref: { book: "2-kings", chapter: 25, label: "2 Kings 25:18" },
      },
      {
        name: "Joshua (Jeshua)",
        years: "from ~536 BC",
        note: "Returned with Zerubbabel; stood in filthy garments and heard the Branch named.",
        ref: { book: "zechariah", chapter: 3, label: "Zechariah 3:8" },
      },
    ],
  },
];
