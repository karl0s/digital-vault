import type { Show } from '../../App';

/**
 * The picture on each artist's tile in search results, picked by the owner
 * (2026-10-13) on ~/VaultShots/reports/artist-portraits.html, whose "Copy for
 * Claude Code" export is pasted in here. Keyed by the exact Artist string;
 * `show` is a ShowID and `slot` its image, 1–4; the comment names the show.
 * 109 of 304 artists picked (2026-10-13).
 *
 * An artist not listed here, or whose pick no longer exists (show deleted,
 * slot gone from the manifest), shows the newest show's slot 1.
 */
const ARTIST_PORTRAITS: Record<string, { show: string; slot: number }> = {
  '30 Seconds to Mars': { show: 'c7d5bd8f3f45', slot: 1 }, // 2010-06-05 · Rock am Ring
  'A Perfect Circle': { show: 'db91d096ef1b', slot: 1 }, // 2000-01-01 · Irving Plaza
  'Aerosmith': { show: '6bb690ecf0ba', slot: 1 }, // 1997-05-17 · Rock am Ring
  'Alanis Morissette': { show: '1b855d937789', slot: 1 }, // undated · Canada Day
  'Alice in Chains': { show: '8db5b79b6015', slot: 1 }, // 1996-04-10 · MTV Unplugged
  'Ash': { show: '5d92133f87bf', slot: 1 }, // 1999-01-23 · Big Day Out
  'Asian Dub Foundation': { show: '01836f9fcf8b', slot: 4 }, // 1998-08-01 · Reading Festival
  'Audioslave': { show: '7454c8b21d9a', slot: 1 }, // 2005-06-11 · Hurricane Festival
  'Audioweb': { show: '05996643f284', slot: 2 }, // 1998-08-01 · Reading Festival
  'Beastie Boys': { show: '413e7812dfcb', slot: 1 }, // 1998-06-20 · Loreley Open Air
  'Beatles': { show: '7ad98d471f85', slot: 1 }, // 1965-08-15 · Shea Stadium
  'Beck': { show: '0c349de0294e', slot: 1 }, // 1997-06-01 · Glastonbury Festival
  'Ben Harper': { show: '022f4c871291', slot: 1 }, // 1999-10-04 · Sessions at West 54th
  'Blind Melon': { show: '9214db1ffe8d', slot: 1 }, // 1993-11-10 · 2 Meter Sessions
  'Blink-182': { show: '556b972653f1', slot: 1 }, // 2000-01-26 · Big Day Out
  'Bluetones': { show: 'bd50aeedd39b', slot: 2 }, // 1998-08-01 · Reading Festival
  'Bush': { show: '483b9b972187', slot: 1 }, // 1997-08-24 · Reading Festival
  'Cars': { show: '0f63a29e8a15', slot: 3 }, // 1984-09-11 · The Summit
  'Cat Stevens': { show: '7691fb8e6362', slot: 1 }, // 1971-01-01 · BBC Television Centre
  'Chemical Brothers': { show: 'a3a87aceb63c', slot: 2 }, // 1997-06-01 · Glastonbury Festival
  'Chris Cornell': { show: '057d55697a19', slot: 1 }, // 2000-03-07 · House of Blues
  'Counting Crows': { show: '3c76fc1c3f0f', slot: 1 }, // 1997-10-06 · MTV Live from the 10 Spot
  'Creed': { show: '99d74640a4c6', slot: 1 }, // 1999-07-23 · Woodstock
  'Creedence Clearwater Revival': { show: '74b693f4c5d8', slot: 4 }, // 1970-04-14 · London, United Kingdom
  'Datsuns': { show: 'af5bfdacc652', slot: 1 }, // 2003-03-11 · Conan O'Brien
  'Deftones': { show: '70dabb713576', slot: 1 }, // 2000-11-14 · MusiquePlus
  'Dr. Dre': { show: 'd359ebcdd417', slot: 4 }, // 2000-06-01 · @The Experience Music Project
  'Drake': { show: 'f32bf75e01b0', slot: 3 }, // 2010-09-29 · New York, United States
  'Echobelly': { show: '6df95a0e367b', slot: 4 }, // 1996-07-21 · Phoenix Festival
  'Editors': { show: '6620c6ca576f', slot: 1 }, // 2008-07-05 · Rock Werchter
  'Eric Clapton': { show: '82f63234f573', slot: 4 }, // 1992-01-16 · MTV Unplugged
  'Erykah Badu': { show: '1a8295be165b', slot: 1 }, // 1997-01-01 · MTV Unplugged
  'Everclear': { show: '78c99bcde706', slot: 1 }, // 1999-07-23 · Woodstock
  'Faith No More': { show: '5276ff6ff344', slot: 1 }, // 1997-08-17 · Sziget Festival
  "Fat Freddy's Drop": { show: '12d30a2c8b99', slot: 3 }, // 2013-07-07 · Summerjam
  'Filter': { show: 'c8bc803d0924', slot: 1 }, // 1999-01-01 · MusiquePlus
  'Flight of the Conchords': { show: 'd4fcfb3bbaec', slot: 2 }, // 2005-01-01 · HBO One Night Stand
  'Foo Fighters': { show: '488c35986e53', slot: 1 }, // 2007-09-18 · Nissan Live Sets on Yahoo! Music
  'Franz Ferdinand': { show: '1a2eb2febd4c', slot: 1 }, // 2006-08-01 · Reading and Leeds Festival
  "Fun Lovin' Criminals": { show: '2408539ca72d', slot: 1 }, // 2008-06-27 · Glastonbury Festival
  'Garbage': { show: '9e3e0ae33db8', slot: 1 }, // 1998-08-01 · Reading Festival
  'Gomez': { show: 'cc4f1e4227b4', slot: 2 }, // 1999-06-25 · Glastonbury Festival
  'Green Day': { show: '678f382c44dd', slot: 1 }, // 1994-11-18 · Chicago, United States
  "Guns N' Roses": { show: '9876d0292d49', slot: 1 }, // 1988-02-02 · The Ritz
  'Hole': { show: '0dfc65fa15e8', slot: 3 }, // 1995-02-14 · MTV Unplugged
  'Incubus': { show: '0d37170a885a', slot: 1 }, // undated · Channel V
  'James': { show: '7d6374809c22', slot: 4 }, // 1997-08-22 · Reading Festival
  'Jamiroquai': { show: 'cb428e645237', slot: 1 }, // 1997-02-13 · London, United Kingdom
  "Jane's Addiction": { show: 'af0cf904cece', slot: 1 }, // 2002-07-26 · One Hot Day Festival
  'Jay-Z': { show: 'daeb3a95fe0d', slot: 1 }, // 2008-06-28 · Glastonbury Festival
  'Jeff Buckley': { show: '4c43c04e46ec', slot: 4 }, // undated · unknown
  'Joe Walsh': { show: 'bf24f4bd16a9', slot: 4 }, // 1973-08-17 · The Midnight Special
  'Killers': { show: 'e006c0fa4e1b', slot: 1 }, // 2005-06-24 · Glastonbury Festival
  'Kings of Leon': { show: '0d0905da4bf0', slot: 1 }, // 2008-07-04 · Roskilde Festival
  'Kiss': { show: '4b183293c441', slot: 2 }, // 1997-01-01 · Detroit, United States
  'Kooks': { show: 'c207d0b6d59b', slot: 4 }, // 2007-06-23 · Glastonbury Festival
  'Korn': { show: '77bf9aa7b1fd', slot: 1 }, // 1999-01-23 · Big Day Out
  'Led Zeppelin': { show: '9426334a848d', slot: 1 }, // 1979-08-11 · Knebworth Festival
  'Lenny Kravitz': { show: '57425a16cba2', slot: 1 }, // 1995-10-07 · Cologne, Germany
  'Limp Bizkit': { show: '2e8bb0740488', slot: 1 }, // 2001-01-01 · Rock im Park
  'Live': { show: 'fdedd28b08ad', slot: 4 }, // 1995-02-15 · MTV Unplugged
  'Macy Gray': { show: 'e2440d6d14cc', slot: 4 }, // 2003-06-01 · Glastonbury Festival
  'Manic Street Preachers': { show: '09341983a200', slot: 1 }, // 2003-06-01 · Glastonbury Festival
  'Marilyn Manson': { show: '87a9cbe74bbc', slot: 1 }, // 1997-05-02 · Copps Coliseum
  'Mars Volta': { show: 'a5b7693d20b2', slot: 4 }, // 2003-08-29 · Lowlands Festival
  'Millencolin': { show: '35ec81bc02ee', slot: 4 }, // 2008-08-29 · Area 4 Festival
  'Muse': { show: '19c022518f76', slot: 1 }, // 2004-08-21 · V Festival
  'Nickelback': { show: '700e97fd568d', slot: 3 }, // 2002-01-25 · Skyreach Centre
  'Offspring': { show: '9c0c6f6d123c', slot: 1 }, // 1999-07-23 · Woodstock
  'Opshop': { show: '563e83aafbd1', slot: 3 }, // undated · C4 Video Hits
  'Our Lady Peace': { show: 'e7cf6611c9a4', slot: 1 }, // 2000-08-05 · Rolling Rock Town Fair
  'Pearl Jam': { show: '9a2f19340c67', slot: 1 }, // 1992-03-16 · MTV Unplugged
  'Placebo': { show: '67f5fd83552f', slot: 1 }, // 2001-01-26 · Big Day Out
  'Police': { show: 'c0dee2ac575f', slot: 1 }, // 1980-01-11 · Rockpalast
  'Powderfinger': { show: '5dd71b77a04b', slot: 4 }, // 2007-08-18 · Triple J AWOL
  'Presidents of the USA': { show: 'cb90878735fa', slot: 4 }, // undated · United States
  'Primal Scream': { show: '931ddf61a032', slot: 4 }, // 2006-08-01 · Reading and Leeds Festival
  'Prodigy': { show: '3f300670c0bf', slot: 1 }, // 1996-07-18 · Phoenix Festival
  'Queens of the Stone Age': { show: '8e8d56e0a5f7', slot: 1 }, // 2001-08-18 · Bizarre Festival
  'R.E.M.': { show: '6a6269fdb11e', slot: 1 }, // 1998-11-02 · Rockpalast
  'Radiohead': { show: '87b69f8144b4', slot: 4 }, // 2001-06-09 · Jools Holland
  'Rage Against the Machine': { show: '07346400f7e5', slot: 1 }, // 1994-05-23 · Pinkpop
  'Rammstein': { show: '6104480eb763', slot: 4 }, // 2001-01-26 · Big Day Out
  'Red Hot Chili Peppers': { show: '225d1dee1f4c', slot: 1 }, // 1994-08-28 · Reading Festival
  'Rolling Stones': { show: '8afb2a6f8480', slot: 1 }, // undated · unknown
  'Scott Weiland': { show: 'f358adf36e19', slot: 4 }, // 2008-11-26 · Jimmy Kimmel
  'Sheryl Crow': { show: '4c048029be3c', slot: 4 }, // 1997-06-01 · Glastonbury Festival
  'Sia': { show: 'c10d89b9d5bc', slot: 4 }, // 2009-03-27 · MTV Australia Awards
  'Silverchair': { show: '61ace843b328', slot: 1 }, // 1997-02-04 · Much Music Intimate & Interactive
  'Smashing Pumpkins': { show: 'd21ee8a95dad', slot: 1 }, // 1997-06-01 · Glastonbury Festival
  'Snoop Dogg': { show: '8ae9a6c98740', slot: 4 }, // 2008-03-13 · VH1 Storytellers
  'Soul Asylum': { show: 'ba6db267355b', slot: 1 }, // 1993-03-01 · MTV Spring Break
  'Soundgarden': { show: '3d97ae42ed27', slot: 1 }, // 1996-09-20 · MTV Live & Loud
  'Stereophonics': { show: '934521a246c3', slot: 1 }, // 2008-07-11 · T in the Park
  'Stone Temple Pilots': { show: '7ba32801defb', slot: 1 }, // 1993-11-17 · MTV Unplugged
  'Strokes': { show: 'db6859f65c40', slot: 1 }, // 2005-11-27 · Top of the Pops
  'Suede': { show: '7ba871cb7f43', slot: 4 }, // 2003-06-01 · Glastonbury Festival
  'Supergrass': { show: 'c3524f56bb47', slot: 3 }, // 2004-06-27 · Glastonbury Festival
  'Them Crooked Vultures': { show: 'ee6e5a7e1480', slot: 1 }, // 2009-08-29 · Reading Festival
  'Third Eye Blind': { show: 'f38606f2d035', slot: 4 }, // 2000-01-01 · United States
  'Tom Petty': { show: 'd039fdfe37c7', slot: 1 }, // 1982-12-19 · Dortmund, Germany
  'Tool': { show: 'c0108f42ea7a', slot: 1 }, // 1993-08-29 · Lowlands Festival
  'Train': { show: '211520aa7ffc', slot: 1 }, // 2001-06-17 · VH1 Storytellers
  'Various Artists': { show: 'd249e3ea7485', slot: 1 }, // 2005-08-01 · Reading Festival
  'Velvet Revolver': { show: '937471fd8b54', slot: 1 }, // 2007-06-03 · Rock am Ring
  'Weezer': { show: 'a0907d3657a0', slot: 1 }, // 2001-06-16 · Hultsfredsfestivalen
  'White Stripes': { show: '149b5245f6b9', slot: 1 }, // 2005-06-24 · Glastonbury Festival
  'Wolfmother': { show: '24b7c85a58ff', slot: 1 }, // 2006-08-01 · Jay Leno
  'ZZ Top': { show: 'f0c80a7a53a2', slot: 1 }, // 1982-05-28 · Westfalenhalle
};

export interface Portrait {
  checksum: string;
  slot: number;
}

/**
 * Newest first by ShowDate, ties by ShowID; undated after, by ShowID. Kept
 * this simple on purpose: the picker page reproduces it to mark each
 * artist's default.
 */
function newestFirst(a: Show, b: Show): number {
  const ad = /^\d{4}/.test(a.ShowDate || '') ? a.ShowDate : '';
  const bd = /^\d{4}/.test(b.ShowDate || '') ? b.ShowDate : '';
  if (ad !== bd) {
    if (!ad) return 1;
    if (!bd) return -1;
    return bd.localeCompare(ad);
  }
  return a.ShowID.localeCompare(b.ShowID);
}

/**
 * Every artist's candidate portraits, best first: the owner's pick, then
 * slot 1 of each show, newest first. The tile shows the first one in the
 * image manifest, which is how a missing pick falls back. Built once per
 * catalogue, so each artist's list is the same array on every render.
 */
export function portraitsByArtist(shows: Show[]): Map<string, Portrait[]> {
  const byArtist = new Map<string, Show[]>();
  for (const show of shows) {
    if (!show.ChecksumSHA1) continue;
    const list = byArtist.get(show.Artist);
    if (list) list.push(show);
    else byArtist.set(show.Artist, [show]);
  }

  const byId = new Map(shows.map(s => [s.ShowID, s]));
  const out = new Map<string, Portrait[]>();
  for (const [artist, list] of byArtist) {
    const portraits = [...list].sort(newestFirst).map(s => ({ checksum: s.ChecksumSHA1!, slot: 1 }));
    const pick = ARTIST_PORTRAITS[artist];
    const picked = pick ? byId.get(pick.show) : undefined;
    if (picked?.ChecksumSHA1 && picked.Artist === artist) {
      portraits.unshift({ checksum: picked.ChecksumSHA1, slot: pick.slot });
    }
    out.set(artist, portraits);
  }
  return out;
}
